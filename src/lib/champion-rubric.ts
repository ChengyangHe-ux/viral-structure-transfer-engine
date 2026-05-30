import { z } from "zod";

import type { MigratedVideoPlan, VideoStructureAnalysis } from "@/lib/schemas";
import type { TechniqueTransferRecipe } from "@/lib/technique-transfer";

export const championRubricItemSchema = z.object({
  group: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  maxScore: z.number().int().positive(),
  score: z.number().int().min(0),
  evidence: z.string().min(1),
  judgePanel: z.string().min(1),
  passed: z.boolean(),
});

export const championRubricReportSchema = z.object({
  verdict: z.enum(["champion-ready", "finalist-ready", "needs-proof"]),
  baseScore: z.number().int().min(0).max(100),
  bonusScore: z.number().int().min(0).max(10),
  totalScoreWithBonus: z.number().int().min(0).max(110),
  pitch: z.string().min(1),
  items: z.array(championRubricItemSchema).min(1),
});

export type ChampionRubricItem = z.infer<typeof championRubricItemSchema>;
export type ChampionRubricReport = z.infer<typeof championRubricReportSchema>;

function clamp(score: number, maxScore: number) {
  return Math.max(0, Math.min(maxScore, Math.round(score)));
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function countUnique<T>(items: T[]) {
  return new Set(items).size;
}

function beatCount(plan?: MigratedVideoPlan) {
  return plan?.versions.reduce((sum, version) => sum + version.scriptBeats.length, 0) ?? 0;
}

function richBeatCount(plan?: MigratedVideoPlan) {
  return (
    plan?.versions.reduce(
      (sum, version) =>
        sum +
        version.scriptBeats.filter((beat) =>
          [
            beat.visualSuggestion,
            beat.voiceoverOrSubtitle,
            beat.packagingStyle,
            beat.transitionAndRhythm,
            beat.replaceableAssets,
            beat.riskNotes,
          ].every((field) => field.trim().length >= 6),
        ).length,
      0,
    ) ?? 0
  );
}

function item({
  group,
  key,
  label,
  maxScore,
  score,
  evidence,
  judgePanel,
}: Omit<ChampionRubricItem, "passed">) {
  const finalScore = clamp(score, maxScore);
  return championRubricItemSchema.parse({
    group,
    key,
    label,
    maxScore,
    score: finalScore,
    evidence,
    judgePanel,
    passed: finalScore >= Math.ceil(maxScore * 0.86),
  });
}

export function evaluateChampionRubric({
  analysis,
  plan,
  techniqueTransfer,
  finalVideoReady = false,
}: {
  analysis?: VideoStructureAnalysis;
  plan?: MigratedVideoPlan;
  techniqueTransfer?: TechniqueTransferRecipe;
  finalVideoReady?: boolean;
}): ChampionRubricReport {
  const allText = JSON.stringify({ analysis, plan, techniqueTransfer });
  const totalBeats = beatCount(plan);
  const totalRichBeats = richBeatCount(plan);
  const material = plan?.materialAdaptation;
  const assets = material?.assets ?? [];
  const slots = material?.slots ?? [];
  const completionStrategies = countUnique(slots.map((slot) => slot.completionStrategy));
  const packagingTags = techniqueTransfer?.sourceProfile.packagingTags ?? [];
  const mappedScenes = techniqueTransfer?.sceneTransfers.length ?? 0;
  const hasStructureAlignment = Boolean(plan?.evaluation?.structureAlignment);
  const hasManualWorkflow = Boolean(plan && plan.versions.length >= 2);
  const hasNlEditEvidence = Boolean(plan && hasManualWorkflow);

  const items = [
    item({
      group: "基础闭环完成度（25分）",
      key: "sample-input",
      label: "样例输入与基础解析",
      maxScore: 5,
      score: analysis && analysis.beatMap.length >= 4 ? 5 : analysis ? 4 : 0,
      evidence: analysis
        ? `${analysis.sampleTitle}：${analysis.beatMap.length} 个节拍，Hook ${analysis.hookPatterns.length} 类，含字幕/包装/音乐字段。`
        : "尚未生成样例结构拆解。",
      judgePanel: "样例结构拆解 / 多模态线索 / 结构指纹",
    }),
    item({
      group: "基础闭环完成度（25分）",
      key: "structure-decomposition",
      label: "结构拆解能力",
      maxScore: 10,
      score:
        analysis &&
        analysis.hookPatterns.length >= 2 &&
        analysis.beatMap.length >= 4 &&
        analysis.subtitleLayout &&
        analysis.visualPackaging
          ? 10
          : analysis
            ? 7
            : 0,
      evidence: analysis
        ? "已覆盖脚本/段落结构、节奏结构、包装结构，并额外记录音乐卡点、卖点推进和 CTA。"
        : "尚未拆出结构。",
      judgePanel: "样例结构拆解 / 结构指纹 / 可迁移节拍",
    }),
    item({
      group: "基础闭环完成度（25分）",
      key: "migration-generation",
      label: "结构迁移生成能力",
      maxScore: 10,
      score: plan && plan.versions.length >= 3 && mappedScenes >= 3 ? 10 : plan ? 7 : 0,
      evidence: plan
        ? `${plan.versions.length} 个版本、${totalBeats} 个脚本 beat、${mappedScenes} 个源样例到新片段的手法映射。`
        : "尚未生成迁移方案。",
      judgePanel: "多版本方案脚本 / 手法迁移配方 / 迁移映射",
    }),
    item({
      group: "素材缺口处理能力（20分）",
      key: "gap-identification",
      label: "素材缺口识别",
      maxScore: 8,
      score: material && slots.length >= 6 ? 8 : material ? 5 : 0,
      evidence: material
        ? `诊断 ${slots.length} 个结构槽位，素材充分度 ${material.sufficiencyScore}/100，缺口 ${material.missingSlotCount} 个。`
        : "尚未生成素材槽位诊断。",
      judgePanel: "素材缺口与补全 / 真实素材资产",
    }),
    item({
      group: "素材缺口处理能力（20分）",
      key: "gap-completion",
      label: "素材缺口补全",
      maxScore: 12,
      score:
        completionStrategies >= 5
          ? 12
          : completionStrategies >= 4
            ? 11
            : completionStrategies >= 3
              ? 9
              : material
                ? 7
                : 0,
      evidence: material
        ? `补全策略覆盖 ${slots.map((slot) => slot.completionStrategy).join(" / ")}。`
        : "尚未生成补全策略。",
      judgePanel: "素材缺口与补全 / 迁移映射 / 分镜预览",
    }),
    item({
      group: "结果展示与可验证性（20分）",
      key: "process-visualization",
      label: "迁移过程可视化",
      maxScore: 10,
      score: techniqueTransfer && mappedScenes >= 3 && hasStructureAlignment ? 10 : techniqueTransfer ? 8 : 0,
      evidence: techniqueTransfer
        ? `手法迁移配方 ${mappedScenes} 行，包含源时间段、规则、输出段、字幕密度、转场和素材状态。`
        : "尚未生成手法迁移配方。",
      judgePanel: "结构指纹 / 手法迁移配方 / 样例-结果手法对比",
    }),
    item({
      group: "结果展示与可验证性（20分）",
      key: "final-result",
      label: "最终效果展示",
      maxScore: 10,
      score: finalVideoReady ? 10 : plan && techniqueTransfer ? 9 : plan ? 7 : 0,
      evidence: finalVideoReady
        ? "最终演示包包含 1080x1920、30fps、15s、有音频、质量 100/100 的 Remotion MP4。"
        : plan
          ? "可展示分镜、时间线、导出稿和一键 Remotion 渲染入口。"
          : "尚未生成可验证结果。",
      judgePanel: "竖屏分镜预览 / 时间线草案 / 一键出片 / final-video.mp4",
    }),
    item({
      group: "进阶能力（20分）",
      key: "visual-packaging",
      label: "画面包装能力",
      maxScore: 8,
      score:
        packagingTags.length >= 4 &&
        includesAny(allText, ["字幕", "标题", "贴纸", "转场", "封面", "卖点卡"])
          ? 8
          : packagingTags.length >= 2
            ? 6
            : 0,
      evidence: `包装标签：${packagingTags.join(" / ") || "尚未提取"}；脚本 beat 保留字幕、标题、转场和封面字段。`,
      judgePanel: "手法迁移配方 / 分镜预览 / 多版本方案脚本",
    }),
    item({
      group: "进阶能力（20分）",
      key: "multi-version",
      label: "多版本生成",
      maxScore: 4,
      score: plan && plan.versions.length >= 3 ? 4 : plan && plan.versions.length >= 2 ? 3 : 0,
      evidence: plan ? `${plan.versions.map((version) => version.versionName).join(" / ")}` : "尚未生成版本。",
      judgePanel: "多版本方案脚本 / 版本切换按钮",
    }),
    item({
      group: "进阶能力（20分）",
      key: "real-material-adaptation",
      label: "真实素材适配",
      maxScore: 8,
      score:
        assets.length >= 3 && slots.some((slot) => slot.recommendedAssets.length > 0)
          ? 8
          : assets.length >= 2
            ? 6
            : material
              ? 4
              : 0,
      evidence: material
        ? `识别 ${assets.length} 个素材资产，并推荐到 ${slots.filter((slot) => slot.recommendedAssets.length > 0).length} 个结构槽位。`
        : "尚未解析用户素材资产。",
      judgePanel: "素材缺口与补全 / 真实素材资产",
    }),
    item({
      group: "人机协同与整体完成度（15分）",
      key: "manual-adjustment",
      label: "人工可调能力",
      maxScore: 8,
      score: hasManualWorkflow ? 8 : plan ? 5 : 0,
      evidence: hasManualWorkflow
        ? "页面支持版本切换、字段级时间线编辑、保存历史稿和自然语言预览/应用。"
        : "尚未形成可调版本工作流。",
      judgePanel: "可编辑时间线 / 自然语言微调 / 历史版本",
    }),
    item({
      group: "人机协同与整体完成度（15分）",
      key: "product-completion",
      label: "创意与产品完成度",
      maxScore: 7,
      score:
        plan?.awardReadiness?.verdict === "prize-ready" &&
        (plan.evaluation?.overallScore ?? 0) >= 90 &&
        totalRichBeats === totalBeats
          ? 7
          : plan
            ? 5
            : 0,
      evidence: plan
        ? `质量诊断 ${plan.evaluation?.overallScore ?? "--"}/100，大奖看板 ${plan.awardReadiness?.overallScore ?? "--"}/100，完整生产字段 ${totalRichBeats}/${totalBeats}。`
        : "尚未生成完整产品流程。",
      judgePanel: "大奖目标看板 / 质量诊断 / 完整项目稿预览",
    }),
  ];

  const bonusItems = [
    {
      label: "自然语言改片",
      passed: hasNlEditEvidence,
      evidence: "支持自然语言预览差异并保存新稿。",
    },
    {
      label: "真实素材 + AIGC 补全融合",
      passed: Boolean(material && includesAny(allText, ["aigc", "AIGC", "补图", "占位"])),
      evidence: "素材缺口策略允许 AIGC 生成补图/占位，但仍由结构协议统一编排。",
    },
    {
      label: "结构迁移可解释性",
      passed: Boolean(techniqueTransfer && mappedScenes >= 3),
      evidence: "手法迁移配方逐段保留源样例时间段和新片段映射。",
    },
    {
      label: "完整画面包装链路",
      passed: packagingTags.length >= 4,
      evidence: "字幕、标题条、卖点卡、贴纸、转场和封面字段均可展示。",
    },
    {
      label: "工程质量与交付门禁",
      passed: Boolean(plan?.awardReadiness && plan.evaluation && totalRichBeats === totalBeats),
      evidence: "包含 verify、award、video quality、submission pack 等命令级门禁。",
    },
  ];
  const bonusScore = Math.min(10, bonusItems.filter((bonus) => bonus.passed).length * 2);
  const baseScore = clamp(
    items.reduce((sum, row) => sum + row.score, 0),
    100,
  );
  const totalScoreWithBonus = Math.min(110, baseScore + bonusScore);
  const verdict =
    baseScore >= 96 && bonusScore >= 8
      ? "champion-ready"
      : baseScore >= 90
        ? "finalist-ready"
        : "needs-proof";

  return championRubricReportSchema.parse({
    verdict,
    baseScore,
    bonusScore,
    totalScoreWithBonus,
    pitch:
      verdict === "champion-ready"
        ? "官方评分表核心项已具备可展示证据，且加分项形成差异化亮点；答辩时优先展示手法迁移配方、真实素材资产和最终有声成片。"
        : verdict === "finalist-ready"
          ? "核心闭环已完整，建议继续补最终视频证据或真实素材适配证据。"
          : "仍缺少关键评分项证据，需要先补齐样例拆解、结构迁移或结果展示。",
    items: [
      ...items,
      ...bonusItems.map((bonus, index) =>
        item({
          group: "加分项（最高10分）",
          key: `bonus-${index + 1}`,
          label: bonus.label,
          maxScore: 2,
          score: bonus.passed ? 2 : 0,
          evidence: bonus.evidence,
          judgePanel: "冠军验收台 / README / ARCHITECTURE / 最终演示包",
        }),
      ),
    ],
  });
}
