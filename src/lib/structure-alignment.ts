import type { MigratedVideoPlan, PlanVersion, VideoStructureAnalysis } from "@/lib/schemas";

type AlignmentInput = {
  analysis: VideoStructureAnalysis;
  plan: MigratedVideoPlan;
  version?: PlanVersion;
};

type AlignmentMatch = {
  sampleIndex: number;
  planIndex: number;
  similarity: number;
};

const stopwords = new Set([
  "一个",
  "一种",
  "这个",
  "那个",
  "我们",
  "你们",
  "他们",
  "就是",
  "还是",
  "然后",
  "但是",
  "因为",
  "所以",
  "需要",
  "可以",
  "如何",
  "什么",
  "为什么",
  "怎么",
  "一定",
  "并且",
  "以及",
  "同时",
  "如果",
  "的话",
  "不要",
  "避免",
  "提示",
  "建议",
  "镜头",
  "字幕",
  "画面",
  "这里",
  "主要",
  "通过",
]);

function clampInt0to100(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeText(text: string) {
  return text
    .replace(/[。，“”‘’！？：；（）()[\]【】]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTokens(text: string) {
  const normalized = normalizeText(text);
  if (!normalized) return [] as string[];

  const raw = normalized.split(/[ \\/|,，;；.。:+-]/g).map((token) => token.trim());
  const tokens = raw
    .filter(Boolean)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length >= 2 && token.length <= 16)
    .filter((token) => !stopwords.has(token));

  const cjkTokens: string[] = [];
  const segments = normalized.match(/[\p{Script=Han}]{2,}/gu) ?? [];
  for (const segment of segments) {
    const maxLen = Math.min(segment.length, 10);
    for (let i = 0; i < maxLen - 1; i += 1) {
      cjkTokens.push(segment.slice(i, i + 2));
    }
    for (let i = 0; i < maxLen - 2; i += 1) {
      cjkTokens.push(segment.slice(i, i + 3));
    }
  }

  const merged = [...tokens, ...cjkTokens]
    .filter((token) => token.length >= 2 && token.length <= 16)
    .filter((token) => !stopwords.has(token));

  return Array.from(new Set(merged));
}

function jaccard(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const categoryWords: Array<{ key: string; words: string[] }> = [
  { key: "hook", words: ["反差", "结论", "别急", "关键", "90%", "第一步", "抓住", "注意力"] },
  { key: "evidence", words: ["证据", "数据", "参数", "反馈", "评价", "对比", "证明", "流程"] },
  { key: "benefit", words: ["收益", "适用", "场景", "门槛", "成本", "痛点", "好处"] },
  { key: "action", words: ["行动", "收藏", "试用", "领取", "入口", "关注", "转化"] },
  { key: "packaging", words: ["贴纸", "箭头", "进度条", "标签", "高亮", "描边", "分屏"] },
  { key: "rhythm", words: ["节奏", "卡点", "切镜", "停顿", "加速", "收束"] },
];

function categorySimilarity(sampleText: string, planText: string) {
  const sampleKeys = categoryWords
    .filter(({ words }) => words.some((word) => sampleText.includes(word)))
    .map(({ key }) => key);
  const planKeys = categoryWords
    .filter(({ words }) => words.some((word) => planText.includes(word)))
    .map(({ key }) => key);

  if (!sampleKeys.length || !planKeys.length) return 0;
  const setA = new Set(sampleKeys);
  const setB = new Set(planKeys);
  let intersection = 0;
  for (const key of setA) if (setB.has(key)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function sampleBeatText(beat: VideoStructureAnalysis["beatMap"][number]) {
  return [beat.shotPurpose, beat.visualObservation, beat.captionObservation, beat.transferableRule].join(" ");
}

function planBeatText(beat: PlanVersion["scriptBeats"][number]) {
  return [
    beat.timeRange,
    beat.shotPurpose,
    beat.visualSuggestion,
    beat.voiceoverOrSubtitle,
    beat.packagingStyle,
    beat.sellingPointIntent,
    beat.transitionAndRhythm,
    beat.replaceableAssets,
    beat.riskNotes,
  ].join(" ");
}

export function alignStructure({ analysis, plan, version }: AlignmentInput) {
  const sourceBeats = analysis.beatMap;
  const targetVersion = version ?? plan.versions[0];
  const targetBeats = targetVersion?.scriptBeats ?? [];

  const sampleTexts = sourceBeats.map((beat) => sampleBeatText(beat));
  const planTexts = targetBeats.map((beat) => planBeatText(beat));
  const sampleTokens = sampleTexts.map((text) => extractTokens(text));
  const planTokens = planTexts.map((text) => extractTokens(text));

  const matches: AlignmentMatch[] = [];
  const usedPlanIndices = new Set<number>();

  for (let sampleIndex = 0; sampleIndex < sampleTokens.length; sampleIndex += 1) {
    let best: AlignmentMatch | null = null;
    for (let planIndex = 0; planIndex < planTokens.length; planIndex += 1) {
      if (usedPlanIndices.has(planIndex)) continue;
      const tokenSimilarity = jaccard(sampleTokens[sampleIndex] ?? [], planTokens[planIndex] ?? []);
      const similarity = Math.max(
        tokenSimilarity,
        categorySimilarity(sampleTexts[sampleIndex] ?? "", planTexts[planIndex] ?? ""),
      );
      if (!best || similarity > best.similarity) {
        best = { sampleIndex, planIndex, similarity };
      }
    }
    if (best && best.similarity >= 0.08) {
      matches.push(best);
      usedPlanIndices.add(best.planIndex);
    }
  }

  const sampleBeatCount = sourceBeats.length;
  const matchedSampleBeatCount = matches.length;
  const coverageRatio = sampleBeatCount === 0 ? 0 : matchedSampleBeatCount / sampleBeatCount;
  const coverageScore = clampInt0to100(38 + coverageRatio * 62);

  const missingSampleBeats = sourceBeats
    .map((beat, index) => ({ beat, index }))
    .filter(({ index }) => !matches.some((match) => match.sampleIndex === index))
    .slice(0, 4)
    .map(({ beat }) => ({
      timeRange: beat.timeRange,
      shotPurpose: beat.shotPurpose,
      transferableRule: beat.transferableRule,
    }));

  const notes: string[] = [];
  if (coverageRatio < 0.6) notes.push("结构覆盖偏低：建议逐条补齐样例中的关键镜头意图与字幕/包装规则。");
  if (coverageRatio >= 0.85) notes.push("结构覆盖较高：建议用更具体的证据素材提升可信度，而不是继续加段落。");

  return {
    coverageScore,
    coverageRatio,
    matchedSampleBeatCount,
    sampleBeatCount,
    missingSampleBeats,
    notes,
  };
}
