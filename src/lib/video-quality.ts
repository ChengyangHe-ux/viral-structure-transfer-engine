export type VideoQualityProbe = {
  inputPath: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  videoBitrate: number;
  audioCodec: string | null;
  audioSampleRate: number | null;
  audioChannels: number | null;
  audioBitrate: number | null;
  meanVolumeDb: number | null;
  maxVolumeDb: number | null;
};

export type VideoQualityThresholds = {
  minWidth: number;
  minHeight: number;
  expectedAspectRatio: number;
  aspectRatioTolerance: number;
  minFps: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  minVideoBitrate: number;
  requireAudio: boolean;
  minAudioSampleRate: number;
  minAudioChannels: number;
  minMeanVolumeDb: number;
  maxPeakVolumeDb: number;
};

export type VideoQualityIssue = {
  metric: string;
  expected: string;
  actual: string;
};

export type VideoQualityResult = {
  passed: boolean;
  score: number;
  issues: VideoQualityIssue[];
};

export const defaultVideoQualityThresholds: VideoQualityThresholds = {
  minWidth: 1080,
  minHeight: 1920,
  expectedAspectRatio: 9 / 16,
  aspectRatioTolerance: 0.02,
  minFps: 29,
  minDurationSeconds: 12,
  maxDurationSeconds: 90,
  minVideoBitrate: 4_000_000,
  requireAudio: true,
  minAudioSampleRate: 44_100,
  minAudioChannels: 2,
  minMeanVolumeDb: -24,
  maxPeakVolumeDb: -0.2,
};

function formatNumber(value: number, digits = 2) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

export function parseFpsRatio(value: string | null | undefined) {
  if (!value) return 0;
  const [numeratorText, denominatorText] = value.split("/");
  const numerator = Number(numeratorText);
  const denominator = Number(denominatorText ?? 1);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

export function parseVolumeStats(text: string) {
  const meanMatch = text.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
  const maxMatch = text.match(/max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
  return {
    meanVolumeDb: meanMatch ? Number(meanMatch[1]) : null,
    maxVolumeDb: maxMatch ? Number(maxMatch[1]) : null,
  };
}

export function evaluateVideoQuality(
  probe: VideoQualityProbe,
  thresholds: VideoQualityThresholds = defaultVideoQualityThresholds,
): VideoQualityResult {
  const issues: VideoQualityIssue[] = [];
  const aspectRatio = probe.width / Math.max(1, probe.height);
  const aspectDelta = Math.abs(aspectRatio - thresholds.expectedAspectRatio);

  if (probe.width < thresholds.minWidth || probe.height < thresholds.minHeight) {
    issues.push({
      metric: "resolution",
      expected: `>= ${thresholds.minWidth}x${thresholds.minHeight}`,
      actual: `${probe.width}x${probe.height}`,
    });
  }

  if (aspectDelta > thresholds.aspectRatioTolerance) {
    issues.push({
      metric: "aspectRatio",
      expected: `${formatNumber(thresholds.expectedAspectRatio, 3)} +/- ${thresholds.aspectRatioTolerance}`,
      actual: formatNumber(aspectRatio, 3),
    });
  }

  if (probe.fps < thresholds.minFps) {
    issues.push({
      metric: "fps",
      expected: `>= ${thresholds.minFps}`,
      actual: formatNumber(probe.fps),
    });
  }

  if (
    probe.durationSeconds < thresholds.minDurationSeconds ||
    probe.durationSeconds > thresholds.maxDurationSeconds
  ) {
    issues.push({
      metric: "duration",
      expected: `${thresholds.minDurationSeconds}-${thresholds.maxDurationSeconds}s`,
      actual: `${formatNumber(probe.durationSeconds)}s`,
    });
  }

  if (probe.videoBitrate < thresholds.minVideoBitrate) {
    issues.push({
      metric: "videoBitrate",
      expected: `>= ${(thresholds.minVideoBitrate / 1_000_000).toFixed(2)} Mbps`,
      actual: `${(probe.videoBitrate / 1_000_000).toFixed(2)} Mbps`,
    });
  }

  if (thresholds.requireAudio && !probe.audioCodec) {
    issues.push({
      metric: "audio",
      expected: "present",
      actual: "missing",
    });
  }

  if ((probe.audioSampleRate ?? 0) < thresholds.minAudioSampleRate) {
    issues.push({
      metric: "audioSampleRate",
      expected: `>= ${thresholds.minAudioSampleRate}Hz`,
      actual: probe.audioSampleRate ? `${probe.audioSampleRate}Hz` : "missing",
    });
  }

  if ((probe.audioChannels ?? 0) < thresholds.minAudioChannels) {
    issues.push({
      metric: "audioChannels",
      expected: `>= ${thresholds.minAudioChannels}`,
      actual: probe.audioChannels ? String(probe.audioChannels) : "missing",
    });
  }

  if (probe.meanVolumeDb === null || probe.meanVolumeDb < thresholds.minMeanVolumeDb) {
    issues.push({
      metric: "meanVolume",
      expected: `>= ${thresholds.minMeanVolumeDb} dB`,
      actual: probe.meanVolumeDb === null ? "missing" : `${probe.meanVolumeDb} dB`,
    });
  }

  if (probe.maxVolumeDb === null || probe.maxVolumeDb > thresholds.maxPeakVolumeDb) {
    issues.push({
      metric: "peakVolume",
      expected: `<= ${thresholds.maxPeakVolumeDb} dB`,
      actual: probe.maxVolumeDb === null ? "missing" : `${probe.maxVolumeDb} dB`,
    });
  }

  return {
    passed: issues.length === 0,
    score: Math.max(0, 100 - issues.length * 12),
    issues,
  };
}
