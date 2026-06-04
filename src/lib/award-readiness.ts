import {
  awardReadinessSchema,
  type AwardReadiness,
  type MigratedVideoPlan,
  type VideoStructureAnalysis,
} from "@/lib/schemas";

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function average(scores: number[]) {
  if (scores.length === 0) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function getDimensionScore(plan: MigratedVideoPlan, key: string) {
  return plan.evaluation?.dimensions.find((dimension) => dimension.key === key)?.score ?? 0;
}

function countBeats(plan: MigratedVideoPlan) {
  return plan.versions.reduce((sum, version) => sum + version.scriptBeats.length, 0);
}

function countRichBeats(plan: MigratedVideoPlan) {
  return plan.versions.reduce(
    (sum, version) =>
      sum +
      version.scriptBeats.filter((beat) =>
        [
          beat.visualSuggestion,
          beat.packagingStyle,
          beat.transitionAndRhythm,
          beat.replaceableAssets,
        ].every((field) => field.trim().length >= 8),
      ).length,
    0,
  );
}

export function evaluateAwardReadiness({
  plan,
  analysis,
}: {
  plan: MigratedVideoPlan;
  analysis?: VideoStructureAnalysis;
}): AwardReadiness {
  const beatCount = countBeats(plan);
  const richBeatCount = countRichBeats(plan);
  const structureCoverage = plan.evaluation?.structureAlignment?.coverageScore ?? 0;
  const structureScore = clampScore(
    average([
      structureCoverage || 68,
      Math.min(plan.inheritedStructure.length, 5) * 18,
      plan.versions.length >= 3 ? 92 : 70,
    ]),
  );

  const techniqueNotes = plan.productionNotes.filter(
    (note) => note.startsWith("剪辑手法") || note.startsWith("RAG剪辑技巧"),
  );
  const allText = JSON.stringify(plan);
  const techniqueScore = clampScore(
    48 +
      Math.min(plan.retrievedTechniques.length, 5) * 8 +
      Math.min(techniqueNotes.length, 5) * 4 +
      (includesAny(allText, ["B-roll", "微距", "卡点", "匹配转场", "CTA"]) ? 12 : 0),
  );

  const productionScore = clampScore(
    average([
      Math.min(100, beatCount * 6),
      richBeatCount === beatCount ? 92 : Math.min(88, 52 + richBeatCount * 4),
      plan.materialAdaptation?.sufficiencyScore ?? 68,
      includesAny(allText, ["真实", "特写", "场景", "镜头", "转场"]) ? 88 : 68,
    ]),
  );

  const editabilityScore = clampScore(
    average([
      getDimensionScore(plan, "editability") || 72,
      plan.versions.length >= 3 ? 92 : 70,
      beatCount >= 12 ? 88 : 72,
      includesAny(allText, ["可替换素材", "风险", "补全", "剪法建议", "剪辑手法"]) ? 88 : 68,
    ]),
  );

  const evidenceScore = clampScore(
    average([
      plan.evaluation?.overallScore ?? 70,
      plan.evaluation?.judgePitch ? 88 : 60,
      plan.materialAdaptation ? 86 : 58,
      analysis?.beatMap.length ? 88 : 60,
      plan.productionNotes.length >= 5 ? 90 : 70,
    ]),
  );

  const criteria = [
    {
      key: "structure-loop",
      label: "结构迁移闭环",
      score: structureScore,
      target: "样例结构覆盖 ≥80，且至少 3 个可比较方案。",
      evidence: `结构覆盖 ${structureCoverage || "未计算"}/100；版本数 ${plan.versions.length}；继承结构 ${plan.inheritedStructure.length} 条。`,
      passed: structureScore >= 82,
      suggestion:
        structureScore >= 82
          ? "答辩时直接展示样例节拍到新镜头的迁移映射。"
          : "补齐未覆盖的样例节拍，并保持三版本差异足够明确。",
    },
    {
      key: "technique-explainability",
      label: "剪辑方法可解释",
      score: techniqueScore,
      target: "命中 ≥4 条剪辑技巧，并能说明它们如何进入镜头、转场、字幕和 CTA。",
      evidence: `命中技巧 ${plan.retrievedTechniques.length} 条；制作备注 ${techniqueNotes.length} 条。`,
      passed: techniqueScore >= 86,
      suggestion:
        techniqueScore >= 86
          ? "答辩时强调系统不是直接生成文案，而是先检索“怎么剪”。"
          : "增加与 Brief 更贴合的技巧命中，例如场景阶梯、微距产品镜头或卡点字幕。",
    },
    {
      key: "production-ready",
      label: "成片生产可执行",
      score: productionScore,
      target: "每段都具备画面、包装、转场、可替换素材，素材缺口有补全策略。",
      evidence: `时间线镜头 ${beatCount} 段；完整生产字段 ${richBeatCount}/${beatCount}；素材充分度 ${plan.materialAdaptation?.sufficiencyScore ?? "未计算"}/100。`,
      passed: productionScore >= 84,
      suggestion:
        productionScore >= 84
          ? "可以进入一键出片或人工剪辑替换素材。"
          : "优先补齐真实素材槽位，并减少只有字幕卡的段落。",
    },
    {
      key: "editable-workflow",
      label: "现场可控编辑",
      score: editabilityScore,
      target: "评委现场改需求时，方案能继续编辑、保存、导出和出片。",
      evidence: `可编辑性维度 ${getDimensionScore(plan, "editability") || "未计算"}/100；版本数 ${plan.versions.length}；总 beat ${beatCount}。`,
      passed: editabilityScore >= 84,
      suggestion:
        editabilityScore >= 84
          ? "演示自然语言微调 + 差异摘要，证明不是一次性生成器。"
          : "增加更细粒度的 beat 字段和可替换素材描述。",
    },
    {
      key: "submission-evidence",
      label: "上交证据完整",
      score: evidenceScore,
      target: "导出稿能自证目标、方法、质量分、缺口、风险和下一步。",
      evidence: `质量分 ${plan.evaluation?.overallScore ?? "未计算"}/100；制作备注 ${plan.productionNotes.length} 条；样例节拍 ${analysis?.beatMap.length ?? "未提供"} 段。`,
      passed: evidenceScore >= 84,
      suggestion:
        evidenceScore >= 84
          ? "导出 Markdown/JSON 可作为上交说明附件。"
          : "补充评估证据、风险边界和制作备注，避免只交一个结果视频。",
    },
  ];

  const overallScore = clampScore(
    criteria.reduce((sum, item) => sum + item.score, 0) / criteria.length,
  );
  const verdict =
    overallScore >= 90
      ? "prize-ready"
      : overallScore >= 82
        ? "submission-ready"
        : "needs-polish";

  const nextActions = criteria
    .filter((item) => !item.passed)
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
    .map((item) => item.suggestion);

  return awardReadinessSchema.parse({
    goalStatement:
      "演示目标：现场可证明样例拆解、剪辑手法匹配、结构迁移、素材补全、可编辑时间线和一键出片形成完整创作闭环。",
    overallScore,
    verdict,
    criteria,
    nextActions:
      nextActions.length > 0
        ? nextActions
        : ["保持当前主链路，录屏时重点展示剪辑手法命中、结构映射和一键出片。"],
    demoProof: [
      "展示样例拆解：Hook、节奏、字幕、包装、卖点推进。",
      "展示剪辑手法命中：说明每条技巧如何进入脚本和转场。",
      "展示质量诊断：证明系统能自评、可补强。",
      "展示自然语言微调或可编辑时间线：证明现场可控。",
      "展示导出或一键出片：证明上交链路闭合。",
    ],
  });
}
