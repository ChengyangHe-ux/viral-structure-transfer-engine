import { describe, expect, it } from "vitest";

import { insertBeatAfter, moveBeat, removeBeat } from "@/lib/plan-edit";
import type { PlanVersion } from "@/lib/schemas";

function makeVersion(count: number): PlanVersion {
  return {
    versionName: "A",
    positioning: "pos",
    bestFor: "best",
    coverTitle: "cover",
    captionTitle: "caption",
    hashtags: ["#a"],
    scriptBeats: Array.from({ length: count }, (_, index) => ({
      timeRange: `${index}-${index + 1}s`,
      shotPurpose: `P${index + 1}`,
      visualSuggestion: "V",
      voiceoverOrSubtitle: "VO",
      packagingStyle: "Pack",
      sellingPointIntent: "Sell",
      transitionAndRhythm: "Rhythm",
      replaceableAssets: "Assets",
      riskNotes: "Risk",
    })),
  };
}

describe("plan-edit", () => {
  it("moves beat up/down", () => {
    const version = makeVersion(4);
    const movedUp = moveBeat(version, 2, "up");
    expect(movedUp.scriptBeats.map((b) => b.shotPurpose)).toEqual(["P1", "P3", "P2", "P4"]);
    const movedDown = moveBeat(movedUp, 1, "down");
    expect(movedDown.scriptBeats.map((b) => b.shotPurpose)).toEqual(["P1", "P2", "P3", "P4"]);
  });

  it("removes beat only when >=4", () => {
    const v3 = makeVersion(3);
    expect(removeBeat(v3, 1).scriptBeats).toHaveLength(3);
    const v4 = makeVersion(4);
    expect(removeBeat(v4, 1).scriptBeats).toHaveLength(3);
  });

  it("inserts beat after index", () => {
    const version = makeVersion(3);
    const next = insertBeatAfter(version, 0);
    expect(next.scriptBeats).toHaveLength(4);
    expect(next.scriptBeats[1].shotPurpose).toBe("P1");
  });
});

