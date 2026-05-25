import { describe, expect, it } from "vitest";

import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";
import { attachPlanEvaluation } from "@/lib/evaluation";
import { attachMaterialAdaptation } from "@/lib/materials";
import {
  attachEditingTechniquesToPlan,
  retrieveEditingTechniques,
} from "@/lib/editing-techniques";
import {
  migratedVideoPlanSchema,
  videoStructureAnalysisSchema,
} from "@/lib/schemas";

describe("structured output schemas", () => {
  it("accepts deterministic fallback analysis", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "样例",
      sampleNotes: "开头展示结果，中段拆解步骤，结尾引导收藏。",
    });

    expect(videoStructureAnalysisSchema.parse(analysis).beatMap.length).toBeGreaterThan(0);
  });

  it("accepts deterministic fallback migrated plans", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "样例",
      sampleNotes: "开头展示结果，中段拆解步骤，结尾引导收藏。",
    });
    const basePlan = createFallbackPlan({
      projectTitle: "测试项目",
      targetBrief: "面向大学生的 AI 简历优化工具",
      userMaterials: "有界面截图、操作流程和领取入口。",
      analysis,
    });
    const planWithTechniques = attachEditingTechniquesToPlan({
      plan: basePlan,
      techniques: retrieveEditingTechniques({
        targetBrief: basePlan.targetBrief,
        userMaterials: "有界面截图、操作流程和领取入口。",
        analysis,
      }),
    });
    const plan = attachPlanEvaluation(
      attachMaterialAdaptation({
        plan: planWithTechniques,
        targetBrief: basePlan.targetBrief,
        userMaterials: "有界面截图、操作流程和领取入口。",
      }),
      analysis,
    );

    const parsed = migratedVideoPlanSchema.parse(plan);
    expect(parsed.versions).toHaveLength(3);
    expect(parsed.versions[0].scriptBeats[0]).toHaveProperty("replaceableAssets");
    expect(parsed.retrievedTechniques.length).toBeGreaterThan(0);
    expect(parsed.awardReadiness?.goalStatement).toContain("比赛大奖目标");
    expect(parsed.materialAdaptation?.slots.length).toBeGreaterThan(0);
    expect(parsed.evaluation?.overallScore).toBeGreaterThan(0);
  });
});
