import type { MigrationMapRow } from "@/lib/mapping";
import type { PlanVersion } from "@/lib/schemas";

export type StoryboardFrame = {
  index: number;
  timeRange: string;
  focus: string;
  frameTitle: string;
  visualLayer: string;
  subtitleLayer: string;
  packagingLayer: string;
  transitionCue: string;
  materialFit: MigrationMapRow["materialFit"];
  materialSlotName: string;
  completionPlan: string;
};

function classifyFocus(text: string) {
  if (/hook|开头|停留|吸引|反差|抢/i.test(text)) return "Hook";
  if (/证据|背书|可信|反馈|评价|参数|数据/i.test(text)) return "证据";
  if (/结尾|行动|转化|入口|收藏|领取|cta/i.test(text)) return "CTA";
  if (/收益|场景|适用|利益|转成/i.test(text)) return "收益";
  if (/包装|字幕|转场|节奏|卡点/i.test(text)) return "包装";
  return "推进";
}

function compact(text: string, maxLength: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
}

export function buildStoryboardFrames({
  version,
  rows,
}: {
  version: PlanVersion;
  rows?: MigrationMapRow[];
}): StoryboardFrame[] {
  return version.scriptBeats.map((beat, index) => {
    const row = rows?.[index];
    const focus = row?.materialSlotName
      ? classifyFocus(`${row.samplePurpose} ${row.outputPurpose} ${row.mappingLogic}`)
      : classifyFocus(`${beat.shotPurpose} ${beat.sellingPointIntent}`);

    return {
      index: index + 1,
      timeRange: beat.timeRange,
      focus,
      frameTitle: compact(beat.shotPurpose, 18),
      visualLayer: compact(beat.visualSuggestion, 72),
      subtitleLayer: compact(beat.voiceoverOrSubtitle, 48),
      packagingLayer: compact(beat.packagingStyle, 42),
      transitionCue: compact(beat.transitionAndRhythm, 42),
      materialFit: row?.materialFit ?? "unknown",
      materialSlotName: row?.materialSlotName ?? "待确认素材槽位",
      completionPlan: compact(row?.completionPlan ?? beat.replaceableAssets, 72),
    };
  });
}
