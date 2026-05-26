import { describe, expect, it } from "vitest";

import {
  evaluateVideoQuality,
  parseFpsRatio,
  parseVolumeStats,
  type VideoQualityProbe,
} from "@/lib/video-quality";

const passingProbe: VideoQualityProbe = {
  inputPath: "renders/coffee-launch-short-high.mp4",
  width: 1080,
  height: 1920,
  fps: 30,
  durationSeconds: 38,
  videoBitrate: 5_020_000,
  audioCodec: "mp3",
  audioSampleRate: 48_000,
  audioChannels: 2,
  audioBitrate: 320_000,
  meanVolumeDb: -18.5,
  maxVolumeDb: -3.2,
};

describe("video quality", () => {
  it("accepts the high-quality coffee demo profile", () => {
    const result = evaluateVideoQuality(passingProbe);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it("flags missing audio and low video bitrate", () => {
    const result = evaluateVideoQuality({
      ...passingProbe,
      videoBitrate: 1_600_000,
      audioCodec: null,
      audioSampleRate: null,
      audioChannels: null,
      audioBitrate: null,
      meanVolumeDb: null,
      maxVolumeDb: null,
    });

    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.metric)).toEqual(
      expect.arrayContaining([
        "videoBitrate",
        "audio",
        "audioSampleRate",
        "audioChannels",
        "meanVolume",
        "peakVolume",
      ]),
    );
  });

  it("parses ffprobe ratios and ffmpeg volume output", () => {
    expect(parseFpsRatio("30000/1001")).toBeCloseTo(29.97, 2);
    expect(parseFpsRatio("30/1")).toBe(30);
    expect(parseFpsRatio("bad")).toBe(0);

    expect(
      parseVolumeStats(`
        [Parsed_volumedetect_0] mean_volume: -18.5 dB
        [Parsed_volumedetect_0] max_volume: -3.2 dB
      `),
    ).toEqual({ meanVolumeDb: -18.5, maxVolumeDb: -3.2 });
  });
});
