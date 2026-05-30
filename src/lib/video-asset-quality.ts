import { heroVideoApprovalFlag, type SlotKind } from "@/lib/render-policy";

export type GeneratedVideoAssetVerdict = "accept" | "review" | "reject";

export type GeneratedVideoAssetReportInput = {
  inputPath: string;
  slotKind: SlotKind;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  riskFlags?: string[];
};

export type GeneratedVideoAssetReport = GeneratedVideoAssetReportInput & {
  riskFlags: string[];
  score: number;
  verdict: GeneratedVideoAssetVerdict;
  recommendedUse: string;
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isHeroLikeSlot(slotKind: SlotKind) {
  return slotKind === "hero" || slotKind === "product-closeup";
}

function verdictFor(score: number): GeneratedVideoAssetVerdict {
  if (score >= 82) return "accept";
  if (score >= 62) return "review";
  return "reject";
}

export function scoreGeneratedVideoAsset(
  input: GeneratedVideoAssetReportInput,
): GeneratedVideoAssetReport {
  const risks = [...(input.riskFlags ?? [])];
  let score = 100;

  if (input.width < 720 || input.height < 720) {
    risks.push("low-resolution");
    score -= 24;
  }

  if (input.height < input.width) {
    risks.push("not-vertical");
    score -= 12;
  }

  if (input.width < 960 || input.height < 1280) {
    risks.push("below-premium-vertical-size");
    score -= 10;
  }

  if (input.fps < 24) {
    risks.push("low-fps");
    score -= 16;
  }

  if (input.durationSeconds < 2) {
    risks.push("too-short-for-broll");
    score -= 20;
  }

  if (!input.hasAudio) {
    risks.push("needs-audio-bed");
  }

  if (isHeroLikeSlot(input.slotKind) && !risks.includes(heroVideoApprovalFlag)) {
    risks.push("generated-video-unsafe-for-hero");
    score = Math.min(score, 60);
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const normalizedRisks = unique(risks);
  const verdict = isHeroLikeSlot(input.slotKind) && normalizedRisks.includes("generated-video-unsafe-for-hero")
    ? "reject"
    : verdictFor(boundedScore);
  const recommendedUse =
    verdict === "accept"
      ? "可作为中段 B-roll、转场垫片或氛围镜头进入 Remotion 时间线。"
      : verdict === "review"
        ? "建议人工预览后只用于中段辅助镜头，并保留图片动效回退。"
        : "不要作为开场商品主视觉；改用稳定图片推镜或重新生成 B-roll。";

  return {
    ...input,
    riskFlags: normalizedRisks,
    score: boundedScore,
    verdict,
    recommendedUse,
  };
}
