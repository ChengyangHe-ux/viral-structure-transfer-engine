import { describe, expect, it } from "vitest";

import { evaluateAwardReadiness } from "@/lib/award-readiness";
import {
  attachEditingTechniquesToPlan,
  retrieveEditingTechniques,
} from "@/lib/editing-techniques";
import { attachPlanEvaluation } from "@/lib/evaluation";
import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";
import { attachMaterialAdaptation } from "@/lib/materials";

describe("award readiness", () => {
  it("turns a competition goal into measurable readiness criteria", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "矿泉水样例",
      sampleNotes: "开头先给高级清爽结果，中段多场景 B-roll 和微距特写，结尾 CTA。",
    });
    const basePlan = createFallbackPlan({
      projectTitle: "矿泉水展示项目",
      targetBrief: "15秒矿泉水介绍，要高级、多场景、真实视频素材和明确购买行动。",
      userMaterials: "瓶身特写、开盖水滴、山泉感场景、运动后饮用、购买入口。",
      analysis,
    });
    const techniques = retrieveEditingTechniques({
      targetBrief: basePlan.targetBrief,
      userMaterials: "瓶身特写、开盖水滴、山泉感场景、运动后饮用、购买入口。",
      analysis,
    });
    const planned = attachPlanEvaluation(
      attachMaterialAdaptation({
        plan: attachEditingTechniquesToPlan({ plan: basePlan, techniques }),
        targetBrief: basePlan.targetBrief,
        userMaterials: "瓶身特写、开盖水滴、山泉感场景、运动后饮用、购买入口。",
      }),
      analysis,
    );

    const readiness = evaluateAwardReadiness({ plan: planned, analysis });

    expect(readiness.criteria).toHaveLength(5);
    expect(readiness.goalStatement).toContain("演示目标");
    expect(readiness.criteria.map((item) => item.key)).toContain("technique-explainability");
    expect(readiness.demoProof.length).toBeGreaterThanOrEqual(4);
    expect(readiness.overallScore).toBeGreaterThanOrEqual(80);
  });
});
