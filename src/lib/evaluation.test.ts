import { describe, expect, it } from "vitest";

import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";
import { attachPlanEvaluation, evaluatePlan } from "@/lib/evaluation";

describe("plan evaluation", () => {
  it("scores a migrated plan and chooses a best version", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "样例",
      sampleNotes: "开头反差，中段证据，结尾转化。",
    });
    const plan = createFallbackPlan({
      projectTitle: "测试项目",
      targetBrief: "面向大学生的 AI 简历优化工具",
      analysis,
    });

    const evaluation = evaluatePlan(plan, analysis);

    expect(evaluation.overallScore).toBeGreaterThanOrEqual(75);
    expect(evaluation.dimensions).toHaveLength(5);
    expect(evaluation.bestVersion.length).toBeGreaterThan(0);
  });

  it("attaches the evaluation to the persisted plan shape", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "样例",
      sampleNotes: "开头反差，中段证据，结尾转化。",
    });
    const plan = createFallbackPlan({
      projectTitle: "测试项目",
      targetBrief: "面向大学生的 AI 简历优化工具",
      analysis,
    });

    const evaluatedPlan = attachPlanEvaluation(plan, analysis);

    expect(evaluatedPlan.evaluation?.judgePitch).toContain("结构规则");
  });
});
