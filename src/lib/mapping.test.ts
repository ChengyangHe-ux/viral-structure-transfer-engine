import { describe, expect, it } from "vitest";

import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";
import { buildMigrationMap } from "@/lib/mapping";
import { attachMaterialAdaptation } from "@/lib/materials";

describe("migration mapping", () => {
  it("connects sample beats, generated beats, and material slots", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "样例",
      sampleNotes: "开头结果前置，中段连续证据，结尾 CTA。",
    });
    const basePlan = createFallbackPlan({
      projectTitle: "测试项目",
      targetBrief: "面向大学生的 AI 简历优化工具",
      userMaterials: "有界面截图、操作录屏和领取入口。",
      analysis,
    });
    const plan = attachMaterialAdaptation({
      plan: basePlan,
      targetBrief: basePlan.targetBrief,
      userMaterials: "有界面截图、操作录屏和领取入口。",
    });

    const rows = buildMigrationMap({ analysis, plan });

    expect(rows).toHaveLength(plan.versions[0].scriptBeats.length);
    expect(rows[0].sampleRule).toContain("开头");
    expect(rows[0].outputLine).toContain("AI 简历优化工具");
    expect(rows.some((row) => row.materialSlotName !== "未匹配槽位")).toBe(true);
  });
});
