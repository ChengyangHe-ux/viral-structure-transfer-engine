import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateObject, generateText, type ModelMessage, type UserContent } from "ai";
import { z } from "zod";

import {
  migratedVideoPlanSchema,
  planVersionSchema,
  videoStructureAnalysisSchema,
  type MediaMeta,
  type MigratedVideoPlan,
  type VideoStructureAnalysis,
} from "@/lib/schemas";
import { raceWithTimeout, readTimeoutMs } from "@/lib/ai-timeout";
import {
  createFallbackAnalysis,
  createFallbackPlan,
  createRefinedFallbackPlan,
} from "@/lib/fallbacks";
import {
  attachEditingTechniquesToPlan,
  formatEditingTechniquesForPrompt,
  retrieveEditingTechniques,
} from "@/lib/editing-techniques";
import { attachPlanEvaluation } from "@/lib/evaluation";
import { attachMaterialAdaptation } from "@/lib/materials";
import {
  describeMediaForPrompt,
  isLikelyDirectVideoUrl,
  loadVideoDataUrl,
  loadPreviewFrameImages,
  type PreviewFrameImage,
} from "@/lib/media";
import { parseJsonFromText } from "@/lib/structured-json";
import { describeUserMaterialsForPrompt } from "@/lib/user-materials";

const aiPlanDraftSchema = z.object({
  projectTitle: z.string().min(1),
  targetBrief: z.string().min(2),
  strategySummary: z.string().min(8),
  inheritedStructure: z.array(z.string().min(1)),
  versions: z.array(planVersionSchema).min(1),
  evaluationChecklist: z.array(z.string().min(1)),
  productionNotes: z.array(z.string().min(1)).default([]),
});

function transformProviderRequestBody(args: Record<string, unknown>) {
  if (process.env.AI_DISABLE_THINKING !== "true") return args;
  return {
    ...args,
    thinking: { type: "disabled" },
  };
}

const provider = createOpenAICompatible({
  name: "configured-openai-compatible",
  baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1",
  apiKey: process.env.AI_API_KEY || "missing-key",
  supportsStructuredOutputs: process.env.AI_SUPPORTS_STRUCTURED_OUTPUTS === "true",
  transformRequestBody: transformProviderRequestBody,
});

type SchemaPrompt = string | ModelMessage[];

function hasAiConfig() {
  return Boolean(process.env.AI_API_KEY && process.env.AI_API_KEY.trim().length > 0);
}

function supportsStructuredOutputs() {
  return process.env.AI_SUPPORTS_STRUCTURED_OUTPUTS === "true";
}

function requestTimeoutMs() {
  const parsed = Number(process.env.AI_REQUEST_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 45000;
}

function planGenerationTimeoutMs() {
  return readTimeoutMs("AI_PLAN_TIMEOUT_MS", Math.min(requestTimeoutMs(), 22000));
}

function planRefineTimeoutMs() {
  return readTimeoutMs("AI_REFINE_TIMEOUT_MS", Math.min(requestTimeoutMs(), 18000));
}

function maxOutputTokens() {
  const parsed = Number(process.env.AI_MAX_OUTPUT_TOKENS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 4096;
}

function visionFrameLimit() {
  const parsed = Number(process.env.AI_VISION_FRAME_LIMIT);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 24) : 12;
}

function directVideoMaxBytes() {
  const parsedMb = Number(process.env.AI_DIRECT_VIDEO_MAX_MB);
  const safeMb = Number.isFinite(parsedMb) && parsedMb > 0 ? Math.min(parsedMb, 80) : 20;
  return safeMb * 1024 * 1024;
}

function directVideoFps() {
  const parsed = Number(process.env.AI_DIRECT_VIDEO_FPS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 4) : 1;
}

function videoInputMode() {
  const mode = process.env.AI_VIDEO_INPUT_MODE;
  return mode === "frames" || mode === "direct" || mode === "off" ? mode : "hybrid";
}

function shouldTryDirectVideo(input: { sampleUrl?: string; mediaPath?: string }) {
  const mode = videoInputMode();
  if (mode === "off" || mode === "frames") return false;
  if (mode === "direct") return true;
  return Boolean(input.mediaPath || isLikelyDirectVideoUrl(input.sampleUrl));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function schemaPrompt<T>(schema: z.ZodType<T>) {
  return JSON.stringify(z.toJSONSchema(schema), null, 2).slice(0, 16000);
}

function promptForError(prompt: SchemaPrompt) {
  if (typeof prompt === "string") return prompt;
  return prompt
    .map((message) => {
      if (typeof message.content === "string") return `${message.role}: ${message.content}`;
      return `${message.role}: ${message.content
        .map((part) => (part.type === "text" ? part.text : `[${part.type}]`))
        .join("\n")}`;
    })
    .join("\n\n")
    .slice(0, 16000);
}

function appendInstruction(prompt: SchemaPrompt, instruction: string): SchemaPrompt {
  if (typeof prompt === "string") return `${prompt}\n\n${instruction}`;
  return [...prompt, { role: "user", content: instruction }];
}

function promptOptions(prompt: SchemaPrompt) {
  return typeof prompt === "string" ? { prompt } : { messages: prompt };
}

function buildVisionAnalysisPrompt(input: {
  sampleTitle: string;
  sampleNotes: string;
  sampleUrl?: string;
  mediaMeta?: MediaMeta;
  frameImages: PreviewFrameImage[];
}) {
  const frameInstruction = input.frameImages.length
    ? `我已经附上 ${input.frameImages.length} 张从样例视频抽取的关键帧。请直接观察这些画面，结合描述判断镜头主体、字幕/包装、构图、节奏和卖点推进；不要只复述元数据。`
    : "当前没有可直接传入模型的关键帧，请基于标题、链接、描述/转写和视频元数据进行结构拆解。";

  return `请分析样例视频结构，并输出结构化 JSON。

样例标题：${input.sampleTitle}
样例链接：${input.sampleUrl || "无"}
样例描述/转写/观察：${input.sampleNotes}
视频元数据：${describeMediaForPrompt(input.mediaMeta)}

${frameInstruction}

重点拆解：开头 hook、镜头节奏、字幕布局、画面包装、音乐卡点、卖点推进、结尾转化。`;
}

function buildVisionAnalysisMessages(input: {
  promptText: string;
  frameImages: PreviewFrameImage[];
}): SchemaPrompt {
  if (!input.frameImages.length) return input.promptText;

  const content: UserContent = [
    {
      type: "text",
      text: `${input.promptText}

下面按视频时间顺序附关键帧。请把每张图当成真实样例画面观察，而不是占位说明。`,
    },
  ];

  input.frameImages.forEach((image, index) => {
    content.push({
      type: "text",
      text: `关键帧 ${index + 1} / ${input.frameImages.length}：${image.label}`,
    });
    content.push({
      type: "image",
      image: image.data,
      mediaType: image.mediaType,
    });
  });

  return [{ role: "user", content }];
}

function chatCompletionsUrl() {
  const baseURL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
  return `${baseURL.replace(/\/$/, "")}/chat/completions`;
}

async function summarizeDirectVideo(input: {
  promptText: string;
  sampleUrl?: string;
  mediaPath?: string;
}) {
  if (!shouldTryDirectVideo(input)) return { notes: "", used: false };

  let videoUrl = isLikelyDirectVideoUrl(input.sampleUrl) ? input.sampleUrl : undefined;
  if (!videoUrl && input.mediaPath) {
    videoUrl = (await loadVideoDataUrl(input.mediaPath, directVideoMaxBytes())) ?? undefined;
  }
  if (!videoUrl) return { notes: "", used: false };

  const requestBody = {
    model: process.env.AI_MODEL_VIDEO || process.env.AI_MODEL_VISION || process.env.AI_MODEL_TEXT,
    messages: [
      {
        role: "system",
        content:
          "你是短视频视觉理解助手。你会观察整段视频的时间顺序，只输出中文观察笔记，不输出 JSON。",
      },
      {
        role: "user",
        content: [
          {
            type: "video_url",
            video_url: {
              url: videoUrl,
              fps: directVideoFps(),
            },
          },
          {
            type: "text",
            text: `${input.promptText}

请直接理解整段样例视频，按时间顺序输出观察笔记。重点覆盖：镜头段落、开头 hook、主体/商品、字幕与包装、转场/节奏、音乐或音频线索、卖点推进、结尾 CTA，以及哪些规则适合迁移到新主题。`,
          },
        ],
      },
    ],
    max_tokens: Math.min(maxOutputTokens(), 1800),
    ...(process.env.AI_DISABLE_THINKING === "true" ? { thinking: { type: "disabled" } } : {}),
  };

  const response = await fetch(chatCompletionsUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(requestTimeoutMs()),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Direct video understanding failed: ${response.status} ${text.slice(0, 800)}`);
  }

  const payload = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const notes = payload.choices?.[0]?.message?.content?.trim() ?? "";
  return { notes: notes.slice(0, 6000), used: Boolean(notes) };
}

async function summarizeVisionFrames(input: {
  promptText: string;
  frameImages: PreviewFrameImage[];
}) {
  if (!input.frameImages.length) return "";

  const result = await generateText({
    model: provider(process.env.AI_MODEL_VISION || process.env.AI_MODEL_TEXT || "gpt-4.1-mini"),
    system:
      "你是短视频视觉拆解助手。直接观察用户提供的关键帧，只输出中文观察笔记，不输出 JSON。",
    maxRetries: 0,
    timeout: requestTimeoutMs(),
    maxOutputTokens: Math.min(maxOutputTokens(), 1400),
    ...promptOptions(
      buildVisionAnalysisMessages({
        promptText: `${input.promptText}

请只输出画面观察笔记，覆盖：主体/产品、字幕与标题、构图、色彩、包装元素、可能的镜头节奏、适合迁移的规则。不要输出 JSON。`,
        frameImages: input.frameImages,
      }),
    ),
  });

  return result.text.trim().slice(0, 6000);
}

async function generateSchemaObject<T>({
  modelId,
  schema,
  system,
  prompt,
  timeoutMs,
}: {
  modelId: string;
  schema: z.ZodType<T>;
  system: string;
  prompt: SchemaPrompt;
  timeoutMs?: number;
}): Promise<T> {
  let structuredError: unknown = null;
  const modelTimeoutMs = timeoutMs && timeoutMs > 0 ? timeoutMs : requestTimeoutMs();

  if (supportsStructuredOutputs()) {
    try {
      const result = await generateObject({
        model: provider(modelId),
        schema,
        system,
        ...promptOptions(prompt),
        maxRetries: 0,
        timeout: modelTimeoutMs,
        maxOutputTokens: maxOutputTokens(),
      });

      return result.object;
    } catch (error) {
      structuredError = error;
    }
  }

  try {
    const schemaDescription = schemaPrompt(schema);
    const textPrompt = appendInstruction(
      prompt,
      `字段约束 JSON Schema：
${schemaDescription}

输出要求：
- 只输出一个合法 JSON 对象，不要 Markdown 代码块，不要解释。
- JSON 必须完整覆盖约定字段，数组字段不要省略。
- 如果数组元素是 object，绝不能输出 string。
- 中文文案可以自然，但字段名必须严格匹配 schema。`,
    );
    const textResult = await generateText({
      model: provider(modelId),
      system,
      maxRetries: 0,
      timeout: modelTimeoutMs,
      maxOutputTokens: maxOutputTokens(),
      ...promptOptions(textPrompt),
    });

    try {
      return schema.parse(parseJsonFromText(textResult.text));
    } catch (parseError) {
      const repairResult = await generateText({
        model: provider(modelId),
        system:
          "你是 JSON 修复器。只返回合法 JSON，不要解释，不要 Markdown。保留原意，补齐缺失字段。",
        maxRetries: 0,
        timeout: modelTimeoutMs,
        maxOutputTokens: maxOutputTokens(),
        prompt: `原始任务：
${promptForError(prompt)}

上一次结构化输出错误：
${errorMessage(structuredError)}

上一次文本 JSON 解析错误：
${errorMessage(parseError)}

字段约束 JSON Schema：
${schemaDescription}

请把下面内容修复成完全合法、字段完整的 JSON：
${textResult.text.slice(0, 12000)}`,
      });

      return schema.parse(parseJsonFromText(repairResult.text));
    }
  } catch (error) {
    if (structuredError) {
      throw new Error(
        `Structured output failed: ${errorMessage(structuredError)}; text JSON fallback failed: ${errorMessage(error)}`,
      );
    }
    throw error;
  }
}

export async function analyzeSample(input: {
  sampleTitle: string;
  sampleNotes: string;
  sampleUrl?: string;
  mediaPath?: string;
  mediaMeta?: MediaMeta;
}) {
  let visionFrameCount = 0;
  let directVideoUsed = false;
  if (!hasAiConfig()) {
    return {
      analysis: createFallbackAnalysis(input),
      usedFallback: true,
      aiError: null,
      visionFrameCount,
      directVideoUsed,
    };
  }

  try {
    const frameImages = await loadPreviewFrameImages(
      input.mediaMeta?.previewFrames ?? [],
      visionFrameLimit(),
      input.mediaMeta?.frameTimestamps ?? [],
    );
    visionFrameCount = frameImages.length;
    const promptText = buildVisionAnalysisPrompt({ ...input, frameImages });
    let directVideoNotes = "";
    let directVideoError = "";
    try {
      const directVideo = await summarizeDirectVideo({
        promptText,
        sampleUrl: input.sampleUrl,
        mediaPath: input.mediaPath,
      });
      directVideoNotes = directVideo.notes;
      directVideoUsed = directVideo.used;
    } catch (error) {
      directVideoError = errorMessage(error);
    }
    const visionNotes = await summarizeVisionFrames({ promptText, frameImages });
    const observationBlocks = [
      directVideoNotes
        ? `整段视频模型观察笔记：\n${directVideoNotes}`
        : directVideoError
          ? `整段视频模型不可用，原因：${directVideoError}`
          : "",
      visionNotes ? `时间轴关键帧观察笔记：\n${visionNotes}` : "",
    ].filter(Boolean);
    const structuredPrompt = observationBlocks.length
      ? `${promptText}

${observationBlocks.join("\n\n")}

请基于这些视觉观察笔记和样例信息，整理成严格符合 schema 的视频结构拆解 JSON。`
      : promptText;
    const analysis = await generateSchemaObject({
      modelId: process.env.AI_MODEL_TEXT || process.env.AI_MODEL_VISION || "gpt-4.1-mini",
      schema: videoStructureAnalysisSchema,
      system:
        "你是短视频爆款结构分析师。只抽象创作方法，不复刻具体内容。输出必须可迁移、可剪辑、可执行。",
      prompt: structuredPrompt,
    });

    return {
      analysis,
      usedFallback: false,
      aiError: null,
      visionFrameCount,
      directVideoUsed,
    };
  } catch (error) {
    return {
      analysis: createFallbackAnalysis(input),
      usedFallback: true,
      aiError: error instanceof Error ? error.message : "AI analysis failed",
      visionFrameCount,
      directVideoUsed,
    };
  }
}

export async function generateMigratedPlan(input: {
  projectTitle: string;
  targetBrief: string;
  userMaterials?: string;
  direction: string;
  analysis: VideoStructureAnalysis;
}) {
  const promptUserMaterials = describeUserMaterialsForPrompt(input.userMaterials);
  const retrievedTechniques = retrieveEditingTechniques({
    targetBrief: input.targetBrief,
    userMaterials: promptUserMaterials,
    direction: input.direction,
    analysis: input.analysis,
    limit: 5,
  });

  if (!hasAiConfig()) {
    const plan = attachEditingTechniquesToPlan({
      plan: createFallbackPlan({ ...input, userMaterials: promptUserMaterials }),
      techniques: retrievedTechniques,
    });
    const adaptedPlan = attachMaterialAdaptation({
      plan,
      targetBrief: input.targetBrief,
      userMaterials: input.userMaterials,
    });
    return {
      plan: attachPlanEvaluation(adaptedPlan, input.analysis),
      usedFallback: true,
      aiError: null,
    };
  }

  try {
    const timeoutMs = planGenerationTimeoutMs();
    const generatedDraft = await raceWithTimeout(
      generateSchemaObject({
        modelId: process.env.AI_MODEL_TEXT || "gpt-4.1-mini",
        schema: aiPlanDraftSchema,
        system:
          "你是 AIGC 短视频创意导演。把样例结构迁移到新主题中，生成方案脚本，不复制样例内容。",
        prompt: `请基于样例结构拆解，为新主题生成 3 个可比较的视频方案版本。

项目：${input.projectTitle}
新主题/商品 Brief：${input.targetBrief}
用户素材：${promptUserMaterials || "用户未提供明确素材，请识别缺口并给出补全策略。"}
生成方向：${input.direction}

样例结构分析：
${JSON.stringify(input.analysis, null, 2)}

剪辑手法匹配结果（必须应用到脚本节奏、画面建议、包装和制作备注中）：
${formatEditingTechniquesForPrompt(retrievedTechniques)}

要求：
1. 每个版本都必须包含时间段、镜头目的、画面建议、口播/字幕、包装风格、卖点意图、转场/节奏、可替换素材、风险提示。
2. 必须考虑素材是否足够支撑目标结构；缺素材时用结构重排、文案/字幕补全、包装补全、AIGC 生成建议或现有素材复用补足。
3. 方案应可被创作者直接二次编辑。
4. 输出侧重结构迁移，不要复刻样例中的具体人物、台词和画面。
5. 必须输出 3 个版本，每个版本至少 5 个 scriptBeats，第一段 timeRange 必须从 0- 开始。
6. 主版本开头口播必须包含“别”“变化”“错”或“关键”之一，以形成强 Hook。
7. 每个版本必须写出证据/对比/反馈/评价中的至少 2 类；每段 replaceableAssets 必须明确“可替换素材”；每段 riskNotes 必须包含“避免”或“追溯”。
8. productionNotes 至少写出 3 条具体剪辑执行提醒。`,
        timeoutMs,
      }),
      timeoutMs,
      "AI plan generation",
    );
    const generatedPlan = migratedVideoPlanSchema.parse(generatedDraft);
    const plan = attachEditingTechniquesToPlan({
      plan: generatedPlan,
      techniques: retrievedTechniques,
    });
    const adaptedPlan = attachMaterialAdaptation({
      plan,
      targetBrief: input.targetBrief,
      userMaterials: input.userMaterials,
    });

    return {
      plan: attachPlanEvaluation(adaptedPlan, input.analysis),
      usedFallback: false,
      aiError: null,
    };
  } catch (error) {
    const plan = attachEditingTechniquesToPlan({
      plan: createFallbackPlan({ ...input, userMaterials: promptUserMaterials }),
      techniques: retrievedTechniques,
    });
    const adaptedPlan = attachMaterialAdaptation({
      plan,
      targetBrief: input.targetBrief,
      userMaterials: input.userMaterials,
    });
    return {
      plan: attachPlanEvaluation(adaptedPlan, input.analysis),
      usedFallback: true,
      aiError: error instanceof Error ? error.message : "AI plan generation failed",
    };
  }
}

export async function refineMigratedPlan(input: {
  projectTitle: string;
  instruction: string;
  analysis: VideoStructureAnalysis;
  plan: MigratedVideoPlan;
}) {
  if (!hasAiConfig()) {
    const refinedPlan = createRefinedFallbackPlan(input.plan, input.instruction);
    return {
      plan: attachPlanEvaluation(refinedPlan, input.analysis),
      usedFallback: true,
      aiError: null,
    };
  }

  try {
    const timeoutMs = planRefineTimeoutMs();
    const generatedDraft = await raceWithTimeout(
      generateSchemaObject({
        modelId: process.env.AI_MODEL_TEXT || "gpt-4.1-mini",
        schema: aiPlanDraftSchema,
        system:
          "你是短视频创作平台的自然语言编辑器。基于用户修改指令，保留原结构并生成修订后的完整方案。",
        prompt: `请根据用户修改指令重写方案，保持 JSON 结构完整。

项目：${input.projectTitle}
修改指令：${input.instruction}

样例结构分析：
${JSON.stringify(input.analysis, null, 2)}

当前方案：
${JSON.stringify(input.plan, null, 2)}

要求：保留可迁移结构，不复刻样例内容；输出完整多版本方案，而不是局部补丁。每个版本至少 5 段，开头要强 Hook，证据/对比/反馈/评价、可替换素材和风险追溯提醒必须完整。`,
        timeoutMs,
      }),
      timeoutMs,
      "AI plan refinement",
    );
    const generatedPlan = migratedVideoPlanSchema.parse(generatedDraft);

    const nextPlan = input.plan.retrievedTechniques.length
      ? attachEditingTechniquesToPlan({
          plan: generatedPlan,
          techniques: input.plan.retrievedTechniques,
        })
      : generatedPlan;

    return {
      plan: attachPlanEvaluation(nextPlan, input.analysis),
      usedFallback: false,
      aiError: null,
    };
  } catch (error) {
    const refinedPlan = createRefinedFallbackPlan(input.plan, input.instruction);
    return {
      plan: attachPlanEvaluation(refinedPlan, input.analysis),
      usedFallback: true,
      aiError: error instanceof Error ? error.message : "AI plan refinement failed",
    };
  }
}
