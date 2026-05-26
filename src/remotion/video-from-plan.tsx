import { Fragment, useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { type MigratedVideoPlan } from "@/lib/schemas";
import {
  classifyBeatFocus,
  compactText,
  extractHighlightText,
  getFocusSceneStyle,
  getMaterialFitSummary,
  splitSubtitleLines,
  type BeatFocus,
  type FocusSceneStyle,
} from "@/remotion/video-style";
import { calculateVideoFramesFromPlan } from "@/remotion/video-metadata";

type LoadedPlan = MigratedVideoPlan & { evaluation?: MigratedVideoPlan["evaluation"] };
type MaterialSlot = NonNullable<LoadedPlan["materialAdaptation"]>["slots"][number];

export type VideoFromPlanProps = {
  title: string;
  plan: LoadedPlan | null;
};

type Segment = {
  index: number;
  timeRange: string;
  startSecond: number;
  endSecond: number;
  focus: BeatFocus;
  shotPurpose: string;
  label: string;
  visualSuggestion: string;
  packagingStyle: string;
  sellingPointIntent: string;
  transitionAndRhythm: string;
  replaceableAssets: string;
  riskNotes: string;
  materialSlot: MaterialSlot | null;
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

function pickMaterialSlot({
  slots,
  index,
  focus,
}: {
  slots: MaterialSlot[] | undefined;
  index: number;
  focus: BeatFocus;
}) {
  if (!slots?.length) return null;
  const patterns: Record<BeatFocus, RegExp> = {
    Hook: /开头|吸引|结果|反差|hook/i,
    证据: /证据|背书|对比|特写|主体|商品/i,
    收益: /使用|过程|场景|收益|结果/i,
    包装: /包装|字幕|封面|标题|贴纸/i,
    CTA: /结尾|行动|cta|转化|入口/i,
    推进: /过程|主体|场景/i,
  };
  const matched = slots.find((slot) =>
    patterns[focus].test(`${slot.slotName} ${slot.requiredFor} ${slot.requiredMaterial}`),
  );
  return matched ?? slots[index] ?? slots[index % slots.length] ?? null;
}

function fitLabelToReadiness(readiness?: NonNullable<LoadedPlan["evaluation"]>["readiness"]) {
  if (readiness === "ready") return "可交付";
  if (readiness === "minor-edits") return "可打磨";
  if (readiness === "needs-work") return "需返工";
  return "待评估";
}

export function VideoFromPlan({ title, plan }: VideoFromPlanProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const { version, bestVersionName } = useMemo(() => {
    if (!plan) return { version: null, bestVersionName: "" };
    const bestVersion =
      plan.versions.find((item) => item.versionName === plan.evaluation?.bestVersion) ??
      plan.versions[0] ??
      null;
    return {
      version: bestVersion,
      bestVersionName: plan.evaluation?.bestVersion || bestVersion?.versionName || "",
    };
  }, [plan]);

  const segments = useMemo<Segment[]>(() => {
    if (!plan || !version) return [];
    return version.scriptBeats.map((beat, index) => {
      const parsed = parseTimeRangeSeconds(beat.timeRange);
      const startSecond = parsed ? parsed.start : index * 4;
      const endSecond = parsed ? parsed.end : startSecond + 4;
      const focus = classifyBeatFocus(
        `${beat.shotPurpose} ${beat.sellingPointIntent} ${beat.packagingStyle} ${beat.transitionAndRhythm}`,
      );

      return {
        index,
        timeRange: beat.timeRange,
        startSecond,
        endSecond,
        focus,
        shotPurpose: beat.shotPurpose,
        label: beat.voiceoverOrSubtitle,
        visualSuggestion: beat.visualSuggestion,
        packagingStyle: beat.packagingStyle,
        sellingPointIntent: beat.sellingPointIntent,
        transitionAndRhythm: beat.transitionAndRhythm,
        replaceableAssets: beat.replaceableAssets,
        riskNotes: beat.riskNotes,
        materialSlot: pickMaterialSlot({
          slots: plan.materialAdaptation?.slots,
          index,
          focus,
        }),
      };
    });
  }, [plan, version]);

  const timeline = useMemo(() => {
    const introFrames = Math.round(2.1 * fps);
    const outroFrames = Math.round(2.4 * fps);
    const { totalFrames } = calculateVideoFramesFromPlan({ plan, fps });
    const boundedTotalFrames = clamp(totalFrames, 1, durationInFrames);

    const frameSegments = segments
      .map((segment) => {
        const startFrame = Math.round(segment.startSecond * fps) + introFrames;
        const endFrame = Math.round(segment.endSecond * fps) + introFrames;
        const length = clamp(endFrame - startFrame, Math.round(1.4 * fps), Math.round(8.5 * fps));
        return {
          ...segment,
          startFrame: clamp(startFrame, 0, boundedTotalFrames - 1),
          durationInFrames: clamp(length, 1, boundedTotalFrames),
        };
      })
      .sort((a, b) => a.startFrame - b.startFrame)
      .filter((segment) => segment.startFrame < boundedTotalFrames);

    return {
      totalFrames: boundedTotalFrames,
      introFrames,
      outroFrames,
      segments: frameSegments,
    };
  }, [durationInFrames, fps, plan, segments]);

  if (!plan || !version || timeline.segments.length === 0) {
    return <NoPlanScene title={title} />;
  }

  return (
    <AbsoluteFill
      style={{
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "PingFang SC", "Microsoft YaHei", Arial',
        backgroundColor: "#080A0F",
        color: "white",
        overflow: "hidden",
      }}
    >
      <Sequence from={0} durationInFrames={timeline.introFrames}>
        <IntroScene
          title={title}
          versionName={bestVersionName || version.versionName}
          plan={plan}
        />
      </Sequence>

      {timeline.segments.map((segment, index) => {
        const isLast = index === timeline.segments.length - 1;
        const duration = isLast
          ? Math.max(1, timeline.totalFrames - segment.startFrame)
          : segment.durationInFrames;

        return (
          <Fragment key={`${segment.index}-${segment.timeRange}`}>
            <Sequence from={segment.startFrame} durationInFrames={duration}>
              <BeatScene
                segment={segment}
                sequenceDurationInFrames={duration}
                totalSegments={timeline.segments.length}
                projectTitle={plan.projectTitle || title}
                versionName={version.versionName}
              />
            </Sequence>
          </Fragment>
        );
      })}

      <Sequence
        from={Math.max(0, timeline.totalFrames - timeline.outroFrames)}
        durationInFrames={timeline.outroFrames}
      >
        <OutroScene plan={plan} title={title} />
      </Sequence>

      <GlobalProgress frame={frame} totalFrames={timeline.totalFrames} />
    </AbsoluteFill>
  );
}

function IntroScene({
  title,
  versionName,
  plan,
}: {
  title: string;
  versionName: string;
  plan: LoadedPlan;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = getFocusSceneStyle("Hook");
  const enter = spring({ fps, frame, config: { damping: 170, mass: 0.78 } });
  const fade = interpolate(frame, [0, 12, Math.round(1.9 * fps), Math.round(2.1 * fps)], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lift = interpolate(enter, [0, 1], [64, 0]);
  const score = plan.evaluation?.overallScore;

  return (
    <AbsoluteFill style={{ background: style.sceneGradient, opacity: fade }}>
      <SceneTexture style={style} localFrame={frame} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.26) 58%, rgba(0,0,0,0.52))",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 74,
          right: 74,
          top: 136,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 24,
          color: style.ink,
        }}
      >
        <span style={{ fontWeight: 800 }}>爆款结构迁移引擎</span>
        <span style={{ opacity: 0.74 }}>VIDEO PREVIEW</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          bottom: 190,
          transform: `translateY(${lift}px)`,
        }}
      >
        <div
          style={{
            width: 156,
            height: 8,
            borderRadius: 999,
            background: style.accent,
            boxShadow: `0 0 34px ${style.accent}`,
          }}
        />
        <div
          style={{
            marginTop: 34,
            fontSize: 94,
            lineHeight: 0.98,
            fontWeight: 920,
            letterSpacing: 0,
            textShadow: "0 28px 74px rgba(0,0,0,0.42)",
          }}
        >
          结构迁移
          <br />
          成片预览
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 36,
            lineHeight: 1.18,
            maxWidth: 840,
            opacity: 0.9,
            fontWeight: 650,
          }}
        >
          {compactText(title, 36)}
        </div>
        <div style={{ marginTop: 32, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <IntroChip label="主版本" value={versionName || "未命名"} />
          <IntroChip label="评分" value={typeof score === "number" ? `${score}/100` : "待评估"} />
          <IntroChip label="状态" value={fitLabelToReadiness(plan.evaluation?.readiness)} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

function BeatScene({
  segment,
  sequenceDurationInFrames,
  totalSegments,
  projectTitle,
  versionName,
}: {
  segment: Segment;
  sequenceDurationInFrames: number;
  totalSegments: number;
  projectTitle: string;
  versionName: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = clamp(frame, 0, sequenceDurationInFrames);
  const style = getFocusSceneStyle(segment.focus, segment.index);
  const material = getMaterialFitSummary(segment.materialSlot?.fit);
  const enter = spring({ fps, frame: localFrame, config: { damping: 160, mass: 0.82 } });
  const exit = interpolate(
    localFrame,
    [Math.max(0, sequenceDurationInFrames - Math.round(0.45 * fps)), sequenceDurationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const opacity =
    interpolate(enter, [0, 1], [0, 1], { extrapolateRight: "clamp" }) *
    interpolate(exit, [0, 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(enter, [0, 1], [54, 0], { extrapolateRight: "clamp" });
  const scale = interpolate(localFrame, [0, sequenceDurationInFrames], [1.04, 1.13], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const subtitleLines = splitSubtitleLines(segment.label, 15, 3);
  const highlight = extractHighlightText(segment.sellingPointIntent || segment.shotPurpose, 7);
  const localProgress = clamp(localFrame / Math.max(1, sequenceDurationInFrames), 0, 1);

  return (
    <AbsoluteFill style={{ background: style.sceneGradient, color: style.ink, opacity }}>
      <SceneTexture style={style} localFrame={localFrame} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.16) 52%, rgba(0,0,0,0.58) 100%)",
        }}
      />
      <TopBar
        style={style}
        projectTitle={projectTitle}
        versionName={versionName}
        segment={segment}
        totalSegments={totalSegments}
      />
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 150,
          fontSize: 126,
          lineHeight: 0.86,
          fontWeight: 940,
          opacity: 0.13,
          color: "#FFFFFF",
          transform: `translateY(${interpolate(localProgress, [0, 1], [0, -38])}px)`,
        }}
      >
        {style.label}
      </div>

      <VisualStage
        segment={segment}
        style={style}
        material={material}
        localFrame={localFrame}
        sequenceDurationInFrames={sequenceDurationInFrames}
        scale={scale}
        translateY={y}
      />

      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          bottom: 268,
          transform: `translateY(${y * 0.45}px)`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderRadius: 999,
            background: style.accentSoft,
            color: style.ink,
            border: `1px solid ${style.accent}`,
            fontSize: 24,
            fontWeight: 850,
            boxShadow: `0 16px 44px ${style.accentSoft}`,
          }}
        >
          <span>{style.label}</span>
          <span style={{ opacity: 0.72 }}>/</span>
          <span>{highlight}</span>
        </div>

        <div
          style={{
            marginTop: 20,
            padding: "28px 32px",
            borderRadius: 18,
            background: style.captionBackground,
            border: "1px solid rgba(255,255,255,0.22)",
            boxShadow: "0 28px 86px rgba(0,0,0,0.34)",
          }}
        >
          {subtitleLines.map((line, index) => (
            <div
              key={`${line}-${index}`}
              style={{
                fontSize: 58,
                lineHeight: 1.07,
                fontWeight: 920,
                letterSpacing: 0,
                textShadow: "0 12px 34px rgba(0,0,0,0.42)",
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>

      <PackagingStrip
        style={style}
        packaging={segment.packagingStyle}
        rhythm={segment.transitionAndRhythm}
        risk={segment.riskNotes}
        localProgress={localProgress}
      />
    </AbsoluteFill>
  );
}

function TopBar({
  style,
  projectTitle,
  versionName,
  segment,
  totalSegments,
}: {
  style: FocusSceneStyle;
  projectTitle: string;
  versionName: string;
  segment: Segment;
  totalSegments: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        top: 70,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        color: style.ink,
        zIndex: 5,
      }}
    >
      <div>
        <div style={{ fontSize: 22, opacity: 0.72, fontWeight: 650 }}>
          {compactText(projectTitle, 24)}
        </div>
        <div style={{ marginTop: 8, fontSize: 17, opacity: 0.58 }}>
          {versionName} / {segment.timeRange}
        </div>
      </div>
      <div
        style={{
          padding: "13px 16px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.13)",
          border: "1px solid rgba(255,255,255,0.22)",
          fontSize: 20,
          fontWeight: 850,
          minWidth: 126,
          textAlign: "center",
        }}
      >
        {String(segment.index + 1).padStart(2, "0")} / {String(totalSegments).padStart(2, "0")}
      </div>
    </div>
  );
}

function VisualStage({
  segment,
  style,
  material,
  localFrame,
  sequenceDurationInFrames,
  scale,
  translateY,
}: {
  segment: Segment;
  style: FocusSceneStyle;
  material: ReturnType<typeof getMaterialFitSummary>;
  localFrame: number;
  sequenceDurationInFrames: number;
  scale: number;
  translateY: number;
}) {
  const progress = clamp(localFrame / Math.max(1, sequenceDurationInFrames), 0, 1);
  const phoneTilt = interpolate(progress, [0, 1], [-1.5, 1.8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scan = interpolate(localFrame % 70, [0, 70], [-100, 780]);

  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        right: 72,
        top: 258,
        height: 815,
        borderRadius: 38,
        overflow: "hidden",
        background: style.heroGradient,
        border: "1px solid rgba(255,255,255,0.34)",
        boxShadow: "0 38px 110px rgba(0,0,0,0.36)",
        transform: `translateY(${translateY}px) scale(${scale}) rotate(${phoneTilt}deg)`,
        transformOrigin: "center center",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.7,
          background: style.texture,
          backgroundSize: "84px 84px",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: scan,
          top: -120,
          width: 150,
          height: 1100,
          transform: "rotate(16deg)",
          background:
            "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.34), rgba(255,255,255,0))",
          opacity: 0.7,
        }}
      />
      <ShotMockup segment={segment} style={style} progress={progress} />
      <MaterialBadge segment={segment} material={material} />
      <RhythmMeter style={style} progress={progress} />
    </div>
  );
}

function ShotMockup({
  segment,
  style,
  progress,
}: {
  segment: Segment;
  style: FocusSceneStyle;
  progress: number;
}) {
  const title = compactText(segment.shotPurpose, 18);
  const visual = compactText(segment.visualSuggestion, 42);
  const asset = compactText(segment.materialSlot?.slotName || segment.replaceableAssets, 16);
  const move = interpolate(progress, [0, 1], [0, -26], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 48,
          top: 52,
          width: 360,
          minHeight: 104,
          borderRadius: 8,
          background: "rgba(7,10,18,0.38)",
          border: "1px solid rgba(255,255,255,0.24)",
          color: style.ink,
          padding: "18px 22px",
          boxShadow: "0 18px 46px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ fontSize: 18, opacity: 0.72 }}>镜头目的</div>
        <div
          style={{
            marginTop: 8,
            fontSize: 27,
            lineHeight: 1.12,
            fontWeight: 900,
            textShadow: "0 10px 28px rgba(0,0,0,0.32)",
          }}
        >
          {title}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 74,
          top: 218 + move,
          width: 470,
          height: 470,
          borderRadius: 999,
          background: "rgba(255,255,255,0.22)",
          border: "1px solid rgba(255,255,255,0.36)",
          boxShadow: `0 0 90px ${style.accentSoft}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 148,
          top: 284 + move,
          width: 322,
          height: 346,
          borderRadius: 36,
          background: "rgba(255,255,255,0.82)",
          color: "#121722",
          padding: 28,
          boxShadow: "0 22px 58px rgba(0,0,0,0.22)",
        }}
      >
        <div
          style={{
            height: 150,
            borderRadius: 10,
            background:
              "linear-gradient(135deg, rgba(15,23,42,0.08), rgba(15,23,42,0.2))",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 24,
              right: 24,
              bottom: 26,
              height: 12,
              borderRadius: 99,
              background: style.accent,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 40,
              top: 34,
              width: 88,
              height: 88,
              borderRadius: 999,
              background: style.accentSoft,
              border: `2px solid ${style.accent}`,
            }}
          />
        </div>
        <div style={{ marginTop: 22, fontSize: 23, fontWeight: 900, lineHeight: 1.15 }}>
          {asset}
        </div>
        <div style={{ marginTop: 12, fontSize: 17, lineHeight: 1.35, opacity: 0.7 }}>
          {visual}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 58,
          top: 156,
          width: 330,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          transform: `translateY(${move * 0.5}px)`,
        }}
      >
        <FloatingNote title="卖点推进" value={segment.sellingPointIntent} style={style} index={0} />
        <FloatingNote title="转场节奏" value={segment.transitionAndRhythm} style={style} index={1} />
        <FloatingNote title="补全方式" value={segment.materialSlot?.completionPlan || segment.replaceableAssets} style={style} index={2} />
      </div>
    </>
  );
}

function FloatingNote({
  title,
  value,
  style,
  index,
}: {
  title: string;
  value: string;
  style: FocusSceneStyle;
  index: number;
}) {
  return (
    <div
      style={{
        borderRadius: 12,
        background: "rgba(7, 10, 18, 0.42)",
        border: "1px solid rgba(255,255,255,0.2)",
        padding: "18px 20px",
        color: style.ink,
        boxShadow: "0 18px 44px rgba(0,0,0,0.22)",
        marginLeft: index % 2 === 0 ? 0 : 34,
      }}
    >
      <div style={{ fontSize: 17, color: style.accent, fontWeight: 820 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 20, lineHeight: 1.32, fontWeight: 680 }}>
        {compactText(value, 36)}
      </div>
    </div>
  );
}

function MaterialBadge({
  segment,
  material,
}: {
  segment: Segment;
  material: ReturnType<typeof getMaterialFitSummary>;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 48,
        right: 48,
        bottom: 42,
        borderRadius: 14,
        background: material.background,
        border: `1px solid ${material.tone}`,
        padding: "16px 18px",
        display: "flex",
        justifyContent: "space-between",
        gap: 18,
        alignItems: "center",
        color: "#FFFFFF",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: 999,
            background: material.tone,
            boxShadow: `0 0 18px ${material.tone}`,
          }}
        />
        <div style={{ fontSize: 22, fontWeight: 860 }}>{material.label}</div>
      </div>
      <div
        style={{
          fontSize: 18,
          opacity: 0.86,
          textAlign: "right",
          maxWidth: 590,
          lineHeight: 1.28,
        }}
      >
        {compactText(
          segment.materialSlot
            ? `${segment.materialSlot.slotName}：${segment.materialSlot.completionPlan}`
            : segment.replaceableAssets,
          54,
        )}
      </div>
    </div>
  );
}

function RhythmMeter({
  style,
  progress,
}: {
  style: FocusSceneStyle;
  progress: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        right: 44,
        bottom: 126,
        display: "flex",
        alignItems: "flex-end",
        gap: 7,
      }}
    >
      {Array.from({ length: 12 }).map((_, index) => {
        const active = index / 12 <= progress;
        const height = 24 + ((index * 17) % 54);
        return (
          <div
            key={index}
            style={{
              width: 9,
              height,
              borderRadius: 99,
              background: active ? style.accent : "rgba(255,255,255,0.24)",
              opacity: active ? 1 : 0.6,
            }}
          />
        );
      })}
    </div>
  );
}

function PackagingStrip({
  style,
  packaging,
  rhythm,
  risk,
  localProgress,
}: {
  style: FocusSceneStyle;
  packaging: string;
  rhythm: string;
  risk: string;
  localProgress: number;
}) {
  const chips = [
    { label: "字幕包装", value: packaging },
    { label: "镜头节奏", value: rhythm },
    { label: "风险边界", value: risk },
  ];

  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        right: 72,
        bottom: 126,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 14,
      }}
    >
      {chips.map((chip, index) => (
        <div
          key={chip.label}
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.17)",
            background: "rgba(255,255,255,0.08)",
            padding: "14px 16px",
            minHeight: 86,
            opacity: interpolate(localProgress, [0, 0.16 + index * 0.08], [0.58, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div style={{ fontSize: 15, color: style.accent, fontWeight: 850 }}>{chip.label}</div>
          <div style={{ marginTop: 7, fontSize: 17, lineHeight: 1.28, opacity: 0.84 }}>
            {compactText(chip.value, 34)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SceneTexture({ style, localFrame }: { style: FocusSceneStyle; localFrame: number }) {
  const drift = interpolate(localFrame, [0, 220], [0, -42], {
    extrapolateLeft: "clamp",
    extrapolateRight: "extend",
  });

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: style.texture,
          backgroundSize: "118px 118px",
          opacity: 0.64,
          transform: `translateY(${drift}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -180,
          top: 190 + drift * 0.3,
          width: 620,
          height: 620,
          borderRadius: 999,
          background: style.accentSoft,
          filter: "blur(8px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -150,
          top: 640 - drift * 0.2,
          width: 520,
          height: 760,
          borderRadius: 36,
          border: "1px solid rgba(255,255,255,0.18)",
          transform: "rotate(-8deg)",
          background: "rgba(255,255,255,0.06)",
        }}
      />
    </>
  );
}

function GlobalProgress({ frame, totalFrames }: { frame: number; totalFrames: number }) {
  const width = `${clamp((frame / Math.max(1, totalFrames)) * 100, 0, 100)}%`;

  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        right: 72,
        bottom: 54,
        height: 8,
        borderRadius: 999,
        background: "rgba(255,255,255,0.18)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width,
          height: "100%",
          borderRadius: 999,
          background: "linear-gradient(90deg, #FFB84D, #74D7FF, #86F0BE, #FF8DA5)",
        }}
      />
    </div>
  );
}

function OutroScene({ plan, title }: { plan: LoadedPlan; title: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = getFocusSceneStyle("CTA");
  const enter = spring({ fps, frame, config: { damping: 175, mass: 0.82 } });
  const y = interpolate(enter, [0, 1], [44, 0]);
  const strengths = plan.evaluation?.strengths?.slice(0, 3) ?? [];

  return (
    <AbsoluteFill style={{ background: style.sceneGradient, color: style.ink }}>
      <SceneTexture style={style} localFrame={frame} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.38) 54%, rgba(0,0,0,0.66))",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          bottom: 168,
          transform: `translateY(${y}px)`,
        }}
      >
        <div
          style={{
            fontSize: 30,
            color: style.accent,
            fontWeight: 850,
            letterSpacing: 0,
          }}
        >
          输出完成
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 82,
            lineHeight: 1,
            fontWeight: 940,
            textShadow: "0 22px 64px rgba(0,0,0,0.38)",
          }}
        >
          可替换素材
          <br />
          直接开剪
        </div>
        <div style={{ marginTop: 28, fontSize: 28, lineHeight: 1.35, opacity: 0.84 }}>
          {compactText(title, 42)}
        </div>
        <div style={{ marginTop: 36, display: "grid", gap: 14 }}>
          {(strengths.length
            ? strengths
            : ["结构迁移、素材缺口、包装补全都已落到时间线。", "导出 JSON/Markdown 后可继续人工微调。"]
          ).map((item) => (
            <div
              key={item}
              style={{
                borderRadius: 12,
                padding: "16px 18px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.16)",
                fontSize: 22,
                lineHeight: 1.32,
              }}
            >
              {compactText(item, 48)}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function NoPlanScene({ title }: { title: string }) {
  const style = getFocusSceneStyle("推进");
  return (
    <AbsoluteFill
      style={{
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "PingFang SC", "Microsoft YaHei", Arial',
        background: style.sceneGradient,
        color: style.ink,
      }}
    >
      <SceneTexture style={style} localFrame={0} />
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          bottom: 190,
        }}
      >
        <div style={{ fontSize: 84, lineHeight: 1, fontWeight: 940 }}>等待方案 JSON</div>
        <div style={{ marginTop: 26, fontSize: 30, opacity: 0.82 }}>
          {compactText(title, 42)}
        </div>
        <div style={{ marginTop: 32, fontSize: 22, lineHeight: 1.45, opacity: 0.74 }}>
          使用 `npm run video:render -- --input cases/generated/demo-学习平板.json --out renders/demo.mp4`
          生成竖屏预览。
        </div>
      </div>
    </AbsoluteFill>
  );
}

function IntroChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "13px 16px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.13)",
        border: "1px solid rgba(255,255,255,0.2)",
        display: "flex",
        gap: 10,
        fontSize: 20,
      }}
    >
      <span style={{ opacity: 0.68 }}>{label}</span>
      <span style={{ fontWeight: 850 }}>{value}</span>
    </div>
  );
}
