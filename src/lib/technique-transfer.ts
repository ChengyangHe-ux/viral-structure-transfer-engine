import { z } from "zod";

import { buildMigrationMap } from "@/lib/mapping";
import type {
  MigratedVideoPlan,
  PlanVersion,
  VideoStructureAnalysis,
} from "@/lib/schemas";
import { buildStructureFingerprint } from "@/lib/structure-fingerprint";

const focusSchema = z.enum(["Hook", "证据", "收益", "包装", "CTA", "推进"]);

export const sampleTechniqueProfileSchema = z.object({
  summary: z.string().min(1),
  durationSeconds: z.number().positive(),
  hookWindowSeconds: z.number().positive(),
  ctaHoldSeconds: z.number().positive(),
  shotDensityPer10s: z.number().nonnegative(),
  subtitleDensityPer10s: z.number().nonnegative(),
  captionPlacement: z.enum(["top", "middle", "bottom"]),
  captionDensity: z.enum(["light", "medium", "dense"]),
  transitionStyle: z.enum(["hard-cut", "flash-cut", "wipe-slide", "soft-fade"]),
  motionStyle: z.enum(["static-proof", "push-in", "fast-cut", "beat-synced"]),
  packagingTags: z.array(z.string().min(1)),
  rhythmCurve: z.array(
    z.object({
      index: z.number().int().min(0),
      timeRange: z.string().min(1),
      focus: focusSchema,
      intensity: z.number().int().min(0).max(100),
      durationWeight: z.number().positive(),
      label: z.string().min(1),
    }),
  ),
});

export const techniqueTransferSceneSchema = z.object({
  index: z.number().int().min(1),
  sourceBeatIndex: z.number().int().min(0),
  sampleTimeRange: z.string().min(1),
  sourcePurpose: z.string().min(1),
  transferableRule: z.string().min(1),
  outputTimeRange: z.string().min(1),
  outputPurpose: z.string().min(1),
  outputLine: z.string().min(1),
  mappedTechnique: z.string().min(1),
  materialSlotName: z.string().min(1),
  materialFit: z.enum(["matched", "partial", "missing", "unknown"]),
  completionPlan: z.string().min(1),
  durationWeight: z.number().positive(),
  beatIntensity: z.number().int().min(0).max(100),
  transitionStyle: sampleTechniqueProfileSchema.shape.transitionStyle,
  captionPlacement: sampleTechniqueProfileSchema.shape.captionPlacement,
  captionDensity: sampleTechniqueProfileSchema.shape.captionDensity,
  packagingTags: z.array(z.string().min(1)),
  inheritedFromSample: z.array(z.string().min(1)),
});

export const techniqueTransferRecipeSchema = z.object({
  summary: z.string().min(1),
  sourceProfile: sampleTechniqueProfileSchema,
  sceneTransfers: z.array(techniqueTransferSceneSchema).min(1),
});

export type SampleTechniqueProfile = z.infer<typeof sampleTechniqueProfileSchema>;
export type TechniqueTransferScene = z.infer<typeof techniqueTransferSceneSchema>;
export type TechniqueTransferRecipe = z.infer<typeof techniqueTransferRecipeSchema>;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function compact(text: string, maxLength: number) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1))}…`;
}

function toRenderFocus(focus: string): z.infer<typeof focusSchema> {
  if (focus === "hook") return "Hook";
  if (focus === "proof") return "证据";
  if (focus === "benefit") return "收益";
  if (focus === "packaging") return "包装";
  if (focus === "cta") return "CTA";
  return "推进";
}

function inferCaptionPlacement(analysis: VideoStructureAnalysis) {
  const placement = analysis.subtitleLayout.placement;
  if (/顶|上|顶部|上方/.test(placement)) return "top" as const;
  if (/底|下|底部|下方|安全区/.test(placement)) return "bottom" as const;
  if (/中|中央|画面中/.test(placement)) return "middle" as const;
  return "bottom" as const;
}

function inferCaptionDensity(analysis: VideoStructureAnalysis, subtitleDensityPer10s: number) {
  const density = analysis.subtitleLayout.density;
  if (/高|密|每屏|短句|8-16|8~16|8 到 16/.test(density) || subtitleDensityPer10s >= 6) {
    return "dense" as const;
  }
  if (/低|少|克制|留白/.test(density) || subtitleDensityPer10s <= 2.2) {
    return "light" as const;
  }
  return "medium" as const;
}

function inferTransitionStyle(analysis: VideoStructureAnalysis) {
  const source = [
    analysis.pacing.rhythmNotes,
    analysis.visualPackaging.motionGraphics,
    analysis.visualPackaging.editingNotes,
    analysis.musicAndBeats.map((beat) => `${beat.audioCue} ${beat.editingResponse}`).join(" "),
  ].join(" ");

  if (/卡点|重拍|鼓点|快切|切镜|0\.3|0\.5|音效点/.test(source)) return "flash-cut" as const;
  if (/滑|推|擦|wipe|slide|划入/.test(source)) return "wipe-slide" as const;
  if (/淡入|淡出|柔和|慢/.test(source)) return "soft-fade" as const;
  return "hard-cut" as const;
}

function inferMotionStyle(analysis: VideoStructureAnalysis, shotDensityPer10s: number) {
  const source = [
    analysis.pacing.opening,
    analysis.pacing.middle,
    analysis.pacing.rhythmNotes,
    analysis.visualPackaging.framing,
    analysis.visualPackaging.motionGraphics,
  ].join(" ");

  if (/卡点|重拍|鼓点|音乐/.test(source)) return "beat-synced" as const;
  if (shotDensityPer10s >= 2.2 || /快切|快速|加速/.test(source)) return "fast-cut" as const;
  if (/推近|推进|特写|主体居中|近景|微距/.test(source)) return "push-in" as const;
  return "static-proof" as const;
}

function firstBeatDurationSeconds(analysis: VideoStructureAnalysis) {
  const first = buildStructureFingerprint(analysis).rhythmCurve[0];
  if (!first) return 3;
  return clamp(round(first.endSecond - first.startSecond, 1), 1.2, 4.5);
}

function ctaHoldSeconds(analysis: VideoStructureAnalysis) {
  const fingerprint = buildStructureFingerprint(analysis);
  const cta =
    [...fingerprint.rhythmCurve].reverse().find((point) => point.focus === "cta") ??
    fingerprint.rhythmCurve.at(-1);
  if (!cta) return 2.4;
  return clamp(round(cta.endSecond - cta.startSecond, 1), 1.8, 5);
}

export function buildSampleTechniqueProfile(
  analysis: VideoStructureAnalysis,
): SampleTechniqueProfile {
  const fingerprint = buildStructureFingerprint(analysis);
  const totalDuration = Math.max(fingerprint.durationSeconds, 1);
  const transitionStyle = inferTransitionStyle(analysis);
  const captionDensity = inferCaptionDensity(analysis, fingerprint.subtitleDensityPer10s);
  const rhythmCurve = fingerprint.rhythmCurve.map((point) => {
    const duration = Math.max(0.6, point.endSecond - point.startSecond);
    return {
      index: point.index,
      timeRange: point.timeRange,
      focus: toRenderFocus(point.focus),
      intensity: point.intensity,
      durationWeight: round(duration / totalDuration, 4),
      label: point.label,
    };
  });

  return sampleTechniqueProfileSchema.parse({
    summary: fingerprint.summary,
    durationSeconds: fingerprint.durationSeconds,
    hookWindowSeconds: firstBeatDurationSeconds(analysis),
    ctaHoldSeconds: ctaHoldSeconds(analysis),
    shotDensityPer10s: fingerprint.shotDensityPer10s,
    subtitleDensityPer10s: fingerprint.subtitleDensityPer10s,
    captionPlacement: inferCaptionPlacement(analysis),
    captionDensity,
    transitionStyle,
    motionStyle: inferMotionStyle(analysis, fingerprint.shotDensityPer10s),
    packagingTags: fingerprint.packagingTags,
    rhythmCurve,
  });
}

function selectVersion(plan: MigratedVideoPlan, version?: PlanVersion) {
  return (
    version ??
    plan.versions.find((item) => item.versionName === plan.evaluation?.bestVersion) ??
    plan.versions[0]
  );
}

function inheritedTags({
  profile,
  rule,
  outputPurpose,
}: {
  profile: SampleTechniqueProfile;
  rule: string;
  outputPurpose: string;
}) {
  const tags = [
    ...profile.packagingTags.slice(0, 3),
    /结果|前置|反差|hook|停留/i.test(`${rule} ${outputPurpose}`) ? "结果前置" : "",
    /证据|背书|证明|评价/.test(`${rule} ${outputPurpose}`) ? "证据推进" : "",
    /CTA|行动|转化|结尾/i.test(`${rule} ${outputPurpose}`) ? "行动收束" : "",
  ].filter(Boolean);

  return Array.from(new Set(tags)).slice(0, 5);
}

export function buildTechniqueTransferRecipe({
  analysis,
  plan,
  version,
}: {
  analysis: VideoStructureAnalysis;
  plan: MigratedVideoPlan;
  version?: PlanVersion;
}): TechniqueTransferRecipe {
  const selectedVersion = selectVersion(plan, version);
  if (!selectedVersion) {
    throw new Error("Cannot build technique transfer recipe without a plan version.");
  }

  const sourceProfile = buildSampleTechniqueProfile(analysis);
  const rows = buildMigrationMap({ analysis, plan, version: selectedVersion });
  const sceneTransfers = rows.map((row, index) => {
    const sourceBeatIndex = Math.min(index, sourceProfile.rhythmCurve.length - 1);
    const sourceBeat = sourceProfile.rhythmCurve[sourceBeatIndex];
    const beatIntensity = sourceBeat?.intensity ?? (index === 0 ? 84 : 68);
    const durationWeight = sourceBeat?.durationWeight ?? 1 / Math.max(rows.length, 1);
    const inheritedFromSample = inheritedTags({
      profile: sourceProfile,
      rule: row.sampleRule,
      outputPurpose: row.outputPurpose,
    });

    return {
      index: row.index,
      sourceBeatIndex,
      sampleTimeRange: row.sampleTimeRange,
      sourcePurpose: row.samplePurpose,
      transferableRule: row.sampleRule,
      outputTimeRange: row.outputTimeRange,
      outputPurpose: row.outputPurpose,
      outputLine: row.outputLine,
      mappedTechnique: `迁移样例 ${row.sampleTimeRange} 的“${row.samplePurpose}”：${row.sampleRule}；新片段用“${row.outputPurpose}”承接。`,
      materialSlotName: row.materialSlotName,
      materialFit: row.materialFit,
      completionPlan: row.completionPlan,
      durationWeight,
      beatIntensity,
      transitionStyle: sourceProfile.transitionStyle,
      captionPlacement: sourceProfile.captionPlacement,
      captionDensity: sourceProfile.captionDensity,
      packagingTags: inheritedFromSample,
      inheritedFromSample: [
        `${row.sampleTimeRange} ${row.samplePurpose}`,
        compact(row.sampleRule, 28),
        ...inheritedFromSample,
      ],
    };
  });

  return techniqueTransferRecipeSchema.parse({
    sourceProfile,
    sceneTransfers,
    summary: `从样例抽取 ${sourceProfile.shotDensityPer10s} 镜/10s、${sourceProfile.captionDensity} 字幕密度、${sourceProfile.transitionStyle} 转场倾向，并映射到 ${selectedVersion.versionName} 的 ${sceneTransfers.length} 个镜头槽位。`,
  });
}
