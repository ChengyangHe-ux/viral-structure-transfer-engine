import { createTikTokStyleCaptions } from "@remotion/captions";
import { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { RenderScene, RenderTimeline } from "@/lib/render-timeline";
import type { MigratedVideoPlan } from "@/lib/schemas";

export type CoffeeLaunchShortProps = {
  title: string;
  plan: MigratedVideoPlan | null;
  renderTimeline: RenderTimeline | null;
};

const stageColors = [
  { bg: "#07111D", accent: "#FFB84D", second: "#72E2D1", label: "冷萃反差" },
  { bg: "#081A22", accent: "#72E2D1", second: "#F8D27A", label: "原料证据" },
  { bg: "#112034", accent: "#9AD3FF", second: "#FF8DA5", label: "通勤场景" },
  { bg: "#101724", accent: "#F8D27A", second: "#72E2D1", label: "口感背书" },
  { bg: "#1D1222", accent: "#FF8DA5", second: "#FFB84D", label: "限时转化" },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function compact(text: string, maxLength: number) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1))}...`;
}

export function CoffeeLaunchShort({ title, renderTimeline }: CoffeeLaunchShortProps) {
  if (!renderTimeline?.scenes.length) {
    return <CoffeeEmpty title={title} />;
  }

  return (
    <AbsoluteFill
      style={{
        background: "#07111D",
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
            const fadeIn = interpolate(frame, [0, 36], [0, 0.9], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const fadeOut = interpolate(
              frame,
              [renderTimeline.totalFrames - 54, renderTimeline.totalFrames],
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
      {renderTimeline.scenes.map((scene) => (
        <Sequence from={scene.startFrame} durationInFrames={scene.durationFrames} key={scene.id}>
          <CoffeeScene scene={scene} totalScenes={renderTimeline.scenes.length} />
        </Sequence>
      ))}
      <CoffeeCover timeline={renderTimeline} />
      <Sequence from={Math.max(0, renderTimeline.totalFrames - 72)} durationInFrames={72}>
        <CoffeeFinal timeline={renderTimeline} />
      </Sequence>
    </AbsoluteFill>
  );
}

function CoffeeCover({ timeline }: { timeline: RenderTimeline }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 180, mass: 0.8 } });
  const opacity = interpolate(frame, [0, 8, 34, 48], [1, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        background:
          "radial-gradient(circle at 50% 36%, rgba(255,184,77,0.48), rgba(255,184,77,0) 34%), linear-gradient(180deg, #08121F 0%, #142B35 58%, #07111D 100%)",
      }}
    >
      <CoffeeTexture />
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          top: 82,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#CFE8EA",
          fontSize: 22,
          fontWeight: 800,
        }}
      >
        <span>LOW SUGAR COLD BREW</span>
        <span>{timeline.scenes.length} SCENES</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 92,
          right: 92,
          bottom: 154,
          transform: `translateY(${interpolate(pop, [0, 1], [56, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 28, color: "#72E2D1", fontWeight: 900 }}>咖啡新品主推案例</div>
        <div
          style={{
            marginTop: 22,
            fontSize: 86,
            lineHeight: 0.96,
            fontWeight: 960,
            letterSpacing: 0,
          }}
        >
          {compact(timeline.coverTitle, 20)}
        </div>
        <div style={{ marginTop: 28, fontSize: 30, color: "#DDE8EE", lineHeight: 1.34 }}>
          清爽果香 / 低负担 / 通勤场景 / 限时口味
        </div>
      </div>
      <CoffeeHeroProduct frame={frame} palette={stageColors[0]} large />
    </AbsoluteFill>
  );
}

function CoffeeScene({ scene, totalScenes }: { scene: RenderScene; totalScenes: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = stageColors[scene.index % stageColors.length]!;
  const enter = spring({ fps, frame, config: { damping: 160, mass: 0.82 } });
  const progress = clamp(frame / scene.durationFrames, 0, 1);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${palette.bg} 0%, #061018 100%)`,
      }}
    >
      <CoffeeTexture />
      <MovingLight frame={frame} palette={palette} />
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: 66,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#EAF1F7",
        }}
      >
        <div>
          <div style={{ fontSize: 20, opacity: 0.7 }}>Scene {scene.index + 1}</div>
          <div style={{ marginTop: 8, fontSize: 34, fontWeight: 920 }}>{palette.label}</div>
        </div>
        <div
          style={{
            width: 128,
            height: 46,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.28)",
            background: "rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 900,
          }}
        >
          {String(scene.index + 1).padStart(2, "0")} / {String(totalScenes).padStart(2, "0")}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 56,
          right: 56,
          top: 178,
          height: 970,
          transform: `translateY(${interpolate(enter, [0, 1], [46, 0])}px)`,
        }}
      >
        <CoffeeVisual scene={scene} frame={frame} progress={progress} palette={palette} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          bottom: 138,
          padding: "28px 30px",
          borderRadius: 24,
          background: "rgba(5, 10, 18, 0.82)",
          border: `1px solid ${palette.accent}`,
          boxShadow: `0 24px 90px rgba(0,0,0,0.36), 0 0 42px ${palette.accent}33`,
        }}
      >
        <div style={{ fontSize: 56, lineHeight: 1.08, fontWeight: 960, letterSpacing: 0 }}>
          <CoffeeCaption scene={scene} />
        </div>
      </div>
      <CoffeeProgress scene={scene} palette={palette} />
    </AbsoluteFill>
  );
}

function CoffeeVisual({
  scene,
  frame,
  progress,
  palette,
}: {
  scene: RenderScene;
  frame: number;
  progress: number;
  palette: (typeof stageColors)[number];
}) {
  if (scene.index === 0) return <HookCoffee frame={frame} progress={progress} palette={palette} />;
  if (scene.index === 1) return <IngredientCoffee frame={frame} progress={progress} palette={palette} />;
  if (scene.index === 2) return <CommuteCoffee frame={frame} progress={progress} palette={palette} />;
  if (scene.index === 3) return <ProofCoffee frame={frame} progress={progress} palette={palette} />;
  return <CtaCoffee frame={frame} progress={progress} palette={palette} scene={scene} />;
}

function HookCoffee({
  frame,
  progress,
  palette,
}: {
  frame: number;
  progress: number;
  palette: (typeof stageColors)[number];
}) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 28,
          right: 28,
          top: 20,
          height: 658,
          borderRadius: 42,
          background:
            "linear-gradient(155deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06) 44%, rgba(0,0,0,0.18))",
          border: "1px solid rgba(255,255,255,0.2)",
          overflow: "hidden",
        }}
      >
        <LiquidPour frame={frame} palette={palette} />
        <CoffeeHeroProduct frame={frame} palette={palette} />
        <CitrusSlice frame={frame} left={654} top={120} />
        <IceCube frame={frame} left={165} top={118} delay={0} />
        <IceCube frame={frame} left={742} top={390} delay={12} />
      </div>
      <BigClaim
        text="不是甜，是干净的香"
        left={44}
        top={700}
        palette={palette}
        progress={progress}
      />
    </>
  );
}

function IngredientCoffee({
  frame,
  progress,
  palette,
}: {
  frame: number;
  progress: number;
  palette: (typeof stageColors)[number];
}) {
  const cards = [
    ["果香冷萃", "清爽入口", palette.accent],
    ["低糖负担", "下午也轻", "#9AD3FF"],
    ["冰杯成品", "即拿即走", palette.second],
  ];
  return (
    <>
      <div style={{ position: "absolute", inset: 0 }}>
        {cards.map((card, index) => (
          <div
            key={card[0]}
            style={{
              position: "absolute",
              left: 36 + index * 306,
              top: 70 + Math.sin((frame + index * 18) / 20) * 12,
              width: 260,
              height: 530,
              borderRadius: 34,
              background: "rgba(255,255,255,0.92)",
              color: "#111827",
              padding: 26,
              boxShadow: "0 30px 92px rgba(0,0,0,0.26)",
              transform: `translateY(${interpolate(progress, [0, 1], [34, -8])}px)`,
            }}
          >
            <div
              style={{
                height: 230,
                borderRadius: 24,
                background: `radial-gradient(circle at 52% 46%, ${card[2]}, rgba(255,255,255,0.82) 54%, rgba(17,24,39,0.12))`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <CoffeeBeanCluster frame={frame + index * 20} />
            </div>
            <div style={{ marginTop: 30, fontSize: 34, fontWeight: 940 }}>{card[0]}</div>
            <div style={{ marginTop: 12, fontSize: 22, color: "#4B5563" }}>{card[1]}</div>
          </div>
        ))}
      </div>
      <BigClaim text="三类镜头，证明一杯够清爽" left={44} top={675} palette={palette} progress={progress} />
    </>
  );
}

function CommuteCoffee({
  frame,
  progress,
  palette,
}: {
  frame: number;
  progress: number;
  palette: (typeof stageColors)[number];
}) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 28,
          right: 28,
          top: 42,
          height: 610,
          borderRadius: 42,
          background:
            "linear-gradient(180deg, rgba(154,211,255,0.16), rgba(255,255,255,0.08)), linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
          border: "1px solid rgba(255,255,255,0.2)",
          overflow: "hidden",
        }}
      >
        {[0, 1, 2, 3, 4].map((item) => (
          <div
            key={item}
            style={{
              position: "absolute",
              left: -200 + ((frame * (2.5 + item * 0.4)) % 1280),
              top: 100 + item * 86,
              width: 280,
              height: 4,
              background: "rgba(255,255,255,0.24)",
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: 70,
            right: 70,
            top: 92,
            height: 260,
            borderRadius: 28,
            border: "2px solid rgba(255,255,255,0.28)",
          }}
        />
        <CoffeeHeroProduct frame={frame} palette={palette} compact />
        <div
          style={{
            position: "absolute",
            right: 62,
            bottom: 72,
            width: 300,
            padding: "24px 26px",
            borderRadius: 24,
            background: "rgba(255,255,255,0.92)",
            color: "#111827",
            boxShadow: "0 28px 78px rgba(0,0,0,0.24)",
          }}
        >
          <div style={{ fontSize: 22, color: palette.accent, fontWeight: 940 }}>COMMUTE FIT</div>
          <div style={{ marginTop: 10, fontSize: 34, fontWeight: 940, lineHeight: 1.05 }}>
            低负担
            <br />
            不抢味
          </div>
        </div>
      </div>
      <BigClaim text="通勤路上，也能有一口清醒" left={44} top={685} palette={palette} progress={progress} />
    </>
  );
}

function ProofCoffee({
  frame,
  progress,
  palette,
}: {
  frame: number;
  progress: number;
  palette: (typeof stageColors)[number];
}) {
  const comments = ["清爽果香更明显", "甜感低，回味干净", "冰杯出片很稳"];
  return (
    <>
      <FlavorWave frame={frame} palette={palette} />
      {comments.map((comment, index) => (
        <div
          key={comment}
          style={{
            position: "absolute",
            left: 90 + index * 58,
            top: 95 + index * 156,
            width: 650,
            height: 112,
            borderRadius: 26,
            background: "rgba(255,255,255,0.92)",
            color: "#111827",
            padding: "24px 28px",
            boxShadow: "0 24px 70px rgba(0,0,0,0.2)",
            transform: `translateX(${interpolate(progress, [0, 1], [34, -12])}px)`,
          }}
        >
          <div style={{ fontSize: 20, color: "#6B7280", fontWeight: 800 }}>试饮反馈占位</div>
          <div style={{ marginTop: 8, fontSize: 34, fontWeight: 940 }}>{comment}</div>
        </div>
      ))}
      <CoffeeHeroProduct frame={frame} palette={palette} compact right />
      <BigClaim text="真实发布前，评价必须可追溯" left={44} top={688} palette={palette} progress={progress} />
    </>
  );
}

function CtaCoffee({
  frame,
  progress,
  palette,
  scene,
}: {
  frame: number;
  progress: number;
  palette: (typeof stageColors)[number];
  scene: RenderScene;
}) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 34,
          right: 34,
          top: 34,
          height: 650,
          borderRadius: 42,
          background:
            "linear-gradient(160deg, rgba(255,141,165,0.22), rgba(255,184,77,0.12) 52%, rgba(255,255,255,0.06))",
          border: "1px solid rgba(255,255,255,0.22)",
          overflow: "hidden",
        }}
      >
        <CoffeeHeroProduct frame={frame} palette={palette} large />
        <div
          style={{
            position: "absolute",
            right: 64,
            top: 84,
            width: 310,
            padding: "24px 24px 26px",
            borderRadius: 26,
            background: "rgba(255,255,255,0.94)",
            color: "#111827",
            boxShadow: "0 30px 86px rgba(0,0,0,0.24)",
          }}
        >
          <div style={{ fontSize: 22, color: palette.accent, fontWeight: 940 }}>LIMITED FLAVOR</div>
          <div style={{ marginTop: 14, fontSize: 42, lineHeight: 1, fontWeight: 960 }}>
            夏季
            <br />
            冷萃
          </div>
          <div style={{ marginTop: 20, fontSize: 20, color: "#4B5563", lineHeight: 1.28 }}>
            {compact(scene.completionPlan, 34)}
          </div>
        </div>
      </div>
      <BigClaim text="先收藏，再去门店试这杯" left={44} top={688} palette={palette} progress={progress} />
    </>
  );
}

function CoffeeHeroProduct({
  frame,
  palette,
  compact: isCompact = false,
  right = false,
  large = false,
}: {
  frame: number;
  palette: (typeof stageColors)[number];
  compact?: boolean;
  right?: boolean;
  large?: boolean;
}) {
  const scale = large ? 1.12 : isCompact ? 0.78 : 1;
  const cupLeft = right ? 560 : large ? 350 : 370;
  const cupTop = large ? 194 : isCompact ? 170 : 128;
  const bob = Math.sin(frame / 18) * 8;

  return (
    <div
      style={{
        position: "absolute",
        left: cupLeft,
        top: cupTop + bob,
        width: 280,
        height: 420,
        transform: `scale(${scale}) rotate(${Math.sin(frame / 50) * 1.8}deg)`,
        transformOrigin: "50% 70%",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 52,
          top: 0,
          width: 176,
          height: 52,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.88)",
          border: "5px solid rgba(255,255,255,0.96)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 42,
          top: 24,
          width: 196,
          height: 342,
          clipPath: "polygon(7% 0, 93% 0, 82% 100%, 18% 100%)",
          borderRadius: 24,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.56) 18%, rgba(96,55,34,0.88) 52%, rgba(16,24,39,0.92) 100%)",
          boxShadow: "0 34px 88px rgba(0,0,0,0.35)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 22,
            right: 22,
            top: 140 + Math.sin(frame / 14) * 8,
            height: 68,
            borderRadius: "50%",
            background: `linear-gradient(90deg, ${palette.accent}, ${palette.second})`,
            opacity: 0.88,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 34,
            right: 34,
            top: 214,
            height: 76,
            borderRadius: 16,
            background: "rgba(255,255,255,0.86)",
            color: "#111827",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontSize: 22,
            lineHeight: 1.05,
            fontWeight: 960,
          }}
        >
          低糖
          <br />
          冷萃
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 20,
          top: 360,
          width: 238,
          height: 42,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.28)",
          filter: "blur(12px)",
        }}
      />
    </div>
  );
}

function LiquidPour({
  frame,
  palette,
}: {
  frame: number;
  palette: (typeof stageColors)[number];
}) {
  const pourHeight = interpolate(frame % 90, [0, 16, 90], [0, 300, 300], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 202,
        top: 0,
        width: 86,
        height: pourHeight,
        borderRadius: "0 0 40px 40px",
        background: `linear-gradient(180deg, ${palette.accent}, rgba(88,49,31,0.88))`,
        opacity: 0.92,
        filter: "blur(0.3px)",
      }}
    />
  );
}

function CitrusSlice({ frame, left, top }: { frame: number; left: number; top: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: 170,
        height: 170,
        borderRadius: "50%",
        border: "16px solid #F8D27A",
        background:
          "conic-gradient(from 20deg, rgba(255,255,255,0.82), #FFE08A, rgba(255,255,255,0.78), #FFE08A, rgba(255,255,255,0.82))",
        transform: `rotate(${frame * 0.8}deg)`,
        boxShadow: "0 20px 60px rgba(248,210,122,0.28)",
      }}
    />
  );
}

function IceCube({
  frame,
  left,
  top,
  delay,
}: {
  frame: number;
  left: number;
  top: number;
  delay: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top: top + Math.sin((frame + delay) / 15) * 16,
        width: 108,
        height: 92,
        borderRadius: 22,
        background: "rgba(221,248,255,0.82)",
        border: "2px solid rgba(255,255,255,0.86)",
        boxShadow: "inset 0 0 24px rgba(255,255,255,0.8), 0 18px 48px rgba(0,0,0,0.22)",
        transform: `rotate(${Math.sin((frame + delay) / 22) * 12}deg)`,
      }}
    />
  );
}

function CoffeeBeanCluster({ frame }: { frame: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          style={{
            position: "absolute",
            left: 38 + (item % 3) * 58,
            top: 50 + Math.floor(item / 3) * 72 + Math.sin((frame + item * 8) / 12) * 7,
            width: 48,
            height: 64,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #5B3424, #1F2937)",
            transform: `rotate(${30 + item * 22}deg)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 22,
              top: 8,
              width: 4,
              height: 48,
              borderRadius: 999,
              background: "rgba(255,255,255,0.26)",
            }}
          />
        </div>
      ))}
    </>
  );
}

function FlavorWave({
  frame,
  palette,
}: {
  frame: number;
  palette: (typeof stageColors)[number];
}) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          style={{
            position: "absolute",
            left: 58 + item * 146,
            top: 100 + Math.sin((frame + item * 24) / 18) * 34,
            width: 260,
            height: 620,
            borderRadius: 999,
            border: `3px solid ${item % 2 === 0 ? palette.accent : palette.second}`,
            opacity: 0.16,
            transform: `rotate(${12 + item * 18}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function BigClaim({
  text,
  left,
  top,
  palette,
  progress,
}: {
  text: string;
  left: number;
  top: number;
  palette: (typeof stageColors)[number];
  progress: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        right: 44,
        padding: "22px 26px",
        borderRadius: 26,
        background: "rgba(255,255,255,0.92)",
        color: "#111827",
        boxShadow: "0 30px 88px rgba(0,0,0,0.28)",
        transform: `translateY(${interpolate(progress, [0, 1], [22, -6])}px)`,
      }}
    >
      <div style={{ fontSize: 26, color: palette.accent, fontWeight: 940 }}>STRUCTURE TRANSFER</div>
      <div style={{ marginTop: 8, fontSize: 48, lineHeight: 1.02, fontWeight: 970 }}>{text}</div>
    </div>
  );
}

function CoffeeCaption({ scene }: { scene: RenderScene }) {
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
        combineTokensWithinMilliseconds: 820,
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
        const hot = /低糖|冷萃|清爽|果香|通勤|限时|关键|第一|第二|收藏/i.test(token.text);
        return (
          <span
            key={`${token.text}-${token.fromMs}`}
            style={{
              display: "inline-block",
              marginRight: 9,
              color: active || hot ? "#FFE08A" : "#FFFFFF",
              transform: active ? "translateY(-5px) scale(1.06)" : "translateY(0) scale(1)",
              textShadow: active
                ? "0 10px 28px rgba(255,224,138,0.42)"
                : "0 12px 34px rgba(0,0,0,0.34)",
            }}
          >
            {token.text}
          </span>
        );
      })}
    </span>
  );
}

function CoffeeProgress({
  scene,
  palette,
}: {
  scene: RenderScene;
  palette: (typeof stageColors)[number];
}) {
  const frame = useCurrentFrame();
  const progress = clamp(frame / scene.durationFrames, 0, 1);
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        right: 72,
        bottom: 82,
        height: 12,
        borderRadius: 999,
        background: "rgba(255,255,255,0.12)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${progress * 100}%`,
          height: "100%",
          borderRadius: 999,
          background: `linear-gradient(90deg, ${palette.accent}, ${palette.second})`,
        }}
      />
    </div>
  );
}

function MovingLight({
  frame,
  palette,
}: {
  frame: number;
  palette: (typeof stageColors)[number];
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: -240 + (frame % 240) * 5,
        top: 0,
        width: 280,
        height: 1920,
        background: `linear-gradient(90deg, transparent, ${palette.accent}22, transparent)`,
        transform: "skewX(-14deg)",
      }}
    />
  );
}

function CoffeeTexture() {
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.25,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
          backgroundSize: "108px 108px",
        }}
      />
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          style={{
            position: "absolute",
            left: 80 + ((item * 173) % 900),
            top: 190 + item * 210,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.26)",
          }}
        />
      ))}
    </AbsoluteFill>
  );
}

function CoffeeFinal({ timeline }: { timeline: RenderTimeline }) {
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 42%, rgba(255,141,165,0.42), rgba(255,141,165,0) 42%), linear-gradient(180deg, #101724 0%, #1D1222 100%)",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: 72,
      }}
    >
      <CoffeeTexture />
      <div style={{ fontSize: 30, color: "#FFB84D", fontWeight: 940 }}>FINAL CUT READY</div>
      <div style={{ marginTop: 22, fontSize: 78, lineHeight: 1, fontWeight: 970 }}>
        {compact(timeline.captionTitle, 26)}
      </div>
      <div style={{ marginTop: 28, fontSize: 25, color: "#D8E3F0", lineHeight: 1.35 }}>
        可解释结构迁移 / 素材缺口补全 / 有声音频节奏
      </div>
    </AbsoluteFill>
  );
}

function CoffeeEmpty({ title }: { title: string }) {
  return (
    <AbsoluteFill
      style={{
        background: "#07111D",
        color: "white",
        justifyContent: "center",
        alignItems: "center",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "PingFang SC", "Microsoft YaHei", Arial',
      }}
    >
      <div style={{ fontSize: 72, fontWeight: 940 }}>等待咖啡成片时间线</div>
      <div style={{ marginTop: 20, fontSize: 28, opacity: 0.78 }}>{title}</div>
    </AbsoluteFill>
  );
}
