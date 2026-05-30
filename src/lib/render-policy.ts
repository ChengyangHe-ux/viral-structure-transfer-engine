import { z } from "zod";

export const heroVideoApprovalFlag = "human-approved-hero-video";

export const slotKindSchema = z.enum([
  "hero",
  "product-closeup",
  "broll",
  "transition",
  "atmosphere",
  "cta",
  "unknown",
]);

export const visualAssetSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  kind: z.enum(["image", "video"]),
  slotId: z.string().min(1).optional(),
  slotKind: slotKindSchema.default("unknown"),
  sceneIndex: z.number().int().min(0).optional(),
  source: z.enum(["user-upload", "aigc-image", "generated-video", "fallback"]).default("fallback"),
  riskFlags: z.array(z.string().min(1)).default([]),
});

export const visualAssetManifestSchema = z.object({
  assets: z.array(visualAssetSchema).default([]),
});

export const sceneAssetDecisionSchema = z.object({
  sceneIndex: z.number().int().min(0),
  slotKind: slotKindSchema,
  imagePath: z.string().min(1).nullable().default(null),
  videoPath: z.string().min(1).nullable().default(null),
  useVideo: z.boolean(),
  reason: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high"]),
  riskFlags: z.array(z.string().min(1)).default([]),
});

export type SlotKind = z.infer<typeof slotKindSchema>;
export type VisualAsset = z.infer<typeof visualAssetSchema>;
export type VisualAssetManifest = z.infer<typeof visualAssetManifestSchema>;
export type SceneAssetDecision = z.infer<typeof sceneAssetDecisionSchema>;

const sceneSlotPriority: SlotKind[][] = [
  ["hero", "product-closeup"],
  ["product-closeup", "broll", "transition"],
  ["broll", "atmosphere", "transition"],
  ["cta", "product-closeup", "broll"],
];

function isHeroLikeSlot(slotKind: SlotKind) {
  return slotKind === "hero" || slotKind === "product-closeup";
}

function isHumanApprovedHeroVideo(asset: VisualAsset) {
  return asset.riskFlags.includes(heroVideoApprovalFlag);
}

function rankAssetForScene(asset: VisualAsset, sceneIndex: number) {
  if (asset.sceneIndex === sceneIndex) return 0;
  const priorities = sceneSlotPriority[sceneIndex] ?? ["unknown"];
  const slotRank = priorities.indexOf(asset.slotKind);
  if (slotRank >= 0) return 10 + slotRank;
  return 100;
}

function pickAsset({
  assets,
  sceneIndex,
  kind,
}: {
  assets: VisualAsset[];
  sceneIndex: number;
  kind: VisualAsset["kind"];
}) {
  return assets
    .filter((asset) => asset.kind === kind)
    .map((asset) => ({ asset, rank: rankAssetForScene(asset, sceneIndex) }))
    .filter((item) => item.rank < 100)
    .sort((a, b) => a.rank - b.rank)[0]?.asset;
}

function canUseVideoForScene(asset: VisualAsset | undefined, sceneIndex: number) {
  if (!asset) {
    return {
      useVideo: false,
      riskLevel: "low" as const,
      reason: "没有可用视频素材，使用图片或包装层稳定出片。",
    };
  }

  const heroLikeScene = sceneIndex === 0 || isHeroLikeSlot(asset.slotKind);
  if (asset.source === "generated-video" && heroLikeScene && !isHumanApprovedHeroVideo(asset)) {
    return {
      useVideo: false,
      riskLevel: "high" as const,
      reason: "生成视频不直接用于开场商品特写，避免杯身、冰块、液体边缘逐帧形变。",
    };
  }

  if (asset.source === "generated-video") {
    return {
      useVideo: true,
      riskLevel: "medium" as const,
      reason: "生成视频仅作为中段 B-roll/氛围镜头使用，主结构仍由 Remotion 控制。",
    };
  }

  return {
    useVideo: true,
    riskLevel: "low" as const,
    reason: "真实或人工确认视频素材可进入当前场景。",
  };
}

export function decideSceneAssetUsage(
  manifestInput: VisualAssetManifest,
  sceneCount: number,
): SceneAssetDecision[] {
  const manifest = visualAssetManifestSchema.parse(manifestInput);
  const assets = manifest.assets;

  return Array.from({ length: sceneCount }).map((_, sceneIndex) => {
    const image = pickAsset({ assets, sceneIndex, kind: "image" });
    const video = pickAsset({ assets, sceneIndex, kind: "video" });
    const videoPolicy = canUseVideoForScene(video, sceneIndex);
    const slotKind =
      video?.slotKind ??
      image?.slotKind ??
      sceneSlotPriority[sceneIndex]?.[0] ??
      ("unknown" as SlotKind);
    const riskFlags = Array.from(new Set([...(image?.riskFlags ?? []), ...(video?.riskFlags ?? [])]));

    return sceneAssetDecisionSchema.parse({
      sceneIndex,
      slotKind,
      imagePath: image?.path ?? null,
      videoPath: video?.path ?? null,
      useVideo: videoPolicy.useVideo,
      reason: videoPolicy.reason,
      riskLevel: videoPolicy.riskLevel,
      riskFlags,
    });
  });
}

export function isSceneVideoAllowed(decision: SceneAssetDecision | undefined) {
  if (!decision?.useVideo || !decision.videoPath) return false;
  if (decision.sceneIndex === 0 && !decision.riskFlags.includes(heroVideoApprovalFlag)) {
    return false;
  }
  return true;
}
