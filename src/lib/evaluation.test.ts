import { describe, expect, it } from "vitest";

import {
  createFallbackAnalysis,
  createFallbackPlan,
  createRefinedFallbackPlan,
} from "@/lib/fallbacks";
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
    expect(evaluation.dimensions).toHaveLength(6);
    expect(evaluation.bestVersion.length).toBeGreaterThan(0);
    expect(evaluation.structureAlignment?.sampleBeatCount).toBeGreaterThan(0);
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

  it("refines a plan from a natural-language instruction", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "样例",
      sampleNotes: "开头反差，中段证据，结尾转化。",
    });
    const plan = createFallbackPlan({
      projectTitle: "测试项目",
      targetBrief: "面向大学生的 AI 简历优化工具",
      analysis,
    });

    const refined = createRefinedFallbackPlan(
      plan,
      "开头更强一点，并补充可信证据",
    );

    expect(refined.strategySummary).toContain("自然语言指令");
    expect(refined.versions[0].scriptBeats[0].voiceoverOrSubtitle).toContain("别急着划走");
  });
});
