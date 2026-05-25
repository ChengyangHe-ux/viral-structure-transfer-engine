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
import { calculateVideoFramesFromPlan } from "@/remotion/video-metadata";

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
        visualSuggestion: beat.visualSuggestion,
        packagingStyle: beat.packagingStyle,
        sellingPointIntent: beat.sellingPointIntent,
        transitionAndRhythm: beat.transitionAndRhythm,
        replaceableAssets: beat.replaceableAssets,
        riskNotes: beat.riskNotes,
      };
    });
  }, [plan, versions]);

  const timeline = useMemo(() => {
    const introFrames = Math.round(3.2 * fps);
    const outroFrames = Math.round(2.2 * fps);

    const { totalFrames } = calculateVideoFramesFromPlan({
      plan,
      fps,
    });
    const boundedTotalFrames = clamp(totalFrames, 1, durationInFrames);

    const frameSegments = segments.map((segment) => {
      const startFrame = Math.round(segment.startSecond * fps) + introFrames;
      const endFrame = Math.round(segment.endSecond * fps) + introFrames;
      const length = clamp(endFrame - startFrame, Math.round(1.3 * fps), Math.round(9 * fps));
      return {
        ...segment,
        startFrame: clamp(startFrame, 0, boundedTotalFrames - 1),
        durationInFrames: clamp(length, 1, boundedTotalFrames),
      };
    });

    const sorted = frameSegments
      .slice()
      .sort((a, b) => a.startFrame - b.startFrame)
      .filter((segment) => segment.startFrame < boundedTotalFrames);

    return { totalFrames: boundedTotalFrames, introFrames, outroFrames, segments: sorted };
  }, [durationInFrames, fps, plan, segments]);

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
        <Sequence from={0} durationInFrames={timeline.introFrames}>
          <IntroCard
            title={title}
            plan={plan}
            bestVersionName={bestVersionName || versions[0]?.versionName || "未命名"}
          />
        </Sequence>

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
                      sequenceStartFrame={segment.startFrame}
                      sequenceDurationInFrames={sequenceDuration}
                      planTitle={plan?.strategySummary ?? ""}
                      evalMeta={
                        plan?.evaluation
                          ? {
                              overallScore: plan.evaluation.overallScore,
                              readiness: plan.evaluation.readiness,
                            }
                          : null
                      }
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

        <Sequence
          from={Math.max(0, timeline.totalFrames - timeline.outroFrames)}
          durationInFrames={timeline.outroFrames}
        >
          <OutroCard plan={plan} />
        </Sequence>

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
  sequenceStartFrame,
  sequenceDurationInFrames,
  planTitle,
  evalMeta,
  width,
  height,
}: {
  segment: {
    timeRange: string;
    focus: string;
    label: string;
    index: number;
    visualSuggestion: string;
    packagingStyle: string;
    sellingPointIntent: string;
    transitionAndRhythm: string;
    replaceableAssets: string;
    riskNotes: string;
  };
  sequenceStartFrame: number;
  sequenceDurationInFrames: number;
  planTitle: string;
  evalMeta: { overallScore: number; readiness: "ready" | "minor-edits" | "needs-work" } | null;
  width: number;
  height: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // `useCurrentFrame()` is global; convert to sequence-local frame so every beat animates.
  const localFrameRaw = frame - sequenceStartFrame;
  const localFrame = clamp(localFrameRaw, 0, sequenceDurationInFrames);

  const enter = spring({ fps, frame: localFrame, config: { damping: 160, mass: 0.9 } });
  const exitT = interpolate(
    localFrame,
    [Math.max(0, sequenceDurationInFrames - Math.round(0.45 * fps)), sequenceDurationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const translateY =
    interpolate(enter, [0, 1], [44, 0], { extrapolateRight: "clamp" }) +
    interpolate(exitT, [0, 1], [0, -18]);
  const opacity =
    interpolate(enter, [0, 1], [0, 1], { extrapolateRight: "clamp" }) *
    interpolate(exitT, [0, 1], [1, 0]);
  const scale =
    interpolate(enter, [0, 1], [0.98, 1], { extrapolateRight: "clamp" }) *
    interpolate(exitT, [0, 1], [1, 1.02]);

  const glow = interpolate(localFrame, [0, Math.round(0.8 * fps)], [0.12, 0.34], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ padding: 72 }}>
      <div
        style={{
          height: height - 72 * 2 - 86,
          borderRadius: 30,
          border: "1px solid rgba(255,255,255,0.14)",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.22))",
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.45)",
          padding: 44,
          transform: `translateY(${translateY}px) scale(${scale})`,
          opacity,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 22,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -2,
            opacity: 0.55,
            background:
              "radial-gradient(circle at 30% 20%, rgba(107, 92, 255, 0.38), transparent 55%), radial-gradient(circle at 80% 30%, rgba(32, 217, 255, 0.22), transparent 60%), radial-gradient(circle at 40% 95%, rgba(255, 122, 74, 0.2), transparent 62%)",
            transform: `translateY(${interpolate(localFrame, [0, sequenceDurationInFrames], [18, -12])}px)`,
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 22,
          }}
        >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 26 }}>
          <div style={{ maxWidth: width - 320 }}>
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

            <div style={{ marginTop: 18 }}>
              <SubtitleText text={segment.label} />
            </div>
          </div>

          <div
            style={{
              width: 280,
              borderRadius: 26,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.22)",
              padding: 18,
              fontSize: 16,
              lineHeight: 1.4,
              opacity: 0.86,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 650 }}>结构提示</div>
              {evalMeta ? (
                <div
                  style={{
                    fontSize: 14,
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: `rgba(32, 217, 255, ${glow})`,
                    color: "rgba(0,0,0,0.85)",
                    fontWeight: 700,
                  }}
                >
                  {evalMeta.overallScore} / 100
                </div>
              ) : null}
            </div>

            <div style={{ marginTop: 10, opacity: 0.82 }}>
              {planTitle ? planTitle.slice(0, 90) : "保持“Hook → 证据 → 利益 → CTA”的节奏。"}
            </div>

            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <InfoPill label="画面" value={segment.visualSuggestion} />
              <InfoPill label="包装" value={segment.packagingStyle} />
              <InfoPill label="卖点" value={segment.sellingPointIntent} />
              <InfoPill label="节奏" value={segment.transitionAndRhythm} />
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            fontSize: 16,
            lineHeight: 1.45,
            opacity: 0.86,
          }}
        >
          <InfoBlock title="可替换素材" value={segment.replaceableAssets} fallback="（可替换为录屏 / 截图 / AIGC 画面）" />
          <InfoBlock title="风险提醒" value={segment.riskNotes} fallback="（注意信息密度、真实性与合规表述）" />
        </div>

        <div style={{ fontSize: 16, opacity: 0.6 }}>
          结构演示稿：用 Beat 卡片把“可编辑时间线”直接变成可交付视频。
        </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  const shown = (value || "").trim();
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.12)",
        padding: "10px 12px",
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: 0.3, opacity: 0.68 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 15, opacity: 0.9 }}>
        {shown.length > 70 ? `${shown.slice(0, 70)}…` : shown || "（待补充）"}
      </div>
    </div>
  );
}

function InfoBlock({
  title,
  value,
  fallback,
}: {
  title: string;
  value: string;
  fallback: string;
}) {
  const shown = (value || "").trim();
  return (
    <div
      style={{
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        padding: 18,
        background: "rgba(0,0,0,0.18)",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 650, opacity: 0.82 }}>{title}</div>
      <div style={{ marginTop: 10, fontSize: 15, opacity: 0.86 }}>
        {shown.length > 140 ? `${shown.slice(0, 140)}…` : shown || fallback}
      </div>
    </div>
  );
}

function SubtitleText({ text }: { text: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ fps, frame, config: { damping: 180 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  const cleaned = (text || "").trim();
  const shown = cleaned.length > 90 ? `${cleaned.slice(0, 90)}…` : cleaned || "（待补充口播/字幕）";

  return (
    <div
      style={{
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(0,0,0,0.22)",
        padding: "14px 18px",
        fontSize: 24,
        lineHeight: 1.35,
        opacity,
      }}
    >
      {shown}
    </div>
  );
}

function IntroCard({
  title,
  plan,
  bestVersionName,
}: {
  title: string;
  plan: LoadedPlan | null;
  bestVersionName: string;
}) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const enter = spring({ fps, frame, config: { damping: 200 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const translate = interpolate(enter, [0, 1], [28, 0]);

  const score = plan?.evaluation?.overallScore;
  const readiness = plan?.evaluation?.readiness;
  const judgePitch = plan?.evaluation?.judgePitch;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", paddingBottom: 34, opacity }}>
      <div
        style={{
          borderRadius: 34,
          border: "1px solid rgba(255,255,255,0.16)",
          background: "rgba(0,0,0,0.28)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.5)",
          padding: 40,
          transform: `translateY(${translate}px)`,
        }}
      >
        <div style={{ fontSize: 18, opacity: 0.68, letterSpacing: 0.6 }}>STRUCTURE TRANSFER DEMO</div>
        <div style={{ marginTop: 14, fontSize: 44, fontWeight: 820, lineHeight: 1.05 }}>
          {title}
        </div>
        <div style={{ marginTop: 16, fontSize: 20, opacity: 0.82 }}>
          推荐版本：{bestVersionName}
        </div>

        <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {typeof score === "number" ? (
            <Chip label="效果评分" value={`${score}/100`} />
          ) : (
            <Chip label="效果评分" value="（待评估）" />
          )}
          <Chip
            label="状态"
            value={
              readiness === "ready"
                ? "可上架"
                : readiness === "minor-edits"
                  ? "轻微打磨"
                  : readiness === "needs-work"
                    ? "需重做"
                    : "未评估"
            }
          />
          <Chip label="输出" value="可编辑时间线 → 视频" />
          <Chip label="分辨率" value={`${width}x1920`} />
        </div>

        <div style={{ marginTop: 18, fontSize: 16, lineHeight: 1.5, opacity: 0.68 }}>
          {judgePitch
            ? judgePitch.length > 120
              ? `${judgePitch.slice(0, 120)}…`
              : judgePitch
            : "这是一段可直接交付的结构演示视频：每个 Beat 都对应可编辑脚本与素材位。"}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function OutroCard({ plan }: { plan: LoadedPlan | null }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ fps, frame, config: { damping: 200 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const translate = interpolate(enter, [0, 1], [24, 0]);
  const strengths = plan?.evaluation?.strengths?.slice?.(0, 3) ?? [];

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", paddingBottom: 26, opacity }}>
      <div
        style={{
          borderRadius: 26,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.22)",
          padding: 22,
          transform: `translateY(${translate}px)`,
          display: "flex",
          justifyContent: "space-between",
          gap: 18,
        }}
      >
        <div style={{ fontSize: 16, lineHeight: 1.5, opacity: 0.72, flex: 1 }}>
          {strengths.length ? (
            <>
              <div style={{ fontWeight: 700, opacity: 0.9 }}>优势总结</div>
              <div style={{ marginTop: 8 }}>
                {strengths.map((item) => (
                  <div key={item}>- {item}</div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, opacity: 0.9 }}>下一步</div>
              <div style={{ marginTop: 8 }}>
                - 替换 Beat 卡片为真实素材（录屏/截图/AIGC）<br />
                - 补入口播/字幕与 BGM<br />- 进行 A/B 版本对比输出
              </div>
            </>
          )}
        </div>

        <div
          style={{
            width: 260,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            padding: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.85 }}>爆款结构迁移引擎</div>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.72, lineHeight: 1.45 }}>
            结构复刻 / 时间线可编辑 / 一键出片
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.06)",
        fontSize: 14,
        opacity: 0.9,
        display: "flex",
        gap: 8,
      }}
    >
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}
