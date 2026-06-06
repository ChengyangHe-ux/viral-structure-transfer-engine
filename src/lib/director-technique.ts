import { z } from "zod";

import type {
  MaterialAdaptation,
  MaterialAsset,
  MigratedVideoPlan,
  PlanBeat,
  PlanVersion,
  VideoStructureAnalysis,
} from "@/lib/schemas";
import { buildSampleTechniqueProfile } from "@/lib/technique-transfer";

const personaModeSchema = z.enum([
  "presenter",
  "hands",
  "non-identifiable-person",
  "product-only",
  "screen",
  "mixed",
]);

const framingSchema = z.enum([
  "extreme-close-up",
  "close-up",
  "medium",
  "wide",
  "screen-capture",
  "mixed",
]);

const cameraMotionSchema = z.enum([
  "static",
  "push-in",
  "pull-out",
  "handheld",
  "pan",
  "fast-cut",
  "beat-cut",
]);

const materialKindSchema = z.enum(["image", "video", "text", "link", "aigc"]);

const editDecisionSourceSchema = z.enum([
  "user-video",
  "user-image",
  "aigc-video",
  "text-only",
  "unknown",
]);

export const personaRequirementSchema = z.object({
  mode: personaModeSchema,
  label: z.string().min(1),
  presence: z.enum(["required", "preferred", "avoid", "optional"]),
  identityPolicy: z.string().min(1),
  transferInstruction: z.string().min(1),
});

export const shotLanguageRuleSchema = z.object({
  framing: framingSchema,
  cameraMotion: cameraMotionSchema,
  composition: z.string().min(1),
  visualPriority: z.string().min(1),
});

export const techniqueProfileSchema = z.object({
  sampleTitle: z.string().min(1),
  summary: z.string().min(1),
  durationSeconds: z.number().positive(),
  personaRequirements: z.array(personaRequirementSchema).min(1),
  shotLanguageRules: z.array(shotLanguageRuleSchema).min(1),
  rhythmRules: z.array(z.string().min(1)).default([]),
  captionRules: z.array(z.string().min(1)).default([]),
  packagingRules: z.array(z.string().min(1)).default([]),
  forbiddenToCopy: z.array(z.string().min(1)).default([]),
});

export const transferSlotSchema = z.object({
  slotId: z.string().min(1),
  sourceBeatIndex: z.number().int().min(0),
  sampleTimeRange: z.string().min(1),
  targetTimeRange: z.string().min(1),
  role: z.string().min(1),
  sourcePurpose: z.string().min(1),
  targetPurpose: z.string().min(1),
  transferableTechnique: z.string().min(1),
  targetLine: z.string().min(1),
  personaRequirement: personaRequirementSchema,
  shotLanguage: shotLanguageRuleSchema,
  rhythm: z.string().min(1),
  captionRole: z.string().min(1),
  transition: z.string().min(1),
  materialSlotId: z.string().min(1),
  preferredMaterialKinds: z.array(materialKindSchema).min(1),
  nonCopyable: z.array(z.string().min(1)).default([]),
  missingFallback: z.string().min(1),
});

export const materialRequirementSchema = z.object({
  slotId: z.string().min(1),
  materialSlotId: z.string().min(1),
  role: z.string().min(1),
  requiredKinds: z.array(materialKindSchema).min(1),
  personRequirement: z.string().min(1),
  actionRequirement: z.string().min(1),
  sceneRequirement: z.string().min(1),
  matchedAssets: z.array(z.string().min(1)).default([]),
  fit: z.enum(["matched", "partial", "missing", "unknown"]),
  gap: z.string().min(1),
  completionStrategy: z.string().min(1),
  completionPlan: z.string().min(1),
});

export const editDecisionSchema = z.object({
  order: z.number().int().positive(),
  slotId: z.string().min(1),
  sampleTimeRange: z.string().min(1),
  outputTimeRange: z.string().min(1),
  role: z.string().min(1),
  source: editDecisionSourceSchema,
  materialLabel: z.string().nullable().default(null),
  sourceInSeconds: z.number().nonnegative().nullable().default(null),
  sourceOutSeconds: z.number().nonnegative().nullable().default(null),
  crop: z.string().min(1),
  motion: z.string().min(1),
  speed: z.string().min(1),
  transition: z.string().min(1),
  captionPlan: z.string().min(1),
  audioPlan: z.string().min(1),
  aigcPrompt: z.string().nullable().default(null),
  transferReason: z.string().min(1),
  gapResolution: z.string().min(1),
});

export type PersonaRequirement = z.infer<typeof personaRequirementSchema>;
export type ShotLanguageRule = z.infer<typeof shotLanguageRuleSchema>;
export type TechniqueProfile = z.infer<typeof techniqueProfileSchema>;
export type TransferSlot = z.infer<typeof transferSlotSchema>;
export type MaterialRequirement = z.infer<typeof materialRequirementSchema>;
export type EditDecision = z.infer<typeof editDecisionSchema>;

function compact(text: string, maxLength: number) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1))}…`;
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function beatText(beat: {
  shotPurpose?: string;
  visualObservation?: string;
  captionObservation?: string;
  transferableRule?: string;
}) {
  return [
    beat.shotPurpose,
    beat.visualObservation,
    beat.captionObservation,
    beat.transferableRule,
  ]
    .filter(Boolean)
    .join(" ");
}

function planBeatText(beat?: PlanBeat) {
  if (!beat) return "";
  return [
    beat.shotPurpose,
    beat.visualSuggestion,
    beat.voiceoverOrSubtitle,
    beat.packagingStyle,
    beat.transitionAndRhythm,
    beat.sellingPointIntent,
    beat.replaceableAssets,
  ].join(" ");
}

function inferPersonaRequirement(text: string): PersonaRequirement {
  if (/口播|主播|出镜|露脸|半身|达人|讲解|镜头前|对着镜头/.test(text)) {
    return {
      mode: "presenter",
      label: "真人口播/半身出镜",
      presence: "preferred",
      identityPolicy: "只迁移口播站位、表情节奏和镜头距离，不复制样例人物身份、长相、服装或人设。",
      transferInstruction: "新内容如需要真人，用新主题对应的人物或非可识别演员完成讲解。",
    };
  }
  if (/手部|手拿|手势|操作|演示|倒入|冲泡|点击|滑动|录屏操作/.test(text)) {
    return {
      mode: "hands",
      label: "手部操作/动作演示",
      presence: "preferred",
      identityPolicy: "只迁移手部进入画面的动作节奏，不复制样例人物、道具或原场景。",
      transferInstruction: "优先用用户视频中的手部动作、操作录屏或产品使用过程承接该手法。",
    };
  }
  if (/背影|路人|人物经过|使用者|人群|生活场景|场景人物/.test(text)) {
    return {
      mode: "non-identifiable-person",
      label: "非可识别人物/场景使用者",
      presence: "optional",
      identityPolicy: "人物只承担氛围和尺度作用，避免生成可识别脸部或样例人物复刻。",
      transferInstruction: "用背影、侧身、局部肢体或远景人物表现真实使用场景。",
    };
  }
  if (/界面|录屏|截图|UI|屏幕|表格|页面|app|网页|系统/.test(text)) {
    return {
      mode: "screen",
      label: "界面/录屏主导",
      presence: "avoid",
      identityPolicy: "不要补无关真人，迁移的是屏幕信息推进和圈选节奏。",
      transferInstruction: "用新产品界面、流程录屏或截图承接样例的证明/解释手法。",
    };
  }
  if (/商品|产品|包装|杯|瓶|设备|工具|特写|主视觉|成品|实物/.test(text)) {
    return {
      mode: "product-only",
      label: "产品/主体主导",
      presence: "avoid",
      identityPolicy: "产品主体必须替换为新主题对象，不复制样例商品、品牌、包装或场景。",
      transferInstruction: "用新产品特写、细节、结果画面或主视觉替代样例主体。",
    };
  }
  return {
    mode: "mixed",
    label: "主体随内容切换",
    presence: "optional",
    identityPolicy: "只迁移出镜方式和信息层级，不复制样例具体人物、品牌、场景和台词。",
    transferInstruction: "根据新主题在人物、产品、界面和环境之间选择最能说明问题的主体。",
  };
}

function inferFraming(text: string): ShotLanguageRule["framing"] {
  if (/微距|极近|局部|细节|大特写/.test(text)) return "extreme-close-up";
  if (/特写|近景|主体|产品|脸部|手部|屏幕局部/.test(text)) return "close-up";
  if (/半身|人物|讲解|桌面|操作/.test(text)) return "medium";
  if (/全景|环境|场景|街景|门店|空间/.test(text)) return "wide";
  if (/录屏|界面|截图|屏幕|app|网页|系统/.test(text)) return "screen-capture";
  return "mixed";
}

function inferCameraMotion(text: string): ShotLanguageRule["cameraMotion"] {
  if (/推近|推进|放大|zoom in|拉近/.test(text)) return "push-in";
  if (/拉远|后退|露出全貌/.test(text)) return "pull-out";
  if (/手持|跟拍|晃动|真实感/.test(text)) return "handheld";
  if (/横移|扫过|平移|pan/.test(text)) return "pan";
  if (/卡点|鼓点|节拍/.test(text)) return "beat-cut";
  if (/快切|切镜|快速|加速/.test(text)) return "fast-cut";
  return "static";
}

function inferShotLanguage(text: string): ShotLanguageRule {
  const framing = inferFraming(text);
  const cameraMotion = inferCameraMotion(text);
  const composition =
    framing === "screen-capture"
      ? "界面占满竖屏安全区，关键位置用后期圈选或字幕强调。"
      : framing === "wide"
        ? "先交代环境关系，再让主体在中心或三分线位置形成清晰视觉锚点。"
        : "主体居中或偏上，底部留出字幕安全区，避免关键信息被遮挡。";
  const visualPriority =
    framing === "extreme-close-up" || framing === "close-up"
      ? "优先让新主题的核心对象、动作或结果在第一眼可辨认。"
      : "优先让观众理解场景和行动关系，再进入卖点解释。";

  return { framing, cameraMotion, composition, visualPriority };
}

function inferMaterialSlotId(text: string, index: number, total: number) {
  if (index === 0) return "hook";
  if (index === total - 1 && /cta|行动|转化|入口|购买|领取|收藏|结尾|收束/i.test(text)) {
    return "cta";
  }
  if (/使用|过程|操作|步骤|流程|演示|录屏|点击|滑动|制作/i.test(text)) return "usage";
  if (/对比|结果|变化|before|after|提升|效果|成品/i.test(text)) return "comparison";
  if (/证据|证明|背书|评价|反馈|参数|数据|可信/i.test(text)) return "proof";
  if (/主体|商品|产品|工具|特写|界面|主视觉|包装/i.test(text)) return "hero";
  if (index === total - 1) return "cta";
  return ["hook", "hero", "usage", "comparison", "proof", "cta"][Math.min(index, 5)] ?? "usage";
}

function focusSlug(slotId: string) {
  const names: Record<string, string> = {
    hook: "hook",
    hero: "subject",
    usage: "action",
    comparison: "compare",
    proof: "proof",
    cta: "cta",
  };
  return names[slotId] ?? "beat";
}

function preferredKindsForSlot(slotId: string, persona: PersonaRequirement): Array<z.infer<typeof materialKindSchema>> {
  const base =
    slotId === "usage"
      ? ["video", "image", "aigc"]
      : slotId === "cta"
        ? ["image", "link", "video", "aigc"]
        : slotId === "proof"
          ? ["image", "text", "video", "aigc"]
          : slotId === "hero"
            ? ["image", "video", "aigc"]
            : ["video", "image", "aigc"];

  if (persona.mode === "screen") return unique(["video", "image", "text", "aigc", ...base]) as Array<z.infer<typeof materialKindSchema>>;
  if (persona.mode === "hands" || persona.mode === "presenter") return unique(["video", "aigc", ...base]) as Array<z.infer<typeof materialKindSchema>>;
  return unique(base) as Array<z.infer<typeof materialKindSchema>>;
}

function slotFallback(slotId: string, persona: PersonaRequirement) {
  if (slotId === "usage") return "缺少过程画面时，用三步字幕卡、局部放大和结果回看降低对连续视频的依赖。";
  if (slotId === "proof") return "缺少证据素材时，用可追溯文案卡占位，并标记上线前需要补真实截图或数据。";
  if (slotId === "comparison") return "缺少前后对比时，用左右分屏包装或结果前置重排补足对比关系。";
  if (slotId === "cta") return "缺少结尾入口时，复用主视觉定格并叠加单一行动指令。";
  if (persona.mode === "presenter") return "缺少真人时，不硬补样例人物，改为产品/界面主导加短字幕说明。";
  return "缺少直接素材时，用新主题 AIGC 补镜或现有素材裁切复用完成该手法。";
}

function transitionForText(text: string) {
  if (/卡点|鼓点|重拍|快切|切镜/.test(text)) return "卡点硬切";
  if (/滑|推|划入|slide|wipe/i.test(text)) return "滑入/擦除转场";
  if (/淡入|淡出|柔和|慢/.test(text)) return "轻淡入淡出";
  return "自然硬切";
}

function captionRoleForText(text: string) {
  if (/字幕|标题|大字|高亮|关键词/.test(text)) return compact(text.match(/[^。；;]*?(字幕|标题|高亮|关键词)[^。；;]*/)?.[0] ?? "短句字幕跟随镜头推进，关键词高亮。", 72);
  return "字幕只解释当前镜头的一个信息点，避免把样例台词原样搬到新内容。";
}

function selectedVersion(plan: MigratedVideoPlan, version?: PlanVersion) {
  return (
    version ??
    plan.versions.find((item) => item.versionName === plan.evaluation?.bestVersion) ??
    plan.versions[0]
  );
}

export function buildTechniqueProfile(analysis: VideoStructureAnalysis): TechniqueProfile {
  const baseProfile = buildSampleTechniqueProfile(analysis);
  const beatSamples = analysis.beatMap.length
    ? analysis.beatMap
    : [
        {
          shotPurpose: analysis.contentPromise,
          visualObservation: analysis.visualPackaging.framing,
          captionObservation: analysis.subtitleLayout.density,
          transferableRule: analysis.reusableTemplate.join("；"),
        },
      ];
  const personaRequirements = unique(
    beatSamples.map((beat) => JSON.stringify(inferPersonaRequirement(beatText(beat)))),
  ).map((item) => JSON.parse(item) as PersonaRequirement);
  const shotLanguageRules = unique(
    beatSamples.map((beat) => JSON.stringify(inferShotLanguage(beatText(beat)))),
  ).map((item) => JSON.parse(item) as ShotLanguageRule);

  return techniqueProfileSchema.parse({
    sampleTitle: analysis.sampleTitle,
    summary: `${baseProfile.summary} 人物/主体只抽象出镜方法，不能复刻原人物、品牌、商品和场景。`,
    durationSeconds: baseProfile.durationSeconds,
    personaRequirements,
    shotLanguageRules,
    rhythmRules: unique([
      analysis.pacing.opening,
      analysis.pacing.middle,
      analysis.pacing.ending,
      analysis.pacing.rhythmNotes,
      ...analysis.musicAndBeats.map((cue) => `${cue.moment}：${cue.audioCue} -> ${cue.editingResponse}`),
    ]).slice(0, 8),
    captionRules: unique([
      `${analysis.subtitleLayout.placement}；${analysis.subtitleLayout.density}`,
      analysis.subtitleLayout.emphasisStyle,
      ...analysis.beatMap.map((beat) => beat.captionObservation),
    ]).slice(0, 8),
    packagingRules: unique([
      analysis.visualPackaging.colorMood,
      analysis.visualPackaging.framing,
      analysis.visualPackaging.motionGraphics,
      analysis.visualPackaging.editingNotes,
      ...baseProfile.packagingTags,
    ]).slice(0, 10),
    forbiddenToCopy: [
      "样例中的具体人物身份、长相、服装和人设",
      "样例中的品牌、商品、包装、店铺和场景",
      "样例原台词、字幕原句、Logo、水印和二维码",
      "与新主题无关的通用广告画面",
    ],
  });
}

export function buildTransferSlots({
  analysis,
  plan,
  version,
}: {
  analysis: VideoStructureAnalysis;
  plan: MigratedVideoPlan;
  version?: PlanVersion;
}): TransferSlot[] {
  const selected = selectedVersion(plan, version);
  if (!selected) return [];

  const sourceBeats = analysis.beatMap.length
    ? analysis.beatMap
    : selected.scriptBeats.map((beat) => ({
        timeRange: beat.timeRange,
        shotPurpose: beat.shotPurpose,
        visualObservation: beat.visualSuggestion,
        captionObservation: beat.voiceoverOrSubtitle,
        transferableRule: beat.transitionAndRhythm,
      }));
  return selected.scriptBeats.map((targetBeat, index) => {
    const sourceBeat = sourceBeats[Math.min(index, sourceBeats.length - 1)] ?? sourceBeats[0]!;
    const sourceText = beatText(sourceBeat);
    const targetText = planBeatText(targetBeat);
    const allText = `${sourceText} ${targetText}`;
    const materialSlotId = inferMaterialSlotId(allText, index, selected.scriptBeats.length);
    const personaRequirement = inferPersonaRequirement(allText);
    const shotLanguage = inferShotLanguage(allText);
    const preferredMaterialKinds = preferredKindsForSlot(materialSlotId, personaRequirement);

    return transferSlotSchema.parse({
      slotId: `slot-${index + 1}-${focusSlug(materialSlotId)}`,
      sourceBeatIndex: Math.min(index, sourceBeats.length - 1),
      sampleTimeRange: sourceBeat.timeRange,
      targetTimeRange: targetBeat.timeRange,
      role: compact(sourceBeat.shotPurpose || targetBeat.shotPurpose, 32),
      sourcePurpose: sourceBeat.shotPurpose,
      targetPurpose: targetBeat.shotPurpose,
      transferableTechnique: compact(
        `${sourceBeat.transferableRule}；画面规律：${sourceBeat.visualObservation}`,
        180,
      ),
      targetLine: compact(targetBeat.voiceoverOrSubtitle, 140),
      personaRequirement,
      shotLanguage,
      rhythm: compact(`${analysis.pacing.rhythmNotes}；${targetBeat.transitionAndRhythm}`, 160),
      captionRole: captionRoleForText(`${sourceBeat.captionObservation} ${targetBeat.packagingStyle}`),
      transition: transitionForText(allText),
      materialSlotId,
      preferredMaterialKinds,
      nonCopyable: [
        "不复制样例人物身份、外貌和人设",
        "不复制样例品牌、商品、包装和场景",
        "不搬运样例原台词和字幕原句",
      ],
      missingFallback: slotFallback(materialSlotId, personaRequirement),
    });
  });
}

function assetKindText(asset: MaterialAsset) {
  if (asset.kind === "video") return "视频";
  if (asset.kind === "image") return "图片";
  if (asset.kind === "link") return "链接";
  return "文案";
}

function materialSlotFor(slot: TransferSlot, adaptation?: MaterialAdaptation) {
  return adaptation?.slots.find((item) => item.slotId === slot.materialSlotId) ?? null;
}

function matchedAssetLabels(assets: MaterialAsset[], assetIds: string[]) {
  return assetIds
    .map((assetId) => {
      const asset = assets.find((item) => item.id === assetId);
      return asset ? `${asset.label}（${assetKindText(asset)}）` : null;
    })
    .filter((item): item is string => Boolean(item));
}

export function buildMaterialRequirementMatrix({
  transferSlots,
  materialAdaptation,
}: {
  transferSlots: TransferSlot[];
  materialAdaptation?: MaterialAdaptation;
}): MaterialRequirement[] {
  const assets = materialAdaptation?.assets ?? [];
  return transferSlots.map((slot) => {
    const diagnosedSlot = materialSlotFor(slot, materialAdaptation);
    const matchedAssets = diagnosedSlot
      ? matchedAssetLabels(
          assets,
          diagnosedSlot.recommendedAssets.map((asset) => asset.assetId),
        )
      : [];
    const fit = diagnosedSlot?.fit ?? "unknown";

    return materialRequirementSchema.parse({
      slotId: slot.slotId,
      materialSlotId: slot.materialSlotId,
      role: slot.role,
      requiredKinds: slot.preferredMaterialKinds,
      personRequirement: slot.personaRequirement.transferInstruction,
      actionRequirement: slot.targetPurpose,
      sceneRequirement: slot.shotLanguage.visualPriority,
      matchedAssets,
      fit,
      gap:
        fit === "matched"
          ? "素材可以直接承接该手法。"
          : fit === "partial"
            ? "素材只能部分承接，需要字幕或包装补强。"
            : fit === "missing"
              ? "当前素材无法直接满足该手法槽位。"
              : "尚未完成素材诊断。",
      completionStrategy: diagnosedSlot?.completionStrategy ?? "manual-review",
      completionPlan: diagnosedSlot?.completionPlan ?? slot.missingFallback,
    });
  });
}

export function buildDirectorTransferPlan({
  analysis,
  plan,
  version,
}: {
  analysis: VideoStructureAnalysis;
  plan: MigratedVideoPlan;
  version?: PlanVersion;
}) {
  const techniqueProfile = buildTechniqueProfile(analysis);
  const transferSlots = buildTransferSlots({ analysis, plan, version });
  const materialRequirementMatrix = buildMaterialRequirementMatrix({
    transferSlots,
    materialAdaptation: plan.materialAdaptation,
  });

  return {
    techniqueProfile,
    transferSlots,
    materialRequirementMatrix,
  };
}

export function slotSummaryForPrompt(slot: TransferSlot) {
  return [
    `样例时段：${slot.sampleTimeRange}`,
    `可迁移手法：${slot.transferableTechnique}`,
    `人物/主体：${slot.personaRequirement.transferInstruction}`,
    `镜头语言：${slot.shotLanguage.framing} / ${slot.shotLanguage.cameraMotion}；${slot.shotLanguage.composition}`,
    `字幕角色：${slot.captionRole}`,
    `禁止复制：${slot.nonCopyable.join("；")}`,
  ].join("\n");
}
