import { z } from "zod";

import type { MigratedVideoPlan, PlanVersion, VideoStructureAnalysis } from "@/lib/schemas";
import {
  buildTechniqueTransferRecipe,
  sampleTechniqueProfileSchema,
  techniqueTransferRecipeSchema,
  type TechniqueTransferScene,
} from "@/lib/technique-transfer";

const DEFAULT_FPS = 30;
const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1920;

export const captionTokenSchema = z.object({
  text: z.string().min(1),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  emphasis: z.boolean().default(false),
});

export const renderAssetSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["video", "image", "fallback-card", "aigc-placeholder"]),
  src: z.string().optional(),
  label: z.string().min(1),
  slotName: z.string().min(1),
  fit: z.enum(["matched", "partial", "missing", "unknown"]),
  completionPlan: z.string().min(1),
});

export const renderAudioCueSchema = z.object({
  atFrame: z.number().int().min(0),
  type: z.enum(["beat", "hit", "rise", "cta"]),
  intensity: z.number().min(0).max(1),
  label: z.string().min(1),
});

export const renderSceneSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().min(0),
  focus: z.enum(["Hook", "证据", "收益", "包装", "CTA", "推进"]),
  timeRange: z.string().min(1),
  startFrame: z.number().int().min(0),
  durationFrames: z.number().int().positive(),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  captionTokens: z.array(captionTokenSchema).min(1),
  visualLayers: z.array(renderAssetSchema).min(1),
  transition: z.object({
    type: z.enum(["cut", "fade", "wipe", "slide"]),
    durationFrames: z.number().int().min(0),
  }),
  audioCues: z.array(renderAudioCueSchema).default([]),
  materialFit: z.enum(["matched", "partial", "missing", "unknown"]),
  materialSlotName: z.string().min(1),
  completionPlan: z.string().min(1),
  colorMood: z.string().min(1),
});

export const renderTimelineSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  versionName: z.string().min(1),
  renderMode: z.enum(["structure", "high-quality", "commercial"]).default("high-quality"),
  width: z.number().int().positive().default(DEFAULT_WIDTH),
  height: z.number().int().positive().default(DEFAULT_HEIGHT),
  fps: z.number().int().positive().default(DEFAULT_FPS),
  totalFrames: z.number().int().positive(),
  coverTitle: z.string().min(1),
  captionTitle: z.string().min(1),
  audioBedPath: z.string().min(1).nullable().default(null),
  techniqueProfile: sampleTechniqueProfileSchema.nullable().default(null),
  transferRecipe: techniqueTransferRecipeSchema.nullable().default(null),
  scenes: z.array(renderSceneSchema).min(1),
  audioCues: z.array(renderAudioCueSchema).default([]),
  notes: z.array(z.string().min(1)).default([]),
});

export type CaptionToken = z.infer<typeof captionTokenSchema>;
export type RenderAsset = z.infer<typeof renderAssetSchema>;
export type RenderAudioCue = z.infer<typeof renderAudioCueSchema>;
export type RenderScene = z.infer<typeof renderSceneSchema>;
export type RenderTimeline = z.infer<typeof renderTimelineSchema>;

type MaterialLike = {
  slotId?: string;
  slotName?: string;
  src?: string;
  kind?: RenderAsset["kind"];
  label?: string;
  fit?: RenderAsset["fit"];
  completionPlan?: string;
};

type BuildRenderTimelineInput = {
  plan: MigratedVideoPlan;
  analysis?: VideoStructureAnalysis | null;
  materials?: MaterialLike[];
  fps?: number;
  width?: number;
  height?: number;
};

function parseTimeRange(timeRange: string, index: number) {
  const match = timeRange.match(/(\d+(?:\.\d+)?)\s*s?\s*-\s*(\d+(?:\.\d+)?)\s*s?/i);
  if (!match) {
    const startSecond = index * 5;
    return { startSecond, endSecond: startSecond + 5 };
  }

  const startSecond = Number(match[1]);
  const endSecond = Number(match[2]);
  if (!Number.isFinite(startSecond) || !Number.isFinite(endSecond)) {
    const fallbackStart = index * 5;
    return { startSecond: fallbackStart, endSecond: fallbackStart + 5 };
  }

  return {
    startSecond,
    endSecond: Math.max(endSecond, startSecond + 1),
  };
}

function compact(text: string, maxLength: number) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1))}…`;
}

function classifyFocus(text: string): RenderScene["focus"] {
  if (/cta|结尾|行动|转化|入口|收藏|领取|下单|私信|购买/i.test(text)) return "CTA";
  if (/hook|开头|停留|吸引|反差|抢|冲突|痛点/i.test(text)) return "Hook";
  if (/证据|背书|可信|反馈|评价|参数|数据|证明|对比/i.test(text)) return "证据";
  if (/收益|场景|适用|利益|省|提升|结果|价值|效果/i.test(text)) return "收益";
  if (/包装|字幕|转场|节奏|卡点|贴纸|标题条|封面/i.test(text)) return "包装";
  return "推进";
}

function transitionForFocus(
  focus: RenderScene["focus"],
  index: number,
  transfer?: TechniqueTransferScene,
): RenderScene["transition"] {
  if (index === 0) return { type: "cut", durationFrames: 0 };
  if (transfer?.transitionStyle === "flash-cut") return { type: "cut", durationFrames: 6 };
  if (transfer?.transitionStyle === "wipe-slide") return { type: "slide", durationFrames: 14 };
  if (transfer?.transitionStyle === "soft-fade") return { type: "fade", durationFrames: 16 };
  if (focus === "Hook") return { type: "slide", durationFrames: 12 };
  if (focus === "CTA") return { type: "wipe", durationFrames: 16 };
  if (focus === "证据") return { type: "fade", durationFrames: 10 };
  return { type: index % 2 === 0 ? "slide" : "wipe", durationFrames: 12 };
}

function materialFitFromPlan(plan: MigratedVideoPlan, index: number, focus: RenderScene["focus"]) {
  const slots = plan.materialAdaptation?.slots ?? [];
  const patterns: Record<RenderScene["focus"], RegExp> = {
    Hook: /开头|吸引|结果|反差|hook/i,
    证据: /证据|背书|对比|特写|主体|商品/i,
    收益: /使用|过程|场景|收益|结果/i,
    包装: /包装|字幕|封面|标题|贴纸/i,
    CTA: /结尾|行动|cta|转化|入口/i,
    推进: /过程|主体|场景/i,
  };

  return (
    slots.find((slot) =>
      patterns[focus].test(`${slot.slotName} ${slot.requiredFor} ${slot.requiredMaterial}`),
    ) ??
    slots[index] ??
    null
  );
}

function tokenizeCaption(text: string, startFrame: number, durationFrames: number, fps: number) {
  const source = compact(text || "补充口播字幕", 64);
  const rawTokens = source
    .replace(/([，。！？；,.!?;])/g, "$1 ")
    .split(/\s+/)
    .filter(Boolean);
  const tokens = rawTokens.length ? rawTokens : [source];
  const sceneStartMs = Math.round((startFrame / fps) * 1000);
  const tokenStepMs = Math.max(120, Math.round((durationFrames / fps / tokens.length) * 1000));

  return tokens.map((token, index) => ({
    text: token,
    startMs: sceneStartMs + index * tokenStepMs,
    endMs: sceneStartMs + (index + 1) * tokenStepMs,
    emphasis: /别|关键|第一|第二|真正|收藏|领取|错|变化|收益|结果|省|少踩坑/i.test(token),
  }));
}

function audioCuesForScene({
  scene,
  startFrame,
  durationFrames,
  transfer,
}: {
  scene: Pick<RenderScene, "focus" | "title">;
  startFrame: number;
  durationFrames: number;
  transfer?: TechniqueTransferScene;
}): RenderAudioCue[] {
  const strong = scene.focus === "Hook" || scene.focus === "CTA";
  const transferredIntensity = transfer ? transfer.beatIntensity / 100 : null;
  const midFrame = startFrame + Math.round(durationFrames * 0.48);
  const cues: RenderAudioCue[] = [
    {
      atFrame: startFrame,
      type: strong ? "hit" : "beat",
      intensity: transferredIntensity
        ? Math.max(strong ? 0.72 : 0.44, transferredIntensity)
        : strong
          ? 0.92
          : 0.58,
      label: transfer
        ? `迁移 ${transfer.sampleTimeRange} ${transfer.sourcePurpose}`
        : `${scene.focus} 入场`,
    },
  ];

  if (durationFrames > 90) {
    cues.push({
      atFrame: midFrame,
      type: scene.focus === "CTA" ? "cta" : "rise",
      intensity: transferredIntensity
        ? Math.max(strong ? 0.66 : 0.38, transferredIntensity * 0.86)
        : strong
          ? 0.82
          : 0.48,
      label: transfer ? compact(transfer.transferableRule, 16) : compact(scene.title, 16),
    });
  }

  return cues;
}

function createVisualLayer({
  plan,
  materials,
  index,
  focus,
  fallbackLabel,
}: {
  plan: MigratedVideoPlan;
  materials: MaterialLike[];
  index: number;
  focus: RenderScene["focus"];
  fallbackLabel: string;
}): RenderAsset {
  const slot = materialFitFromPlan(plan, index, focus);
  const explicit = materials.find((item) => {
    if (!slot) return false;
    return item.slotId === slot.slotId || item.slotName === slot.slotName;
  });

  return {
    id: explicit?.slotId || slot?.slotId || `scene-${index + 1}-asset`,
    kind: explicit?.kind || (explicit?.src ? "video" : slot?.fit === "missing" ? "aigc-placeholder" : "fallback-card"),
    src: explicit?.src,
    label: explicit?.label || slot?.matchedMaterial || fallbackLabel,
    slotName: explicit?.slotName || slot?.slotName || "待确认素材槽位",
    fit: explicit?.fit || slot?.fit || "unknown",
    completionPlan: explicit?.completionPlan || slot?.completionPlan || "用包装卡片、字幕和素材复用补足表达。",
  };
}

export function selectBestPlanVersion(plan: MigratedVideoPlan): PlanVersion {
  return (
    plan.versions.find((version) => version.versionName === plan.evaluation?.bestVersion) ??
    plan.versions[0]!
  );
}

export function buildRenderTimelineFromPlan({
  plan,
  analysis = null,
  materials = [],
  fps = DEFAULT_FPS,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: BuildRenderTimelineInput): RenderTimeline {
  const version = selectBestPlanVersion(plan);
  const transferRecipe = analysis
    ? buildTechniqueTransferRecipe({ analysis, plan, version })
    : null;
  const scenes = version.scriptBeats.map((beat, index) => {
    const { startSecond, endSecond } = parseTimeRange(beat.timeRange, index);
    const startFrame = Math.round(startSecond * fps);
    const durationFrames = Math.max(30, Math.round((endSecond - startSecond) * fps));
    const focus = classifyFocus(
      `${beat.shotPurpose} ${beat.sellingPointIntent} ${beat.packagingStyle} ${beat.transitionAndRhythm}`,
    );
    const visualLayer = createVisualLayer({
      plan,
      materials,
      index,
      focus,
      fallbackLabel: beat.visualSuggestion,
    });
    const sceneCore = {
      focus,
      title: compact(beat.shotPurpose, 24),
    };
    const transfer = transferRecipe?.sceneTransfers[index];

    return {
      id: `scene-${index + 1}`,
      index,
      focus,
      timeRange: beat.timeRange,
      startFrame,
      durationFrames,
      title: sceneCore.title,
      subtitle: beat.voiceoverOrSubtitle,
      captionTokens: tokenizeCaption(beat.voiceoverOrSubtitle, startFrame, durationFrames, fps),
      visualLayers: [visualLayer],
      transition: transitionForFocus(focus, index, transfer),
      audioCues: audioCuesForScene({ scene: sceneCore, startFrame, durationFrames, transfer }),
      materialFit: visualLayer.fit,
      materialSlotName: visualLayer.slotName,
      completionPlan: visualLayer.completionPlan,
      colorMood: focus === "CTA" ? "conversion-rose" : focus === "证据" ? "evidence-blue" : "impact-warm",
    } satisfies RenderScene;
  });

  const maxEndFrame = Math.max(
    ...scenes.map((scene) => scene.startFrame + scene.durationFrames),
    Math.round(15 * fps),
  );
  const audioCues = scenes.flatMap((scene) => scene.audioCues);

  return renderTimelineSchema.parse({
    id: `${plan.projectTitle}-${version.versionName}`.replace(/\s+/g, "-"),
    title: plan.projectTitle,
    versionName: version.versionName,
    renderMode: "high-quality",
    width,
    height,
    fps,
    totalFrames: maxEndFrame + Math.round(3 * fps),
    coverTitle: version.coverTitle,
    captionTitle: version.captionTitle,
    audioBedPath: null,
    techniqueProfile: transferRecipe?.sourceProfile ?? null,
    transferRecipe,
    scenes,
    audioCues,
    notes: [
      "LLM 只生成受控 RenderTimeline JSON，Remotion 只渲染白名单组件。",
      "真实素材不足时，用字幕、包装卡片和 AIGC 占位提示补足结构槽位。",
      transferRecipe
        ? "最终成片的节奏、字幕密度、包装标签和转场倾向来自样例手法迁移配方。"
        : "未提供样例分析时，渲染使用方案脚本的默认节奏。",
    ],
  });
}
