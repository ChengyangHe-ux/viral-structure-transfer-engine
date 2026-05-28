import { describe, expect, it } from "vitest";

import { createFallbackAnalysis } from "@/lib/fallbacks";
import { buildStructureFingerprint } from "@/lib/structure-fingerprint";
import type { VideoStructureAnalysis } from "@/lib/schemas";

describe("buildStructureFingerprint", () => {
  it("turns fallback analysis into judge-readable structure metrics", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "强 Hook 样例",
      sampleNotes: "0-3s 结果前置，3-12s 证据三连，结尾 CTA。",
    });

    const fingerprint = buildStructureFingerprint(analysis);

    expect(fingerprint.durationSeconds).toBe(30);
    expect(fingerprint.rhythmCurve).toHaveLength(4);
    expect(fingerprint.hookStrength).toBeGreaterThanOrEqual(85);
    expect(fingerprint.rhythmCurve[0]?.focus).toBe("hook");
    expect(fingerprint.rhythmCurve.at(-1)?.focus).toBe("cta");
    expect(fingerprint.ctaPositionPercent).toBeGreaterThan(80);
    expect(fingerprint.summary).toContain("Hook 强度");
  });

  it("handles missing and malformed time ranges without NaN values", () => {
    const analysis: VideoStructureAnalysis = {
      ...createFallbackAnalysis({
        sampleTitle: "异常时间样例",
        sampleNotes: "时间段来自人工输入，格式不统一。",
      }),
      durationSeconds: undefined,
      beatMap: [
        {
          timeRange: "开头",
          shotPurpose: "抓住注意力",
          visualObservation: "先放反差结果",
          captionObservation: "短句强调痛点",
          transferableRule: "开头承诺具体结果",
        },
        {
          timeRange: "bad-range",
          shotPurpose: "解释可信证据",
          visualObservation: "展示参数和反馈",
          captionObservation: "证据字幕",
          transferableRule: "每个镜头只讲一个证明点",
        },
      ],
    };

    const fingerprint = buildStructureFingerprint(analysis);

    expect(fingerprint.durationSeconds).toBeGreaterThan(0);
    expect(fingerprint.rhythmCurve).toHaveLength(2);
    expect(
      fingerprint.rhythmCurve.every(
        (point) =>
          Number.isFinite(point.startSecond) &&
          Number.isFinite(point.endSecond) &&
          Number.isFinite(point.intensity),
      ),
    ).toBe(true);
    expect(Number.isFinite(fingerprint.shotDensityPer10s)).toBe(true);
    expect(Number.isFinite(fingerprint.subtitleDensityPer10s)).toBe(true);
  });

  it("extracts packaging tags from subtitle and visual packaging text", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "包装样例",
      sampleNotes: "标题条、贴纸、分屏、箭头和高亮字幕。",
    });

    const fingerprint = buildStructureFingerprint(analysis);

    expect(fingerprint.packagingTags).toEqual(
      expect.arrayContaining(["字幕节奏", "对比画面", "指示元素", "重点高亮"]),
    );
  });
});
