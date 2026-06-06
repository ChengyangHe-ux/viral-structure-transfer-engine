import type { PlanBeat, VideoStructureAnalysis } from "@/lib/schemas";
import { describeUserMaterialsForPrompt } from "@/lib/user-materials";

export type AdaptiveTransferStoryboardShot = {
  order: number;
  slotId: TransferSlotId;
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

export type TransferSlotId = "hook" | "hero" | "usage" | "comparison" | "proof" | "cta";

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
  targetDurationSeconds,
  targetBrief,
  userMaterials,
  segmentSeconds,
}: {
  targetDurationSeconds?: number | null;
  targetBrief: string;
  userMaterials?: string | null;
  segmentSeconds: number;
}) {
  if (targetDurationSeconds && Number.isFinite(targetDurationSeconds)) {
    return normalizeTargetDuration(targetDurationSeconds, segmentSeconds);
  }

  const explicit =
    findExplicitDurationSeconds(targetBrief) || findExplicitDurationSeconds(userMaterials || "");
  if (explicit) return normalizeTargetDuration(explicit, segmentSeconds);

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

const slotOrder: TransferSlotId[] = ["hook", "hero", "usage", "comparison", "proof", "cta"];

const slotLabels: Record<TransferSlotId, { name: string; task: string }> = {
  hook: {
    name: "开头吸引镜头",
    task: "优先放最强结果、反差、微距或能让用户停下来的画面。",
  },
  hero: {
    name: "主体识别镜头",
    task: "让新主题的商品、人物、服务或核心对象清楚出现。",
  },
  usage: {
    name: "使用过程镜头",
    task: "展示操作、制作、使用过程或关键动作，证明内容不是空讲。",
  },
  comparison: {
    name: "对比结果镜头",
    task: "呈现前后变化、成品状态、效果差异或收益转折。",
  },
  proof: {
    name: "证据强化镜头",
    task: "放大细节、参数、评价、反馈或可信证明，承接中后段卖点。",
  },
  cta: {
    name: "结尾收束镜头",
    task: "复用主体或结果画面定格，给出收藏、购买、领取或下一步动作。",
  },
};

function slotForShot({
  sourceGroup,
  targetBeat,
  index,
  total,
}: {
  sourceGroup: SourceBeat[];
  targetBeat?: PlanBeat;
  index: number;
  total: number;
}): TransferSlotId {
  const text = compactJoin(
    [
      ...sourceGroup.map((beat) => `${beat.shotPurpose} ${beat.transferableRule}`),
      targetBeat?.shotPurpose,
      targetBeat?.visualSuggestion,
      targetBeat?.replaceableAssets,
    ].filter((value): value is string => Boolean(value)),
    320,
  );

  if (index === 0) return "hook";
  if (index === total - 1) {
    if (total > 3 && /CTA|行动|入口|购买|领取|收藏|店铺|咨询/i.test(text)) return "cta";
    return "proof";
  }
  if (/使用|过程|操作|步骤|流程|演示|制作|饮用|倒入|冲泡|录屏/i.test(text)) {
    return "usage";
  }
  if (/对比|结果|变化|before|after|提升|成品|效果/i.test(text)) return "comparison";
  if (/证据|证明|背书|评价|反馈|参数|数据|可信/i.test(text)) return "proof";
  if (/主体|识别|商品|产品|工具|主视觉|特写|包装/i.test(text)) return "hero";
  return slotOrder[Math.min(index, slotOrder.length - 1)] ?? "usage";
}

export function buildAdaptiveTransferStoryboard({
  analysis,
  beats,
  targetBrief,
  userMaterials,
  targetDurationSeconds: rawTargetDurationSeconds,
  segmentSeconds: rawSegmentSeconds,
}: {
  analysis?: VideoStructureAnalysis | null;
  beats: PlanBeat[];
  targetBrief: string;
  userMaterials?: string | null;
  targetDurationSeconds?: number | null;
  segmentSeconds?: number;
}): AdaptiveTransferStoryboard {
  const segmentSeconds = normalizeSegmentSeconds(rawSegmentSeconds);
  const targetDurationSeconds = pickTargetDuration({
    targetDurationSeconds: rawTargetDurationSeconds,
    targetBrief,
    userMaterials,
    segmentSeconds,
  });
  const shotCount = Math.max(2, Math.round(targetDurationSeconds / segmentSeconds));
  const sourceBeats = sourceBeatsFromAnalysis(analysis, beats);
  const materialCue = compact(describeUserMaterialsForPrompt(userMaterials), 160);
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
    const slotId = slotForShot({
      sourceGroup,
      targetBeat,
      index,
      total: shotCount,
    });
    const slotLabel = slotLabels[slotId];
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
      slotId,
      role: roleFromSource(sourceGroup, index, shotCount),
      sourceTimeRange: compactJoin(sourceGroup.map((beat) => beat.timeRange), 32),
      targetTimeRange,
      durationSeconds: segmentSeconds,
      transferredTechnique: sourceTechnique,
      visual: [
        `目标内容唯一锚点：${compact(targetBrief, 120)}。画面主体、环境和动作都必须服务这个目标内容。`,
        `第${index + 1}段${segmentSeconds}秒，围绕「${compact(targetBrief, 90)}」。`,
        `结构槽位：${slotLabel.name}。素材剪辑任务：${slotLabel.task}`,
        `只迁移样片手法：${sourceTechnique || "按当前脚本推进镜头任务"}。`,
        visualObservation ? `样片画面规律：${visualObservation}。` : "",
        `迁移到新主题的画面：${targetVisual || "用真实素材表现当前主题的关键动作、结果或状态变化"}。`,
        materialCue
          ? `优先参考用户素材：${materialCue}。`
          : "用户没有提供可用素材：请用 AIGC 生成目标内容对应的新画面，不要生成样片原商品、原场景或无关产品。",
        "禁止复刻样片的具体人物、品牌、商品、场景和台词，只保留叙事顺序、镜头目的、节奏和包装方法。",
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
