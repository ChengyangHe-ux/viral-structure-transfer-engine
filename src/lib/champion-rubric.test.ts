import { describe, expect, it } from "vitest";

import { demoPresets } from "@/lib/demo-presets";
import { buildOfflineDemoCase } from "@/lib/offline-demo-case";
import { evaluateChampionRubric } from "@/lib/champion-rubric";
import { buildTechniqueTransferRecipe } from "@/lib/technique-transfer";

describe("champion rubric", () => {
  it("maps a demo case to the official competition scoring table", () => {
    const { analysis, plan } = buildOfflineDemoCase(demoPresets[0]!);
    const techniqueTransfer = buildTechniqueTransferRecipe({ analysis, plan });
    const report = evaluateChampionRubric({
      analysis,
      plan,
      techniqueTransfer,
      finalVideoReady: true,
    });

    expect(report.verdict).toBe("champion-ready");
    expect(report.baseScore).toBeGreaterThanOrEqual(96);
    expect(report.bonusScore).toBeGreaterThanOrEqual(8);
    expect(report.items.map((item) => item.group)).toEqual(
      expect.arrayContaining([
        "基础闭环完成度（25分）",
        "素材缺口处理能力（20分）",
        "结果展示与可验证性（20分）",
        "进阶能力（20分）",
        "人机协同与整体完成度（15分）",
        "加分项（最高10分）",
      ]),
    );
    expect(report.items.map((item) => item.label)).toContain("结构迁移生成能力");
    expect(report.items.map((item) => item.label)).toContain("真实素材适配");
  });
});
