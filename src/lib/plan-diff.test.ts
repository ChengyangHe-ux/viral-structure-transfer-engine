import { describe, expect, it } from "vitest";

import { diffPlans } from "@/lib/plan-diff";
import type { MigratedVideoPlan } from "@/lib/schemas";

function basePlan(): MigratedVideoPlan {
  return {
    projectTitle: "Demo",
    targetBrief: "Brief brief",
    strategySummary: "用于测试 diffPlans",
    inheritedStructure: ["Hook"],
    versions: [
      {
        versionName: "A",
        positioning: "pos",
        bestFor: "best",
        coverTitle: "cover",
        captionTitle: "caption",
        hashtags: ["#a"],
        scriptBeats: [
          {
            timeRange: "0-1s",
            shotPurpose: "Hook",
            visualSuggestion: "V",
            voiceoverOrSubtitle: "VO",
            packagingStyle: "Pack",
            sellingPointIntent: "Sell",
            transitionAndRhythm: "R",
            replaceableAssets: "Assets",
            riskNotes: "Risk",
          },
          {
            timeRange: "1-2s",
            shotPurpose: "证据",
            visualSuggestion: "V2",
            voiceoverOrSubtitle: "VO2",
            packagingStyle: "Pack2",
            sellingPointIntent: "Sell2",
            transitionAndRhythm: "R2",
            replaceableAssets: "Assets2",
            riskNotes: "Risk2",
          },
          {
            timeRange: "2-3s",
            shotPurpose: "行动",
            visualSuggestion: "V3",
            voiceoverOrSubtitle: "VO3",
            packagingStyle: "Pack3",
            sellingPointIntent: "Sell3",
            transitionAndRhythm: "R3",
            replaceableAssets: "Assets3",
            riskNotes: "Risk3",
          },
        ],
      },
    ],
    evaluationChecklist: ["x"],
    retrievedTechniques: [],
    productionNotes: [],
  };
}

describe("diffPlans", () => {
  it("captures beat field changes and hashtag/title changes", () => {
    const before = basePlan();
    const after: MigratedVideoPlan = structuredClone(before);
    after.versions[0].coverTitle = "new cover";
    after.versions[0].hashtags = ["#b", "#c"];
    after.versions[0].scriptBeats[1].voiceoverOrSubtitle = "changed";

    const items = diffPlans(before, after);
    expect(items.some((i) => i.kind === "version" && i.field === "coverTitle")).toBe(true);
    expect(items.some((i) => i.kind === "hashtags")).toBe(true);
    expect(items.some((i) => i.kind === "beat-field" && i.beatIndex === 1 && i.field === "voiceoverOrSubtitle")).toBe(
      true,
    );
  });
});
