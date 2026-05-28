import type { VideoStructureAnalysis } from "@/lib/schemas";

export type StructureFocus = "hook" | "proof" | "benefit" | "cta" | "packaging";

export type StructureFingerprintPoint = {
  index: number;
  timeRange: string;
  startSecond: number;
  endSecond: number;
  focus: StructureFocus;
  intensity: number;
  label: string;
};

export type StructureFingerprint = {
  durationSeconds: number;
  hookStrength: number;
  shotDensityPer10s: number;
  subtitleDensityPer10s: number;
  proofPositionPercent: number;
  ctaPositionPercent: number;
  rhythmCurve: StructureFingerprintPoint[];
  packagingTags: string[];
  summary: string;
};

type ParsedBeat = {
  timeRange: string;
  startSecond: number;
  endSecond: number;
  text: string;
  purpose: string;
};

const DEFAULT_DURATION_SECONDS = 30;

const hookPattern = /hook|钩子|抓|注意|停留|反差|痛点|结果|开头|前置/i;
const proofPattern = /证据|可信|背书|评价|参数|证明|为什么|成立|数据|反馈|过程/i;
const benefitPattern = /收益|利益|场景|适用|人群|效果|价值|放大|转化成/i;
const ctaPattern = /cta|行动|转化|收藏|领取|购买|试用|查看|结尾|入口|私信/i;
const packagingPattern = /字幕|包装|贴纸|标题|转场|封面|箭头|高亮|卡片|分屏|进度条|描边/i;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseTimeToken(token: string) {
  const normalized = token
    .trim()
    .replace(/[秒sS]/g, "")
    .replace(/：/g, ":")
    .replace(/[^\d.:]/g, "");

  if (!normalized) return null;

  if (normalized.includes(":")) {
    const parts = normalized
      .split(":")
      .map((part) => Number(part))
      .filter((part) => Number.isFinite(part));

    if (!parts.length) return null;

    return parts.reduce((total, part) => total * 60 + part, 0);
  }

  const seconds = Number(normalized);
  return Number.isFinite(seconds) ? seconds : null;
}

function parseTimeRange(timeRange: string, fallbackStartSecond: number) {
  const parts = timeRange
    .replace(/[～~–—至到]/g, "-")
    .split("-")
    .map((part) => part.trim());

  const parsedStart = parts[0] ? parseTimeToken(parts[0]) : null;
  const parsedEnd = parts[1] ? parseTimeToken(parts[1]) : null;
  const startSecond = parsedStart ?? fallbackStartSecond;
  const endSecond = parsedEnd ?? startSecond + 6;

  if (endSecond <= startSecond) {
    return {
      startSecond,
      endSecond: startSecond + 6,
    };
  }

  return {
    startSecond,
    endSecond,
  };
}

function parseBeats(analysis: VideoStructureAnalysis): ParsedBeat[] {
  let cursor = 0;

  return analysis.beatMap.map((beat) => {
    const parsed = parseTimeRange(beat.timeRange, cursor);
    cursor = parsed.endSecond;

    return {
      timeRange: beat.timeRange,
      startSecond: parsed.startSecond,
      endSecond: parsed.endSecond,
      purpose: beat.shotPurpose,
      text: [
        beat.shotPurpose,
        beat.visualObservation,
        beat.captionObservation,
        beat.transferableRule,
      ].join(" "),
    };
  });
}

function inferDuration(analysis: VideoStructureAnalysis, beats: ParsedBeat[]) {
  if (analysis.durationSeconds && Number.isFinite(analysis.durationSeconds)) {
    return round(analysis.durationSeconds);
  }

  const maxBeatEnd = Math.max(0, ...beats.map((beat) => beat.endSecond));
  return maxBeatEnd > 0 ? round(maxBeatEnd) : DEFAULT_DURATION_SECONDS;
}

function classifyFocus(beat: ParsedBeat, index: number, total: number): StructureFocus {
  if (index === 0) return "hook";
  if (ctaPattern.test(beat.text) || index === total - 1) return "cta";
  if (hookPattern.test(beat.text)) return "hook";
  if (proofPattern.test(beat.text)) return "proof";
  if (benefitPattern.test(beat.text)) return "benefit";
  if (packagingPattern.test(beat.text)) return "packaging";
  return "proof";
}

function buildIntensity({
  beat,
  focus,
  durationSeconds,
}: {
  beat: ParsedBeat;
  focus: StructureFocus;
  durationSeconds: number;
}) {
  const focusBase: Record<StructureFocus, number> = {
    hook: 84,
    proof: 66,
    benefit: 72,
    cta: 82,
    packaging: 60,
  };
  const beatDuration = Math.max(1, beat.endSecond - beat.startSecond);
  const durationRatio = beatDuration / durationSeconds;
  const compactBonus = durationRatio <= 0.12 ? 9 : durationRatio >= 0.35 ? -7 : 0;
  const keywordBonus = /反差|痛点|结果|证据|高亮|行动|三连|收束|卡点/.test(beat.text) ? 5 : 0;

  return clamp(Math.round(focusBase[focus] + compactBonus + keywordBonus), 35, 100);
}

function calculateHookStrength(analysis: VideoStructureAnalysis, beats: ParsedBeat[]) {
  const firstBeat = beats[0];
  const firstBeatDuration = firstBeat ? firstBeat.endSecond - firstBeat.startSecond : 6;
  const hookCountBonus = clamp(analysis.hookPatterns.length, 0, 3) * 8;
  const firstBeatBonus = firstBeat && hookPattern.test(firstBeat.text) ? 12 : 0;
  const compactOpeningBonus = firstBeatDuration <= 3.5 ? 10 : 0;
  const promiseBonus = hookPattern.test(analysis.contentPromise) ? 6 : 0;

  return clamp(52 + hookCountBonus + firstBeatBonus + compactOpeningBonus + promiseBonus, 0, 100);
}

function estimateSubtitleDensity(analysis: VideoStructureAnalysis, durationSeconds: number) {
  const captionChars = analysis.beatMap.reduce(
    (total, beat) => total + beat.captionObservation.replace(/\s/g, "").length,
    0,
  );
  const densityText = analysis.subtitleLayout.density;
  const densityBoost = /高|密|每屏|短句|8-16|8~16|8 到 16/.test(densityText) ? 1.15 : 1;
  const estimatedScreens = Math.max(analysis.beatMap.length, captionChars / 12) * densityBoost;

  return round((estimatedScreens / durationSeconds) * 10);
}

function findPositionPercent({
  beats,
  durationSeconds,
  pattern,
  fallbackIndex,
}: {
  beats: ParsedBeat[];
  durationSeconds: number;
  pattern: RegExp;
  fallbackIndex: number;
}) {
  const matchedIndex = beats.findIndex((beat) => pattern.test(beat.text));
  const beat = beats[matchedIndex >= 0 ? matchedIndex : clamp(fallbackIndex, 0, beats.length - 1)];

  if (!beat) return 0;

  const midpoint = (beat.startSecond + beat.endSecond) / 2;
  return clamp(Math.round((midpoint / durationSeconds) * 100), 0, 100);
}

function extractPackagingTags(analysis: VideoStructureAnalysis) {
  const source = [
    analysis.subtitleLayout.placement,
    analysis.subtitleLayout.density,
    analysis.subtitleLayout.emphasisStyle,
    analysis.visualPackaging.colorMood,
    analysis.visualPackaging.framing,
    analysis.visualPackaging.motionGraphics,
    analysis.visualPackaging.editingNotes,
    analysis.reusableTemplate.join(" "),
    analysis.beatMap
      .map((beat) => `${beat.visualObservation} ${beat.captionObservation}`)
      .join(" "),
  ].join(" ");

  const candidates: Array<[RegExp, string]> = [
    [/字幕|短句|底部|安全区/, "字幕节奏"],
    [/标题|大字|结论/, "标题条"],
    [/贴纸|标签/, "贴纸标签"],
    [/转场|切换|切镜|卡点/, "转场卡点"],
    [/封面/, "封面方案"],
    [/分屏|对比/, "对比画面"],
    [/箭头|圈选/, "指示元素"],
    [/进度条/, "进度条"],
    [/卡片/, "卖点卡片"],
    [/高亮|描边|高对比/, "重点高亮"],
  ];

  const tags = candidates
    .filter(([pattern]) => pattern.test(source))
    .map(([, tag]) => tag);

  return Array.from(new Set(tags.length ? tags : ["字幕节奏", "重点高亮"])).slice(0, 8);
}

function focusText(focus: StructureFocus) {
  const labels: Record<StructureFocus, string> = {
    hook: "Hook",
    proof: "证据",
    benefit: "收益",
    cta: "CTA",
    packaging: "包装",
  };

  return labels[focus];
}

export function buildStructureFingerprint(
  analysis: VideoStructureAnalysis,
): StructureFingerprint {
  const beats = parseBeats(analysis);
  const durationSeconds = inferDuration(analysis, beats);
  const rhythmCurve = beats.map((beat, index) => {
    const focus = classifyFocus(beat, index, beats.length);

    return {
      index,
      timeRange: beat.timeRange,
      startSecond: round(beat.startSecond),
      endSecond: round(beat.endSecond),
      focus,
      intensity: buildIntensity({ beat, focus, durationSeconds }),
      label: `${focusText(focus)} · ${beat.purpose}`,
    };
  });
  const proofPositionPercent = findPositionPercent({
    beats,
    durationSeconds,
    pattern: proofPattern,
    fallbackIndex: 1,
  });
  const ctaPositionPercent = findPositionPercent({
    beats,
    durationSeconds,
    pattern: ctaPattern,
    fallbackIndex: beats.length - 1,
  });
  const hookStrength = calculateHookStrength(analysis, beats);
  const shotDensityPer10s = round((beats.length / durationSeconds) * 10);
  const subtitleDensityPer10s = estimateSubtitleDensity(analysis, durationSeconds);
  const packagingTags = extractPackagingTags(analysis);

  return {
    durationSeconds,
    hookStrength,
    shotDensityPer10s,
    subtitleDensityPer10s,
    proofPositionPercent,
    ctaPositionPercent,
    rhythmCurve,
    packagingTags,
    summary: `Hook 强度 ${hookStrength}/100，平均 ${shotDensityPer10s} 镜/10s，证据在 ${proofPositionPercent}% 处开始发力，CTA 落在 ${ctaPositionPercent}% 附近。`,
  };
}
