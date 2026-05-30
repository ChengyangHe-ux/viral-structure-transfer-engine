import { describe, expect, it } from "vitest";

import { scoreGeneratedVideoAsset } from "@/lib/video-asset-quality";

describe("video asset quality", () => {
  it("caps hero generated video even when technical specs pass", () => {
    const report = scoreGeneratedVideoAsset({
      inputPath: "hero.mp4",
      slotKind: "hero",
      durationSeconds: 5,
      width: 1080,
      height: 1920,
      fps: 30,
      hasAudio: true,
      riskFlags: [],
    });

    expect(report.score).toBeLessThanOrEqual(60);
    expect(report.verdict).toBe("reject");
    expect(report.riskFlags).toContain("generated-video-unsafe-for-hero");
  });

  it("accepts vertical generated broll when specs pass", () => {
    const report = scoreGeneratedVideoAsset({
      inputPath: "broll.mp4",
      slotKind: "broll",
      durationSeconds: 5,
      width: 1080,
      height: 1920,
      fps: 30,
      hasAudio: false,
      riskFlags: [],
    });

    expect(report.score).toBeGreaterThanOrEqual(90);
    expect(report.verdict).toBe("accept");
    expect(report.riskFlags).toContain("needs-audio-bed");
  });
});
