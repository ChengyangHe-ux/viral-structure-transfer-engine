import { describe, expect, it } from "vitest";

import type { MigrationMapRow } from "@/lib/mapping";
import { buildTimelineSegments } from "@/lib/timeline";

const rows: MigrationMapRow[] = [
  {
    index: 1,
    sampleTimeRange: "0-3s",
    samplePurpose: "抓住注意力",
    sampleRule: "开头结果前置",
    outputTimeRange: "0-3s",
    outputPurpose: "用反差或结果抢停留",
    outputLine: "先别划走",
    mappingLogic: "开头承诺具体结果 -> 先建立继续观看的理由",
    materialSlotName: "开头吸引镜头",
    materialFit: "matched",
    completionStrategy: "visual-packaging",
    completionPlan: "用标题条强化冲击。",
  },
  {
    index: 2,
    sampleTimeRange: "3-12s",
    samplePurpose: "解释为什么成立",
    sampleRule: "每个镜头只服务一个证明点",
    outputTimeRange: "3-10s",
    outputPurpose: "拆出第一个证据点",
    outputLine: "第一点",
    mappingLogic: "证明点 -> 可信证据",
    materialSlotName: "背书证据镜头",
    materialFit: "missing",
    completionStrategy: "copy-caption",
    completionPlan: "用证据占位卡提醒补真实截图。",
  },
];

describe("timeline segments", () => {
  it("turns migration rows into proportional timeline segments", () => {
    const segments = buildTimelineSegments(rows);

    expect(segments).toHaveLength(2);
    expect(segments[0].focus).toBe("Hook");
    expect(segments[1].focus).toBe("证据");
    expect(segments[1].materialFit).toBe("missing");
    expect(segments[1].leftPercent).toBeGreaterThan(segments[0].leftPercent);
  });
});
