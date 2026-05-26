import { createTikTokStyleCaptions } from "@remotion/captions";
import { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { MigratedVideoPlan } from "@/lib/schemas";
import type { RenderScene, RenderTimeline } from "@/lib/render-timeline";

export type HighQualityShortProps = {
  title: string;
  plan: MigratedVideoPlan | null;
  renderTimeline: RenderTimeline | null;
};

const focusColors: Record<RenderScene["focus"], { bg: string; accent: string; label: string }> = {
  Hook: { bg: "#261021", accent: "#FFB84D", label: "抢停留" },
  证据: { bg: "#071B2D", accent: "#74D7FF", label: "可信证据" },
  收益: { bg: "#0A241D", accent: "#86F0BE", label: "收益放大" },
  包装: { bg: "#18152F", accent: "#C7B7FF", label: "包装节奏" },
  CTA: { bg: "#2D111A", accent: "#FF8DA5", label: "行动转化" },
  推进: { bg: "#111827", accent: "#D7E0EA", label: "结构推进" },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function compact(text: string, maxLength: number) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function HighQualityShort({ title, renderTimeline }: HighQualityShortProps) {
  if (!renderTimeline?.scenes.length) {
    return <EmptyHighQualityShort title={title} />;
  }

  return (
    <AbsoluteFill
      style={{
        background: "#06070B",
        color: "#FFFFFF",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "PingFang SC", "Microsoft YaHei", Arial',
        overflow: "hidden",
      }}
    >
      {renderTimeline.audioBedPath ? (
        <Audio
          src={staticFile(renderTimeline.audioBedPath)}
          volume={(frame) => {
            const fadeIn = interpolate(frame, [0, 36], [0, 0.86], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const fadeOut = interpolate(
              frame,
              [renderTimeline.totalFrames - 48, renderTimeline.totalFrames],
              [1, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );
            return fadeIn * fadeOut;
          }}
        />
      ) : null}
      <HeroIntro timeline={renderTimeline} />
      {renderTimeline.scenes.map((scene) => (
        <Sequence
          from={scene.startFrame}
          durationInFrames={scene.durationFrames}
          key={scene.id}
        >
          <HighQualityScene scene={scene} totalScenes={renderTimeline.scenes.length} />
        </Sequence>
      ))}
      <Sequence
        from={Math.max(0, renderTimeline.totalFrames - 78)}
        durationInFrames={78}
      >
        <FinalCTA timeline={renderTimeline} />
      </Sequence>
    </AbsoluteFill>
  );
}

function HeroIntro({ timeline }: { timeline: RenderTimeline }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ fps, frame, config: { damping: 190, mass: 0.85 } });
  const opacity = interpolate(frame, [0, 10, 52, 64], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(enter, [0, 1], [58, 0]);

  return (
    <AbsoluteFill
      style={{
        opacity,
        background:
          "linear-gradient(180deg, #080A12 0%, #101733 46%, #F07A38 100%)",
      }}
    >
      <NoiseGrid />
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          bottom: 170,
          transform: `translateY(${y}px)`,
        }}
      >
        <div style={{ fontSize: 24, opacity: 0.72, fontWeight: 700 }}>
          HIGH QUALITY REMOTION CUT
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 82,
            lineHeight: 0.98,
            fontWeight: 940,
            letterSpacing: 0,
          }}
        >
          {compact(timeline.coverTitle, 28)}
        </div>
        <div style={{ marginTop: 28, fontSize: 28, opacity: 0.84 }}>
          {timeline.versionName} / {timeline.scenes.length} scenes / 1080x1920
        </div>
      </div>
    </AbsoluteFill>
  );
}

function HighQualityScene({
  scene,
  totalScenes,
}: {
  scene: RenderScene;
  totalScenes: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = focusColors[scene.focus];
  const enter = spring({ fps, frame, config: { damping: 165, mass: 0.86 } });
  const localProgress = clamp(frame / scene.durationFrames, 0, 1);
  const y = interpolate(enter, [0, 1], [42, 0]);
  const scale = interpolate(localProgress, [0, 1], [1.02, 1.08]);
  const firstLayer = scene.visualLayers[0]!;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${palette.bg} 0%, #07111D 100%)`,
      }}
    >
      <NoiseGrid />
      <div
        style={{
          position: "absolute",
          left: 62,
          right: 62,
          top: 70,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 22, opacity: 0.68 }}>Scene {scene.index + 1}</div>
          <div style={{ marginTop: 8, fontSize: 30, fontWeight: 860 }}>{palette.label}</div>
        </div>
        <div
          style={{
            minWidth: 132,
            padding: "12px 16px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.13)",
            border: "1px solid rgba(255,255,255,0.2)",
            textAlign: "center",
            fontSize: 20,
            fontWeight: 820,
          }}
        >
          {String(scene.index + 1).padStart(2, "0")} / {String(totalScenes).padStart(2, "0")}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 58,
          right: 58,
          top: 212,
          height: 830,
          borderRadius: 34,
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(255,255,255,0.34) 42%, rgba(255,255,255,0.08))",
          border: "1px solid rgba(255,255,255,0.32)",
        boxShadow: "0 36px 110px rgba(0,0,0,0.34)",
        overflow: "hidden",
        transform: `translateY(${y}px) scale(${scale})`,
      }}
    >
        <MaterialStage layer={firstLayer} palette={palette} progress={localProgress} />
        <div
          style={{
            position: "absolute",
            left: 56,
            top: 54,
            padding: "14px 18px",
            borderRadius: 12,
            background: "rgba(7, 10, 18, 0.52)",
            color: "#FFFFFF",
            border: "1px solid rgba(255,255,255,0.2)",
            fontSize: 24,
            fontWeight: 820,
          }}
        >
          {scene.title}
        </div>
        <div
          style={{
            position: "absolute",
            left: 94,
            top: 238,
            width: 360,
            height: 360,
            borderRadius: 28,
            background: "#FFFFFF",
            color: "#111827",
            padding: 28,
            boxShadow: "0 26px 78px rgba(0,0,0,0.26)",
          }}
        >
          <div style={{ height: 142, borderRadius: 12, overflow: "hidden" }}>
            <MiniMaterialPreview layer={firstLayer} palette={palette} />
          </div>
          <div style={{ marginTop: 24, fontSize: 28, fontWeight: 900 }}>
            {compact(firstLayer.slotName, 12)}
          </div>
          <div style={{ marginTop: 12, fontSize: 18, lineHeight: 1.35, opacity: 0.68 }}>
            {compact(firstLayer.label, 44)}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 58,
            bottom: 58,
            width: 390,
            padding: "18px 20px",
            borderRadius: 14,
            background: "rgba(7,10,18,0.55)",
            color: "#FFFFFF",
            border: `1px solid ${palette.accent}`,
            fontSize: 20,
            lineHeight: 1.34,
          }}
        >
          <div style={{ color: palette.accent, fontWeight: 860 }}>素材状态：{scene.materialFit}</div>
          <div style={{ marginTop: 8 }}>{compact(scene.completionPlan, 58)}</div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          bottom: 190,
          padding: "26px 30px",
          borderRadius: 18,
          background: "rgba(3,7,18,0.78)",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 26px 84px rgba(0,0,0,0.34)",
        }}
      >
        <div
          style={{
            fontSize: 56,
            lineHeight: 1.08,
            fontWeight: 940,
            letterSpacing: 0,
          textShadow: "0 12px 32px rgba(0,0,0,0.34)",
        }}
      >
          <KineticCaptionLayer scene={scene} />
        </div>
      </div>
      <RhythmRail scene={scene} />
    </AbsoluteFill>
  );
}

function MaterialStage({
  layer,
  palette,
  progress,
}: {
  layer: RenderScene["visualLayers"][number];
  palette: (typeof focusColors)[RenderScene["focus"]];
  progress: number;
}) {
  const src = layer.src ? staticFile(layer.src) : null;

  return (
    <AbsoluteFill>
      {src && layer.kind === "video" ? (
        <OffthreadVideo
          src={src}
          muted
          delayRenderTimeoutInMilliseconds={120000}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${1.05 + progress * 0.12})`,
            filter: "saturate(1.18) contrast(1.05) brightness(0.92)",
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.24), rgba(255,255,255,0.08) 52%, rgba(0,0,0,0.18))",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 92,
              right: 92,
              top: 118,
              height: 420,
              borderRadius: 26,
              background: `linear-gradient(135deg, ${palette.accent}, rgba(255,255,255,0.74))`,
              boxShadow: "0 34px 90px rgba(0,0,0,0.2)",
              transform: `translateY(${interpolate(progress, [0, 1], [24, -18])}px)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 134,
              right: 134,
              top: 176,
              height: 260,
              borderRadius: 18,
              background: "rgba(255,255,255,0.84)",
              boxShadow: "inset 0 0 0 1px rgba(17,24,39,0.08)",
            }}
          />
        </AbsoluteFill>
      )}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.04) 38%, rgba(0,0,0,0.46) 100%)",
        }}
      />
    </AbsoluteFill>
  );
}

function MiniMaterialPreview({
  layer,
  palette,
}: {
  layer: RenderScene["visualLayers"][number];
  palette: (typeof focusColors)[RenderScene["focus"]];
}) {
  if (layer.kind === "video" && layer.src) {
    return (
      <OffthreadVideo
        src={staticFile(layer.src)}
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "saturate(1.1)",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: `linear-gradient(135deg, ${palette.accent}, rgba(17,24,39,0.16))`,
      }}
    />
  );
}

function KineticCaptionLayer({ scene }: { scene: RenderScene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = ((scene.startFrame + frame) / fps) * 1000;
  const pages = useMemo(
    () =>
      createTikTokStyleCaptions({
        captions: scene.captionTokens.map((token) => ({
          text: token.text,
          startMs: token.startMs,
          endMs: token.endMs,
          timestampMs: null,
          confidence: null,
        })),
        combineTokensWithinMilliseconds: 900,
      }).pages,
    [scene.captionTokens],
  );
  const activePage =
    pages.find((page) => currentMs >= page.startMs && currentMs <= page.startMs + page.durationMs) ??
    pages[0];

  if (!activePage) return compact(scene.subtitle, 36);

  return (
    <span>
      {activePage.tokens.map((token) => {
        const active = currentMs >= token.fromMs && currentMs <= token.toMs;
        return (
          <span
            key={`${token.text}-${token.fromMs}`}
            style={{
              display: "inline-block",
              marginRight: 8,
              color: active || /省|结果|关键|领取|收藏|错|变化|第一|真正/i.test(token.text)
                ? "#FFE08A"
                : "#FFFFFF",
              transform: active ? "translateY(-4px) scale(1.05)" : "translateY(0) scale(1)",
              textShadow: active
                ? "0 8px 24px rgba(255,184,77,0.4)"
                : "0 12px 32px rgba(0,0,0,0.34)",
            }}
          >
            {token.text}
          </span>
        );
      })}
    </span>
  );
}

function RhythmRail({ scene }: { scene: RenderScene }) {
  const frame = useCurrentFrame();
  const cueProgress = scene.audioCues.map((cue) => {
    const localCueFrame = cue.atFrame - scene.startFrame;
    const distance = Math.abs(frame - localCueFrame);
    return {
      ...cue,
      pulse: interpolate(distance, [0, 18], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    };
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        right: 72,
        bottom: 110,
        height: 10,
        borderRadius: 999,
        background: "rgba(255,255,255,0.12)",
        overflow: "hidden",
      }}
    >
      {cueProgress.map((cue) => (
        <div
          key={`${cue.type}-${cue.atFrame}`}
          style={{
            position: "absolute",
            left: `${clamp(((cue.atFrame - scene.startFrame) / scene.durationFrames) * 100, 0, 100)}%`,
            top: 0,
            width: 42 + cue.pulse * 58,
            height: "100%",
            borderRadius: 999,
            background:
              cue.type === "cta"
                ? "#FF8DA5"
                : cue.type === "hit"
                  ? "#FFB84D"
                  : "rgba(255,255,255,0.82)",
            opacity: 0.38 + cue.pulse * 0.62,
            transform: "translateX(-50%)",
          }}
        />
      ))}
    </div>
  );
}

function FinalCTA({ timeline }: { timeline: RenderTimeline }) {
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #111827 0%, #2D111A 100%)",
        justifyContent: "center",
        alignItems: "center",
        padding: 72,
        textAlign: "center",
      }}
    >
      <NoiseGrid />
      <div style={{ fontSize: 34, color: "#FF8DA5", fontWeight: 900 }}>READY TO RENDER</div>
      <div style={{ marginTop: 22, fontSize: 76, lineHeight: 1, fontWeight: 950 }}>
        {compact(timeline.captionTitle, 30)}
      </div>
      <div style={{ marginTop: 28, fontSize: 24, opacity: 0.78 }}>
        RenderTimeline JSON → Remotion whitelist components → MP4
      </div>
    </AbsoluteFill>
  );
}

function EmptyHighQualityShort({ title }: { title: string }) {
  return (
    <AbsoluteFill
      style={{
        background: "#080A12",
        color: "white",
        justifyContent: "center",
        alignItems: "center",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "PingFang SC", "Microsoft YaHei", Arial',
      }}
    >
      <div style={{ fontSize: 70, fontWeight: 900 }}>等待 RenderTimeline</div>
      <div style={{ marginTop: 18, fontSize: 28, opacity: 0.75 }}>{title}</div>
    </AbsoluteFill>
  );
}

function NoiseGrid() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: 0.28,
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
        backgroundSize: "96px 96px",
      }}
    />
  );
}
