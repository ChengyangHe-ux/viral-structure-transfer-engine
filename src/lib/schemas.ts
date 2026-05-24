import { z } from "zod";

export const mediaMetaSchema = z.object({
  durationSeconds: z.number().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  frameRate: z.string().optional(),
  hasAudio: z.boolean().optional(),
  previewFrames: z.array(z.string()).default([]),
  sourceKind: z.enum(["upload", "url", "manual"]).default("manual"),
});

export const videoStructureAnalysisSchema = z.object({
  sampleTitle: z.string().min(1),
  summary: z.string().min(10),
  targetAudience: z.string().min(2),
  contentPromise: z.string().min(4),
  durationSeconds: z.number().positive().optional(),
  hookPatterns: z.array(
    z.object({
      type: z.string().min(1),
      expression: z.string().min(2),
      transferableRule: z.string().min(4),
    }),
  ),
  pacing: z.object({
    opening: z.string().min(2),
    middle: z.string().min(2),
    ending: z.string().min(2),
    rhythmNotes: z.string().min(2),
  }),
  subtitleLayout: z.object({
    placement: z.string().min(1),
    density: z.string().min(1),
    emphasisStyle: z.string().min(1),
  }),
  visualPackaging: z.object({
    colorMood: z.string().min(1),
    framing: z.string().min(1),
    motionGraphics: z.string().min(1),
    editingNotes: z.string().min(1),
  }),
  musicAndBeats: z.array(
    z.object({
      moment: z.string().min(1),
      audioCue: z.string().min(1),
      editingResponse: z.string().min(1),
    }),
  ),
  sellingPointProgression: z.array(
    z.object({
      order: z.number().int().positive(),
      intent: z.string().min(1),
      message: z.string().min(1),
    }),
  ),
  beatMap: z.array(
    z.object({
      timeRange: z.string().min(1),
      shotPurpose: z.string().min(1),
      visualObservation: z.string().min(1),
      captionObservation: z.string().min(1),
      transferableRule: z.string().min(1),
    }),
  ),
  reusableTemplate: z.array(z.string().min(1)),
  riskNotes: z.array(z.string().min(1)).default([]),
});

export const planBeatSchema = z.object({
  timeRange: z.string().min(1),
  shotPurpose: z.string().min(1),
  visualSuggestion: z.string().min(1),
  voiceoverOrSubtitle: z.string().min(1),
  packagingStyle: z.string().min(1),
  sellingPointIntent: z.string().min(1),
  transitionAndRhythm: z.string().min(1),
  replaceableAssets: z.string().min(1),
  riskNotes: z.string().min(1),
});

export const planVersionSchema = z.object({
  versionName: z.string().min(1),
  positioning: z.string().min(1),
  bestFor: z.string().min(1),
  scriptBeats: z.array(planBeatSchema).min(3),
  coverTitle: z.string().min(1),
  captionTitle: z.string().min(1),
  hashtags: z.array(z.string().min(1)).default([]),
});

export const planEvaluationSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  readiness: z.enum(["ready", "minor-edits", "needs-work"]),
  bestVersion: z.string().min(1),
  dimensions: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      score: z.number().int().min(0).max(100),
      evidence: z.string().min(1),
      suggestion: z.string().min(1),
    }),
  ),
  versionScores: z.array(
    z.object({
      versionName: z.string().min(1),
      score: z.number().int().min(0).max(100),
      rationale: z.string().min(1),
    }),
  ),
  strengths: z.array(z.string().min(1)),
  priorityFixes: z.array(z.string().min(1)),
  judgePitch: z.string().min(1),
});

export const materialAdaptationSchema = z.object({
  providedMaterialsSummary: z.string().min(1),
  sufficiencyScore: z.number().int().min(0).max(100),
  missingSlotCount: z.number().int().min(0),
  slots: z.array(
    z.object({
      slotId: z.string().min(1),
      slotName: z.string().min(1),
      requiredFor: z.string().min(1),
      requiredMaterial: z.string().min(1),
      matchedMaterial: z.string().min(1),
      fit: z.enum(["matched", "partial", "missing"]),
      impact: z.string().min(1),
      completionStrategy: z.enum([
        "structure-reorder",
        "copy-caption",
        "visual-packaging",
        "aigc-generation",
        "reuse-existing",
      ]),
      completionPlan: z.string().min(1),
    }),
  ),
  timelineAdjustment: z.string().min(1),
});

export const migratedVideoPlanSchema = z.object({
  projectTitle: z.string().min(1),
  targetBrief: z.string().min(4),
  strategySummary: z.string().min(8),
  inheritedStructure: z.array(z.string().min(1)),
  versions: z.array(planVersionSchema).min(1),
  evaluationChecklist: z.array(z.string().min(1)),
  materialAdaptation: materialAdaptationSchema.optional(),
  evaluation: planEvaluationSchema.optional(),
  productionNotes: z.array(z.string().min(1)).default([]),
});

export const analyzeSampleRequestSchema = z.object({
  projectTitle: z.string().min(1).default("爆款结构迁移项目"),
  sampleTitle: z.string().min(1).default("未命名样例"),
  sampleUrl: z.string().url().optional().or(z.literal("")),
  sampleNotes: z.string().min(1),
  targetBrief: z.string().default(""),
});

export const generatePlanRequestSchema = z.object({
  projectId: z.string().min(1),
  targetBrief: z.string().min(4),
  userMaterials: z.string().default(""),
  direction: z.string().default("比赛 MVP：优先输出可编辑方案脚本"),
});

export const refinePlanRequestSchema = z.object({
  projectId: z.string().min(1),
  instruction: z.string().min(4),
});

export type MediaMeta = z.infer<typeof mediaMetaSchema>;
export type VideoStructureAnalysis = z.infer<typeof videoStructureAnalysisSchema>;
export type MigratedVideoPlan = z.infer<typeof migratedVideoPlanSchema>;
export type PlanBeat = z.infer<typeof planBeatSchema>;
export type PlanVersion = z.infer<typeof planVersionSchema>;
export type PlanEvaluation = z.infer<typeof planEvaluationSchema>;
export type MaterialAdaptation = z.infer<typeof materialAdaptationSchema>;
