import { describe, expect, it } from "vitest";

import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";
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
    const plan = createFallbackPlan({
      projectTitle: "测试项目",
      targetBrief: "面向大学生的 AI 简历优化工具",
      analysis,
    });

    const parsed = migratedVideoPlanSchema.parse(plan);
    expect(parsed.versions).toHaveLength(3);
    expect(parsed.versions[0].scriptBeats[0]).toHaveProperty("replaceableAssets");
  });
});
