import {
  attachEditingTechniquesToPlan,
  retrieveEditingTechniques,
} from "@/lib/editing-techniques";
import { attachPlanEvaluation } from "@/lib/evaluation";
import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";
import { renderProjectMarkdown } from "@/lib/markdown";
import { attachMaterialAdaptation } from "@/lib/materials";
import type { DemoPreset } from "@/lib/demo-presets";

export function buildOfflineDemoCase(preset: DemoPreset) {
  const analysis = createFallbackAnalysis({
    sampleTitle: preset.sampleTitle,
    sampleNotes: preset.sampleNotes,
  });
  const techniques = retrieveEditingTechniques({
    targetBrief: preset.targetBrief,
    userMaterials: preset.userMaterials,
    analysis,
  });
  const basePlan = createFallbackPlan({
    projectTitle: preset.projectTitle,
    targetBrief: preset.targetBrief,
    userMaterials: preset.userMaterials,
    analysis,
  });
  const plan = attachPlanEvaluation(
    attachMaterialAdaptation({
      plan: attachEditingTechniquesToPlan({ plan: basePlan, techniques }),
      targetBrief: preset.targetBrief,
      userMaterials: preset.userMaterials,
    }),
    analysis,
  );
  const markdown = renderProjectMarkdown({
    title: preset.projectTitle,
    analysis,
    plan,
    source: "cases/generated (auto)",
  });

  return {
    preset,
    analysis,
    plan,
    markdown,
    techniques,
  };
}
