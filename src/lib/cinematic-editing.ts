import { z } from "zod";

import type { AdaptiveTransferStoryboardShot } from "@/lib/adaptive-video-storyboard";
import type { TransferSlot } from "@/lib/director-technique";

const cinematicStageSchema = z.enum(["hook", "reveal", "process", "proof", "cta"]);

export const cinematicShotDecisionSchema = z.object({
  order: z.number().int().positive(),
  stage: cinematicStageSchema,
  role: z.string().min(1),
  cameraTreatment: z.string().min(1),
  motionPlan: z.string().min(1),
  colorGrade: z.string().min(1),
  transitionPlan: z.string().min(1),
  soundDesign: z.string().min(1),
  captionTreatment: z.string().min(1),
  materialInstruction: z.string().min(1),
  aigcPromptInstruction: z.string().min(1),
  postPolish: z.array(z.string().min(1)).min(1),
});

export const cinematicEditPlanSchema = z.object({
  enabled: z.boolean(),
  label: z.string().min(1),
  summary: z.string().min(1),
  globalStyle: z.string().min(1),
  negativeRules: z.array(z.string().min(1)).min(1),
  decisions: z.array(cinematicShotDecisionSchema),
});

export const cinematicMaterialRenderPlanSchema = z.object({
  stage: cinematicStageSchema,
  cropFilter: z.string().min(1),
  imageZoomExpression: z.string().min(1),
  trimBias: z.enum(["start", "middle", "end"]),
  segmentPolishFilters: z.array(z.string().min(1)).default([]),
  executionSummary: z.string().min(1),
});

export const cinematicConcatPlanSchema = z.object({
  filterComplex: z.string().min(1),
  outputLabel: z.string().min(1),
  transitionDuration: z.number().positive(),
  summary: z.string().min(1),
});

export type CinematicShotDecision = z.infer<typeof cinematicShotDecisionSchema>;
export type CinematicEditPlan = z.infer<typeof cinematicEditPlanSchema>;
export type CinematicMaterialRenderPlan = z.infer<typeof cinematicMaterialRenderPlanSchema>;
export type CinematicConcatPlan = z.infer<typeof cinematicConcatPlanSchema>;

function compact(value: string, maxLength: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
}

function slotStage(shot: AdaptiveTransferStoryboardShot, slot?: TransferSlot | null): CinematicShotDecision["stage"] {
  const text = `${slot?.materialSlotId ?? shot.slotId} ${shot.role} ${slot?.targetPurpose ?? ""}`;
  if (/hook|开头|吸引|反差|第一眼/i.test(text)) return "hook";
  if (/hero|主体|识别|主视觉|特写/i.test(text)) return "reveal";
  if (/usage|过程|操作|步骤|演示|流程/i.test(text)) return "process";
  if (/proof|comparison|证据|证明|对比|效果|反馈|参数/i.test(text)) return "proof";
  if (/cta|结尾|收束|行动|购买|领取|收藏/i.test(text)) return "cta";
  return shot.order <= 1 ? "hook" : "process";
}

function stageRole(stage: CinematicShotDecision["stage"]) {
  const roles: Record<CinematicShotDecision["stage"], string> = {
    hook: "开场强吸引",
    reveal: "主体英雄亮相",
    process: "过程推进",
    proof: "证据强化",
    cta: "收束行动",
  };
  return roles[stage];
}

function treatmentForStage(stage: CinematicShotDecision["stage"], transferSlot?: TransferSlot | null) {
  const framing = transferSlot?.shotLanguage.framing ?? "mixed";
  const base = {
    hook: {
      cameraTreatment: "低机位或微距英雄镜头，第一秒出现最强主体，不从空场铺垫。",
      motionPlan: "0.2 秒冲击切入，随后轻微推进或速度坡度，让主体像预告片主镜头一样被推出。",
      transitionPlan: "重拍硬切或快速闪白转场，只服务停留，不做花哨堆叠。",
      soundDesign: "低频冲击 + 短促 whoosh，开头 0.4 秒建立电影预告片张力。",
      captionTreatment: "少字强字幕，最多两行，关键词像片名卡一样短促出现。",
      materialInstruction: "优先选最清晰、最有结果感的真实素材；图片要做慢推进，视频要从动作最强处起剪。",
      aigcPromptInstruction: "生成电影广告级开场镜头：强主体、浅景深、边缘高光、真实光影，不能出现文字或黑边。",
    },
    reveal: {
      cameraTreatment: "主体居中偏上，保留竖屏安全区，用干净背景和轮廓光突出产品/人物/界面。",
      motionPlan: "慢推或轻环绕，建立主体分量，不频繁切碎主体识别镜头。",
      transitionPlan: "由开场冲击切到稳定英雄镜头，使用动作方向匹配转场。",
      soundDesign: "保留轻微环境声，叠加柔和上扬音效，让主体出现有仪式感。",
      captionTreatment: "标题感短句贴底，不遮挡主体核心轮廓。",
      materialInstruction: "优先用主体特写、清晰截图或正面产品画面；素材不足时放大局部做英雄亮相。",
      aigcPromptInstruction: "生成高端商业英雄镜头：主体清晰、光线干净、背景有空间层次、真实材质可见。",
    },
    process: {
      cameraTreatment: framing === "screen-capture" ? "界面全屏占位，鼠标/手势/圈选节奏清楚。" : "手部、动作或流程用近景跟拍，动作方向保持连续。",
      motionPlan: "用 2-3 个动作点形成节奏坡度，过程镜头之间用 match cut 衔接。",
      transitionPlan: "按动作方向切镜，避免无意义转场；步骤切换用轻 whip 或动作遮挡。",
      soundDesign: "细节 Foley 声，例如点击、液体、包装、滑动或键盘声，增强真实剪辑感。",
      captionTreatment: "字幕只解释当前动作，不把脚本文案整段压上去。",
      materialInstruction: "视频素材从关键动作前 0.2 秒切入；图片素材用局部放大、轻推和顺序重排模拟过程。",
      aigcPromptInstruction: "生成真实操作过程镜头：动作连贯、手部或界面清晰、浅景深适度、不要生成字幕文字。",
    },
    proof: {
      cameraTreatment: "证据画面更稳定，使用近景、分屏或局部放大，信息要可信而不花。",
      motionPlan: "镜头运动收敛，用短暂停顿让结果、参数、反馈或前后对比被看清。",
      transitionPlan: "从过程切到证据时做节奏降速，给观众确认感。",
      soundDesign: "减少 whoosh，使用轻提示音或低频停顿，突出可信证据。",
      captionTreatment: "关键词高亮，数字和结果词单独成句，避免满屏说明。",
      materialInstruction: "优先用反馈截图、结果页、参数图和对比图；素材不足时做局部放大和左右对照卡。",
      aigcPromptInstruction: "生成可信结果镜头：真实对比、清晰细节、商业摄影质感，不生成虚假可读文字。",
    },
    cta: {
      cameraTreatment: "回到最强主体或结果定格，用稳定画面完成收束。",
      motionPlan: "慢拉远或微定格，最后 0.6 秒留出行动指令空间。",
      transitionPlan: "音乐收束硬切到最终画面，不再引入新信息。",
      soundDesign: "收束音效 + 轻环境底噪，给出完成感。",
      captionTreatment: "只保留一个行动句，短、清楚、可执行。",
      materialInstruction: "复用主视觉或结果画面做结尾，避免新增陌生素材破坏统一性。",
      aigcPromptInstruction: "生成电影广告收尾镜头：主体稳定、空间留白、干净高光、适合叠加行动字幕。",
    },
  }[stage];
  return base;
}

export function buildCinematicShotDecision({
  shot,
  transferSlot,
}: {
  shot: AdaptiveTransferStoryboardShot;
  transferSlot?: TransferSlot | null;
}): CinematicShotDecision {
  const stage = slotStage(shot, transferSlot);
  const treatment = treatmentForStage(stage, transferSlot);
  return cinematicShotDecisionSchema.parse({
    order: shot.order,
    stage,
    role: stageRole(stage),
    colorGrade: "竖屏电影广告色调：轻微冷暖对比、肤色/产品不过饱和、保留高光层次，不加黑边。",
    postPolish: [
      "电影级对比和高光保护",
      "轻胶片颗粒和中心注意力控制",
      "按动作点做转场与音效收束",
    ],
    ...treatment,
  });
}

export function buildCinematicEditPlan({
  storyboard,
  transferSlots,
}: {
  storyboard: AdaptiveTransferStoryboardShot[];
  transferSlots?: TransferSlot[];
}): CinematicEditPlan {
  const decisions = storyboard.map((shot, index) =>
    buildCinematicShotDecision({
      shot,
      transferSlot: transferSlots?.[Math.min(index, Math.max(0, transferSlots.length - 1))],
    }),
  );

  return cinematicEditPlanSchema.parse({
    enabled: true,
    label: "大片精剪",
    summary: "把样片手法迁移成电影广告级成片：开场强冲击、主体英雄镜头、过程动作连续、证据镜头稳定、结尾有收束感。",
    globalStyle: "高端商业短片质感，竖屏 9:16，无黑边；统一冷暖电影色调、真实光影、浅景深、细节 Foley、少字强字幕。",
    negativeRules: [
      "不加上下黑边或大黑框",
      "不把字幕、Logo、水印、二维码或伪文字画进生成视频",
      "不复制样片人物、品牌、商品、场景和原台词",
      "不为了炫技牺牲目标内容清晰度",
    ],
    decisions,
  });
}

export function cinematicPromptBlock(decision?: CinematicShotDecision | null) {
  if (!decision) return "";
  return [
    "大片精剪要求：",
    `段落角色：${decision.role}`,
    `镜头处理：${decision.cameraTreatment}`,
    `运动设计：${decision.motionPlan}`,
    `色彩质感：${decision.colorGrade}`,
    `转场声音：${decision.transitionPlan}；${decision.soundDesign}`,
    `字幕留白：${decision.captionTreatment}`,
    `生成补镜：${decision.aigcPromptInstruction}`,
    "禁止黑边、可读文字、Logo、水印、二维码和样片内容复刻。",
  ].join("\n");
}

export function compactCinematicDecision(decision?: CinematicShotDecision | null) {
  if (!decision) return null;
  return compact(
    `${decision.role}：${decision.cameraTreatment} ${decision.motionPlan} ${decision.transitionPlan}`,
    150,
  );
}

function stageFromSlotId(slotId: string): CinematicShotDecision["stage"] {
  if (/hook|开头/i.test(slotId)) return "hook";
  if (/hero|主体|product/i.test(slotId)) return "reveal";
  if (/usage|process|过程|操作/i.test(slotId)) return "process";
  if (/proof|comparison|证据|对比|效果/i.test(slotId)) return "proof";
  if (/cta|结尾|收束/i.test(slotId)) return "cta";
  return "process";
}

function materialRenderProfile(stage: CinematicShotDecision["stage"]) {
  const profiles: Record<
    CinematicShotDecision["stage"],
    {
      cropY: string;
      zoom: string;
      trimBias: CinematicMaterialRenderPlan["trimBias"];
      polish: string[];
      summary: string;
    }
  > = {
    hook: {
      cropY: "(in_h-out_h)*0.36",
      zoom: "min(1.02+0.0018*on,1.13)",
      trimBias: "start",
      polish: [
        "eq=contrast=1.08:saturation=1.05:brightness=0.006:gamma=1.012",
        "unsharp=5:5:0.52:3:3:0.18",
        "fade=t=in:st=0:d=0.08",
      ],
      summary: "开场用上半安全区和微推进制造冲击，视频从动作最强处起剪。",
    },
    reveal: {
      cropY: "(in_h-out_h)*0.40",
      zoom: "min(1.01+0.0011*on,1.10)",
      trimBias: "middle",
      polish: [
        "eq=contrast=1.065:saturation=1.045:brightness=0.004:gamma=1.01",
        "unsharp=5:5:0.48:3:3:0.16",
      ],
      summary: "主体亮相保持稳定构图和轻推进，让新主题先被看清。",
    },
    process: {
      cropY: "(in_h-out_h)*0.45",
      zoom: "min(1.0+0.0009*on,1.07)",
      trimBias: "middle",
      polish: [
        "eq=contrast=1.045:saturation=1.035:brightness=0.003",
        "unsharp=5:5:0.38:3:3:0.12",
      ],
      summary: "过程镜头留足动作连续性，用轻运动模拟跟拍和 match cut 衔接。",
    },
    proof: {
      cropY: "(in_h-out_h)*0.43",
      zoom: "min(1.04+0.00045*on,1.08)",
      trimBias: "end",
      polish: [
        "eq=contrast=1.055:saturation=1.025:brightness=0.002",
        "unsharp=5:5:0.42:3:3:0.12",
      ],
      summary: "证据镜头放慢视觉变化，优先截取素材后段结果和反馈。",
    },
    cta: {
      cropY: "(in_h-out_h)*0.41",
      zoom: "max(1.10-0.0012*on,1.02)",
      trimBias: "end",
      polish: [
        "eq=contrast=1.06:saturation=1.04:brightness=0.004",
        "unsharp=5:5:0.45:3:3:0.14",
      ],
      summary: "结尾复用最强主体或结果画面，微拉远给行动字幕留空间。",
    },
  };
  return profiles[stage];
}

export function buildCinematicMaterialRenderPlan({
  decision,
  slotId,
}: {
  decision?: CinematicShotDecision | null;
  slotId: string;
}): CinematicMaterialRenderPlan {
  const stage = decision?.stage ?? stageFromSlotId(slotId);
  const profile = materialRenderProfile(stage);
  return cinematicMaterialRenderPlanSchema.parse({
    stage,
    cropFilter: `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(in_w-out_w)/2:${profile.cropY},setsar=1`,
    imageZoomExpression: profile.zoom,
    trimBias: profile.trimBias,
    segmentPolishFilters: profile.polish,
    executionSummary: profile.summary,
  });
}

export function buildCinematicConcatPlan({
  inputCount,
  segmentSeconds,
  transitionDuration = 0.18,
}: {
  inputCount: number;
  segmentSeconds: number;
  transitionDuration?: number;
}): CinematicConcatPlan {
  const safeInputCount = Math.max(0, Math.floor(inputCount));
  const safeSegmentSeconds = Math.max(0.8, segmentSeconds);
  const safeTransition = Math.min(
    0.32,
    Math.max(0.08, Math.min(transitionDuration, safeSegmentSeconds / 4)),
  );
  if (safeInputCount < 2) {
    return cinematicConcatPlanSchema.parse({
      filterComplex: "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p[vout]",
      outputLabel: "[vout]",
      transitionDuration: safeTransition,
      summary: "单段素材直接输出，不做交叠转场。",
    });
  }

  const normalizedInputs = Array.from({ length: safeInputCount }, (_, index) =>
    `[${index}:v]${[
      "scale=1080:1920:force_original_aspect_ratio=increase",
      "crop=1080:1920",
      "setsar=1",
      "fps=30",
      "format=yuv420p",
      `trim=duration=${safeSegmentSeconds.toFixed(2)}`,
      "setpts=PTS-STARTPTS",
    ].join(",")}[cv${index}]`,
  );

  const transitions: string[] = [];
  let previousLabel = "[cv0]";
  for (let index = 1; index < safeInputCount; index += 1) {
    const nextLabel = index === safeInputCount - 1 ? "[vout]" : `[cx${index}]`;
    const offset = index * (safeSegmentSeconds - safeTransition);
    transitions.push(
      `${previousLabel}[cv${index}]xfade=transition=fade:duration=${safeTransition.toFixed(
        2,
      )}:offset=${offset.toFixed(2)}${nextLabel}`,
    );
    previousLabel = nextLabel;
  }

  return cinematicConcatPlanSchema.parse({
    filterComplex: [...normalizedInputs, ...transitions].join(";"),
    outputLabel: "[vout]",
    transitionDuration: safeTransition,
    summary: `使用 ${safeTransition.toFixed(2)}s 轻交叠转场拼接 ${safeInputCount} 段，减少普通硬切的拼接感。`,
  });
}
