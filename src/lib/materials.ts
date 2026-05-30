import {
  materialAdaptationSchema,
  type MaterialAsset,
  type MaterialSlotRecommendation,
  type MaterialAdaptation,
  type MigratedVideoPlan,
} from "@/lib/schemas";

const materialSlots = [
  {
    slotId: "hook",
    slotName: "开头吸引镜头",
    requiredFor: "承接样例的前 3 秒 Hook，制造停留。",
    requiredMaterial: "结果画面、强反差画面、问题现场或高冲突截图。",
    keywords: ["开头", "结果", "对比", "前后", "痛点", "截图", "失败", "变化", "微距", "第一眼"],
    completionStrategy: "visual-packaging",
    completionPlan: "用标题条、强字幕和前后对比卡片补足开头冲击；必要时将中段结果画面前置。",
  },
  {
    slotId: "hero",
    slotName: "商品/主体特写",
    requiredFor: "让用户知道新内容的主体是什么，避免只听卖点却看不见对象。",
    requiredMaterial: "商品图、界面截图、Logo、包装、人物或服务主体。",
    keywords: ["商品", "产品", "工具", "界面", "logo", "包装", "特写", "截图", "主体", "杯", "成品", "主视觉"],
    completionStrategy: "copy-caption",
    completionPlan: "用卖点卡片和主体名称字幕替代缺失特写，并在脚本中安排静态封面或界面占位。",
  },
  {
    slotId: "usage",
    slotName: "使用过程镜头",
    requiredFor: "证明卖点不是口号，展示从问题到结果的过程。",
    requiredMaterial: "操作录屏、使用步骤、拍摄过程、工作流或现场演示。",
    keywords: ["使用", "过程", "操作", "录屏", "步骤", "流程", "演示", "工作流", "场景", "工位", "通勤", "饮用", "倒入", "冲泡"],
    completionStrategy: "structure-reorder",
    completionPlan: "降低过程镜头占比，改成“三步字幕解释 + 局部放大 + 结果回看”的结构。",
  },
  {
    slotId: "comparison",
    slotName: "对比/结果镜头",
    requiredFor: "支撑样例的结果前置和收益翻译结构。",
    requiredMaterial: "前后对比、效果截图、数据变化、Before/After 画面。",
    keywords: ["对比", "前后", "效果", "结果", "提升", "变化", "before", "after", "数据"],
    completionStrategy: "visual-packaging",
    completionPlan: "用左右分屏、数字贴纸和结果标题条生成对比表达，避免硬找不存在的画面。",
  },
  {
    slotId: "proof",
    slotName: "背书证据镜头",
    requiredFor: "增强可信度，支撑中段卖点推进。",
    requiredMaterial: "评价截图、用户反馈、案例、参数、实验记录或真实数据。",
    keywords: ["评价", "反馈", "案例", "数据", "参数", "证明", "背书", "记录", "可信"],
    completionStrategy: "copy-caption",
    completionPlan: "用“证据来源待补”字幕卡占位，并要求最终生产前补真实截图或可追溯数据。",
  },
  {
    slotId: "cta",
    slotName: "结尾 CTA 镜头",
    requiredFor: "完成转化或行动指令，让视频有明确收束。",
    requiredMaterial: "购买入口、二维码、链接、店铺页、收藏提示或领取入口。",
    keywords: ["入口", "链接", "二维码", "店铺", "购买", "收藏", "领取", "咨询", "cta", "收尾", "定格", "主视觉"],
    completionStrategy: "reuse-existing",
    completionPlan: "复用主体画面做定格结尾，叠加行动字幕和入口占位，减少对新增镜头的依赖。",
  },
] as const;

function normalize(text: string) {
  return text.toLowerCase();
}

function hasKeyword(text: string, keywords: readonly string[]) {
  const normalized = normalize(text);
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function splitMaterialItems(userMaterials: string) {
  return userMaterials
    .replace(/已有素材[:：]/g, "")
    .replace(/(?:缺少|没有|待补|需要补充|不足|未提供)[^；;。]*/g, "")
    .split(/[\n；;。]+|、|，/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/缺少|没有|待补|需要补充|不足|未提供/.test(item));
}

function inferAssetKind(text: string): MaterialAsset["kind"] {
  if (/链接|入口|二维码|店铺|购买|领取|私信|url|https?:\/\//i.test(text)) {
    return "link";
  }
  if (/视频|录屏|实拍|过程|镜头|片段|拍摄|b-roll|broll/i.test(text)) {
    return "video";
  }
  if (/图|截图|照片|图片|海报|封面|包装|特写|主视觉/.test(text)) {
    return "image";
  }
  return "text";
}

function kindSignal(kind: MaterialAsset["kind"]) {
  if (kind === "video") return "动态素材";
  if (kind === "image") return "静态视觉";
  if (kind === "link") return "行动入口";
  return "文本证据";
}

function suggestedSlotsForAsset(text: string, kind: MaterialAsset["kind"]) {
  const directMatches = materialSlots
    .filter((slot) => hasKeyword(text, slot.keywords))
    .map((slot) => slot.slotId);
  const kindMatches =
    kind === "video"
      ? ["hook", "usage"]
      : kind === "image"
        ? ["hero"]
        : kind === "link"
          ? ["cta"]
          : /评价|反馈|参数|数据|文案|清单|卖点/.test(text)
            ? ["proof"]
            : [];

  return unique([...directMatches, ...kindMatches]).slice(0, 4);
}

function assetSignals(text: string, kind: MaterialAsset["kind"], slots: string[]) {
  const keywordSignals = materialSlots
    .flatMap((slot) => slot.keywords)
    .filter((keyword) => normalize(text).includes(keyword.toLowerCase()))
    .slice(0, 5);
  const quantitySignal = /\d+\s*(张|条|秒|个|份|段)/.exec(text)?.[0];
  return unique([kindSignal(kind), quantitySignal || "", ...keywordSignals, ...slots]);
}

function assetQualityScore({
  text,
  kind,
  slotCount,
}: {
  text: string;
  kind: MaterialAsset["kind"];
  slotCount: number;
}) {
  const kindBoost = kind === "video" ? 14 : kind === "image" ? 10 : kind === "link" ? 8 : 6;
  const evidenceBoost = /真实|已有|截图|录屏|评价|反馈|参数|数据|入口/.test(text) ? 10 : 0;
  const quantityBoost = /\d+\s*(张|条|秒|个|份|段)/.test(text) ? 5 : 0;
  return clampScore(48 + kindBoost + slotCount * 7 + evidenceBoost + quantityBoost);
}

function compactLabel(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 34 ? `${clean.slice(0, 33)}…` : clean;
}

function recommendedUseForAsset(slots: string[], kind: MaterialAsset["kind"]) {
  const names = slots
    .map((slotId) => materialSlots.find((slot) => slot.slotId === slotId)?.slotName)
    .filter(Boolean);
  if (names.length) return `优先用于${names.join("、")}，作为${kindSignal(kind)}支撑结构槽位。`;
  return `作为${kindSignal(kind)}进入候选素材池，人工确认后再放入时间线。`;
}

export function parseMaterialAssets({
  targetBrief,
  userMaterials,
}: {
  targetBrief: string;
  userMaterials?: string;
}): MaterialAsset[] {
  const items = splitMaterialItems(userMaterials || "");
  return items.map((item, index) => {
    const kind = inferAssetKind(item);
    const suggestedSlots = suggestedSlotsForAsset(`${targetBrief} ${item}`, kind);
    const qualityScore = assetQualityScore({
      text: item,
      kind,
      slotCount: suggestedSlots.length,
    });

    return {
      id: `asset-${index + 1}`,
      kind,
      label: compactLabel(item),
      detectedSignals: assetSignals(item, kind, suggestedSlots),
      suggestedSlots,
      qualityScore,
      highlightReason:
        suggestedSlots.length > 0
          ? `识别到可支撑 ${suggestedSlots.length} 个结构槽位，适合进入迁移时间线。`
          : "当前只能作为辅助素材，需要人工判断最合适的镜头位置。",
      recommendedUse: recommendedUseForAsset(suggestedSlots, kind),
    };
  });
}

function recommendationsForSlot(
  assets: MaterialAsset[],
  slotId: string,
): MaterialSlotRecommendation[] {
  return assets
    .filter((asset) => asset.suggestedSlots.includes(slotId))
    .map((asset) => ({
      assetId: asset.id,
      label: asset.label,
      reason: asset.recommendedUse,
      fitScore: asset.qualityScore,
    }))
    .sort((left, right) => right.fitScore - left.fitScore)
    .slice(0, 3);
}

function summarizeMaterials(userMaterials: string, targetBrief: string) {
  const clean = userMaterials.trim();
  if (!clean) {
    return `未提供明确用户素材；仅能基于主题 Brief 生成素材补全建议。主题：${targetBrief}`;
  }
  return clean.length > 180 ? `${clean.slice(0, 180)}...` : clean;
}

export function evaluateMaterialAdaptation({
  targetBrief,
  userMaterials,
}: {
  targetBrief: string;
  userMaterials?: string;
}): MaterialAdaptation {
  const materialText = `${targetBrief}\n${userMaterials || ""}`;
  const assets = parseMaterialAssets({ targetBrief, userMaterials });
  const slots = materialSlots.map((slot) => {
    const recommendedAssets = recommendationsForSlot(assets, slot.slotId);
    const matchedByAsset = recommendedAssets.length > 0;
    const matchedByText = hasKeyword(materialText, slot.keywords);
    const fit = matchedByAsset ? "matched" : matchedByText ? "partial" : "missing";

    return {
      slotId: slot.slotId,
      slotName: slot.slotName,
      requiredFor: slot.requiredFor,
      requiredMaterial: slot.requiredMaterial,
      matchedMaterial: matchedByAsset
        ? `推荐素材：${recommendedAssets.map((asset) => asset.label).join(" / ")}。`
        : matchedByText
          ? `从输入中识别到与“${slot.keywords.slice(0, 3).join(" / ")}”相关的素材线索。`
          : "当前输入中没有足够素材线索直接支撑该槽位。",
      recommendedAssets,
      fit,
      impact:
        fit === "matched"
          ? "可直接支撑目标结构。"
          : fit === "partial"
            ? "可用文字或包装承接，但真实画面说服力偏弱。"
            : "如果不补全，会影响视频结构完整度和可信度。",
      completionStrategy: slot.completionStrategy,
      completionPlan: slot.completionPlan,
    };
  });
  const missingSlotCount = slots.filter((slot) => slot.fit === "missing").length;
  const partialSlotCount = slots.filter((slot) => slot.fit === "partial").length;
  const averageAssetQuality =
    assets.length > 0
      ? assets.reduce((sum, asset) => sum + asset.qualityScore, 0) / assets.length
      : 0;
  const sufficiencyScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        90 - missingSlotCount * 12 - partialSlotCount * 6 + Math.min(10, averageAssetQuality / 10),
      ),
    ),
  );

  return materialAdaptationSchema.parse({
    providedMaterialsSummary: summarizeMaterials(userMaterials || "", targetBrief),
    sufficiencyScore,
    missingSlotCount,
    assets,
    slots,
    timelineAdjustment:
      missingSlotCount === 0
        ? "素材基本覆盖结构槽位，可按原节奏生成时间线。"
        : "缺失槽位优先用字幕卡、卖点卡片、局部放大和结构重排补足，减少对新增拍摄的依赖。",
  });
}

export function attachMaterialAdaptation({
  plan,
  targetBrief,
  userMaterials,
}: {
  plan: MigratedVideoPlan;
  targetBrief: string;
  userMaterials?: string;
}): MigratedVideoPlan {
  return {
    ...plan,
    materialAdaptation: evaluateMaterialAdaptation({ targetBrief, userMaterials }),
  };
}
