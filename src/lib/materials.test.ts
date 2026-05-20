import { describe, expect, it } from "vitest";

import { evaluateMaterialAdaptation } from "@/lib/materials";

describe("material adaptation", () => {
  it("detects missing structural slots when user materials are thin", () => {
    const adaptation = evaluateMaterialAdaptation({
      targetBrief: "一款低糖冷萃咖啡新品",
      userMaterials: "只有一张商品包装图",
    });

    expect(adaptation.slots).toHaveLength(6);
    expect(adaptation.missingSlotCount).toBeGreaterThan(0);
    expect(adaptation.timelineAdjustment).toContain("补足");
  });

  it("raises the sufficiency score when materials cover core slots", () => {
    const sparse = evaluateMaterialAdaptation({
      targetBrief: "一款 AI 简历工具",
      userMaterials: "",
    });
    const covered = evaluateMaterialAdaptation({
      targetBrief: "一款 AI 简历工具",
      userMaterials:
        "有产品界面截图、前后对比效果图、操作录屏、用户评价截图、领取链接和结尾 CTA 画面。",
    });

    expect(covered.sufficiencyScore).toBeGreaterThan(sparse.sufficiencyScore);
  });
});
