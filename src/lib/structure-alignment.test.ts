import { describe, expect, it } from "vitest";

import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";
import { alignStructure } from "@/lib/structure-alignment";

describe("structure alignment", () => {
  it("computes coverage and missing beats", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "样例",
      sampleNotes: "开头反差，中段证据，结尾转化。",
    });
    const plan = createFallbackPlan({
      projectTitle: "测试项目",
      targetBrief: "面向大学生的 AI 简历优化工具",
      analysis,
    });

    const alignment = alignStructure({ analysis, plan });

    expect(alignment.sampleBeatCount).toBeGreaterThan(0);
    expect(alignment.coverageScore).toBeGreaterThan(40);
    expect(alignment.coverageRatio).toBeGreaterThan(0);
    expect(Array.isArray(alignment.missingSampleBeats)).toBe(true);
  });
});

