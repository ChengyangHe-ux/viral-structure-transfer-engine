import { describe, expect, it } from "vitest";

import { evaluateChampionRubric } from "@/lib/champion-rubric";
import { demoPresets } from "@/lib/demo-presets";
import { buildOfflineDemoCase } from "@/lib/offline-demo-case";
import { buildContestRequirementCoverage } from "@/lib/requirement-coverage";
import { buildTechniqueTransferRecipe } from "@/lib/technique-transfer";

describe("requirement coverage", () => {
  it("marks every contest task as todo before a project is generated", () => {
    const report = buildContestRequirementCoverage({});

    expect(report.totalCount).toBe(13);
    expect(report.completedCount).toBe(0);
    expect(report.p0CompletedCount).toBe(0);
    expect(report.items.map((item) => item.taskId)).toEqual(
      Array.from({ length: 13 }, (_, index) => `任务${index + 1}`),
    );
    expect(report.items.every((item) => item.status === "todo")).toBe(true);
  });

  it("turns an offline demo case into a full task-level judge checklist", () => {
    const { analysis, plan } = buildOfflineDemoCase(demoPresets[0]!);
    const techniqueTransfer = buildTechniqueTransferRecipe({ analysis, plan });
    const championRubric = evaluateChampionRubric({
      analysis,
      plan,
      techniqueTransfer,
      finalVideoReady: true,
    });
    const report = buildContestRequirementCoverage({
      analysis,
      plan,
      techniqueTransfer,
      championRubric,
    });

    expect(report.totalCount).toBe(13);
    expect(report.completedCount).toBeGreaterThanOrEqual(12);
    expect(report.p0CompletedCount).toBe(8);
    expect(report.items.filter((item) => item.priority === "P0")).toHaveLength(8);
    expect(report.items.find((item) => item.taskId === "任务7")?.evidence).toContain(
      "手法迁移",
    );
    expect(report.items.find((item) => item.taskId === "任务13")?.status).toBe("ready");
  });
});
