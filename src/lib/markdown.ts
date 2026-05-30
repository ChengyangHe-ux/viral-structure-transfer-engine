import type { MigratedVideoPlan, VideoStructureAnalysis } from "@/lib/schemas";
import {
  evaluateChampionRubric,
  type ChampionRubricReport,
} from "@/lib/champion-rubric";
import { buildMigrationMap, materialFitText } from "@/lib/mapping";
import { buildStoryboardFrames } from "@/lib/storyboard";
import {
  buildTechniqueTransferRecipe,
  type TechniqueTransferRecipe,
} from "@/lib/technique-transfer";

function list(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function fallbackText(value: string | number | undefined | null, fallback = "--") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
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

${plan.retrievedTechniques.length ? `### RAG 剪辑技巧命中

生成前先用 Brief、用户素材和样例结构检索本地剪辑技巧库，再把命中技巧写入脚本节奏、画面建议和制作备注。

| 技巧 | 类别 | 命中原因 | 应用方式 | 预期效果 |
| --- | --- | --- | --- | --- |
${plan.retrievedTechniques
  .map(
    (technique) =>
      `| ${technique.title} | ${technique.category} | ${technique.whyMatched.join("；")} | ${technique.application} | ${technique.expectedImpact} |`,
  )
  .join("\n")}
` : ""}

${plan.awardReadiness ? `### 大奖目标看板

- 目标：${plan.awardReadiness.goalStatement}
- 冲奖评分：${plan.awardReadiness.overallScore}/100
- 状态：${plan.awardReadiness.verdict}

| 验收项 | 分数 | 目标 | 证据 | 建议 |
| --- | --- | --- | --- | --- |
${plan.awardReadiness.criteria
  .map(
    (criterion) =>
      `| ${criterion.label} | ${criterion.score} | ${criterion.target} | ${criterion.evidence} | ${criterion.suggestion} |`,
  )
  .join("\n")}

下一步冲奖动作：
${list(plan.awardReadiness.nextActions)}
` : ""}

${plan.materialAdaptation ? `### 素材缺口与补全

- 素材充分度：${plan.materialAdaptation.sufficiencyScore}/100
- 缺口数量：${plan.materialAdaptation.missingSlotCount}
- 已识别素材资产：${plan.materialAdaptation.assets.length}
- 素材概览：${plan.materialAdaptation.providedMaterialsSummary}
- 时间线调整：${plan.materialAdaptation.timelineAdjustment}

${plan.materialAdaptation.assets.length ? `#### 真实素材资产盘点

| 素材 | 类型 | 推荐槽位 | 质量 | 高光理由 | 用法 |
| --- | --- | --- | --- | --- | --- |
${plan.materialAdaptation.assets
  .map(
    (asset) =>
      `| ${asset.label} | ${asset.kind} | ${asset.suggestedSlots.join(" / ") || "--"} | ${asset.qualityScore}/100 | ${asset.highlightReason} | ${asset.recommendedUse} |`,
  )
  .join("\n")}
` : ""}

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

export function renderTechniqueTransferMarkdown(recipe: TechniqueTransferRecipe) {
  return `## 手法迁移配方

### 样例手法指纹
- 摘要：${recipe.sourceProfile.summary}
- Hook 窗口：${recipe.sourceProfile.hookWindowSeconds}s
- 镜头密度：${recipe.sourceProfile.shotDensityPer10s} 镜/10s
- 字幕密度：${recipe.sourceProfile.subtitleDensityPer10s} 屏/10s（${recipe.sourceProfile.captionDensity}）
- 字幕位置：${recipe.sourceProfile.captionPlacement}
- 转场倾向：${recipe.sourceProfile.transitionStyle}
- 运动手法：${recipe.sourceProfile.motionStyle}
- 包装标签：${recipe.sourceProfile.packagingTags.join(" / ")}

### 源样例 → 新片段
| 序号 | 源样例时间段 | 源手法目的 | 可迁移规则 | 新片段 | 实际映射手法 | 素材状态 | 补全方式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${recipe.sceneTransfers
  .map(
    (scene) =>
      `| ${scene.index} | ${scene.sampleTimeRange} | ${scene.sourcePurpose} | ${scene.transferableRule} | ${scene.outputTimeRange} ${scene.outputPurpose} | ${scene.mappedTechnique} | ${scene.materialSlotName}（${materialFitText(scene.materialFit)}） | ${scene.completionPlan} |`,
  )
  .join("\n")}
`;
}

export function renderTechniqueComparisonMarkdown(recipe: TechniqueTransferRecipe) {
  return `## 样例-结果手法对比

| 对比维度 | 样例指纹 | 新结果承接 |
| --- | --- | --- |
| 节奏 | ${recipe.sourceProfile.shotDensityPer10s} 镜/10s；Hook ${recipe.sourceProfile.hookWindowSeconds}s；CTA ${recipe.sourceProfile.ctaHoldSeconds}s | ${recipe.sceneTransfers.length} 个可渲染镜头，按源样例强度分配 beat intensity |
| 字幕 | ${recipe.sourceProfile.captionPlacement}；${recipe.sourceProfile.captionDensity}；${recipe.sourceProfile.subtitleDensityPer10s} 屏/10s | 每段字幕继承位置/密度，并保留可编辑口播字段 |
| 转场 | ${recipe.sourceProfile.transitionStyle}；${recipe.sourceProfile.motionStyle} | Remotion timeline 使用同一转场倾向和音频 cue |
| 包装 | ${recipe.sourceProfile.packagingTags.join(" / ") || "--"} | 每段输出保留 inherited packaging tags |

| 源样例 | 输出段落 | 强度 | 字幕/转场 | 素材状态 | 证明点 |
| --- | --- | --- | --- | --- | --- |
${recipe.sceneTransfers
  .map(
    (scene) =>
      `| ${scene.sampleTimeRange} ${scene.sourcePurpose} | ${scene.outputTimeRange} ${scene.outputPurpose} | ${scene.beatIntensity}/100 | ${scene.captionPlacement}/${scene.captionDensity}/${scene.transitionStyle} | ${scene.materialSlotName}（${materialFitText(scene.materialFit)}） | ${scene.mappedTechnique} |`,
  )
  .join("\n")}
`;
}

export function renderScoringEvidenceMarkdown({
  analysis,
  plan,
  techniqueTransfer,
}: {
  analysis?: VideoStructureAnalysis;
  plan?: MigratedVideoPlan;
  techniqueTransfer?: TechniqueTransferRecipe;
}) {
  const material = plan?.materialAdaptation;
  const evaluation = plan?.evaluation;
  const versions = plan?.versions.length ?? 0;
  const beatCount = plan?.versions.reduce((sum, version) => sum + version.scriptBeats.length, 0) ?? 0;
  const assets = material?.assets.length ?? 0;
  const missingSlots = material?.missingSlotCount ?? 0;
  const mappedScenes = techniqueTransfer?.sceneTransfers.length ?? 0;

  return `## 评分证据矩阵

| 评分项 | 当前证据 | 验收口径 |
| --- | --- | --- |
| 样例输入与基础解析 | ${analysis ? `${analysis.sampleTitle}；${analysis.beatMap.length} 个样例节拍；${fallbackText(analysis.durationSeconds, "手工/抽帧时长")}` : "待生成"} | 支持样例文本、链接、上传视频和补充样例文本；媒体元信息/关键帧进入拆解。 |
| 结构拆解 | ${analysis ? `Hook ${analysis.hookPatterns.length} 条；节奏/字幕/包装/音乐/卖点/CTA 均有字段` : "待生成"} | 覆盖脚本结构、节奏结构、包装结构 3 类。 |
| 结构迁移生成 | ${plan ? `${versions} 个版本；${beatCount} 个脚本 beat；${mappedScenes} 个手法映射` : "待生成"} | 输出脚本、分镜、时间线草案、包装建议和成片协议。 |
| 素材缺口识别 | ${material ? `素材充分度 ${material.sufficiencyScore}/100；缺口 ${missingSlots} 个；资产 ${assets} 个` : "待生成"} | 明确开头、主体、过程、对比、证据、CTA 槽位状态。 |
| 素材缺口补全 | ${material ? material.slots.map((slot) => slot.completionStrategy).join(" / ") : "待生成"} | 结构重排、字幕补全、包装补全、AIGC 占位和素材复用均可解释。 |
| 迁移过程可视化 | ${techniqueTransfer ? `源样例到输出 ${mappedScenes} 行，含时间段、规则、强度、素材状态` : "待生成"} | UI/Markdown 展示“学到了什么、迁移到哪里、缺口怎么补”。 |
| 结果可验证 | ${plan ? `可导出 Markdown/JSON，可用 Remotion 渲染 MP4；推荐版本 ${fallbackText(evaluation?.bestVersion)}` : "待生成"} | 分镜/时间线/样例-结果对比/有声视频任一或多项可展示。 |
| 画面包装能力 | ${techniqueTransfer ? techniqueTransfer.sourceProfile.packagingTags.join(" / ") : "待生成"} | 字幕样式、标题条/卖点卡、转场、贴纸/强调元素可进入脚本和渲染。 |
| 多版本生成 | ${versions} 个版本 | 至少 2 个版本且定位差异明确。 |
| 真实素材适配 | ${assets} 个资产被分类推荐 | 用户素材被识别为图片/视频/文本/入口，并映射到结构槽位。 |
| 人工可调与自然语言改片 | 页面支持字段编辑、保存历史稿、自然语言预览/应用 | 现场可改 hook、卖点顺序、节奏、包装和结尾表达。 |
| 项目说明与安全边界 | README / ARCHITECTURE / SUBMISSION / DEMO_SCRIPT | 说明 AI 架构、工具协议、安全边界和 AI 辅助工具使用。 |
`;
}

export function renderChampionRubricMarkdown(report: ChampionRubricReport) {
  const groups = Array.from(new Set(report.items.map((item) => item.group)));

  return `## 官方评分表拆解

- 基础分：${report.baseScore}/100
- 加分项：${report.bonusScore}/10
- 含加分总分：${report.totalScoreWithBonus}/110
- 状态：${report.verdict}
- 答辩重点：${report.pitch}

${groups
  .map((group) => {
    const rows = report.items.filter((item) => item.group === group);
    const score = rows.reduce((sum, item) => sum + item.score, 0);
    const maxScore = rows.reduce((sum, item) => sum + item.maxScore, 0);

    return `### ${group}

小计：${score}/${maxScore}

| 评分点 | 分数 | 证据 | 展示位置 |
| --- | --- | --- | --- |
${rows
  .map(
    (item) =>
      `| ${item.label} | ${item.score}/${item.maxScore} | ${item.evidence} | ${item.judgePanel} |`,
  )
  .join("\n")}
`;
  })
  .join("\n")}
`;
}

export function renderStoryboardMarkdown({
  analysis,
  plan,
}: {
  analysis: VideoStructureAnalysis;
  plan: MigratedVideoPlan;
}) {
  const version =
    plan.versions.find((item) => item.versionName === plan.evaluation?.bestVersion) ??
    plan.versions[0];
  const rows = buildMigrationMap({ analysis, plan, version });
  const frames = buildStoryboardFrames({ version, rows });

  return `## 竖屏分镜预览

推荐版本：${version.versionName}

| 时间段 | 结构任务 | 画面层 | 字幕层 | 包装层 | 转场/节奏 | 素材状态 |
| --- | --- | --- | --- | --- | --- | --- |
${frames
  .map(
    (frame) =>
      `| ${frame.timeRange} | ${frame.focus} / ${frame.frameTitle} | ${frame.visualLayer} | ${frame.subtitleLayer} | ${frame.packagingLayer} | ${frame.transitionCue} | ${frame.materialSlotName}（${materialFitText(frame.materialFit)}）：${frame.completionPlan} |`,
  )
  .join("\n")}
`;
}

export function renderProjectMarkdown({
  title,
  analysis,
  plan,
  techniqueTransfer,
  source,
}: {
  title: string;
  analysis?: VideoStructureAnalysis;
  plan?: MigratedVideoPlan;
  techniqueTransfer?: TechniqueTransferRecipe;
  source?: string;
}) {
  const resolvedTechniqueTransfer =
    techniqueTransfer ??
    (analysis && plan ? buildTechniqueTransferRecipe({ analysis, plan }) : undefined);
  const championRubric =
    analysis && plan
      ? evaluateChampionRubric({
          analysis,
          plan,
          techniqueTransfer: resolvedTechniqueTransfer,
        })
      : undefined;

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

${resolvedTechniqueTransfer ? renderTechniqueTransferMarkdown(resolvedTechniqueTransfer) : ""}

${resolvedTechniqueTransfer ? renderTechniqueComparisonMarkdown(resolvedTechniqueTransfer) : ""}

${analysis && plan ? renderStoryboardMarkdown({ analysis, plan }) : ""}

${renderScoringEvidenceMarkdown({
  analysis,
  plan,
  techniqueTransfer: resolvedTechniqueTransfer,
})}

${championRubric ? renderChampionRubricMarkdown(championRubric) : ""}

${plan ? renderPlanMarkdown(plan) : ""}
`;
}
