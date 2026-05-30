import { describe, expect, it } from "vitest";

import { attachPlanEvaluation } from "@/lib/evaluation";
import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";
import { attachMaterialAdaptation } from "@/lib/materials";
import {
  buildSampleTechniqueProfile,
  buildTechniqueTransferRecipe,
  techniqueTransferRecipeSchema,
} from "@/lib/technique-transfer";

function buildCase() {
  const analysis = createFallbackAnalysis({
    sampleTitle: "强 Hook 样例",
    sampleNotes: "0-3s 结果前置，3-12s 证据三连，底部短字幕，结尾 CTA 收束。",
  });
  const basePlan = createFallbackPlan({
    projectTitle: "咖啡新品迁移",
    targetBrief: "一款低糖生椰轻乳拿铁，适合下午三点提神",
    userMaterials: "有商品杯图和工位图，缺少真人试饮评价。",
    analysis,
  });
  const plan = attachPlanEvaluation(
    attachMaterialAdaptation({
      plan: basePlan,
      targetBrief: basePlan.targetBrief,
      userMaterials: "有商品杯图和工位图，缺少真人试饮评价。",
    }),
    analysis,
  );

  return { analysis, plan };
}

describe("technique transfer", () => {
  it("extracts a reusable sample technique profile", () => {
    const { analysis } = buildCase();
    const profile = buildSampleTechniqueProfile(analysis);

    expect(profile.hookWindowSeconds).toBeGreaterThanOrEqual(1.2);
    expect(profile.shotDensityPer10s).toBeGreaterThan(0);
    expect(profile.captionPlacement).toBe("bottom");
    expect(profile.captionDensity).toBe("dense");
    expect(profile.transitionStyle).toBe("flash-cut");
    expect(profile.rhythmCurve[0]?.timeRange).toBe("0-3s");
  });

  it("maps sample beat techniques onto output scenes with material gaps", () => {
    const { analysis, plan } = buildCase();
    const recipe = buildTechniqueTransferRecipe({ analysis, plan });

    expect(techniqueTransferRecipeSchema.parse(recipe)).toEqual(recipe);
    expect(recipe.sceneTransfers[0]?.sampleTimeRange).toBe("0-3s");
    expect(recipe.sceneTransfers[0]?.mappedTechnique).toContain("迁移样例 0-3s");
    expect(recipe.sceneTransfers[1]?.sampleTimeRange).toBe("3-12s");
    expect(recipe.sceneTransfers.some((scene) => scene.materialFit === "missing")).toBe(true);
    expect(recipe.sceneTransfers.every((scene) => scene.inheritedFromSample.length > 0)).toBe(true);
  });
});
