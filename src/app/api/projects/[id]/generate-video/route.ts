import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  buildAdaptiveTransferStoryboard,
  type AdaptiveTransferStoryboardShot,
} from "@/lib/adaptive-video-storyboard";
import {
  migratedVideoPlanSchema,
  videoStructureAnalysisSchema,
  type MigratedVideoPlan,
} from "@/lib/schemas";
import {
  describeUserMaterialsForPrompt,
  getSavedUserMaterials,
  type SavedUserMaterial,
} from "@/lib/user-materials";
import { packageVideoWithSubtitlesAndAudio } from "@/lib/video-packaging";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const ZHIPU_VIDEO_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
type SegmentProvider = "zhipu" | "generic" | "user-video" | "user-image";

function getFfmpegPath() {
  const platformArch =
    process.platform === "darwin" && process.arch === "arm64"
      ? "darwin-arm64"
      : process.platform === "darwin"
        ? "darwin-x64"
        : process.platform === "linux"
          ? "linux-x64"
          : process.platform === "win32"
            ? "win32-x64"
            : null;

  if (!platformArch) return "ffmpeg";
  return path.join(
    process.cwd(),
    "node_modules",
    "@ffmpeg-installer",
    platformArch,
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  );
}

type VideoGenerateRequest = {
  planId?: string;
  versionIndex?: number;
  beatIndex?: number;
  mode?: "hook" | "full-video";
  audioMode?: "natural-sfx" | "model-voiceover";
  packagingMode?: "smart" | "clean";
  targetDurationSeconds?: number;
  resumeOutputBaseName?: string | null;
};

type PackagingMode = NonNullable<VideoGenerateRequest["packagingMode"]>;

type GeneratedSegment = {
  order: number;
  role: string;
  taskId: string | null;
  videoUrl: string | null;
  downloaded: {
    filePath: string;
    bytes: number;
  } | null;
  provider: SegmentProvider;
  source: "aigc-video" | "user-video" | "user-image";
  slotId?: string;
  materialLabel?: string;
  reason?: string;
  editSummary?: string;
  request: Record<string, unknown>;
  submit: unknown;
  final: unknown;
};

type VideoGenerationProgress = {
  projectId: string;
  planId: string;
  mode: "hook" | "full-video";
  audioMode: "natural-sfx" | "model-voiceover";
  packagingMode?: PackagingMode;
  versionIndex: number;
  beatIndex: number;
  adaptiveTransfer?: unknown;
  directorStoryboard?: unknown;
  segmentSeconds?: string;
  materialSummary?: string;
  materialCandidates?: unknown;
  completedSegments: number;
  totalSegments: number;
  outputBaseName?: string;
  progressFilePath?: string;
  segments: GeneratedSegment[];
};

type VideoProviderConfig = {
  provider: "zhipu" | "generic";
  baseUrl: string;
  apiKey: string;
  model: string;
  submitEndpoint: string;
  queryEndpoint: string;
};

type MaterialSegmentCandidate = {
  material: SavedUserMaterial;
  slotIds: string[];
  qualityScore: number;
  visualIndex: number;
  visualTotal: number;
};

type MaterialEditOperation = {
  trimStartSeconds?: number;
  durationSeconds: number;
  crop: string;
  motion: string;
  summary: string;
};

function apiVideoOutDir() {
  return path.join(process.cwd(), "renders", "api-videos");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeOutputBaseName(value: string | null | undefined) {
  if (!value) return null;
  const clean = value.replace(/[^a-zA-Z0-9._-]+/g, "");
  return clean && clean === value ? clean : null;
}

function publicVideoError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "生成视频失败");
  if (/fetch failed|network|timeout|timed out|aborted|ECONN|ENOTFOUND|ETIMEDOUT/i.test(message)) {
    return "生成视频服务连接不稳定，已保存当前进度。稍后再次点击“生成成片”会从未完成分段继续。";
  }
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer ***")
    .replace(/api[_-]?key["']?\s*[:=]\s*["']?[^"',\s]+/gi, "apiKey: ***");
}

function providerStatus(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as { task_status?: string; status?: string; error?: string };
  return record.task_status || record.status || record.error || null;
}

async function fileExists(filePath: string | null | undefined) {
  if (!filePath) return false;
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile() && fileStat.size > 0;
  } catch {
    return false;
  }
}

function upsertSegment(segments: GeneratedSegment[], nextSegment: GeneratedSegment) {
  const index = segments.findIndex((segment) => segment.order === nextSegment.order);
  if (index >= 0) {
    segments[index] = nextSegment;
    return;
  }
  segments.push(nextSegment);
  segments.sort((left, right) => left.order - right.order);
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  {
    label,
    attempts = 3,
    timeoutMs = 45000,
  }: {
    label: string;
    attempts?: number;
    timeoutMs?: number;
  },
) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep(1200 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`${label}失败：${publicVideoError(lastError)}`);
}

function buildPrompt({
  projectTitle,
  versionName,
  beat,
  beatIndex,
  strategySummary,
}: {
  projectTitle: string;
  versionName: string;
  beat: {
    timeRange: string;
    shotPurpose: string;
    visualSuggestion: string;
    voiceoverOrSubtitle: string;
    packagingStyle: string;
    transitionAndRhythm: string;
    sellingPointIntent: string;
    replaceableAssets: string;
  };
  beatIndex: number;
  strategySummary: string;
}) {
  return [
    `竖屏 9:16 短视频镜头，项目：${projectTitle}`,
    `方案版本：${versionName}`,
    `镜头 ${beatIndex + 1}，时间段：${beat.timeRange}`,
    `镜头目的：${beat.shotPurpose}`,
    `画面：${beat.visualSuggestion}`,
    `中文口播/字幕内容仅作为语义参考，不要把这些文字画进视频：${beat.voiceoverOrSubtitle}`,
    `包装风格仅作为后期方向，不要在画面里生成中文标题、字幕、标签或卖点卡片：${beat.packagingStyle}`,
    `节奏与转场：${beat.transitionAndRhythm}`,
    `卖点意图：${beat.sellingPointIntent}`,
    `可替换素材：${beat.replaceableAssets}`,
    `整体结构：${strategySummary}`,
    "生成要求：只生成干净的真实画面和自然动作，不要出现任何可读文字、中文字幕、英文字幕、Logo、水印、二维码、UI乱码或海报字样。",
    "画面需要为后期字幕预留安全区：主体不要遮挡底部 20% 和顶部 12%，方便后续叠加中文标题条和字幕。",
    "真实商业短视频质感，主体清晰，光线干净，适合社媒种草。",
  ].join("\n");
}

function buildSegmentPrompt({
  projectTitle,
  versionName,
  strategySummary,
  targetBrief,
  shot,
  totalShots,
}: {
  projectTitle: string;
  versionName: string;
  strategySummary: string;
  targetBrief: string;
  shot: AdaptiveTransferStoryboardShot;
  totalShots: number;
}) {
  return [
    "竖屏 9:16，真实商业短视频素材片段，用于后期拼成手法迁移成片。",
    `项目：${projectTitle}`,
    `唯一目标内容：${targetBrief}`,
    "内容边界：画面主体、场景、动作、商品/服务都必须围绕「唯一目标内容」。样片只提供结构和节奏，不提供可复用的商品、人物、场景或情节。",
    `方案版本：${versionName}`,
    `迁移结构：${strategySummary}`,
    `当前分镜：${shot.order}/${totalShots} - ${shot.role}`,
    `源样片时间段：${shot.sourceTimeRange || "按当前脚本推断"}`,
    `目标成片时间段：${shot.targetTimeRange}`,
    `迁移手法：${shot.transferredTechnique}`,
    `必拍画面：${shot.visual}`,
    `剪辑节奏：${shot.rhythm}`,
    `后期包装参考：${shot.editPoint}`,
    "没有用户素材时：请直接用 AIGC 生成符合唯一目标内容的新画面，不能回退到样片原始内容，也不能生成无关的通用广告画面。",
    "生成方式：只生成这一段分镜对应的画面，不要把整条视频结构都塞进本片段。",
    "连续性：保持同一个新主题主体和统一商业摄影风格；如果样片手法需要场景切换，可以按源样片节奏切场景，但不要跳出目标 Brief。",
    "转场预留：片段开头和结尾保留自然运动或定格余量，方便剪辑时衔接上一段和下一段。",
    "画面禁止：不要出现中文、英文、字幕、标题、卖点卡片、任何可读文字、Logo、水印、二维码、UI、品牌名、乱码字形或伪文字。",
    "包装要求：如果出现产品包装，只能是无字纯色或抽象图案包装，不要出现任何文字标签。",
    "音频要求：不要生成任何人声、讲解或口播；只保留自然音效，例如冷气、冰块、液体、包装轻响、环境氛围声。",
    "人物要求：除非目标 Brief 明确需要真人出镜，否则优先用产品、手部动作、环境变化、界面录屏或非可识别人物表达。",
    "质感要求：真实商业短视频质感，主体清晰，光线干净，适合社媒种草，不要卡通、不要玩具感、不要夸张变形。",
  ].join("\n");
}

function slotNameForId(slotId: string) {
  const names: Record<string, string> = {
    hook: "开头吸引镜头",
    hero: "主体识别镜头",
    usage: "使用过程镜头",
    comparison: "对比结果镜头",
    proof: "证据强化镜头",
    cta: "结尾收束镜头",
  };
  return names[slotId] ?? "结构槽位";
}

function slotIdForShot(shot: AdaptiveTransferStoryboardShot, index: number, total: number) {
  if (shot.slotId) return shot.slotId;
  const text = `${shot.role} ${shot.transferredTechnique}`;
  const matchers = [
    ["hook", /hook|开头|停留|吸引|反差|冲突|第一眼/i],
    ["cta", /cta|结尾|行动|转化|入口|收藏|领取|购买|收束/i],
    ["usage", /使用|过程|操作|步骤|流程|演示|场景|录屏/i],
    ["comparison", /对比|结果|变化|before|after|提升|效果/i],
    ["proof", /证据|背书|可信|反馈|评价|参数|数据|证明/i],
    ["hero", /主体|商品|产品|工具|特写|界面|主视觉|包装/i],
  ] as const;
  if (index === 0) return "hook";
  if (index === total - 1 && /结尾|行动|转化|入口|收藏|领取|购买|收束/i.test(text)) {
    return "cta";
  }
  return matchers.find(([, pattern]) => pattern.test(text))?.[0] ?? [
    "hook",
    "hero",
    "usage",
    "comparison",
    "proof",
    "cta",
  ][index] ?? "usage";
}

function inferSlotIdsForSavedMaterial(material: SavedUserMaterial) {
  const text = `${material.label} ${material.originalName} ${material.textSnippet}`.toLowerCase();
  const slots = [
    [/hook|开头|结果|痛点|反差|前后|第一眼/, "hook"],
    [/商品|产品|工具|界面|包装|特写|主视觉|截图|logo/, "hero"],
    [/视频|录屏|使用|过程|操作|步骤|演示|场景|工作流/, "usage"],
    [/对比|before|after|效果|结果|提升|变化/, "comparison"],
    [/评价|反馈|参数|数据|案例|证明|证据|背书/, "proof"],
    [/入口|链接|二维码|购买|领取|咨询|cta|结尾|收尾/, "cta"],
  ]
    .filter(([pattern]) => (pattern as RegExp).test(text))
    .map(([, slot]) => slot as string);

  if (material.kind === "video") slots.push("hook", "usage", "comparison", "proof", "cta");
  if (material.kind === "image") slots.push("hook", "hero", "comparison", "proof", "cta");

  return Array.from(new Set(slots));
}

function slotSpreadForVisualMaterial({
  kind,
  visualIndex,
  visualTotal,
}: {
  kind: SavedUserMaterial["kind"];
  visualIndex: number;
  visualTotal: number;
}) {
  if (kind !== "image" && kind !== "video") return [];
  if (visualTotal <= 1) {
    return kind === "video"
      ? ["hook", "usage", "comparison", "proof", "cta"]
      : ["hook", "hero", "comparison", "proof", "cta"];
  }
  if (visualIndex === 0) return ["hook", "hero"];
  if (visualIndex === visualTotal - 1) return ["proof", "cta"];
  const ratio = visualIndex / Math.max(1, visualTotal - 1);
  if (ratio < 0.4) return kind === "video" ? ["usage", "hero"] : ["hero", "usage"];
  if (ratio < 0.72) return ["comparison", "usage", "proof"];
  return ["proof", "comparison", "cta"];
}

function buildMaterialCandidates({
  plan,
  materials,
}: {
  plan: MigratedVideoPlan;
  materials: SavedUserMaterial[];
}): MaterialSegmentCandidate[] {
  const visualMaterials = materials.filter(
    (material) => material.kind === "video" || material.kind === "image",
  );
  return visualMaterials.map((material, visualIndex) => {
      const asset = plan.materialAdaptation?.assets.find(
        (item) => item.sourcePath === material.filePath,
      );
      return {
        material,
        slotIds: Array.from(
          new Set([
            ...(asset?.suggestedSlots.length ? asset.suggestedSlots : inferSlotIdsForSavedMaterial(material)),
            ...slotSpreadForVisualMaterial({
              kind: material.kind,
              visualIndex,
              visualTotal: visualMaterials.length,
            }),
          ]),
        ),
        qualityScore: asset?.qualityScore ?? (material.kind === "video" ? 76 : 70),
        visualIndex,
        visualTotal: visualMaterials.length,
      };
    });
}

function canReuseMaterial(candidate: MaterialSegmentCandidate) {
  if (candidate.visualTotal <= 1) return true;
  return candidate.material.kind === "video" && (candidate.material.durationSeconds ?? 0) >= 8;
}

function pickMaterialCandidate({
  candidates,
  slotId,
  usedMaterialPaths,
  order,
  totalShots,
}: {
  candidates: MaterialSegmentCandidate[];
  slotId: string;
  usedMaterialPaths: Set<string>;
  order: number;
  totalShots: number;
}) {
  if (!candidates.length) return null;

  const fresh = candidates.filter(
    (candidate) => !usedMaterialPaths.has(candidate.material.filePath) || canReuseMaterial(candidate),
  );
  const pool = fresh.length ? fresh : candidates;
  const dynamicSlot = slotId === "hook" || slotId === "usage" || slotId === "comparison";
  const scored = pool
    .map((candidate) => {
      const slotMatch = candidate.slotIds.includes(slotId) ? 100 : 0;
      const alreadyUsed = usedMaterialPaths.has(candidate.material.filePath);
      const orderTarget =
        totalShots <= 1 ? 0 : Math.round(((order - 1) / Math.max(1, totalShots - 1)) * Math.max(0, candidate.visualTotal - 1));
      const sequencePenalty =
        candidate.visualTotal > 1 ? Math.abs(candidate.visualIndex - orderTarget) * 13 : 0;
      const reusePenalty = alreadyUsed ? (canReuseMaterial(candidate) ? 24 : 52) : 0;
      const kindBoost =
        candidate.material.kind === "video"
          ? dynamicSlot
            ? 18
            : 8
          : dynamicSlot
            ? 4
            : 12;
      const fallbackBoost =
        candidate.material.kind === "video"
          ? dynamicSlot
            ? 34
            : 12
          : dynamicSlot
            ? 12
            : 24;
      return {
        candidate,
        exact: candidate.slotIds.includes(slotId),
        score:
          candidate.qualityScore +
          slotMatch +
          kindBoost +
          (slotMatch ? 0 : fallbackBoost) -
          sequencePenalty -
          reusePenalty,
      };
    })
    .sort((left, right) => right.score - left.score);

  return scored.find((item) => item.exact)?.candidate ?? scored[0]?.candidate ?? null;
}

function trimOffsetForMaterialVideo({
  material,
  order,
  durationSeconds,
  slotId,
}: {
  material: SavedUserMaterial;
  order: number;
  durationSeconds: number;
  slotId: string;
}) {
  const maxOffset = Math.max(0, (material.durationSeconds ?? 0) - durationSeconds);
  if (maxOffset <= 0) return 0;
  if (slotId === "hook") return 0;
  if (slotId === "cta" || slotId === "proof") return maxOffset;
  return Math.min(maxOffset, Math.max(0, (order - 1) * durationSeconds * 0.72));
}

function materialEditOperation({
  candidate,
  order,
  durationSeconds,
  slotId,
}: {
  candidate: MaterialSegmentCandidate;
  order: number;
  durationSeconds: number;
  slotId: string;
}): MaterialEditOperation {
  if (candidate.material.kind === "video") {
    const offset = trimOffsetForMaterialVideo({
      material: candidate.material,
      order,
      durationSeconds,
      slotId,
    });
    const offsetText = offset > 0 ? `从 ${offset.toFixed(1)}s 起截取` : "从开头截取";
    return {
      trimStartSeconds: Number(offset.toFixed(2)),
      durationSeconds,
      crop: "9:16 居中裁切",
      motion: "保留原视频运动",
      summary: `${slotNameForId(slotId)}：${offsetText} ${durationSeconds}s，裁成 9:16 后接入时间线。`,
    };
  }

  const motion = slotId === "cta" || order % 2 === 0 ? "轻微拉远" : "轻微推进";
  return {
    durationSeconds,
    crop: "9:16 居中裁切",
    motion,
    summary: `${slotNameForId(slotId)}：图片做${motion}和 9:16 裁切，生成 ${durationSeconds}s 可剪片段。`,
  };
}

function endpoint(baseUrl: string, pathName: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${pathName.replace(/^\/+/, "")}`;
}

function videoProviderConfig(): VideoProviderConfig | null {
  const zhipuApiKey = process.env.ZHIPU_API_KEY;
  const genericApiKey = process.env.VIDEO_API_KEY;
  const provider =
    process.env.VIDEO_API_PROVIDER === "zhipu" || (zhipuApiKey && !genericApiKey)
      ? "zhipu"
      : "generic";

  if (provider === "zhipu") {
    const apiKey = zhipuApiKey || genericApiKey;
    if (!apiKey) return null;
    return {
      provider,
      apiKey,
      baseUrl: process.env.VIDEO_API_BASE_URL || ZHIPU_VIDEO_BASE_URL,
      model: process.env.VIDEO_API_MODEL || process.env.ZHIPU_VIDEO_MODEL || "cogvideox-2",
      submitEndpoint: process.env.VIDEO_API_ENDPOINT || "/videos/generations",
      queryEndpoint: process.env.VIDEO_API_QUERY_ENDPOINT || "/async-result/{id}",
    };
  }

  if (!process.env.VIDEO_API_BASE_URL || !genericApiKey) return null;
  return {
    provider,
    apiKey: genericApiKey,
    baseUrl: process.env.VIDEO_API_BASE_URL,
    model: process.env.VIDEO_API_MODEL || "veo3.1-fast",
    submitEndpoint: process.env.VIDEO_API_ENDPOINT || "/v1/videos",
    queryEndpoint: process.env.VIDEO_API_QUERY_ENDPOINT || "/v1/videos/{id}",
  };
}

function compactZhipuPrompt(prompt: string) {
  const lines = prompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const picked = [
    lines.find((line) => line.startsWith("唯一目标内容")),
    lines.find((line) => line.startsWith("当前分镜")),
    lines.find((line) => line.startsWith("必拍画面")),
    lines.find((line) => line.startsWith("迁移手法")),
    "只生成目标内容对应的真实竖屏画面；样片只提供节奏和结构，不复制样片人物、商品、场景。",
    "不要生成字幕、Logo、水印、二维码、UI 或任何可读文字。",
  ].filter((line): line is string => Boolean(line));

  return (picked.length ? picked.join("\n") : prompt).slice(0, 700);
}

function videoPollAttempts() {
  const parsed = Number(process.env.VIDEO_API_POLL_ATTEMPTS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 42;
  return Math.min(90, Math.max(6, Math.floor(parsed)));
}

function videoPollIntervalMs() {
  const parsed = Number(process.env.VIDEO_API_POLL_INTERVAL_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10000;
  return Math.min(30000, Math.max(3000, Math.floor(parsed)));
}

function buildSubmitPayload(config: VideoProviderConfig, prompt: string, seconds: string) {
  if (config.provider === "zhipu") {
    const duration = Number(seconds) === 10 ? 10 : 5;
    return {
      model: config.model,
      prompt: compactZhipuPrompt(prompt),
      quality: process.env.ZHIPU_VIDEO_QUALITY || "quality",
      with_audio: process.env.ZHIPU_VIDEO_WITH_AUDIO === "true",
      size: process.env.ZHIPU_VIDEO_SIZE || "1080x1920",
      fps: Number(process.env.ZHIPU_VIDEO_FPS) === 60 ? 60 : 30,
      duration,
    };
  }

  return {
    model: config.model,
    prompt,
    seconds,
    size: process.env.VIDEO_API_SIZE || "720x1280",
  };
}

async function downloadVideo(url: string, fileName: string) {
  const response = await fetchWithRetry(url, {}, { label: "下载视频结果", timeoutMs: 60000 });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const outDir = apiVideoOutDir();
  await mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, fileName);
  await writeFile(filePath, buffer);
  return { filePath, bytes: buffer.length };
}

async function writeVideoGenerationDebug(fileName: string, data: unknown) {
  const outDir = apiVideoOutDir();
  await mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, fileName);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  return filePath;
}

function findVideoUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const nested = findVideoUrl(entry);
      if (nested) return nested;
    }
    return null;
  }
  const item = payload as {
    url?: string;
    video?: string;
    video_url?: string;
    result_url?: string;
    file_url?: string;
    download_url?: string;
    output_url?: string;
    output?: { video_url?: string; url?: string };
    data?: unknown;
    result?: unknown;
    video_result?: unknown;
  };
  return (
    item.video_url ||
    item.url ||
    item.video ||
    item.result_url ||
    item.file_url ||
    item.download_url ||
    item.output_url ||
    item.output?.video_url ||
    item.output?.url ||
    findVideoUrl(item.data) ||
    findVideoUrl(item.result) ||
    findVideoUrl(item.video_result) ||
    null
  );
}

async function queryVideo(config: VideoProviderConfig, taskId: string) {
  const queryPath = config.queryEndpoint.replace("{id}", encodeURIComponent(taskId));

  const response = await fetchWithRetry(
    endpoint(config.baseUrl, queryPath),
    {
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "x-api-key": config.apiKey,
      },
    },
    { label: "查询生成视频任务", timeoutMs: 30000 },
  );
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { status: response.status, text };
  }
}

async function submitVideoGeneration({
  config,
  prompt,
  seconds,
  fileName,
}: {
  config: VideoProviderConfig;
  prompt: string;
  seconds: string;
  fileName: string;
}) {
  const payload = buildSubmitPayload(config, prompt, seconds);

  const submitResponse = await fetchWithRetry(
    endpoint(config.baseUrl, config.submitEndpoint),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify(payload),
    },
    { label: "提交生成视频任务", timeoutMs: 45000 },
  );
  const submitText = await submitResponse.text();
  let submitBody: unknown = submitText;
  try {
    submitBody = JSON.parse(submitText) as unknown;
  } catch {
    // Keep raw text inspectable.
  }

  if (!submitResponse.ok) {
    throw new Error(
      `Video API submit failed: ${submitResponse.status} ${JSON.stringify(submitBody).slice(0, 500)}`,
    );
  }

  const taskId =
    submitBody && typeof submitBody === "object"
      ? ((submitBody as { id?: string; task_id?: string }).id ??
          (submitBody as { id?: string; task_id?: string }).task_id ??
          null)
      : null;

  let finalPayload = submitBody;
  let videoUrl = findVideoUrl(submitBody);
  if (taskId && !videoUrl) {
    const maxAttempts = videoPollAttempts();
    const pollIntervalMs = videoPollIntervalMs();
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await sleep(attempt === 0 ? 2000 : pollIntervalMs);
      finalPayload = await queryVideo(config, taskId);
      videoUrl = findVideoUrl(finalPayload);
      const status =
        finalPayload && typeof finalPayload === "object"
          ? String(
              (finalPayload as { status?: string; task_status?: string }).status ||
                (finalPayload as { status?: string; task_status?: string }).task_status ||
                "",
            ).toLowerCase()
          : "";
      if (
        videoUrl ||
        (status &&
          !["queued", "running", "processing", "pending", "in_progress", "submitted"].includes(
            status,
          ))
      ) {
        break;
      }
    }
  }

  const downloaded = videoUrl ? await downloadVideo(videoUrl, fileName) : null;

  return {
    taskId,
    videoUrl,
    downloaded,
    provider: config.provider,
    request: payload,
    submit: submitBody,
    final: finalPayload,
  };
}

function escapeConcatPath(filePath: string) {
  return filePath.replace(/'/g, "'\\''");
}

async function concatSegments(segmentPaths: string[], outputBaseName: string) {
  const outDir = apiVideoOutDir();
  await mkdir(outDir, { recursive: true });
  const listPath = path.join(outDir, `${outputBaseName}-concat.txt`);
  const outputPath = path.join(outDir, `${outputBaseName}.mp4`);
  await writeFile(
    listPath,
    segmentPaths.map((segmentPath) => `file '${escapeConcatPath(segmentPath)}'`).join("\n"),
    "utf-8",
  );
  await execFileAsync(getFfmpegPath(), [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-an",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
  const outputStat = await stat(outputPath);
  return { filePath: outputPath, listPath, bytes: outputStat.size };
}

async function readProgressFile(filePath: string) {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf-8")) as Partial<VideoGenerationProgress>;
    if (!Array.isArray(parsed.segments)) return null;
    return parsed as VideoGenerationProgress;
  } catch {
    return null;
  }
}

async function downloadedSegmentsFromProgress(progress: VideoGenerationProgress) {
  const validSegments: GeneratedSegment[] = [];
  const latestByOrder = new Map<number, GeneratedSegment>();
  for (const segment of progress.segments) {
    latestByOrder.set(segment.order, segment);
  }

  for (const segment of [...latestByOrder.values()].sort((left, right) => left.order - right.order)) {
    if (await fileExists(segment.downloaded?.filePath)) validSegments.push(segment);
  }
  return validSegments;
}

async function loadProgressByOutputBaseName({
  outputBaseName,
  projectId,
  planId,
  versionIndex,
  beatIndex,
}: {
  outputBaseName: string | null | undefined;
  projectId: string;
  planId: string;
  versionIndex: number;
  beatIndex: number;
}) {
  const safeName = safeOutputBaseName(outputBaseName);
  if (!safeName) return null;
  const progressFilePath = path.join(apiVideoOutDir(), `${safeName}.progress.json`);
  const progress = await readProgressFile(progressFilePath);
  if (
    !progress ||
    progress.projectId !== projectId ||
    progress.planId !== planId ||
    progress.mode !== "full-video" ||
    progress.versionIndex !== versionIndex ||
    progress.beatIndex !== beatIndex
  ) {
    return null;
  }
  return { outputBaseName: safeName, progressFilePath, progress };
}

function missingSegmentsFrom({
  storyboard,
  segments,
}: {
  storyboard: AdaptiveTransferStoryboardShot[];
  segments: GeneratedSegment[];
}) {
  return storyboard
    .map((shot) => {
      const segment = segments.find((item) => item.order === shot.order);
      if (segment?.downloaded) return null;
      return {
        order: shot.order,
        role: shot.role,
        taskId: segment?.taskId ?? null,
        status: providerStatus(segment?.final),
      };
    })
    .filter((segment): segment is { order: number; role: string; taskId: string | null; status: string | null } =>
      Boolean(segment),
    );
}

async function writeMaterialVideoSegment({
  material,
  outputBaseName,
  order,
  durationSeconds,
  slotId,
}: {
  material: SavedUserMaterial;
  outputBaseName: string;
  order: number;
  durationSeconds: number;
  slotId: string;
}) {
  const outDir = apiVideoOutDir();
  await mkdir(outDir, { recursive: true });
  const outputPath = path.join(
    outDir,
    `${outputBaseName}-segment-${String(order).padStart(2, "0")}-user-video.mp4`,
  );
  const offset = trimOffsetForMaterialVideo({
    material,
    order,
    durationSeconds,
    slotId,
  });

  await execFileAsync(getFfmpegPath(), [
    "-y",
    "-stream_loop",
    "-1",
    "-ss",
    String(Number(offset.toFixed(2))),
    "-i",
    material.filePath,
    "-t",
    String(durationSeconds),
    "-vf",
    "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p,setpts=PTS-STARTPTS",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
  const outputStat = await stat(outputPath);
  return { filePath: outputPath, bytes: outputStat.size };
}

async function writeMaterialImageSegment({
  material,
  outputBaseName,
  order,
  durationSeconds,
  slotId,
}: {
  material: SavedUserMaterial;
  outputBaseName: string;
  order: number;
  durationSeconds: number;
  slotId: string;
}) {
  const outDir = apiVideoOutDir();
  await mkdir(outDir, { recursive: true });
  const outputPath = path.join(
    outDir,
    `${outputBaseName}-segment-${String(order).padStart(2, "0")}-user-image.mp4`,
  );

  const frameCount = Math.max(1, Math.round(durationSeconds * 30));
  const zoomDirection =
    slotId === "cta" || order % 2 === 0
      ? "max(1.08-0.0012*on,1.0)"
      : "min(1+0.0012*on,1.08)";

  await execFileAsync(getFfmpegPath(), [
    "-y",
    "-framerate",
    "30",
    "-i",
    material.filePath,
    "-vf",
    `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,zoompan=z='${zoomDirection}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frameCount}:s=1080x1920:fps=30,format=yuv420p`,
    "-an",
    "-frames:v",
    String(frameCount),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
  const outputStat = await stat(outputPath);
  return { filePath: outputPath, bytes: outputStat.size };
}

async function writeUserMaterialSegment({
  candidate,
  outputBaseName,
  order,
  durationSeconds,
  slotId,
}: {
  candidate: MaterialSegmentCandidate;
  outputBaseName: string;
  order: number;
  durationSeconds: number;
  slotId: string;
}) {
  return candidate.material.kind === "video"
    ? writeMaterialVideoSegment({
        material: candidate.material,
        outputBaseName,
        order,
        durationSeconds,
        slotId,
      })
    : writeMaterialImageSegment({
        material: candidate.material,
        outputBaseName,
        order,
        durationSeconds,
        slotId,
      });
}

function localVideoUrl(filePath: string) {
  return `/api/renders/video?path=${encodeURIComponent(filePath)}`;
}

function normalizeFullDurationSeconds(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 15;
  return Math.min(30, Math.max(10, Math.round(parsed)));
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as VideoGenerateRequest;
    const versionIndex = body.versionIndex ?? 0;
    const beatIndex = body.beatIndex ?? 0;
    const mode = body.mode ?? "hook";
    const audioMode = body.audioMode ?? "natural-sfx";
    const packagingMode: PackagingMode = body.packagingMode === "clean" ? "clean" : "smart";
    const packagingLabel = packagingMode === "smart" ? "智能包装" : "干净成片";
    const targetDurationSeconds =
      typeof body.targetDurationSeconds === "undefined"
        ? null
        : normalizeFullDurationSeconds(body.targetDurationSeconds);

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        sampleAnalysis: true,
        generatedPlans: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const planRecord = body.planId
      ? project.generatedPlans.find((record) => record.id === body.planId)
      : project.generatedPlans[0];
    if (!planRecord) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const plan = migratedVideoPlanSchema.parse(planRecord.data);
    const analysis = project.sampleAnalysis
      ? videoStructureAnalysisSchema.parse(project.sampleAnalysis.data)
      : null;
    const version = plan.versions[versionIndex] ?? plan.versions[0];
    const beat = version?.scriptBeats[beatIndex];
    if (!version || (mode === "hook" && !beat)) {
      return NextResponse.json({ error: "Version or beat not found" }, { status: 404 });
    }

    const videoConfig = videoProviderConfig();
    if (mode !== "full-video" && !videoConfig) {
      return NextResponse.json(
        { error: "VIDEO_API_* or ZHIPU_API_KEY is not configured" },
        { status: 400 },
      );
    }

    if (mode === "full-video") {
      const requestedSegmentSeconds =
        process.env.VIDEO_API_SEGMENT_SECONDS || process.env.VIDEO_API_DURATION_SECONDS || "5";
      const adaptiveTransfer = buildAdaptiveTransferStoryboard({
        analysis,
        beats: version.scriptBeats,
        targetBrief: plan.targetBrief,
        userMaterials: project.userMaterials,
        targetDurationSeconds,
        segmentSeconds: Number(requestedSegmentSeconds),
      });
      const directorStoryboard = adaptiveTransfer.shots;
      const segmentSeconds = String(adaptiveTransfer.segmentSeconds);
      const explicitResumeOutputBaseName = safeOutputBaseName(body.resumeOutputBaseName);
      const resumedProgress =
        explicitResumeOutputBaseName
          ? await loadProgressByOutputBaseName({
          outputBaseName: body.resumeOutputBaseName,
          projectId: project.id,
          planId: planRecord.id,
          versionIndex,
          beatIndex,
            })
          : null;
      const outputBaseName =
        resumedProgress?.outputBaseName ??
        `${project.id}-${Date.now()}-${versionIndex}-adaptive-transfer`;
      const progressFilePath = path.join(apiVideoOutDir(), `${outputBaseName}.progress.json`);
      const savedUserMaterials = getSavedUserMaterials(project.userMaterials);
      const materialCandidates = buildMaterialCandidates({
        plan,
        materials: savedUserMaterials,
      });
      const materialSummary = describeUserMaterialsForPrompt(project.userMaterials);
      const segments: GeneratedSegment[] = resumedProgress
        ? await downloadedSegmentsFromProgress(resumedProgress.progress)
        : [];
      for (const segment of segments) {
        const shotIndex = directorStoryboard.findIndex((shot) => shot.order === segment.order);
        const shot = directorStoryboard[shotIndex];
        if (!shot) continue;
        const nextSlotId = slotIdForShot(shot, shotIndex, directorStoryboard.length);
        segment.slotId = nextSlotId;
        if (segment.source !== "aigc-video" && segment.materialLabel) {
          segment.reason = `${slotNameForId(nextSlotId)}复用真实素材「${segment.materialLabel}」，按样例节奏裁切进时间线。`;
          if (!segment.editSummary) {
            segment.editSummary = `${slotNameForId(nextSlotId)}：沿用已生成的真实素材剪辑片段。`;
          }
        }
      }
      const usedMaterialPaths = new Set(
        segments
          .map((segment) =>
            segment.request &&
            typeof segment.request === "object" &&
            typeof (segment.request as { sourcePath?: unknown }).sourcePath === "string"
              ? ((segment.request as { sourcePath: string }).sourcePath)
              : null,
          )
          .filter((filePath): filePath is string => Boolean(filePath)),
      );
      const writeProgress = () =>
        writeVideoGenerationDebug(`${outputBaseName}.progress.json`, {
          projectId: project.id,
          planId: planRecord.id,
          mode,
          audioMode,
          packagingMode,
          versionIndex,
          beatIndex,
          adaptiveTransfer,
          directorStoryboard,
          segmentSeconds,
          materialSummary,
          materialCandidates,
          completedSegments: segments.filter((segment) => Boolean(segment.downloaded)).length,
          totalSegments: directorStoryboard.length,
          outputBaseName,
          progressFilePath,
          segments,
        });
      const buildCurrentRenderStrategy = () => ({
        type: segments.some((segment) => segment.source !== "aigc-video")
          ? segments.some((segment) => segment.source === "aigc-video")
            ? "hybrid-material-aigc"
            : "material-remix"
          : "all-aigc",
        targetDurationSeconds: adaptiveTransfer.targetDurationSeconds,
        sourceMaterialCount: savedUserMaterials.length,
        reusedMaterialSegmentCount: segments.filter((segment) => segment.source !== "aigc-video").length,
        aigcSegmentCount: segments.filter((segment) => segment.source === "aigc-video").length,
        materialSummary,
        decisions: segments.map((segment) => ({
          order: segment.order,
          role: segment.role,
          source: segment.source,
          slotId: segment.slotId,
          materialLabel: segment.materialLabel ?? null,
          provider: segment.provider,
          reason: segment.reason,
          editSummary: segment.editSummary ?? null,
        })),
      });

      for (const [shotIndex, shot] of directorStoryboard.entries()) {
        const existingSegment = segments.find(
          (segment) => segment.order === shot.order && segment.downloaded,
        );
        if (existingSegment) continue;

        const slotId = slotIdForShot(shot, shotIndex, directorStoryboard.length);
        const materialCandidate = pickMaterialCandidate({
          candidates: materialCandidates,
          slotId,
          usedMaterialPaths,
          order: shot.order,
          totalShots: directorStoryboard.length,
        });

        if (materialCandidate) {
          try {
            const editOperation = materialEditOperation({
              candidate: materialCandidate,
              order: shot.order,
              durationSeconds: adaptiveTransfer.segmentSeconds,
              slotId,
            });
            const downloaded = await writeUserMaterialSegment({
              candidate: materialCandidate,
              outputBaseName,
              order: shot.order,
              durationSeconds: adaptiveTransfer.segmentSeconds,
              slotId,
            });
            usedMaterialPaths.add(materialCandidate.material.filePath);
            const exactSlotMatch = materialCandidate.slotIds.includes(slotId);
            upsertSegment(segments, {
              order: shot.order,
              role: shot.role,
              taskId: null,
              videoUrl: null,
              downloaded,
              provider: materialCandidate.material.kind === "video" ? "user-video" : "user-image",
              source: materialCandidate.material.kind === "video" ? "user-video" : "user-image",
              slotId,
              materialLabel: materialCandidate.material.label,
              reason: exactSlotMatch
                ? `${slotNameForId(slotId)}已匹配用户上传的${materialCandidate.material.kind === "video" ? "视频" : "图片"}素材，按样例节奏裁切进时间线。`
                : `${slotNameForId(slotId)}缺少完全匹配素材，已复用相近${materialCandidate.material.kind === "video" ? "视频" : "图片"}素材并用包装补足表达。`,
              editSummary: editOperation.summary,
              request: {
                sourcePath: materialCandidate.material.filePath,
                durationSeconds: adaptiveTransfer.segmentSeconds,
                slotIds: materialCandidate.slotIds,
                visualIndex: materialCandidate.visualIndex,
                visualTotal: materialCandidate.visualTotal,
                editOperation,
              },
              submit: null,
              final: null,
            });
            await writeProgress();
            continue;
          } catch (error) {
            await writeVideoGenerationDebug(`${outputBaseName}.material-fallback.json`, {
              projectId: project.id,
              planId: planRecord.id,
              order: shot.order,
              role: shot.role,
              slotId,
              material: materialCandidate.material,
              error: error instanceof Error ? error.message : "material segment failed",
            });
          }
        }

        if (!videoConfig) {
          const missingSegments = missingSegmentsFrom({ storyboard: directorStoryboard, segments });
          const debugFilePath = await writeVideoGenerationDebug(`${outputBaseName}.json`, {
            projectId: project.id,
            planId: planRecord.id,
            mode,
            audioMode,
          packagingMode,
            versionIndex,
            beatIndex,
            adaptiveTransfer,
            directorStoryboard,
            segmentSeconds,
            materialSummary,
            segments,
            renderStrategy: buildCurrentRenderStrategy(),
            missingSegments,
            outputBaseName,
            progressFilePath,
            error: "No video provider is configured for missing segments.",
          });
          return NextResponse.json(
            {
              error: "当前槽位缺少可复用真实素材，且未配置生成视频模型，无法补齐完整成片。",
              generationStatus: "blocked",
              retryable: false,
              projectId: project.id,
              planId: planRecord.id,
              mode,
              audioMode,
          packagingMode,
              versionIndex,
              beatIndex,
              adaptiveTransfer,
              directorStoryboard,
              segmentSeconds,
              materialSummary,
              segments,
              renderStrategy: buildCurrentRenderStrategy(),
              missingSegments,
              outputBaseName,
              progressFilePath,
              debugFilePath,
            },
            { status: 400 },
          );
        }

        const segmentPrompt = buildSegmentPrompt({
          projectTitle: project.title,
          versionName: version.versionName,
          strategySummary: plan.strategySummary,
          targetBrief: plan.targetBrief,
          shot,
          totalShots: directorStoryboard.length,
        });
        let generated: Awaited<ReturnType<typeof submitVideoGeneration>>;
        try {
          generated = await submitVideoGeneration({
            config: videoConfig,
            prompt: segmentPrompt,
            seconds: segmentSeconds,
            fileName: `${outputBaseName}-segment-${String(shot.order).padStart(2, "0")}.mp4`,
          });
        } catch (error) {
          const errorMessage = publicVideoError(error);
          upsertSegment(segments, {
            order: shot.order,
            role: shot.role,
            taskId: null,
            videoUrl: null,
            downloaded: null,
            provider: videoConfig.provider,
            source: "aigc-video",
            slotId,
            reason: materialCandidate
              ? "真实素材处理失败，生成视频模型暂未完成补齐，已保存进度等待续跑。"
              : "该槽位需要生成视频模型补齐，本次调用暂未完成，已保存进度等待续跑。",
            request: {
              provider: videoConfig.provider,
              seconds: segmentSeconds,
              promptPreview: segmentPrompt.slice(0, 1000),
            },
            submit: null,
            final: {
              status: "RETRYABLE_ERROR",
              error: errorMessage,
            },
          });
          await writeProgress();
          const missingSegments = missingSegmentsFrom({ storyboard: directorStoryboard, segments });
          const debugFilePath = await writeVideoGenerationDebug(`${outputBaseName}.json`, {
            projectId: project.id,
            planId: planRecord.id,
            mode,
            audioMode,
          packagingMode,
            versionIndex,
            beatIndex,
            adaptiveTransfer,
            directorStoryboard,
            segmentSeconds,
            materialSummary,
            segments,
            renderStrategy: buildCurrentRenderStrategy(),
            missingSegments,
            outputBaseName,
            progressFilePath,
            error: errorMessage,
          });

          return NextResponse.json(
            {
              error: errorMessage,
              generationStatus: "processing",
              retryable: true,
              projectId: project.id,
              planId: planRecord.id,
              mode,
              audioMode,
          packagingMode,
              versionIndex,
              beatIndex,
              adaptiveTransfer,
              directorStoryboard,
              segmentSeconds,
              segments,
              renderStrategy: buildCurrentRenderStrategy(),
              missingSegments,
              completedSegments: segments.filter((segment) => Boolean(segment.downloaded)).length,
              totalSegments: directorStoryboard.length,
              outputBaseName,
              progressFilePath,
              debugFilePath,
            },
            { status: 202 },
          );
        }

        upsertSegment(segments, {
          order: shot.order,
          role: shot.role,
          source: "aigc-video",
          slotId,
          reason: materialCandidate
            ? "真实素材处理失败，改用生成视频模型补齐该槽位。"
            : "该槽位没有可直接复用的真实素材，调用生成视频模型补齐。",
          ...generated,
        });
        await writeProgress();
      }

      const renderStrategy = buildCurrentRenderStrategy();

      const segmentPaths = segments
        .map((segment) => segment.downloaded?.filePath)
        .filter((filePath): filePath is string => Boolean(filePath));
      if (segmentPaths.length !== directorStoryboard.length) {
        const missingSegments = missingSegmentsFrom({ storyboard: directorStoryboard, segments });
        const debugFilePath = await writeVideoGenerationDebug(`${outputBaseName}.json`, {
          projectId: project.id,
          planId: planRecord.id,
          mode,
          audioMode,
          packagingMode,
          versionIndex,
          beatIndex,
          adaptiveTransfer,
          directorStoryboard,
          segmentSeconds,
          segments,
          renderStrategy,
          missingSegments,
          outputBaseName,
          progressFilePath,
          error: "Some adaptive transfer video segments did not return downloadable video URLs.",
        });

        return NextResponse.json(
          {
            error: "生成视频模型仍在处理部分分段，已保存当前进度。稍后再次点击“生成成片”会从未完成分段继续。",
            generationStatus: "processing",
            retryable: true,
            projectId: project.id,
            planId: planRecord.id,
            mode,
            audioMode,
          packagingMode,
            versionIndex,
            beatIndex,
            adaptiveTransfer,
            directorStoryboard,
            segmentSeconds,
            segments,
            renderStrategy,
            missingSegments,
            completedSegments: segmentPaths.length,
            totalSegments: directorStoryboard.length,
            outputBaseName,
            progressFilePath,
            debugFilePath,
          },
          { status: 202 },
        );
      }

      let stitched: Awaited<ReturnType<typeof concatSegments>>;
      try {
        stitched = await concatSegments(segmentPaths, outputBaseName);
      } catch (error) {
        const debugFilePath = await writeVideoGenerationDebug(`${outputBaseName}.json`, {
          projectId: project.id,
          planId: planRecord.id,
          mode,
          audioMode,
          packagingMode,
          versionIndex,
          beatIndex,
          adaptiveTransfer,
          directorStoryboard,
          segmentSeconds,
          segments,
          renderStrategy,
          progressFilePath,
          error: error instanceof Error ? error.message : "ffmpeg concat failed",
        });

        return NextResponse.json(
          {
            error: error instanceof Error ? error.message : "ffmpeg concat failed",
            generationStatus: "failed",
            retryable: true,
            projectId: project.id,
            planId: planRecord.id,
            mode,
            audioMode,
          packagingMode,
            versionIndex,
            beatIndex,
            adaptiveTransfer,
            directorStoryboard,
            segmentSeconds,
            segments,
            renderStrategy,
            outputBaseName,
            progressFilePath,
            debugFilePath,
          },
          { status: 502 },
        );
      }
      let packaged: Awaited<ReturnType<typeof packageVideoWithSubtitlesAndAudio>> | null = null;
      if (packagingMode === "smart") {
        try {
          packaged = await packageVideoWithSubtitlesAndAudio({
            inputPath: stitched.filePath,
            outputBaseName,
            outputDir: apiVideoOutDir(),
            storyboard: directorStoryboard,
            segmentSeconds: adaptiveTransfer.segmentSeconds,
          });
        } catch (error) {
          await writeVideoGenerationDebug(`${outputBaseName}.packaging-fallback.json`, {
            projectId: project.id,
            planId: planRecord.id,
            outputBaseName,
            stitched,
            error: error instanceof Error ? error.message : "subtitle/audio packaging failed",
          });
        }
      }
      const packaging = packaged
        ? {
            mode: packagingMode,
            label: packagingLabel,
            subtitles: true,
            audio: true,
            subtitlePath: packaged.subtitlePath,
          }
        : packagingMode === "clean"
          ? {
              mode: packagingMode,
              label: packagingLabel,
              subtitles: false,
              audio: false,
            }
          : {
              mode: packagingMode,
              label: packagingLabel,
              subtitles: false,
              audio: false,
              fallback: "packaging failed; returned clean stitched video",
            };
      const finalVideoPath = packaged?.filePath ?? stitched.filePath;
      const downloaded = {
        filePath: finalVideoPath,
        bytes: packaged?.bytes ?? stitched.bytes,
      };
      const debugFilePath = await writeVideoGenerationDebug(`${outputBaseName}.json`, {
        projectId: project.id,
        planId: planRecord.id,
        mode,
        audioMode,
          packagingMode,
        versionIndex,
        beatIndex,
        adaptiveTransfer,
        directorStoryboard,
        segmentSeconds,
        segments,
        renderStrategy,
        stitched,
        packaged,
        downloaded,
        outputBaseName,
        progressFilePath,
        generationStatus: "completed",
        packaging,
      });

      return NextResponse.json({
        generationStatus: "completed",
        retryable: false,
        projectId: project.id,
        planId: planRecord.id,
        mode,
        audioMode,
          packagingMode,
        versionIndex,
        beatIndex,
        adaptiveTransfer,
        directorStoryboard,
        segmentSeconds,
        segments,
        renderStrategy,
        stitched,
        packaged,
        videoUrl: null,
        localVideoUrl: localVideoUrl(finalVideoPath),
        downloaded,
        completedSegments: directorStoryboard.length,
        totalSegments: directorStoryboard.length,
        outputBaseName,
        progressFilePath,
        debugFilePath,
        packaging,
      });
    }

    if (!videoConfig) {
      return NextResponse.json(
        { error: "VIDEO_API_* or ZHIPU_API_KEY is not configured" },
        { status: 400 },
      );
    }
    const requestedSeconds =
      process.env.VIDEO_API_DURATION_SECONDS || "5";
    const prompt = buildPrompt({
      projectTitle: project.title,
      versionName: version.versionName,
      beat: beat!,
      beatIndex,
      strategySummary: plan.strategySummary,
    });
    const outputBaseName = `${project.id}-${Date.now()}-${versionIndex}-${beatIndex}`;
    const generated = await submitVideoGeneration({
      config: videoConfig,
      prompt,
      seconds: requestedSeconds,
      fileName: `${outputBaseName}.mp4`,
    });
    const debugFilePath = await writeVideoGenerationDebug(`${outputBaseName}.json`, {
      projectId: project.id,
      planId: planRecord.id,
      mode,
      audioMode,
      versionIndex,
      beatIndex,
      directorStoryboard: null,
      prompt,
      request: generated.request,
      taskId: generated.taskId,
      submit: generated.submit,
      final: generated.final,
      videoUrl: generated.videoUrl,
      localVideoUrl: generated.downloaded ? localVideoUrl(generated.downloaded.filePath) : null,
      downloaded: generated.downloaded,
    });

    return NextResponse.json({
      projectId: project.id,
      planId: planRecord.id,
      mode,
      audioMode,
      versionIndex,
      beatIndex,
      directorStoryboard: null,
      prompt,
      request: generated.request,
      taskId: generated.taskId,
      submit: generated.submit,
      final: generated.final,
      videoUrl: generated.videoUrl,
      localVideoUrl: generated.downloaded ? localVideoUrl(generated.downloaded.filePath) : null,
      downloaded: generated.downloaded,
      debugFilePath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generate video failed" },
      { status: 400 },
    );
  }
}
