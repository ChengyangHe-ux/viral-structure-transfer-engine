import {
  migratedVideoPlanSchema,
  planEvaluationSchema,
  type MigratedVideoPlan,
  type PlanVersion,
  type VideoStructureAnalysis,
} from "@/lib/schemas";

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function scoreVersion(version: PlanVersion) {
  const firstBeat = version.scriptBeats[0];
  const allBeatText = version.scriptBeats
    .map((beat) =>
      [
        beat.timeRange,
        beat.shotPurpose,
        beat.visualSuggestion,
        beat.voiceoverOrSubtitle,
        beat.packagingStyle,
        beat.sellingPointIntent,
        beat.transitionAndRhythm,
        beat.replaceableAssets,
        beat.riskNotes,
      ].join(" "),
    )
    .join(" ");

  let score = 45;
  if (version.scriptBeats.length >= 5) score += 10;
  if (firstBeat?.timeRange.includes("0-")) score += 8;
  if (firstBeat && includesAny(firstBeat.voiceoverOrSubtitle, ["别", "90%", "变化", "错", "关键"])) {
    score += 8;
  }
  if (version.coverTitle.length >= 8 && version.captionTitle.length >= 8) score += 8;
  if (version.hashtags.length >= 3) score += 5;
  if (includesAny(allBeatText, ["证据", "对比", "反馈", "参数", "流程", "评价"])) score += 7;
  if (includesAny(allBeatText, ["风险", "避免", "追溯", "夸大"])) score += 5;
  if (includesAny(allBeatText, ["替换", "素材", "截图", "特写", "场景"])) score += 4;

  return clampScore(score);
}

export function evaluatePlan(
  plan: MigratedVideoPlan,
  analysis?: VideoStructureAnalysis,
) {
  const versionScores = plan.versions.map((version) => {
    const score = scoreVersion(version);
    return {
      versionName: version.versionName,
      score,
      rationale:
        score >= 85
          ? "结构完整，适合作为演示主版本。"
          : score >= 75
            ? "已具备可执行脚本，需要补强少量证据素材。"
            : "需要进一步强化 Hook、证据链或行动指令。",
    };
  });
  const bestVersion =
    versionScores.reduce((best, current) =>
      current.score > best.score ? current : best,
    ).versionName || plan.versions[0].versionName;

  const inheritedCount = plan.inheritedStructure.length;
  const beatCount = plan.versions.reduce(
    (sum, version) => sum + version.scriptBeats.length,
    0,
  );
  const allText = JSON.stringify(plan);
  const hookScore = scoreVersion(plan.versions[0] ?? plan.versions[0]);
  const transferScore = clampScore(
    55 + inheritedCount * 7 + (analysis?.reusableTemplate.length ?? 0) * 3,
  );
  const progressionScore = clampScore(
    58 +
      (includesAny(allText, ["证据", "背书", "反馈"]) ? 14 : 0) +
      (includesAny(allText, ["收益", "门槛", "成本"]) ? 12 : 0) +
      (includesAny(allText, ["行动", "收藏", "入口"]) ? 10 : 0),
  );
  const editabilityScore = clampScore(
    48 +
      Math.min(beatCount, 15) * 2 +
      (includesAny(allText, ["可替换素材", "截图", "特写", "场景"]) ? 14 : 0) +
      (plan.versions.length >= 3 ? 8 : 0),
  );
  const complianceScore = clampScore(
    62 +
      (includesAny(allText, ["避免", "风险", "追溯"]) ? 18 : 0) +
      (analysis?.riskNotes.length ? 8 : 0),
  );
  const materialScore = plan.materialAdaptation?.sufficiencyScore ?? 65;

  const dimensions = [
    {
      key: "hook-retention",
      label: "前 3 秒停留",
      score: clampScore(hookScore),
      evidence: "首段脚本是否结果前置、反差明确，并能快速给出继续观看理由。",
      suggestion: hookScore >= 85 ? "保留当前开场。" : "开头再加入更具体的结果画面或数字反差。",
    },
    {
      key: "structure-transfer",
      label: "结构迁移度",
      score: transferScore,
      evidence: `已迁移 ${inheritedCount} 条样例结构规则。`,
      suggestion:
        transferScore >= 85 ? "结构迁移充分。" : "补充样例中的音乐卡点或字幕包装规则。",
    },
    {
      key: "selling-progression",
      label: "卖点推进",
      score: progressionScore,
      evidence: "检查脚本是否从痛点、证据、收益到行动逐步推进。",
      suggestion:
        progressionScore >= 85 ? "卖点链路清晰。" : "增加真实证据或用户反馈，避免只讲功能。",
    },
    {
      key: "editability",
      label: "可编辑性",
      score: editabilityScore,
      evidence: `共生成 ${plan.versions.length} 个版本、${beatCount} 个时间线镜头段。`,
      suggestion:
        editabilityScore >= 85 ? "创作者可直接替换素材。" : "每段增加更明确的可替换素材。",
    },
    {
      key: "material-adaptation",
      label: "素材适配",
      score: materialScore,
      evidence: plan.materialAdaptation
        ? `识别 ${plan.materialAdaptation.missingSlotCount} 个素材缺口，并给出槽位级补全策略。`
        : "当前方案未包含素材槽位诊断。",
      suggestion:
        materialScore >= 85
          ? "素材覆盖较完整。"
          : "优先补齐缺失槽位，或用字幕卡、包装卡片和结构重排补足。",
    },
    {
      key: "risk-control",
      label: "风险控制",
      score: complianceScore,
      evidence: "检查是否保留原创迁移边界、夸大表达和证据可追溯提醒。",
      suggestion:
        complianceScore >= 85 ? "风险边界清楚。" : "补充不复刻样例和不虚构背书的提醒。",
    },
  ];

  const overallScore = clampScore(
    dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length,
  );

  return planEvaluationSchema.parse({
    overallScore,
    readiness:
      overallScore >= 88 ? "ready" : overallScore >= 76 ? "minor-edits" : "needs-work",
    bestVersion,
    dimensions,
    versionScores,
    strengths: [
      "结构化输出覆盖 Hook、节奏、字幕、包装、卖点和结尾转化。",
      "多版本方案便于现场对比，能展示系统不是一次性文案生成器。",
      "素材槽位诊断能展示真实创作中“素材不足时如何补全”的决策过程。",
      "每段脚本都保留可替换素材和风险提示，利于真实创作者二次编辑。",
    ],
    priorityFixes:
      overallScore >= 88
        ? ["演示时补充真实样例截图或口播转写，增强可信度。"]
        : [
            "为主版本补充 1-2 条真实证据素材。",
            "把开头 Hook 改成更具体的数字或前后对比。",
          ],
    judgePitch:
      "系统把爆款样例拆成可验证的结构规则，再迁移成多版本可编辑脚本，并用评分诊断说明哪一版最适合生产。",
  });
}

export function attachPlanEvaluation(
  plan: MigratedVideoPlan,
  analysis?: VideoStructureAnalysis,
) {
  return migratedVideoPlanSchema.parse({
    ...plan,
    evaluation: evaluatePlan(plan, analysis),
  });
}
