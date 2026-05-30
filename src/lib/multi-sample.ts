import {
  videoStructureAnalysisSchema,
  type VideoStructureAnalysis,
} from "@/lib/schemas";

type CombineSampleAnalysesInput = {
  projectTitle: string;
  analyses: VideoStructureAnalysis[];
};

function unique(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function withSource(title: string, text: string) {
  return `《${title}》${text}`;
}

function joinDistinct(items: string[], separator = "；") {
  return unique(items).join(separator);
}

function averageDuration(analyses: VideoStructureAnalysis[]) {
  const durations = analyses
    .map((analysis) => analysis.durationSeconds)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!durations.length) return undefined;
  return Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10;
}

export function combineSampleAnalyses({
  projectTitle,
  analyses,
}: CombineSampleAnalysesInput): VideoStructureAnalysis {
  if (analyses.length === 0) {
    throw new Error("Cannot combine sample analyses without at least one sample.");
  }

  if (analyses.length === 1) {
    return videoStructureAnalysisSchema.parse(analyses[0]);
  }

  const sourceTitles = analyses.map((analysis) => analysis.sampleTitle);
  const first = analyses[0]!;

  return videoStructureAnalysisSchema.parse({
    sampleTitle: `${projectTitle}（多样例 ${analyses.length} 条）`,
    summary: `综合 ${sourceTitles.map((title) => `《${title}》`).join("、")} 的可迁移结构：${joinDistinct(
      analyses.map((analysis) => analysis.summary),
      " / ",
    )}`,
    targetAudience: joinDistinct(
      analyses.map((analysis) => withSource(analysis.sampleTitle, analysis.targetAudience)),
    ),
    contentPromise: joinDistinct(
      analyses.map((analysis) => withSource(analysis.sampleTitle, analysis.contentPromise)),
    ),
    durationSeconds: averageDuration(analyses),
    hookPatterns: analyses.flatMap((analysis) =>
      analysis.hookPatterns.map((hook) => ({
        ...hook,
        type: withSource(analysis.sampleTitle, hook.type),
        transferableRule: withSource(analysis.sampleTitle, hook.transferableRule),
      })),
    ),
    pacing: {
      opening: joinDistinct(analyses.map((analysis) => withSource(analysis.sampleTitle, analysis.pacing.opening))),
      middle: joinDistinct(analyses.map((analysis) => withSource(analysis.sampleTitle, analysis.pacing.middle))),
      ending: joinDistinct(analyses.map((analysis) => withSource(analysis.sampleTitle, analysis.pacing.ending))),
      rhythmNotes: joinDistinct(
        analyses.map((analysis) => withSource(analysis.sampleTitle, analysis.pacing.rhythmNotes)),
      ),
    },
    subtitleLayout: {
      placement: joinDistinct(analyses.map((analysis) => analysis.subtitleLayout.placement)),
      density: joinDistinct(analyses.map((analysis) => analysis.subtitleLayout.density)),
      emphasisStyle: joinDistinct(analyses.map((analysis) => analysis.subtitleLayout.emphasisStyle)),
    },
    visualPackaging: {
      colorMood: joinDistinct(analyses.map((analysis) => analysis.visualPackaging.colorMood)),
      framing: joinDistinct(analyses.map((analysis) => analysis.visualPackaging.framing)),
      motionGraphics: joinDistinct(analyses.map((analysis) => analysis.visualPackaging.motionGraphics)),
      editingNotes: joinDistinct(analyses.map((analysis) => analysis.visualPackaging.editingNotes)),
    },
    musicAndBeats: analyses
      .flatMap((analysis) =>
        analysis.musicAndBeats.map((beat) => ({
          moment: withSource(analysis.sampleTitle, beat.moment),
          audioCue: beat.audioCue,
          editingResponse: beat.editingResponse,
        })),
      )
      .slice(0, 8),
    sellingPointProgression: analyses
      .flatMap((analysis) =>
        analysis.sellingPointProgression.map((point) => ({
          intent: withSource(analysis.sampleTitle, point.intent),
          message: point.message,
        })),
      )
      .map((point, index) => ({
        order: index + 1,
        ...point,
      }))
      .slice(0, 8),
    beatMap: analyses.flatMap((analysis) =>
      analysis.beatMap.map((beat) => ({
        timeRange: `${analysis.sampleTitle} ${beat.timeRange}`,
        shotPurpose: withSource(analysis.sampleTitle, beat.shotPurpose),
        visualObservation: beat.visualObservation,
        captionObservation: beat.captionObservation,
        transferableRule: withSource(analysis.sampleTitle, beat.transferableRule),
      })),
    ),
    reusableTemplate: unique([
      ...first.reusableTemplate,
      ...analyses.flatMap((analysis) =>
        analysis.reusableTemplate.map((item) => withSource(analysis.sampleTitle, item)),
      ),
    ]).slice(0, 12),
    riskNotes: unique([
      "多样例模式只迁移共性结构与可解释手法，不复制任一样例的具体画面、人物和台词。",
      ...analyses.flatMap((analysis) => analysis.riskNotes),
    ]),
  });
}
