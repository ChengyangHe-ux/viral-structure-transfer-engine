import { describe, expect, it } from "vitest";

import { evaluateMaterialAdaptation, parseMaterialAssets } from "@/lib/materials";

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

  it("classifies real assets and recommends them to structure slots", () => {
    const assets = parseMaterialAssets({
      targetBrief: "面向大学生的 AI 简历优化工具",
      userMaterials:
        "产品界面截图 3 张、简历优化前后对比图 1 张、10 秒操作录屏 1 条、用户反馈截图 2 张、领取链接。",
    });

    expect(assets.some((asset) => asset.kind === "image")).toBe(true);
    expect(assets.some((asset) => asset.kind === "video")).toBe(true);
    expect(assets.some((asset) => asset.kind === "link")).toBe(true);
    expect(assets.some((asset) => asset.suggestedSlots.includes("usage"))).toBe(true);
    expect(assets.some((asset) => asset.suggestedSlots.includes("cta"))).toBe(true);
  });

  it("surfaces asset recommendations inside gap diagnosis", () => {
    const adaptation = evaluateMaterialAdaptation({
      targetBrief: "一款低糖冷萃咖啡新品",
      userMaterials:
        "产品包装图、冰杯成品图、门店海报、限时口味文案、购买入口；缺少冲泡过程和真实评价。",
    });

    expect(adaptation.assets.length).toBeGreaterThanOrEqual(3);
    expect(
      adaptation.slots.some((slot) => slot.recommendedAssets.length > 0),
    ).toBe(true);
    expect(
      adaptation.slots.find((slot) => slot.slotId === "cta")?.recommendedAssets[0]?.label,
    ).toContain("入口");
  });
});
