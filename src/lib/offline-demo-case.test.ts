import { describe, expect, it } from "vitest";

import { demoPresets } from "@/lib/demo-presets";
import { buildOfflineDemoCase } from "@/lib/offline-demo-case";

describe("offline demo cases", () => {
  it("keeps every generated contest case prize-ready", () => {
    const cases = demoPresets.map((preset) => buildOfflineDemoCase(preset));

    expect(cases.map((item) => item.preset.label)).toContain("矿泉水");
    for (const item of cases) {
      expect(item.plan.retrievedTechniques.length).toBeGreaterThanOrEqual(4);
      expect(item.plan.awardReadiness?.overallScore).toBeGreaterThanOrEqual(90);
      expect(item.markdown).toContain("大奖目标看板");
    }
  });
});
