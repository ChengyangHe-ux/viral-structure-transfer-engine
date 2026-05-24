import type { PlanBeat, PlanVersion } from "@/lib/schemas";

export type BeatMoveDirection = "up" | "down";

function clampIndex(index: number, length: number) {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(length - 1, Math.trunc(index)));
}

export function moveBeat(version: PlanVersion, index: number, direction: BeatMoveDirection) {
  const beats = version.scriptBeats;
  if (beats.length <= 1) return version;
  const from = clampIndex(index, beats.length);
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= beats.length) return version;

  const next = beats.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return { ...version, scriptBeats: next };
}

export function removeBeat(version: PlanVersion, index: number) {
  if (version.scriptBeats.length <= 3) return version;
  const beats = version.scriptBeats;
  const at = clampIndex(index, beats.length);
  return { ...version, scriptBeats: beats.filter((_, i) => i !== at) };
}

export function insertBeatAfter(version: PlanVersion, index: number, beat?: PlanBeat) {
  const beats = version.scriptBeats;
  const at = clampIndex(index, beats.length);
  const template = beat ?? beats[at] ?? beats[0];
  const nextBeat: PlanBeat = {
    ...template,
    timeRange: template?.timeRange ?? "0-1s",
    shotPurpose: template?.shotPurpose ?? "新增镜头",
    visualSuggestion: template?.visualSuggestion ?? "补充画面建议",
    voiceoverOrSubtitle: template?.voiceoverOrSubtitle ?? "补充口播/字幕",
    packagingStyle: template?.packagingStyle ?? "补充包装",
    sellingPointIntent: template?.sellingPointIntent ?? "补充卖点意图",
    transitionAndRhythm: template?.transitionAndRhythm ?? "补充节奏/转场",
    replaceableAssets: template?.replaceableAssets ?? "补充可替换素材",
    riskNotes: template?.riskNotes ?? "补充风险提示",
  };

  const next = beats.slice();
  next.splice(at + 1, 0, nextBeat);
  return { ...version, scriptBeats: next };
}

