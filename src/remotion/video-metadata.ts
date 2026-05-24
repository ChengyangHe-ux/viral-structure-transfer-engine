import { type MigratedVideoPlan } from "@/lib/schemas";

function parseTimeRangeSeconds(timeRange: string) {
  const match = timeRange.match(/(\d+(?:\.\d+)?)\s*s?\s*-\s*(\d+(?:\.\d+)?)\s*s?/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end, duration: end - start };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

type LoadedPlan = MigratedVideoPlan & { evaluation?: MigratedVideoPlan["evaluation"] };

export function calculateVideoFramesFromPlan({
  plan,
  fps,
  minSeconds = 18,
  maxSeconds = 75,
}: {
  plan: LoadedPlan | null;
  fps: number;
  minSeconds?: number;
  maxSeconds?: number;
}) {
  if (!plan?.versions?.length) {
    const fallbackSeconds = clamp(40, minSeconds, maxSeconds);
    return { totalSeconds: fallbackSeconds, totalFrames: Math.round(fallbackSeconds * fps) };
  }

  const version = plan.versions[0]!;
  const segments = version.scriptBeats.map((beat, index) => {
    const parsed = parseTimeRangeSeconds(beat.timeRange);
    const startSecond = parsed ? parsed.start : index * 4;
    const endSecond = parsed ? parsed.end : startSecond + 4;
    return { startSecond, endSecond };
  });

  const totalSecondsFromPlan = segments.length
    ? Math.max(...segments.map((segment) => segment.endSecond))
    : 40;

  const totalSeconds = clamp(totalSecondsFromPlan + 6, minSeconds, maxSeconds);
  return { totalSeconds, totalFrames: Math.round(totalSeconds * fps) };
}

