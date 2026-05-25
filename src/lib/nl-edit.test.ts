import { describe, expect, it } from "vitest";

import { applyNaturalLanguageEdits } from "@/lib/nl-edit";
import type { MigratedVideoPlan } from "@/lib/schemas";

function basePlan(): MigratedVideoPlan {
  return {
    projectTitle: "Demo",
    targetBrief: "面向大学生的简历优化工具",
    strategySummary: "用于测试自然语言编辑",
    inheritedStructure: ["Hook-证据-行动"],
    versions: [
      {
        versionName: "A",
        positioning: "A",
        bestFor: "A",
        scriptBeats: [
          {
            timeRange: "0-2s",
            shotPurpose: "Hook",
            visualSuggestion: "结果对比",
            voiceoverOrSubtitle: "先抛结论",
            packagingStyle: "大字字幕",
            sellingPointIntent: "建立期待",
            transitionAndRhythm: "快切",
            replaceableAssets: "截图",
            riskNotes: "避免夸大",
          },
          {
            timeRange: "2-6s",
            shotPurpose: "证据",
            visualSuggestion: "演示界面",
            voiceoverOrSubtitle: "给出步骤",
            packagingStyle: "分屏",
            sellingPointIntent: "证明可用",
            transitionAndRhythm: "卡点",
            replaceableAssets: "录屏",
            riskNotes: "可追溯",
          },
          {
            timeRange: "6-10s",
            shotPurpose: "行动",
            visualSuggestion: "结尾引导",
            voiceoverOrSubtitle: "收藏私信",
            packagingStyle: "CTA",
            sellingPointIntent: "转化",
            transitionAndRhythm: "收束",
            replaceableAssets: "字幕卡",
            riskNotes: "不虚构背书",
          },
        ],
        coverTitle: "旧封面",
        captionTitle: "旧文案",
        hashtags: ["#demo"],
      },
    ],
    evaluationChecklist: ["Hook 是否具体"],
    retrievedTechniques: [],
    productionNotes: [],
  };
}

describe("applyNaturalLanguageEdits", () => {
  it("updates beat field by index", () => {
    const { plan, applied, warnings } = applyNaturalLanguageEdits(
      basePlan(),
      "第2段 口播 改为 给出更具体的步骤",
    );
    expect(warnings.length).toBe(0);
    expect(applied.some((item) => item.includes("第2段"))).toBe(true);
    expect(plan.versions[0].scriptBeats[1].voiceoverOrSubtitle).toBe("给出更具体的步骤");
  });

  it("updates cover/caption title", () => {
    const { plan } = applyNaturalLanguageEdits(basePlan(), "封面标题改为 10分钟做出岗位匹配简历；文案标题：收藏+私信关键词领取模板");
    expect(plan.versions[0].coverTitle).toBe("10分钟做出岗位匹配简历");
    expect(plan.versions[0].captionTitle).toBe("收藏+私信关键词领取模板");
  });

  it("extends timeRange", () => {
    const { plan } = applyNaturalLanguageEdits(basePlan(), "第1段 延长 1 秒");
    expect(plan.versions[0].scriptBeats[0].timeRange).toBe("0-3s");
  });

  it("replaces hashtags", () => {
    const { plan } = applyNaturalLanguageEdits(basePlan(), "话题=简历优化 AI求职 #大学生");
    expect(plan.versions[0].hashtags).toEqual(["#简历优化", "#AI求职", "#大学生"]);
  });

  it("moves, inserts, deletes beats", () => {
    const moved = applyNaturalLanguageEdits(basePlan(), "第2段上移");
    expect(moved.plan.versions[0].scriptBeats.map((b) => b.shotPurpose)).toEqual([
      "证据",
      "Hook",
      "行动",
    ]);

    const inserted = applyNaturalLanguageEdits(moved.plan, "在第1段后新增");
    expect(inserted.plan.versions[0].scriptBeats).toHaveLength(4);
    expect(inserted.plan.versions[0].scriptBeats[1].shotPurpose).toBe("证据");

    const deleted = applyNaturalLanguageEdits(inserted.plan, "删除第2段");
    expect(deleted.plan.versions[0].scriptBeats).toHaveLength(3);
  });

  it("swaps beats", () => {
    const swapped = applyNaturalLanguageEdits(basePlan(), "交换第1段和第3段");
    expect(swapped.plan.versions[0].scriptBeats.map((b) => b.shotPurpose)).toEqual([
      "行动",
      "证据",
      "Hook",
    ]);
  });
});
