import type {
  MaterialAdaptation,
  MigratedVideoPlan,
  PlanVersion,
  VideoStructureAnalysis,
} from "@/lib/schemas";

export type MigrationMapRow = {
  index: number;
  sampleTimeRange: string;
  samplePurpose: string;
  sampleRule: string;
  outputTimeRange: string;
  outputPurpose: string;
  outputLine: string;
  mappingLogic: string;
  materialSlotName: string;
  materialFit: "matched" | "partial" | "missing" | "unknown";
  completionStrategy: string;
  completionPlan: string;
};

const slotMatchers = [
  {
    slotId: "hook",
    pattern: /hook|开头|停留|注意|反差|冲突|吸引|抢/i,
  },
  {
    slotId: "hero",
    pattern: /主体|商品|产品|工具|特写|界面|品牌/i,
  },
  {
    slotId: "usage",
    pattern: /使用|过程|操作|步骤|流程|演示|怎么/i,
  },
  {
    slotId: "comparison",
    pattern: /对比|结果|变化|收益|before|after|提升/i,
  },
  {
    slotId: "proof",
    pattern: /证据|背书|可信|反馈|评价|参数|数据/i,
  },
  {
    slotId: "cta",
    pattern: /结尾|行动|转化|入口|收藏|领取|cta/i,
  },
] as const;

const fallbackSlotOrder = ["hook", "hero", "usage", "comparison", "proof", "cta"];

function slotFitLabel(fit: MigrationMapRow["materialFit"]) {
  if (fit === "matched") return "已匹配";
  if (fit === "partial") return "部分匹配";
  if (fit === "missing") return "缺口";
  return "未诊断";
}

function findSlot(
  beatText: string,
  index: number,
  adaptation?: MaterialAdaptation,
) {
  if (!adaptation) return undefined;

  const matchedSlotId =
    slotMatchers.find((matcher) => matcher.pattern.test(beatText))?.slotId ??
    fallbackSlotOrder[index] ??
    fallbackSlotOrder[fallbackSlotOrder.length - 1];

  return adaptation.slots.find((slot) => slot.slotId === matchedSlotId);
}

export function materialFitText(fit: MigrationMapRow["materialFit"]) {
  return slotFitLabel(fit);
}

export function buildMigrationMap({
  analysis,
  plan,
  version,
}: {
  analysis: VideoStructureAnalysis;
  plan: MigratedVideoPlan;
  version?: PlanVersion;
}): MigrationMapRow[] {
  const selectedVersion =
    version ??
    plan.versions.find((item) => item.versionName === plan.evaluation?.bestVersion) ??
    plan.versions[0];

  if (!selectedVersion) return [];

  return selectedVersion.scriptBeats.map((beat, index) => {
    const sampleBeat =
      analysis.beatMap[Math.min(index, analysis.beatMap.length - 1)] ??
      analysis.beatMap[0];
    const beatText = [
      beat.shotPurpose,
      beat.visualSuggestion,
      beat.voiceoverOrSubtitle,
      beat.packagingStyle,
      beat.sellingPointIntent,
      beat.replaceableAssets,
    ].join(" ");
    const slot = findSlot(beatText, index, plan.materialAdaptation);

    return {
      index: index + 1,
      sampleTimeRange: sampleBeat?.timeRange ?? "-",
      samplePurpose: sampleBeat?.shotPurpose ?? "样例节拍",
      sampleRule: sampleBeat?.transferableRule ?? "保留样例的结构意图",
      outputTimeRange: beat.timeRange,
      outputPurpose: beat.shotPurpose,
      outputLine: beat.voiceoverOrSubtitle,
      mappingLogic: `${sampleBeat?.transferableRule ?? "结构意图"} → ${beat.sellingPointIntent}`,
      materialSlotName: slot?.slotName ?? "未匹配槽位",
      materialFit: slot?.fit ?? "unknown",
      completionStrategy: slot?.completionStrategy ?? "manual-review",
      completionPlan: slot?.completionPlan ?? "人工确认该段是否需要补充素材或包装。",
    };
  });
}
