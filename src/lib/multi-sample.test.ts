import { describe, expect, it } from "vitest";

import { createFallbackAnalysis } from "@/lib/fallbacks";
import { combineSampleAnalyses } from "@/lib/multi-sample";

describe("multi-sample analysis", () => {
  it("combines multiple source structures with source evidence", () => {
    const hookSample = createFallbackAnalysis({
      sampleTitle: "强 Hook 食品样例",
      sampleNotes: "0-2 秒用一口喝下后的表情和反差大字，随后进入原料和口感证据。",
    });
    const proofSample = createFallbackAnalysis({
      sampleTitle: "证据推进工具样例",
      sampleNotes: "开头给前后对比，中段用三段证据：关键词匹配、量化建议、检查清单。",
    });

    const combined = combineSampleAnalyses({
      projectTitle: "多样例结构迁移",
      analyses: [hookSample, proofSample],
    });

    expect(combined.sampleTitle).toContain("多样例 2 条");
    expect(combined.summary).toContain("强 Hook 食品样例");
    expect(combined.summary).toContain("证据推进工具样例");
    expect(combined.hookPatterns.length).toBe(
      hookSample.hookPatterns.length + proofSample.hookPatterns.length,
    );
    expect(combined.beatMap.length).toBe(
      hookSample.beatMap.length + proofSample.beatMap.length,
    );
    expect(combined.beatMap[0]?.timeRange).toContain("强 Hook 食品样例");
    expect(
      combined.beatMap.some((beat) => beat.transferableRule.includes("证据推进工具样例")),
    ).toBe(true);
    expect(combined.riskNotes[0]).toContain("多样例模式");
  });
});
