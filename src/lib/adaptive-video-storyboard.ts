import type { PlanBeat, VideoStructureAnalysis } from "@/lib/schemas";

export type AdaptiveTransferStoryboardShot = {
  order: number;
  role: string;
  visual: string;
  rhythm: string;
  audio: string;
  editPoint: string;
  sourceTimeRange: string;
  targetTimeRange: string;
  transferredTechnique: string;
  durationSeconds: number;
};

export type AdaptiveTransferStoryboard = {
  shots: AdaptiveTransferStoryboardShot[];
  targetDurationSeconds: number;
  segmentSeconds: number;
  sourceBeatCount: number;
  targetBeatCount: number;
  strategy: string;
};

type SourceBeat = {
  timeRange: string;
  shotPurpose: string;
  visualObservation: string;
  captionObservation: string;
  transferableRule: string;
};

function cleanTemplateResidue(value: string) {
  return value
    .split("样例观察仅作结构参考")[0]
    .replace(/男性主角|侧脸|喝啤酒|啤酒|酒馆|吧台|酒吧|人群|品牌标签|红印章|蓝字体|瓶身|瓶盖/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string, maxLength: number) {
  const clean = cleanTemplateResidue(value);
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}...` : clean;
}

function compactJoin(values: string[], maxLength: number) {
  return compact(values.filter(Boolean).join("；"), maxLength);
}

function parseTimeRangeEnd(timeRange: string) {
  const values = timeRange.match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite);
  if (!values?.length) return null;
  return values.length >= 2 ? values[values.length - 1] : values[0];
}

function inferDurationFromBeats(beats: Array<{ timeRange: string }>) {
  const ends = beats
    .map((beat) => parseTimeRangeEnd(beat.timeRange))
    .filter((value): value is number => value !== null);
  if (!ends.length) return null;
  return Math.max(...ends);
}

function findExplicitDurationSeconds(text: string) {
  const patterns = [
    /(?:视频|成片|短片|广告|片子|总长|时长|做成|生成|剪成|要)\s*(\d{1,3})\s*(?:秒|s|sec|seconds)/i,
    /(\d{1,3})\s*(?:秒|s|sec|seconds)\s*(?:视频|成片|短片|广告|片子)/i,
    /(\d{1,3})\s*(?:秒|s|sec|seconds)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const seconds = match?.[1] ? Number(match[1]) : NaN;
    if (Number.isFinite(seconds) && seconds >= 5) return seconds;
  }
  return null;
}

function normalizeSegmentSeconds(value?: number) {
  if (!value || !Number.isFinite(value) || value <= 0) return 5;
  return value >= 8 ? 10 : 5;
}

function normalizeTargetDuration(seconds: number, segmentSeconds: number) {
  const minDuration = segmentSeconds * 2;
  const maxDuration = segmentSeconds * 6;
  const rounded = Math.round(seconds / segmentSeconds) * segmentSeconds;
  return Math.min(maxDuration, Math.max(minDuration, rounded || 15));
}

function pickTargetDuration({
  targetBrief,
  userMaterials,
  analysis,
  beats,
  segmentSeconds,
}: {
  targetBrief: string;
  userMaterials?: string | null;
  analysis?: VideoStructureAnalysis | null;
  beats: PlanBeat[];
  segmentSeconds: number;
}) {
  const explicit =
    findExplicitDurationSeconds(targetBrief) || findExplicitDurationSeconds(userMaterials || "");
  if (explicit) return normalizeTargetDuration(explicit, segmentSeconds);

  const sampleDuration = analysis?.durationSeconds;
  if (sampleDuration && Number.isFinite(sampleDuration)) {
    return normalizeTargetDuration(sampleDuration, segmentSeconds);
  }

  const planDuration = inferDurationFromBeats(beats);
  if (planDuration) return normalizeTargetDuration(planDuration, segmentSeconds);

  return normalizeTargetDuration(15, segmentSeconds);
}

function sourceBeatsFromAnalysis(
  analysis: VideoStructureAnalysis | null | undefined,
  beats: PlanBeat[],
): SourceBeat[] {
  if (analysis?.beatMap?.length) return analysis.beatMap;

  return beats.map((beat) => ({
    timeRange: beat.timeRange,
    shotPurpose: beat.shotPurpose,
    visualObservation: beat.visualSuggestion,
    captionObservation: beat.voiceoverOrSubtitle,
    transferableRule: `${beat.transitionAndRhythm}；${beat.sellingPointIntent}`,
  }));
}

function pickGroup<T>(items: T[], index: number, total: number) {
  if (!items.length) return [];
  const start = Math.min(items.length - 1, Math.floor((index * items.length) / total));
  const end = Math.min(items.length, Math.max(start + 1, Math.ceil(((index + 1) * items.length) / total)));
  return items.slice(start, end);
}

function pickItem<T>(items: T[], index: number, total: number) {
  const itemIndex = Math.min(items.length - 1, Math.floor((index * items.length) / total));
  return items[itemIndex];
}

function roleFromSource(group: SourceBeat[], index: number, total: number) {
  const role = compactJoin(group.map((beat) => beat.shotPurpose), 28);
  if (role) return role;
  if (index === 0) return "开场手法迁移";
  if (index === total - 1) return "收束手法迁移";
  return `第${index + 1}段手法迁移`;
}

function timeRangeFor(index: number, segmentSeconds: number) {
  return `${index * segmentSeconds}-${(index + 1) * segmentSeconds}s`;
}

function sourceTechniqueLine(group: SourceBeat[]) {
  return compactJoin(
    group.map(
      (beat) =>
        `${beat.timeRange} ${beat.shotPurpose}：${beat.transferableRule || beat.visualObservation}`,
    ),
    180,
  );
}

export function buildAdaptiveTransferStoryboard({
  analysis,
  beats,
  targetBrief,
  userMaterials,
  segmentSeconds: rawSegmentSeconds,
}: {
  analysis?: VideoStructureAnalysis | null;
  beats: PlanBeat[];
  targetBrief: string;
  userMaterials?: string | null;
  segmentSeconds?: number;
}): AdaptiveTransferStoryboard {
  const segmentSeconds = normalizeSegmentSeconds(rawSegmentSeconds);
  const targetDurationSeconds = pickTargetDuration({
    targetBrief,
    userMaterials,
    analysis,
    beats,
    segmentSeconds,
  });
  const shotCount = Math.max(2, Math.round(targetDurationSeconds / segmentSeconds));
  const sourceBeats = sourceBeatsFromAnalysis(analysis, beats);
  const materialCue = compact(userMaterials || "", 160);
  const sampleStyle = analysis
    ? compactJoin(
        [
          analysis.pacing.rhythmNotes,
          analysis.visualPackaging.editingNotes,
          analysis.subtitleLayout.placement,
          analysis.subtitleLayout.emphasisStyle,
        ],
        180,
      )
    : "未找到样片结构分析，改用当前脚本分镜作为迁移依据。";
  const musicCue = analysis
    ? compactJoin(
        analysis.musicAndBeats.map(
          (cue) => `${cue.moment}：${cue.audioCue} -> ${cue.editingResponse}`,
        ),
        140,
      )
    : "";

  const shots = Array.from({ length: shotCount }, (_, index): AdaptiveTransferStoryboardShot => {
    const sourceGroup = pickGroup(sourceBeats, index, shotCount);
    const targetBeat = pickItem(beats, index, shotCount) ?? beats[Math.min(index, beats.length - 1)];
    const targetTimeRange = timeRangeFor(index, segmentSeconds);
    const sourceTechnique = sourceTechniqueLine(sourceGroup);
    const targetVisual = compactJoin(
      [
        targetBeat?.visualSuggestion,
        targetBeat?.sellingPointIntent,
        targetBeat?.replaceableAssets,
      ],
      240,
    );
    const captionCue = compactJoin(sourceGroup.map((beat) => beat.captionObservation), 120);
    const visualObservation = compactJoin(sourceGroup.map((beat) => beat.visualObservation), 140);

    return {
      order: index + 1,
      role: roleFromSource(sourceGroup, index, shotCount),
      sourceTimeRange: compactJoin(sourceGroup.map((beat) => beat.timeRange), 32),
      targetTimeRange,
      durationSeconds: segmentSeconds,
      transferredTechnique: sourceTechnique,
      visual: [
        `第${index + 1}段${segmentSeconds}秒，围绕「${compact(targetBrief, 90)}」。`,
        `只迁移样片手法：${sourceTechnique || "按当前脚本推进镜头任务"}。`,
        visualObservation ? `样片画面规律：${visualObservation}。` : "",
        `迁移到新主题的画面：${targetVisual || "用真实素材表现当前主题的关键动作、结果或状态变化"}。`,
        materialCue ? `优先参考用户素材：${materialCue}。` : "",
        "不要复刻样片的具体人物、品牌、场景和台词，只保留叙事顺序、镜头目的、节奏和包装方法。",
      ]
        .filter(Boolean)
        .join(" "),
      rhythm: compactJoin(
        [
          sampleStyle,
          targetBeat?.transitionAndRhythm,
          musicCue,
          `片段时间：${targetTimeRange}`,
        ],
        260,
      ),
      audio: compactJoin(
        [
          targetBeat?.voiceoverOrSubtitle,
          captionCue ? `字幕手法参考：${captionCue}` : "",
        ],
        180,
      ),
      editPoint: compactJoin(
        [
          targetBeat?.packagingStyle,
          analysis
            ? `字幕布局：${analysis.subtitleLayout.placement}；密度：${analysis.subtitleLayout.density}`
            : "",
        ],
        180,
      ),
    };
  });

  return {
    shots,
    targetDurationSeconds,
    segmentSeconds,
    sourceBeatCount: sourceBeats.length,
    targetBeatCount: beats.length,
    strategy: analysis
      ? `按样片《${analysis.sampleTitle}》的 ${sourceBeats.length} 个结构 beat 自适应迁移为 ${shots.length} 段，每段约 ${segmentSeconds} 秒。`
      : `未找到样片分析，按当前方案的 ${beats.length} 个脚本 beat 自适应生成 ${shots.length} 段。`,
  };
}
