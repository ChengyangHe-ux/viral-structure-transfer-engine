import { describe, expect, it } from "vitest";

import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";
import { attachPlanEvaluation } from "@/lib/evaluation";
import { attachMaterialAdaptation } from "@/lib/materials";
import {
  buildRenderTimelineFromPlan,
  renderTimelineSchema,
  selectBestPlanVersion,
} from "@/lib/render-timeline";

function buildCase() {
  const analysis = createFallbackAnalysis({
    sampleTitle: "样例",
    sampleNotes: "开头强反差，中段证据推进，结尾 CTA。",
  });
  const basePlan = createFallbackPlan({
    projectTitle: "学习平板种草脚本",
    targetBrief: "一款面向初中生家庭的学习平板",
    userMaterials: "有产品图、使用过程录屏、用户反馈截图，缺少对比结果镜头。",
    analysis,
  });
  const plan = attachPlanEvaluation(
    attachMaterialAdaptation({
      plan: basePlan,
      targetBrief: basePlan.targetBrief,
      userMaterials: "有产品图、使用过程录屏、用户反馈截图，缺少对比结果镜头。",
    }),
    analysis,
  );

  return { analysis, plan };
}

describe("render timeline", () => {
  it("selects the evaluated best version", () => {
    const { plan } = buildCase();
    const version = selectBestPlanVersion(plan);

    expect(version.versionName).toBe(plan.evaluation?.bestVersion);
  });

  it("maps a migrated plan into high-quality render scenes", () => {
    const { analysis, plan } = buildCase();
    const timeline = buildRenderTimelineFromPlan({ plan, analysis });

    expect(renderTimelineSchema.parse(timeline)).toEqual(timeline);
    expect(timeline.width).toBe(1080);
    expect(timeline.height).toBe(1920);
    expect(timeline.fps).toBe(30);
    expect(timeline.totalFrames).toBeGreaterThan(450);
    expect(timeline.scenes).toHaveLength(selectBestPlanVersion(plan).scriptBeats.length);
    expect(timeline.scenes[0].focus).toBe("Hook");
    expect(timeline.scenes.at(-1)?.focus).toBe("CTA");
    expect(timeline.scenes.every((scene) => scene.durationFrames > 0)).toBe(true);
    expect(timeline.scenes.every((scene) => scene.captionTokens.length > 0)).toBe(true);
    expect(timeline.scenes.every((scene) => scene.visualLayers.length > 0)).toBe(true);
    expect(timeline.scenes.some((scene) => scene.materialFit === "missing")).toBe(true);
    expect(timeline.techniqueProfile?.summary).toContain("Hook 强度");
    expect(timeline.transferRecipe?.sceneTransfers[0]?.sampleTimeRange).toBe("0-3s");
    expect(timeline.transferRecipe?.sceneTransfers[0]?.mappedTechnique).toContain("迁移样例");
  });

  it("gives Hook and CTA scenes stronger audio cues than evidence scenes", () => {
    const { analysis, plan } = buildCase();
    const timeline = buildRenderTimelineFromPlan({ plan, analysis });
    const hookCue = timeline.scenes.find((scene) => scene.focus === "Hook")?.audioCues[0];
    const evidenceCue = timeline.scenes.find((scene) => scene.focus === "证据")?.audioCues[0];
    const ctaCue = timeline.scenes.find((scene) => scene.focus === "CTA")?.audioCues[0];

    expect(hookCue?.intensity).toBeGreaterThan(evidenceCue?.intensity ?? 1);
    expect(ctaCue?.intensity).toBeGreaterThan(evidenceCue?.intensity ?? 1);
    expect(timeline.audioCues.length).toBeGreaterThanOrEqual(timeline.scenes.length);
  });
});
