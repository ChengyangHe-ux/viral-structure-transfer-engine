import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { RenderTimeline } from "@/lib/render-timeline";
import type { MigratedVideoPlan } from "@/lib/schemas";

export type CoconutLatteAigcCommercial15Props = {
  title: string;
  productName?: string;
  plan: MigratedVideoPlan | null;
  renderTimeline: RenderTimeline | null;
  imageAssets?: string[];
};

const TOTAL_FRAMES = 450;
const sceneRanges = [
  { start: 0, end: 90, accent: "#35dec0", title: "别把它当普通拿铁" },
  { start: 90, end: 210, accent: "#ffd27a", title: "椰香先出来" },
  { start: 210, end: 330, accent: "#8bd1ff", title: "下午三点轻一点醒" },
  { start: 330, end: 450, accent: "#ff6683", title: "今天下午别硬扛" },
] as const;

const fallbackImages = [
  "zhipu-video-assets/hero-cup.png",
  "zhipu-video-assets/pour-macro.png",
  "zhipu-video-assets/commute-desk-v2.png",
  "zhipu-video-assets/cta-packshot.png",
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sceneOpacity(frame: number, index: number) {
  const scene = sceneRanges[index]!;
  return (
    interpolate(frame, [scene.start, scene.start + 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    interpolate(frame, [scene.end - 16, scene.end], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
}

function sceneProgress(frame: number, index: number) {
  const scene = sceneRanges[index]!;
  return interpolate(frame, [scene.start, scene.end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
}

function localFrame(frame: number, index: number) {
  const scene = sceneRanges[index]!;
  return clamp(frame - scene.start, 0, scene.end - scene.start);
}

function assetAt(imageAssets: string[] | undefined, index: number) {
  return imageAssets?.[index] || fallbackImages[index] || fallbackImages[0];
}

export function CoconutLatteAigcCommercial15({
  title,
  productName = "生椰轻乳拿铁",
  renderTimeline,
  imageAssets,
}: CoconutLatteAigcCommercial15Props) {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: "#060807",
        color: "#fffaf0",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "PingFang SC", "Microsoft YaHei", Arial',
        overflow: "hidden",
      }}
    >
      {renderTimeline?.audioBedPath ? (
        <Audio
          src={staticFile(renderTimeline.audioBedPath)}
          volume={(audioFrame) => {
            const fadeIn = interpolate(audioFrame, [0, 24], [0, 0.96], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const fadeOut = interpolate(audioFrame, [TOTAL_FRAMES - 44, TOTAL_FRAMES], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return fadeIn * fadeOut;
          }}
        />
      ) : null}

      <AigcScene
        frame={frame}
        index={0}
        imagePath={assetAt(imageAssets, 0)}
        eyebrow="NEW / LOW SUGAR"
        headline={title || sceneRanges[0].title}
        subline="低糖、椰香、咖啡后劲，把下午三点拉回来。"
        caption={["别划走", "关键不是甜", "是喝完很轻松"]}
      />
      <AigcScene
        frame={frame}
        index={1}
        imagePath={assetAt(imageAssets, 1)}
        eyebrow="CREAMY POUR"
        headline={sceneRanges[1].title}
        subline="咖啡后劲跟上，甜感收得更轻。"
        caption={["椰香先出来", "咖啡后劲跟上", "甜感收得轻"]}
        dark
      />
      <AigcScene
        frame={frame}
        index={2}
        imagePath={assetAt(imageAssets, 2)}
        eyebrow="AFTERNOON RESET"
        headline={sceneRanges[2].title}
        subline="通勤、工位、赶作业，都要醒得柔和一点。"
        caption={["下午三点", "醒得柔和", "不腻口"]}
      />
      <AigcScene
        frame={frame}
        index={3}
        imagePath={assetAt(imageAssets, 3)}
        eyebrow="TRY TODAY"
        headline={sceneRanges[3].title}
        subline={`低糖轻乳 · ${productName}`}
        caption={["低糖轻乳", "下午三点", "来一杯"]}
        dark
        cta
      />

      <CutFlashes frame={frame} />
      <ProgressRail frame={frame} />
      <FilmGrain frame={frame} />
    </AbsoluteFill>
  );
}

function AigcScene({
  frame,
  index,
  imagePath,
  eyebrow,
  headline,
  subline,
  caption,
  dark = false,
  cta = false,
}: {
  frame: number;
  index: number;
  imagePath: string;
  eyebrow: string;
  headline: string;
  subline: string;
  caption: string[];
  dark?: boolean;
  cta?: boolean;
}) {
  const { fps } = useVideoConfig();
  const opacity = sceneOpacity(frame, index);
  const progress = sceneProgress(frame, index);
  const local = localFrame(frame, index);
  const enter = spring({ frame: local, fps, config: { damping: 160, stiffness: 190, mass: 0.78 } });
  const scene = sceneRanges[index]!;
  const textColor = dark ? "#fff8e9" : "#111716";

  return (
    <AbsoluteFill style={{ opacity }}>
      <Img
        src={staticFile(imagePath)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${1.04 + progress * 0.08}) translate3d(${interpolate(
            progress,
            [0, 1],
            [index % 2 === 0 ? -22 : 22, index % 2 === 0 ? 18 : -18],
          )}px, ${interpolate(progress, [0, 1], [18, -22])}px, 0)`,
          filter: cta ? "saturate(1.08) contrast(1.05)" : "saturate(1.14) contrast(1.06)",
        }}
      />
      <AbsoluteFill
        style={{
          background: dark
            ? "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.1) 38%, rgba(0,0,0,0.72) 100%)"
            : "linear-gradient(180deg, rgba(255,248,230,0.32) 0%, rgba(255,248,230,0.08) 40%, rgba(0,0,0,0.52) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 58,
          right: 58,
          top: cta ? 114 : 84,
          color: textColor,
          transform: `translateY(${interpolate(enter, [0, 1], [42, 0])}px)`,
          textShadow: dark
            ? "0 18px 44px rgba(0,0,0,0.46)"
            : "0 16px 46px rgba(255,255,255,0.52)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            padding: "10px 16px",
            borderRadius: 999,
            background: dark ? "rgba(0,0,0,0.52)" : "rgba(255,255,255,0.76)",
            color: scene.accent,
            fontSize: 23,
            fontWeight: 960,
            boxShadow: "0 16px 44px rgba(0,0,0,0.18)",
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            marginTop: 18,
            maxWidth: cta ? 870 : 760,
            fontSize: cta ? 90 : 82,
            lineHeight: 0.96,
            letterSpacing: 0,
            fontWeight: 990,
          }}
        >
          {headline}
        </div>
        <div
          style={{
            marginTop: 22,
            maxWidth: 760,
            fontSize: 31,
            lineHeight: 1.22,
            fontWeight: 780,
            color: dark ? "#fff2d8" : "#23312f",
          }}
        >
          {subline}
        </div>
      </div>
      {cta ? <CtaButton text={subline} accent={scene.accent} /> : null}
      <CaptionBlock frame={local} caption={caption} accent={scene.accent} dark={dark} />
      <SceneBadge index={index} accent={scene.accent} dark={dark} />
    </AbsoluteFill>
  );
}

function CaptionBlock({
  frame,
  caption,
  accent,
  dark,
}: {
  frame: number;
  caption: string[];
  accent: string;
  dark: boolean;
}) {
  const opacity = interpolate(frame, [0, 10, 104, 120], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 58,
        right: 58,
        bottom: 112,
        opacity,
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {caption.map((text, itemIndex) => {
        const active = interpolate(frame, [itemIndex * 8, itemIndex * 8 + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const highlighted = itemIndex === 0 || itemIndex === caption.length - 1;
        return (
          <div
            key={`${text}-${itemIndex}`}
            style={{
              padding: highlighted ? "12px 18px" : "8px 4px",
              borderRadius: highlighted ? 18 : 0,
              background: highlighted ? accent : "transparent",
              color: highlighted ? "#101513" : dark ? "#fff8e9" : "#fff8e9",
              fontSize: itemIndex === 1 ? 49 : 54,
              lineHeight: 1,
              fontWeight: 990,
              letterSpacing: 0,
              textShadow: highlighted ? undefined : "0 16px 34px rgba(0,0,0,0.56)",
              boxShadow: highlighted ? `0 18px 52px ${accent}66` : undefined,
              transform: `translateY(${interpolate(active, [0, 1], [20, 0])}px) scale(${
                1 + active * 0.02
              })`,
            }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}

function CtaButton({ text, accent }: { text: string; accent: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 82,
        right: 82,
        top: 1230,
        height: 92,
        borderRadius: 999,
        background: "#101513",
        color: "#fff8e9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        fontSize: 33,
        fontWeight: 980,
        boxShadow: `0 24px 72px ${accent}55`,
      }}
    >
      <span style={{ color: accent }}>TODAY</span>
      <span>{text}</span>
    </div>
  );
}

function SceneBadge({ index, accent, dark }: { index: number; accent: string; dark: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        right: 58,
        top: 72,
        width: 92,
        height: 92,
        borderRadius: "50%",
        background: dark ? "rgba(0,0,0,0.52)" : "rgba(255,255,255,0.72)",
        color: accent,
        border: `2px solid ${accent}88`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 28,
        fontWeight: 990,
        boxShadow: "0 18px 44px rgba(0,0,0,0.24)",
      }}
    >
      {String(index + 1).padStart(2, "0")}
    </div>
  );
}

function CutFlashes({ frame }: { frame: number }) {
  const opacity = [90, 210, 330].reduce((max, cut) => {
    const value = interpolate(Math.abs(frame - cut), [0, 10], [0.28, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return Math.max(max, value);
  }, 0);
  return <AbsoluteFill style={{ background: "#fff7dd", opacity, mixBlendMode: "screen" }} />;
}

function ProgressRail({ frame }: { frame: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 68,
        right: 68,
        bottom: 48,
        height: 7,
        borderRadius: 999,
        background: "rgba(255,255,255,0.28)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${clamp(frame / TOTAL_FRAMES, 0, 1) * 100}%`,
          borderRadius: 999,
          background: "linear-gradient(90deg, #35dec0, #ffd27a, #ff6683)",
        }}
      />
    </div>
  );
}

function FilmGrain({ frame }: { frame: number }) {
  return (
    <AbsoluteFill style={{ pointerEvents: "none", boxShadow: "inset 0 0 180px rgba(0,0,0,0.24)" }}>
      {Array.from({ length: 44 }).map((_, index) => (
        <div
          key={`grain-${index}`}
          style={{
            position: "absolute",
            left: `${(index * 41 + frame * 0.6) % 100}%`,
            top: `${(index * 67 + frame * 0.4) % 100}%`,
            width: 2 + (index % 3),
            height: 2 + (index % 3),
            borderRadius: "50%",
            background: index % 2 ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.1)",
            opacity: 0.2,
          }}
        />
      ))}
    </AbsoluteFill>
  );
}
