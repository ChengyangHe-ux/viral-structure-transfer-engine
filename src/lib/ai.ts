import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateObject } from "ai";

import {
  migratedVideoPlanSchema,
  videoStructureAnalysisSchema,
  type MediaMeta,
  type VideoStructureAnalysis,
} from "@/lib/schemas";
import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";
import { attachPlanEvaluation } from "@/lib/evaluation";
import { describeMediaForPrompt } from "@/lib/media";

const provider = createOpenAICompatible({
  name: "configured-openai-compatible",
  baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1",
  apiKey: process.env.AI_API_KEY || "missing-key",
});

function hasAiConfig() {
  return Boolean(process.env.AI_API_KEY && process.env.AI_API_KEY.trim().length > 0);
}

export async function analyzeSample(input: {
  sampleTitle: string;
  sampleNotes: string;
  sampleUrl?: string;
  mediaMeta?: MediaMeta;
}) {
  if (!hasAiConfig()) {
    return {
      analysis: createFallbackAnalysis(input),
      usedFallback: true,
      aiError: null,
    };
  }

  try {
    const result = await generateObject({
      model: provider(process.env.AI_MODEL_VISION || process.env.AI_MODEL_TEXT || "gpt-4.1-mini"),
      schema: videoStructureAnalysisSchema,
      system:
        "你是短视频爆款结构分析师。只抽象创作方法，不复刻具体内容。输出必须可迁移、可剪辑、可执行。",
      prompt: `请分析样例视频结构，并输出结构化 JSON。

样例标题：${input.sampleTitle}
样例链接：${input.sampleUrl || "无"}
样例描述/转写/观察：${input.sampleNotes}
视频元数据：${describeMediaForPrompt(input.mediaMeta)}

重点拆解：开头 hook、镜头节奏、字幕布局、画面包装、音乐卡点、卖点推进、结尾转化。`,
    });

    return { analysis: result.object, usedFallback: false, aiError: null };
  } catch (error) {
    return {
      analysis: createFallbackAnalysis(input),
      usedFallback: true,
      aiError: error instanceof Error ? error.message : "AI analysis failed",
    };
  }
}

export async function generateMigratedPlan(input: {
  projectTitle: string;
  targetBrief: string;
  direction: string;
  analysis: VideoStructureAnalysis;
}) {
  if (!hasAiConfig()) {
    const plan = createFallbackPlan(input);
    return {
      plan: attachPlanEvaluation(plan, input.analysis),
      usedFallback: true,
      aiError: null,
    };
  }

  try {
    const result = await generateObject({
      model: provider(process.env.AI_MODEL_TEXT || "gpt-4.1-mini"),
      schema: migratedVideoPlanSchema,
      system:
        "你是 AIGC 短视频创意导演。把样例结构迁移到新主题中，生成方案脚本，不复制样例内容。",
      prompt: `请基于样例结构拆解，为新主题生成 3 个可比较的视频方案版本。

项目：${input.projectTitle}
新主题/商品 Brief：${input.targetBrief}
生成方向：${input.direction}

样例结构分析：
${JSON.stringify(input.analysis, null, 2)}

要求：
1. 每个版本都必须包含时间段、镜头目的、画面建议、口播/字幕、包装风格、卖点意图、转场/节奏、可替换素材、风险提示。
2. 方案应可被创作者直接二次编辑。
3. 输出侧重结构迁移，不要复刻样例中的具体人物、台词和画面。`,
    });

    return {
      plan: attachPlanEvaluation(result.object, input.analysis),
      usedFallback: false,
      aiError: null,
    };
  } catch (error) {
    const plan = createFallbackPlan(input);
    return {
      plan: attachPlanEvaluation(plan, input.analysis),
      usedFallback: true,
      aiError: error instanceof Error ? error.message : "AI plan generation failed",
    };
  }
}
