import { z } from "zod";

import type { ChampionRubricReport } from "@/lib/champion-rubric";
import type { MigratedVideoPlan, VideoStructureAnalysis } from "@/lib/schemas";
import type { TechniqueTransferRecipe } from "@/lib/technique-transfer";

const statusSchema = z.enum(["ready", "partial", "todo"]);
const prioritySchema = z.enum(["P0", "P1", "加分"]);

export const contestRequirementCoverageItemSchema = z.object({
  taskId: z.string().min(1),
  priority: prioritySchema,
  title: z.string().min(1),
  requirement: z.string().min(1),
  status: statusSchema,
  evidence: z.string().min(1),
  judgePanel: z.string().min(1),
  nextAction: z.string().min(1),
});

export const contestRequirementCoverageReportSchema = z.object({
  totalCount: z.number().int().positive(),
  completedCount: z.number().int().min(0),
  p0CompletedCount: z.number().int().min(0),
  p1CompletedCount: z.number().int().min(0),
  bonusReadyCount: z.number().int().min(0),
  items: z.array(contestRequirementCoverageItemSchema).min(1),
});

export type ContestRequirementCoverageItem = z.infer<
  typeof contestRequirementCoverageItemSchema
>;
export type ContestRequirementCoverageReport = z.infer<
  typeof contestRequirementCoverageReportSchema
>;

function textIncludesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function beatCount(plan?: MigratedVideoPlan) {
  return plan?.versions.reduce((sum, version) => sum + version.scriptBeats.length, 0) ?? 0;
}

function statusFrom(score: number, ready = 1, partial = 0.5): ContestRequirementCoverageItem["status"] {
  if (score >= ready) return "ready";
  if (score >= partial) return "partial";
  return "todo";
}

function rubricEvidence(report: ChampionRubricReport | undefined, label: string) {
  return report?.items.find((item) => item.label === label)?.evidence;
}

export function buildContestRequirementCoverage({
  analysis,
  plan,
  techniqueTransfer,
  championRubric,
}: {
  analysis?: VideoStructureAnalysis | null;
  plan?: MigratedVideoPlan | null;
  techniqueTransfer?: TechniqueTransferRecipe | null;
  championRubric?: ChampionRubricReport | null;
}): ContestRequirementCoverageReport {
  const allText = JSON.stringify({ analysis, plan, techniqueTransfer });
  const material = plan?.materialAdaptation;
  const materialSlots = material?.slots ?? [];
  const materialAssets = material?.assets ?? [];
  const totalBeats = beatCount(plan ?? undefined);
  const mappedScenes = techniqueTransfer?.sceneTransfers.length ?? 0;
  const completionStrategies = new Set(materialSlots.map((slot) => slot.completionStrategy));
  const hasStoryboardOrTimeline = Boolean(plan && techniqueTransfer && mappedScenes >= 3);
  const hasPackaging =
    Boolean(techniqueTransfer?.sourceProfile.packagingTags.length) ||
    textIncludesAny(allText, ["字幕", "标题条", "卖点卡", "贴纸", "转场", "封面"]);

  const items: ContestRequirementCoverageItem[] = [
    {
      taskId: "任务1",
      priority: "P0",
      title: "样片导入与洞察",
      requirement: "支持 1 条或多条样例视频，展示时长、镜头数、字幕/语音概览、封面等基础信息。",
      status: analysis && analysis.beatMap.length >= 4 ? "ready" : analysis ? "partial" : "todo",
      evidence:
        rubricEvidence(championRubric ?? undefined, "样例输入与基础解析") ??
        (analysis
          ? `${analysis.sampleTitle} 已分析为 ${analysis.beatMap.length} 个节拍，含 Hook、字幕、包装和音乐线索。`
          : "尚未分析样例。"),
      judgePanel: "参考样片 / 媒体洞察 / 结构指纹",
      nextAction: analysis ? "可展示样例手法分析结果。" : "选择预设、上传视频或填写样例链接。",
    },
    {
      taskId: "任务2",
      priority: "P0",
      title: "结构蓝图",
      requirement: "至少拆解脚本/段落、节奏、包装中的任意 2 类，最好覆盖 3 类。",
      status:
        analysis &&
        analysis.hookPatterns.length >= 2 &&
        analysis.beatMap.length >= 4 &&
        Boolean(analysis.subtitleLayout) &&
        Boolean(analysis.visualPackaging)
          ? "ready"
          : analysis
            ? "partial"
            : "todo",
      evidence:
        rubricEvidence(championRubric ?? undefined, "结构拆解能力") ??
        (analysis
          ? "已包含 Hook、节奏、字幕布局、画面包装、音乐卡点、卖点推进和 CTA。"
          : "尚未生成结构蓝图。"),
      judgePanel: "结构指纹 / 可迁移节拍 / 包装线索",
      nextAction: analysis ? "可说明这里学习的是创作手法，不复刻原内容。" : "先完成样例分析。",
    },
    {
      taskId: "任务3",
      priority: "P0",
      title: "新片需求与素材",
      requirement: "支持输入新主题、商品卖点或用户素材（图片/视频/文案至少一种），并判断是否足以支撑目标结构。",
      status: plan?.targetBrief && material ? "ready" : plan ? "partial" : "todo",
      evidence: material
        ? `创作目标已生成方案；用户素材被整理为 ${materialAssets.length} 个资产和 ${materialSlots.length} 个结构槽位。`
        : plan
          ? "已有新片方案，等待素材资产诊断。"
          : "尚未输入或生成新内容方案。",
      judgePanel: "新片需求 / 素材文件 / 真实素材资产",
      nextAction: material ? "展示文字、图片、视频、文案文件如何进入素材槽位诊断。" : "填写新内容并上传或描述用户素材后生成方案。",
    },
    {
      taskId: "任务4",
      priority: "P0",
      title: "新片方案生成",
      requirement: "基于样例结构和新内容输出脚本、分镜、时间线草案、包装建议或成片 demo 中至少两项。",
      status: plan && plan.versions.length >= 2 && mappedScenes >= 3 ? "ready" : plan ? "partial" : "todo",
      evidence:
        rubricEvidence(championRubric ?? undefined, "结构迁移生成能力") ??
        (plan
          ? `${plan.versions.length} 个版本、${totalBeats} 个脚本 beat、${mappedScenes} 个源样例到新片段映射。`
          : "尚未生成新片方案。"),
      judgePanel: "多版本脚本 / 手法迁移配方 / 竖屏分镜 / 时间线草案",
      nextAction: plan ? "播放手法迁移说明片或展示手法映射。" : "点击“生成新片方案”。",
    },
    {
      taskId: "任务5",
      priority: "P0",
      title: "素材缺口识别",
      requirement: "识别开头吸引、商品特写、使用过程、对比镜头、结尾 CTA 等结构槽位缺口。",
      status: material && materialSlots.length >= 6 ? "ready" : material ? "partial" : "todo",
      evidence:
        rubricEvidence(championRubric ?? undefined, "素材缺口识别") ??
        (material
          ? `诊断 ${materialSlots.length} 个槽位，素材充分度 ${material.sufficiencyScore}/100，缺口 ${material.missingSlotCount} 个。`
          : "尚未生成素材槽位诊断。"),
      judgePanel: "素材缺口与补全 / 手法映射 / 时间线草案",
      nextAction: material ? "展示每个槽位的 fit、impact 和 completionPlan。" : "生成带用户素材的方案。",
    },
    {
      taskId: "任务6",
      priority: "P0",
      title: "素材缺口补全",
      requirement: "至少支持结构重排、文案/字幕、包装、AIGC、复用现有素材中的一种补全方式。",
      status: statusFrom(completionStrategies.size, 3, 1),
      evidence:
        rubricEvidence(championRubric ?? undefined, "素材缺口补全") ??
        (material
          ? `补全策略：${Array.from(completionStrategies).join(" / ")}。`
          : "尚未生成补全策略。"),
      judgePanel: "素材缺口与补全 / 分镜预览 / 手法映射",
      nextAction: completionStrategies.size ? "强调缺素材时系统会降级为包装/字幕/AIGC/复用策略。" : "补齐 materialAdaptation。",
    },
    {
      taskId: "任务7",
      priority: "P0",
      title: "手法映射可视化",
      requirement: "让评审看见抽取了什么结构、如何映射到新内容、哪里有缺口、最终如何生成结果。",
      status: techniqueTransfer && mappedScenes >= 3 ? "ready" : plan ? "partial" : "todo",
      evidence:
        rubricEvidence(championRubric ?? undefined, "迁移过程可视化") ??
        (techniqueTransfer
          ? `手法迁移配方 ${mappedScenes} 行，含源时间段、输出段、字幕密度、转场和素材状态。`
          : "尚未生成手法迁移配方。"),
      judgePanel: "手法迁移配方 / 映射关系 / 手法说明片",
      nextAction: techniqueTransfer ? "点击“手法迁移说明片”作为视频化证据。" : "生成方案后构建 TechniqueTransferRecipe。",
    },
    {
      taskId: "任务8",
      priority: "P0",
      title: "预览与导出",
      requirement: "至少提供新视频 demo、分镜/时间线可视化或样例结构与新结果对比。",
      status: hasStoryboardOrTimeline ? "ready" : plan ? "partial" : "todo",
      evidence:
        rubricEvidence(championRubric ?? undefined, "最终效果展示") ??
        (hasStoryboardOrTimeline
          ? "页面提供竖屏分镜、时间线草案、样例-结果对比和一键 Remotion 渲染入口。"
          : "尚未生成预览结果。"),
      judgePanel: "竖屏分镜 / 时间线草案 / 一键出片 / final-video.mp4",
      nextAction: hasStoryboardOrTimeline ? "演示高质量有声或手法迁移说明片。" : "生成新片方案。",
    },
    {
      taskId: "任务9",
      priority: "P1",
      title: "包装风格生成",
      requirement: "支持字幕样式、标题条、卖点卡、转场、封面文案或贴纸推荐中的至少 2 项。",
      status: hasPackaging && plan ? "ready" : plan ? "partial" : "todo",
      evidence:
        rubricEvidence(championRubric ?? undefined, "画面包装能力") ??
        (plan
          ? "脚本 beat 保留字幕、包装、转场、封面标题、发布标题和包装标签。"
          : "尚未生成包装建议。"),
      judgePanel: "手法迁移配方 / 多版本脚本 / 竖屏分镜",
      nextAction: plan ? "展示每段 packagingStyle 与 transitionAndRhythm。" : "生成方案。",
    },
    {
      taskId: "任务10",
      priority: "P1",
      title: "多版本创意",
      requirement: "针对同一内容输出高点击、高转化、高节奏或高质感等多个版本。",
      status: plan && plan.versions.length >= 3 ? "ready" : plan && plan.versions.length >= 2 ? "partial" : "todo",
      evidence:
        rubricEvidence(championRubric ?? undefined, "多版本生成") ??
        (plan ? `版本：${plan.versions.map((version) => version.versionName).join(" / ")}。` : "尚未生成版本。"),
      judgePanel: "多版本方案脚本 / 版本切换按钮",
      nextAction: plan ? "切换不同版本展示策略差异。" : "生成新片方案。",
    },
    {
      taskId: "任务11",
      priority: "P1",
      title: "素材智能匹配",
      requirement: "支持对用户真实素材做基础理解、筛选或推荐到开头/中段/结尾。",
      status: materialAssets.length >= 3 && materialSlots.some((slot) => slot.recommendedAssets.length) ? "ready" : material ? "partial" : "todo",
      evidence:
        rubricEvidence(championRubric ?? undefined, "真实素材适配") ??
        (material
          ? `识别 ${materialAssets.length} 个素材资产，推荐到 ${materialSlots.filter((slot) => slot.recommendedAssets.length).length} 个结构槽位。`
          : "尚未解析用户素材。"),
      judgePanel: "真实素材资产 / 素材缺口与补全",
      nextAction: material ? "展示资产卡片和结构槽位推荐。" : "填写用户素材再生成方案。",
    },
    {
      taskId: "任务12",
      priority: "P1",
      title: "人工精修",
      requirement: "支持修改 hook、卖点顺序、包装风格、视频节奏或结尾表达中的任意 1 项并重新生成。",
      status: plan ? "ready" : "todo",
      evidence:
        rubricEvidence(championRubric ?? undefined, "人工可调能力") ??
        (plan
          ? "页面支持字段级时间线编辑、顺序调整、保存历史稿和重新导出。"
          : "尚未进入可编辑方案。"),
      judgePanel: "可编辑时间线 / 历史版本 / 导出",
      nextAction: plan ? "点击“进入编辑”，现场修改一个 beat。" : "先生成新片方案。",
    },
    {
      taskId: "任务13",
      priority: "加分",
      title: "自然语言微调",
      requirement: "支持一句话指令调整结果，例如开头更抓人、减少字幕、商品信息提前。",
      status: plan ? "ready" : "todo",
      evidence:
        plan
          ? "页面支持自然语言预览差异、应用到当前方案并保存新稿。"
          : "尚未生成可编辑方案。",
      judgePanel: "自然语言微调 / 差异预览 / 历史版本",
      nextAction: plan ? "输入“开头更抓人，并把证据提前”做现场演示。" : "生成方案后演示自然语言编辑。",
    },
  ];

  const completedCount = items.filter((item) => item.status === "ready").length;
  const p0CompletedCount = items.filter(
    (item) => item.priority === "P0" && item.status === "ready",
  ).length;
  const p1CompletedCount = items.filter(
    (item) => item.priority === "P1" && item.status === "ready",
  ).length;
  const bonusReadyCount = items.filter(
    (item) => item.priority === "加分" && item.status === "ready",
  ).length;

  return contestRequirementCoverageReportSchema.parse({
    totalCount: items.length,
    completedCount,
    p0CompletedCount,
    p1CompletedCount,
    bonusReadyCount,
    items,
  });
}
