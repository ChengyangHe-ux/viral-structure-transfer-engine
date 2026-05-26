import { describe, expect, it } from "vitest";

import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";
import { buildMigrationMap } from "@/lib/mapping";
import { attachMaterialAdaptation } from "@/lib/materials";
import { buildStoryboardFrames } from "@/lib/storyboard";

describe("storyboard frames", () => {
  it("turns generated beats into phone-preview frames", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "样例",
      sampleNotes: "开头反差，中段证据推进，结尾 CTA。",
    });
    const basePlan = createFallbackPlan({
      projectTitle: "测试项目",
      targetBrief: "一款 AI 简历优化工具",
      userMaterials: "有产品界面截图、操作录屏、用户反馈和领取入口。",
      analysis,
    });
    const plan = attachMaterialAdaptation({
      plan: basePlan,
      targetBrief: basePlan.targetBrief,
      userMaterials: "有产品界面截图、操作录屏、用户反馈和领取入口。",
    });
    const rows = buildMigrationMap({ analysis, plan });
    const frames = buildStoryboardFrames({ version: plan.versions[0], rows });

    expect(frames).toHaveLength(plan.versions[0].scriptBeats.length);
    expect(frames[0].focus).toBe("Hook");
    expect(frames[frames.length - 1].focus).toBe("CTA");
    expect(frames[0].subtitleLayer).toContain("AI 简历优化工具");
    expect(frames.some((frame) => frame.materialFit !== "unknown")).toBe(true);
  });
});
