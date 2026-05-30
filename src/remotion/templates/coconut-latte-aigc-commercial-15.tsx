import { LightLeak } from "@remotion/light-leaks";
import { CameraMotionBlur } from "@remotion/motion-blur";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  Video,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { RenderTimeline } from "@/lib/render-timeline";
import {
  heroVideoApprovalFlag,
  isSceneVideoAllowed,
  type SceneAssetDecision,
} from "@/lib/render-policy";
import type { MigratedVideoPlan } from "@/lib/schemas";
import { calculateSceneOpacity } from "@/remotion/video-style";

export type CoconutLatteAigcCommercial15Props = {
  title: string;
  productName?: string;
  plan: MigratedVideoPlan | null;
  renderTimeline: RenderTimeline | null;
  imageAssets?: string[];
  videoAssets?: string[];
  sceneAssetDecisions?: SceneAssetDecision[];
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
  return calculateSceneOpacity({
    frame,
    start: scene.start,
    end: scene.end,
    fadeInFrames: 12,
    fadeOutFrames: 16,
    overlapInFrames: 14,
  });
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

function videoAt(videoAssets: string[] | undefined, index: number) {
  return videoAssets?.[index] || null;
}

function decisionAt(sceneAssetDecisions: SceneAssetDecision[] | undefined, index: number) {
  return sceneAssetDecisions?.find((decision) => decision.sceneIndex === index);
}

function imageForScene({
  imageAssets,
  sceneAssetDecisions,
  index,
}: {
  imageAssets: string[] | undefined;
  sceneAssetDecisions: SceneAssetDecision[] | undefined;
  index: number;
}) {
  return decisionAt(sceneAssetDecisions, index)?.imagePath || assetAt(imageAssets, index);
}

function videoForScene({
  videoAssets,
  sceneAssetDecisions,
  index,
}: {
  videoAssets: string[] | undefined;
  sceneAssetDecisions: SceneAssetDecision[] | undefined;
  index: number;
}) {
  const decision = decisionAt(sceneAssetDecisions, index);
  if (decision) {
    return isSceneVideoAllowed(decision) ? decision.videoPath : null;
  }
  if (index === 0) return null;
  return videoAt(videoAssets, index);
}

export function CoconutLatteAigcCommercial15({
  title,
  productName = "生椰轻乳拿铁",
  renderTimeline,
  imageAssets,
  videoAssets,
  sceneAssetDecisions,
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
        imagePath={imageForScene({ imageAssets, sceneAssetDecisions, index: 0 })}
        videoPath={
          decisionAt(sceneAssetDecisions, 0)?.riskFlags.includes(heroVideoApprovalFlag)
            ? videoForScene({ videoAssets, sceneAssetDecisions, index: 0 })
            : null
        }
        eyebrow="NEW / LOW SUGAR"
        headline={title || sceneRanges[0].title}
        subline="低糖、椰香、咖啡后劲，把下午三点拉回来。"
        caption={["别划走", "关键不是甜", "是喝完很轻松"]}
        structure="HOOK / 结果前置"
        gapLabel="稳定商品图 + Remotion 推镜"
        proofItems={["样例开头迁移", "反差字幕", "0-3s 抢停留"]}
      />
      <AigcScene
        frame={frame}
        index={1}
        imagePath={imageForScene({ imageAssets, sceneAssetDecisions, index: 1 })}
        videoPath={videoForScene({ videoAssets, sceneAssetDecisions, index: 1 })}
        eyebrow="CREAMY POUR"
        headline={sceneRanges[1].title}
        subline="咖啡后劲跟上，甜感收得更轻。"
        caption={["椰香先出来", "咖啡后劲跟上", "甜感收得轻"]}
        structure="证据 / 卖点推进"
        gapLabel="AIGC 微距补制作镜头"
        proofItems={["椰香", "低糖", "咖啡后劲"]}
        dark
      />
      <AigcScene
        frame={frame}
        index={2}
        imagePath={imageForScene({ imageAssets, sceneAssetDecisions, index: 2 })}
        videoPath={videoForScene({ videoAssets, sceneAssetDecisions, index: 2 })}
        eyebrow="AFTERNOON RESET"
        headline={sceneRanges[2].title}
        subline="通勤、工位、赶作业，都要醒得柔和一点。"
        caption={["下午三点", "醒得柔和", "不腻口"]}
        structure="场景 / 素材适配"
        gapLabel="通勤场景补全"
        proofItems={["工位", "通勤", "下午三点"]}
      />
      <AigcScene
        frame={frame}
        index={3}
        imagePath={imageForScene({ imageAssets, sceneAssetDecisions, index: 3 })}
        videoPath={videoForScene({ videoAssets, sceneAssetDecisions, index: 3 })}
        eyebrow="TRY TODAY"
        headline={sceneRanges[3].title}
        subline={`低糖轻乳 · ${productName}`}
        caption={["低糖轻乳", "下午三点", "来一杯"]}
        structure="CTA / 转化收束"
        gapLabel="主视觉复用 + 行动入口"
        proofItems={["限时", "低糖轻乳", "到店"]}
        dark
        cta
      />

      <CommercialLightLeaks />
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
  videoPath,
  eyebrow,
  headline,
  subline,
  caption,
  structure,
  gapLabel,
  proofItems,
  dark = false,
  cta = false,
}: {
  frame: number;
  index: number;
  imagePath: string;
  videoPath?: string | null;
  eyebrow: string;
  headline: string;
  subline: string;
  caption: string[];
  structure: string;
  gapLabel: string;
  proofItems: string[];
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
  const visualScale = 1.04 + progress * 0.08;
  const visualX = interpolate(
    progress,
    [0, 1],
    [index % 2 === 0 ? -22 : 22, index % 2 === 0 ? 18 : -18],
  );
  const visualY = interpolate(progress, [0, 1], [18, -22]);

  return (
    <AbsoluteFill style={{ opacity }}>
      <CameraMotionBlur samples={5} shutterAngle={150}>
        <div
          style={{
            position: "absolute",
            inset: -56,
            transform: `scale(${visualScale}) translate3d(${visualX}px, ${visualY}px, 0)`,
            transformOrigin: "50% 52%",
          }}
        >
          <Img
            src={staticFile(imagePath)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: cta ? "saturate(1.08) contrast(1.05)" : "saturate(1.14) contrast(1.06)",
            }}
          />
          {videoPath ? (
            <Video
              src={staticFile(videoPath)}
              muted
              loop
              startFrom={0}
              delayRenderTimeoutInMilliseconds={120000}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scale(1.025) translate3d(-8px, -10px, 0)",
                filter: "saturate(1.12) contrast(1.04)",
              }}
            />
          ) : null}
        </div>
      </CameraMotionBlur>
      <AbsoluteFill
        style={{
          background: dark
            ? "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.1) 38%, rgba(0,0,0,0.72) 100%)"
            : "linear-gradient(180deg, rgba(255,248,230,0.32) 0%, rgba(255,248,230,0.08) 40%, rgba(0,0,0,0.52) 100%)",
        }}
      />
      <BeatHitWash frame={local} accent={scene.accent} index={index} />
      <LightSweep frame={frame + index * 17} accent={scene.accent} dark={dark} />
      {videoPath ? <VideoWatermarkCover /> : null}
      <StructureRibbon
        frame={local}
        text={structure}
        accent={scene.accent}
        dark={dark}
      />
      <BeatMeter frame={local} accent={scene.accent} dark={dark} />
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
      <ProductionProofStack
        frame={local}
        items={proofItems}
        accent={scene.accent}
        dark={dark}
      />
      <GapFillLabel
        frame={local}
        text={gapLabel}
        accent={scene.accent}
        dark={dark}
      />
      {cta ? <CtaButton text={subline} accent={scene.accent} /> : null}
      <CaptionBlock frame={local} caption={caption} accent={scene.accent} dark={dark} />
      <SceneBadge index={index} accent={scene.accent} dark={dark} />
    </AbsoluteFill>
  );
}

function CommercialLightLeaks() {
  const cuts = [
    { frame: 90, hueShift: 28, seed: 12 },
    { frame: 210, hueShift: 204, seed: 29 },
    { frame: 330, hueShift: 338, seed: 43 },
  ];

  return (
    <>
      {cuts.map((cut) => (
        <LightLeak
          durationInFrames={28}
          from={cut.frame - 14}
          hueShift={cut.hueShift}
          key={cut.frame}
          seed={cut.seed}
        />
      ))}
    </>
  );
}

function BeatHitWash({ frame, accent, index }: { frame: number; accent: string; index: number }) {
  const opacity = interpolate((frame + index * 6) % 30, [0, 3, 12, 30], [0.26, 0.16, 0, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${index % 2 === 0 ? 64 : 42}% ${
          index < 2 ? 42 : 58
        }%, ${accent}88, transparent 34%)`,
        opacity,
        mixBlendMode: "screen",
      }}
    />
  );
}

function LightSweep({
  frame,
  accent,
  dark,
}: {
  frame: number;
  accent: string;
  dark: boolean;
}) {
  const sweepX = -460 + ((frame * 8) % 1680);
  return (
    <div
      style={{
        position: "absolute",
        left: sweepX,
        top: -120,
        width: 280,
        height: 2180,
        background: `linear-gradient(90deg, transparent, rgba(255,255,255,${
          dark ? 0.32 : 0.48
        }), ${accent}44, transparent)`,
        transform: "skewX(-18deg)",
        opacity: dark ? 0.46 : 0.34,
        mixBlendMode: "screen",
      }}
    />
  );
}

function VideoWatermarkCover() {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 260,
        background:
          "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.56) 52%, rgba(0,0,0,0.84) 100%)",
      }}
    />
  );
}

function StructureRibbon({
  frame,
  text,
  accent,
  dark,
}: {
  frame: number;
  text: string;
  accent: string;
  dark: boolean;
}) {
  const enter = interpolate(frame, [0, 16], [28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div
      style={{
        position: "absolute",
        right: 172,
        top: 78,
        height: 54,
        padding: "0 20px",
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        gap: 12,
        color: dark ? "#fff8e9" : "#101513",
        background: dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.72)",
        border: `1px solid ${accent}88`,
        boxShadow: `0 18px 52px ${accent}22`,
        fontSize: 22,
        fontWeight: 960,
        transform: `translateY(${enter}px)`,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: accent,
          boxShadow: `0 0 24px ${accent}`,
        }}
      />
      {text}
    </div>
  );
}

function BeatMeter({
  frame,
  accent,
  dark,
}: {
  frame: number;
  accent: string;
  dark: boolean;
}) {
  const bars = [0, 1, 2, 3, 4, 5];
  return (
    <div
      style={{
        position: "absolute",
        right: 62,
        top: 230,
        width: 50,
        height: 270,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "18px 0",
        borderRadius: 999,
        background: dark ? "rgba(0,0,0,0.36)" : "rgba(255,255,255,0.48)",
        border: `1px solid ${accent}55`,
      }}
    >
      {bars.map((bar) => {
        const pulse = interpolate((frame + bar * 5) % 30, [0, 4, 30], [1, 1.85, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        return (
          <span
            key={bar}
            style={{
              width: 8 + bar * 3,
              height: 16 + bar * 2,
              borderRadius: 999,
              background: accent,
              opacity: 0.42 + bar * 0.08,
              transform: `scaleY(${pulse})`,
              boxShadow: `0 0 18px ${accent}66`,
            }}
          />
        );
      })}
    </div>
  );
}

function ProductionProofStack({
  frame,
  items,
  accent,
  dark,
}: {
  frame: number;
  items: string[];
  accent: string;
  dark: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 58,
        top: 742,
        width: 430,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {items.map((item, index) => {
        const rawReveal = interpolate(frame, [index * 6, 12 + index * 6], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const reveal = index === 0 ? Math.max(rawReveal, 0.82) : rawReveal;
        return (
          <div
            key={item}
            style={{
              minHeight: 58,
              borderRadius: 18,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              color: dark ? "#fff8e9" : "#101513",
              background: dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.78)",
              border: `1px solid ${accent}66`,
              boxShadow: "0 18px 50px rgba(0,0,0,0.2)",
              opacity: reveal,
              transform: `translateX(${interpolate(reveal, [0, 1], [-34, 0])}px)`,
              fontSize: 25,
              fontWeight: 920,
            }}
          >
            <span
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#101513",
                background: accent,
                fontSize: 20,
                fontWeight: 990,
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            {item}
          </div>
        );
      })}
    </div>
  );
}

function GapFillLabel({
  frame,
  text,
  accent,
  dark,
}: {
  frame: number;
  text: string;
  accent: string;
  dark: boolean;
}) {
  const opacity = interpolate(frame, [0, 10, 104, 118], [0.84, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 58,
        bottom: 252,
        maxWidth: 760,
        height: 58,
        padding: "0 20px",
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity,
        background: dark ? "rgba(0,0,0,0.54)" : "rgba(255,255,255,0.74)",
        color: dark ? "#fff8e9" : "#101513",
        border: `1px solid ${accent}88`,
        fontSize: 22,
        fontWeight: 880,
        boxShadow: `0 16px 52px ${accent}22`,
      }}
    >
      <span style={{ color: accent, fontWeight: 990 }}>补素材</span>
      <span>{text}</span>
    </div>
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
