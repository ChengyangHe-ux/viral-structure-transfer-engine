import type { MigratedVideoPlan, VideoStructureAnalysis } from "@/lib/schemas";
import { buildMigrationMap, materialFitText } from "@/lib/mapping";

function list(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function renderAnalysisMarkdown(analysis: VideoStructureAnalysis) {
  return `## 样例结构拆解

### 总结
${analysis.summary}

### 目标人群与内容承诺
- 目标人群：${analysis.targetAudience}
- 内容承诺：${analysis.contentPromise}

### Hook 结构
${analysis.hookPatterns
  .map(
    (hook) =>
      `- ${hook.type}：${hook.expression}\n  - 可迁移规则：${hook.transferableRule}`,
  )
  .join("\n")}

### 节奏与包装
- 开头：${analysis.pacing.opening}
- 中段：${analysis.pacing.middle}
- 结尾：${analysis.pacing.ending}
- 节奏备注：${analysis.pacing.rhythmNotes}
- 字幕布局：${analysis.subtitleLayout.placement}；${analysis.subtitleLayout.density}；${analysis.subtitleLayout.emphasisStyle}
- 画面包装：${analysis.visualPackaging.colorMood}；${analysis.visualPackaging.framing}；${analysis.visualPackaging.motionGraphics}

### 可迁移节拍
| 时间段 | 镜头目的 | 观察 | 字幕 | 迁移规则 |
| --- | --- | --- | --- | --- |
${analysis.beatMap
  .map(
    (beat) =>
      `| ${beat.timeRange} | ${beat.shotPurpose} | ${beat.visualObservation} | ${beat.captionObservation} | ${beat.transferableRule} |`,
  )
  .join("\n")}

### 复用模板
${list(analysis.reusableTemplate)}
`;
}

export function renderPlanMarkdown(plan: MigratedVideoPlan) {
  return `## 迁移后方案脚本

### 策略总结
${plan.strategySummary}

### 继承的样例结构
${list(plan.inheritedStructure)}

${plan.materialAdaptation ? `### 素材缺口与补全

- 素材充分度：${plan.materialAdaptation.sufficiencyScore}/100
- 缺口数量：${plan.materialAdaptation.missingSlotCount}
- 素材概览：${plan.materialAdaptation.providedMaterialsSummary}
- 时间线调整：${plan.materialAdaptation.timelineAdjustment}

| 结构槽位 | 匹配状态 | 需要素材 | 当前匹配 | 影响 | 补全策略 |
| --- | --- | --- | --- | --- | --- |
${plan.materialAdaptation.slots
  .map(
    (slot) =>
      `| ${slot.slotName} | ${slot.fit} | ${slot.requiredMaterial} | ${slot.matchedMaterial} | ${slot.impact} | ${slot.completionPlan} |`,
  )
  .join("\n")}
` : ""}

${plan.evaluation ? `### 质量诊断

- 综合评分：${plan.evaluation.overallScore}/100
- 推荐主版本：${plan.evaluation.bestVersion}
- 参赛讲法：${plan.evaluation.judgePitch}

| 维度 | 分数 | 依据 | 优化建议 |
| --- | --- | --- | --- |
${plan.evaluation.dimensions
  .map(
    (dimension) =>
      `| ${dimension.label} | ${dimension.score} | ${dimension.evidence} | ${dimension.suggestion} |`,
  )
  .join("\n")}

优先修正：
${list(plan.evaluation.priorityFixes)}
` : ""}

${plan.versions
  .map(
    (version) => `### ${version.versionName}

- 定位：${version.positioning}
- 适合：${version.bestFor}
- 封面标题：${version.coverTitle}
- 发布标题：${version.captionTitle}
- 话题：${version.hashtags.join(" ")}

| 时间段 | 镜头目的 | 画面建议 | 口播/字幕 | 包装风格 | 卖点意图 | 转场/节奏 | 可替换素材 | 风险提示 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${version.scriptBeats
  .map(
    (beat) =>
      `| ${beat.timeRange} | ${beat.shotPurpose} | ${beat.visualSuggestion} | ${beat.voiceoverOrSubtitle} | ${beat.packagingStyle} | ${beat.sellingPointIntent} | ${beat.transitionAndRhythm} | ${beat.replaceableAssets} | ${beat.riskNotes} |`,
  )
  .join("\n")}
`,
  )
  .join("\n")}

### 评估清单
${list(plan.evaluationChecklist)}

### 制作备注
${list(plan.productionNotes)}
`;
}

export function renderMigrationMapMarkdown({
  analysis,
  plan,
}: {
  analysis: VideoStructureAnalysis;
  plan: MigratedVideoPlan;
}) {
  const rows = buildMigrationMap({ analysis, plan });

  return `## 结构迁移映射

| 序号 | 样例节拍 | 可迁移规则 | 新方案节拍 | 映射逻辑 | 素材槽位 | 补全动作 |
| --- | --- | --- | --- | --- | --- | --- |
${rows
  .map(
    (row) =>
      `| ${row.index} | ${row.sampleTimeRange} ${row.samplePurpose} | ${row.sampleRule} | ${row.outputTimeRange} ${row.outputPurpose} | ${row.mappingLogic} | ${row.materialSlotName}（${materialFitText(row.materialFit)}） | ${row.completionPlan} |`,
  )
  .join("\n")}
`;
}

export function renderProjectMarkdown({
  title,
  analysis,
  plan,
  source,
}: {
  title: string;
  analysis?: VideoStructureAnalysis;
  plan?: MigratedVideoPlan;
  source?: string;
}) {
  return `---
title: ${JSON.stringify(title)}
tags:
  - AIGC
  - 短视频
  - 结构迁移
status: implemented
---

# ${title}

> [!info] 项目定位
> 爆款结构迁移引擎：从样例拆解到视频重组的 AI 创作平台。

${source ? `关联需求：[[${source}]]\n` : ""}

${analysis ? renderAnalysisMarkdown(analysis) : ""}

${analysis && plan ? renderMigrationMapMarkdown({ analysis, plan }) : ""}

${plan ? renderPlanMarkdown(plan) : ""}
`;
}
