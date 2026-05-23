import { Fragment, useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { type MigratedVideoPlan } from "@/lib/schemas";

type LoadedPlan = MigratedVideoPlan & { evaluation?: MigratedVideoPlan["evaluation"] };

export type VideoFromPlanProps = {
  title: string;
  plan: LoadedPlan | null;
};

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

export function VideoFromPlan({ title, plan }: VideoFromPlanProps) {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  const { versions, bestVersionName } = useMemo(() => {
    const safePlan = plan;
    if (!safePlan) return { versions: [], bestVersionName: "" };
    const bestVersion = safePlan.versions.find(
      (version) => version.versionName === safePlan.evaluation?.bestVersion,
    );
    return {
      versions: bestVersion ? [bestVersion] : safePlan.versions.slice(0, 1),
      bestVersionName: safePlan.evaluation?.bestVersion || (bestVersion?.versionName ?? ""),
    };
  }, [plan]);

  const segments = useMemo(() => {
    if (!plan || versions.length === 0) return [];
    const version = versions[0]!;
    return version.scriptBeats.map((beat, index) => {
      const parsed = parseTimeRangeSeconds(beat.timeRange);
      const startSecond = parsed ? parsed.start : index * 4;
      const endSecond = parsed ? parsed.end : startSecond + 4;
      return {
        index,
        timeRange: beat.timeRange,
        startSecond,
        endSecond,
        focus: beat.shotPurpose,
        label: beat.voiceoverOrSubtitle,
      };
    });
  }, [plan, versions]);

  const timeline = useMemo(() => {
    const totalSecondsFromPlan = segments.length
      ? Math.max(...segments.map((segment) => segment.endSecond))
      : 30;
    const totalSeconds = clamp(totalSecondsFromPlan, 18, 45);
    const totalFrames = Math.min(durationInFrames, Math.round(totalSeconds * fps));

    const frameSegments = segments.map((segment) => {
      const startFrame = Math.round(segment.startSecond * fps);
      const endFrame = Math.round(segment.endSecond * fps);
      const length = clamp(endFrame - startFrame, Math.round(1.2 * fps), Math.round(8 * fps));
      return {
        ...segment,
        startFrame: clamp(startFrame, 0, totalFrames - 1),
        durationInFrames: clamp(length, 1, totalFrames),
      };
    });

    const sorted = frameSegments
      .slice()
      .sort((a, b) => a.startFrame - b.startFrame)
      .filter((segment) => segment.startFrame < totalFrames);

    return { totalFrames, segments: sorted };
  }, [durationInFrames, fps, segments]);

  const titleIn = spring({ fps, frame, config: { damping: 200 } });
  const titleTranslate = interpolate(titleIn, [0, 1], [36, 0]);
  const bgPulse = interpolate(frame, [0, fps * 2, fps * 4], [0.08, 0.16, 0.08], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "PingFang SC", "Microsoft YaHei", Arial',
        backgroundColor: "#070A12",
        color: "white",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 20% 10%, rgba(73, 69, 255, 0.35), transparent 55%), radial-gradient(circle at 80% 20%, rgba(255, 119, 74, 0.25), transparent 55%), radial-gradient(circle at 50% 90%, rgba(0, 209, 255, 0.2), transparent 60%)",
          opacity: bgPulse,
        }}
      />

      <AbsoluteFill style={{ padding: 72 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ maxWidth: 760 }}>
            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: 0.2,
                transform: `translateY(${titleTranslate}px)`,
              }}
            >
              {title}
            </div>
            <div style={{ marginTop: 16, fontSize: 22, lineHeight: 1.5, opacity: 0.86 }}>
              {plan
                ? `推荐版本：${bestVersionName || versions[0]?.versionName || "未命名"}`
                : "未传入 plan（请用 video:render 指定输入 JSON）"}
            </div>
          </div>

          <div
            style={{
              padding: "14px 18px",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.06)",
              fontSize: 18,
              lineHeight: 1.35,
              width: 250,
            }}
          >
            <div style={{ fontWeight: 650 }}>结构演示稿</div>
            <div style={{ marginTop: 6, opacity: 0.82 }}>
              秒级时间线 + 口播字幕 + 素材提示
            </div>
          </div>
        </div>

        <div style={{ marginTop: 64 }}>
          {timeline.segments.length === 0 ? (
            <div
              style={{
                borderRadius: 28,
                border: "1px solid rgba(255,255,255,0.14)",
                padding: 34,
                background: "rgba(255,255,255,0.06)",
                fontSize: 22,
                lineHeight: 1.5,
                opacity: 0.9,
              }}
            >
              没有可渲染的时间线段。请先在 Web UI 中生成方案并导出 JSON，或使用
              `cases/generated/demo-*.json` 作为输入。
            </div>
          ) : (
            timeline.segments.map((segment, index) => {
              const isLast = index === timeline.segments.length - 1;
              const sequenceDuration = isLast
                ? Math.max(1, timeline.totalFrames - segment.startFrame)
                : segment.durationInFrames;

              return (
                <Fragment key={`${segment.index}-${segment.timeRange}`}>
                  <Sequence from={segment.startFrame} durationInFrames={sequenceDuration}>
                    <SegmentCard
                      segment={segment}
                      planTitle={plan?.strategySummary ?? ""}
                      width={width}
                      height={height}
                    />
                  </Sequence>
                </Fragment>
              );
            })
          )}
        </div>

        <div
          style={{
            position: "absolute",
            left: 72,
            right: 72,
            bottom: 66,
            height: 10,
            borderRadius: 999,
            background: "rgba(255,255,255,0.14)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${(frame / timeline.totalFrames) * 100}%`,
              borderRadius: 999,
              background: "linear-gradient(90deg, #6B5CFF, #20D9FF, #FF7A4A)",
            }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: 72,
            fontSize: 16,
            opacity: 0.62,
          }}
        >
          {plan ? "由爆款结构迁移引擎导出 JSON 渲染" : "结构演示稿（等待输入）"}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function SegmentCard({
  segment,
  planTitle,
  width,
  height,
}: {
  segment: { timeRange: string; focus: string; label: string; index: number };
  planTitle: string;
  width: number;
  height: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ fps, frame, config: { damping: 220 } });
  const translateY = interpolate(enter, [0, 1], [36, 0]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ padding: 72 }}>
      <div
        style={{
          height: height - 72 * 2 - 86,
          borderRadius: 30,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.07)",
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.45)",
          padding: 44,
          transform: `translateY(${translateY}px)`,
          opacity,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 22,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <div style={{ maxWidth: width - 280 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div
                style={{
                  fontSize: 18,
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.22)",
                  background: "rgba(0,0,0,0.18)",
                  opacity: 0.9,
                }}
              >
                {segment.timeRange}
              </div>
              <div style={{ fontSize: 18, opacity: 0.68 }}>Beat #{segment.index + 1}</div>
            </div>

            <div style={{ marginTop: 20, fontSize: 40, fontWeight: 760, lineHeight: 1.18 }}>
              {segment.focus}
            </div>
          </div>

          <div
            style={{
              width: 240,
              borderRadius: 26,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.22)",
              padding: 18,
              fontSize: 16,
              lineHeight: 1.4,
              opacity: 0.86,
            }}
          >
            <div style={{ fontWeight: 650, marginBottom: 8 }}>结构提示</div>
            <div style={{ opacity: 0.78 }}>
              {planTitle ? planTitle.slice(0, 90) : "保持“Hook → 证据 → 利益 → CTA”的节奏。"}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 26, lineHeight: 1.4, opacity: 0.9 }}>
          {segment.label.length > 130 ? `${segment.label.slice(0, 130)}…` : segment.label}
        </div>

        <div style={{ fontSize: 16, opacity: 0.6 }}>
          这里是“可生成视频”的占位稿：后续可替换为真实素材、截图、录屏或 AIGC 画面。
        </div>
      </div>
    </AbsoluteFill>
  );
}
