import { LightLeak } from "@remotion/light-leaks";
import { CameraMotionBlur, Trail } from "@remotion/motion-blur";
import { noise2D } from "@remotion/noise";
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
  { bg: "#060A0E", accent: "#FFB84D", second: "#72E2D1", label: "新品冷萃", tag: "LOW SUGAR" },
  { bg: "#07141A", accent: "#72E2D1", second: "#F8D27A", label: "果香证据", tag: "REAL TASTE" },
  { bg: "#0B1526", accent: "#9AD3FF", second: "#FF8DA5", label: "通勤场景", tag: "ON THE WAY" },
  { bg: "#11151E", accent: "#F8D27A", second: "#72E2D1", label: "试饮口碑", tag: "SOCIAL PROOF" },
  { bg: "#1C101F", accent: "#FF8DA5", second: "#FFB84D", label: "限时上新", tag: "TRY TODAY" },
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
        background: "#05080C",
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
            const fadeIn = interpolate(frame, [0, 36], [0, 0.92], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const fadeOut = interpolate(
              frame,
              [renderTimeline.totalFrames - 64, renderTimeline.totalFrames],
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

      <CoffeeTransitionLeaks timeline={renderTimeline} />
      <CoffeeCover timeline={renderTimeline} />

      <Sequence from={Math.max(0, renderTimeline.totalFrames - 84)} durationInFrames={84}>
        <CoffeeFinal timeline={renderTimeline} />
      </Sequence>
    </AbsoluteFill>
  );
}

function CoffeeCover({ timeline }: { timeline: RenderTimeline }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 170, mass: 0.7 } });
  const opacity = interpolate(frame, [0, 10, 32, 44], [1, 1, 0.86, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        background:
          "radial-gradient(circle at 54% 36%, rgba(255,184,77,0.5), rgba(255,184,77,0) 34%), linear-gradient(180deg, #07111D 0%, #14323A 58%, #05080C 100%)",
      }}
    >
      <CoffeeTexture intensity={0.36} />
      <MacroLiquidPlate frame={frame} palette={stageColors[0]} />
      <div
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          top: 82,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#EAF7F5",
          fontSize: 21,
          fontWeight: 860,
        }}
      >
        <span>FRESH COLD BREW</span>
        <span>38S / SOUND ON</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 76,
          right: 76,
          bottom: 148,
          transform: `translateY(${interpolate(pop, [0, 1], [64, 0])}px)`,
        }}
      >
        <div
          style={{
            fontSize: 30,
            color: "#72E2D1",
            fontWeight: 940,
            textShadow: "0 12px 44px rgba(114,226,209,0.28)",
          }}
        >
          低糖果香冷萃
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 92,
            lineHeight: 0.95,
            fontWeight: 980,
            letterSpacing: 0,
            textShadow: "0 32px 100px rgba(0,0,0,0.5)",
          }}
        >
          {compact(timeline.coverTitle, 18)}
        </div>
        <div style={{ marginTop: 28, fontSize: 28, color: "#DDE8EE", lineHeight: 1.32 }}>
          冰感微距 / 果香证据 / 通勤提神 / 限时转化
        </div>
      </div>
      <CoffeeHeroProduct frame={frame} palette={stageColors[0]} large left={390} top={242} />
    </AbsoluteFill>
  );
}

function CoffeeTransitionLeaks({ timeline }: { timeline: RenderTimeline }) {
  return (
    <>
      {timeline.scenes.slice(1).map((scene) => (
        <LightLeak
          durationInFrames={30}
          from={Math.max(0, scene.startFrame - 15)}
          hueShift={scene.index % 2 === 0 ? 215 : 28}
          key={`leak-${scene.id}`}
          seed={scene.index * 17 + 9}
        />
      ))}
    </>
  );
}

function CoffeeScene({ scene, totalScenes }: { scene: RenderScene; totalScenes: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = stageColors[scene.index % stageColors.length]!;
  const enter = spring({ fps, frame, config: { damping: 150, mass: 0.8 } });
  const progress = clamp(frame / scene.durationFrames, 0, 1);
  const cameraPush = interpolate(progress, [0, 1], [1.035, 1.105]);
  const cameraY = interpolate(enter, [0, 1], [36, 0]) + Math.sin(frame / 46) * 8;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 72% 18%, ${palette.accent}36, transparent 30%), linear-gradient(180deg, ${palette.bg} 0%, #05080C 100%)`,
      }}
    >
      <CoffeeTexture intensity={0.24} />
      <MovingLight frame={frame} palette={palette} />

      <CameraMotionBlur samples={5} shutterAngle={165}>
        <div
          style={{
            position: "absolute",
            inset: -46,
            transform: `translateY(${cameraY}px) scale(${cameraPush})`,
            transformOrigin: "50% 52%",
          }}
        >
          <CoffeeVisual scene={scene} frame={frame} progress={progress} palette={palette} />
        </div>
      </CameraMotionBlur>

      <ForegroundOccluders frame={frame} palette={palette} />

      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: 66,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#F7FCFF",
          opacity: interpolate(progress, [0, 0.08, 0.92, 1], [0, 1, 1, 0.32], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div>
          <div style={{ fontSize: 19, fontWeight: 850, color: palette.second }}>{palette.tag}</div>
          <div style={{ marginTop: 8, fontSize: 35, fontWeight: 960 }}>{palette.label}</div>
        </div>
        <div
          style={{
            width: 106,
            height: 106,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.34)",
            background: "rgba(0,0,0,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            fontWeight: 940,
            boxShadow: `0 0 34px ${palette.accent}33`,
          }}
        >
          {String(scene.index + 1).padStart(2, "0")}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 520,
          background: "linear-gradient(180deg, transparent, rgba(5,8,12,0.72) 34%, rgba(5,8,12,0.96))",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          bottom: 116,
          transform: `translateY(${interpolate(progress, [0, 0.16, 1], [38, 0, -10], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px)`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            borderRadius: 999,
            background: `${palette.accent}22`,
            color: palette.second,
            fontSize: 20,
            fontWeight: 900,
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: palette.accent }} />
          {scene.focus}
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 58,
            lineHeight: 1.02,
            fontWeight: 980,
            letterSpacing: 0,
            maxWidth: 940,
            overflowWrap: "anywhere",
            textShadow: "0 22px 78px rgba(0,0,0,0.65)",
          }}
        >
          <CoffeeCaption scene={scene} />
        </div>
      </div>

      <CoffeeProgress scene={scene} palette={palette} totalScenes={totalScenes} />
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
  return <CtaCoffee frame={frame} progress={progress} palette={palette} />;
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
      <MacroLiquidPlate frame={frame} palette={palette} />
      <LiquidPour frame={frame} palette={palette} left={470} top={-24} height={510} />
      <CoffeeHeroProduct frame={frame} palette={palette} large left={396} top={328} />
      <CitrusSlice frame={frame} left={705} top={160} scale={1.08} />
      <IceCube frame={frame} left={132} top={188} delay={0} scale={1.15} />
      <IceCube frame={frame} left={782} top={520} delay={12} scale={0.88} />
      <FloatingTastePill text="果香" left={108} top={612} palette={palette} progress={progress} />
      <FloatingTastePill text="低糖" left={724} top={736} palette={palette} progress={progress} delay={0.12} />
      <CleanHeadline text="不是甜，是干净的香" left={70} top={1010} palette={palette} progress={progress} />
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
    ["01", "果香冷萃", "先给味觉记忆点", palette.accent],
    ["02", "低糖负担", "再解决喝咖啡顾虑", "#9AD3FF"],
    ["03", "冰杯成品", "最后给可拍可买场景", palette.second],
  ];

  return (
    <>
      <IngredientRings frame={frame} palette={palette} />
      <div style={{ position: "absolute", inset: 0 }}>
        {cards.map((card, index) => {
          const shift = interpolate(progress, [0, 1], [72 - index * 18, -18 + index * 8]);
          return (
            <div
              key={card[1]}
              style={{
                position: "absolute",
                left: 74 + index * 304,
                top: 168 + Math.sin((frame + index * 21) / 22) * 18 + shift,
                width: 268,
                height: 660,
                borderRadius: 36,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.72) 62%, rgba(255,255,255,0.28))",
                color: "#111827",
                padding: 22,
                boxShadow: `0 34px 108px rgba(0,0,0,0.34), 0 0 46px ${card[3]}44`,
                transform: `rotate(${[-5, 3, -2][index]}deg)`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: 320,
                  borderRadius: 28,
                  background: `radial-gradient(circle at 48% 44%, ${card[3]}, rgba(255,255,255,0.9) 54%, rgba(17,24,39,0.12))`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <CoffeeBeanCluster frame={frame + index * 20} />
                {index === 0 ? <CitrusSlice frame={frame} left={62} top={54} scale={0.54} /> : null}
                {index === 2 ? <IceCube frame={frame} left={70} top={102} delay={8} scale={0.58} /> : null}
              </div>
              <div style={{ marginTop: 26, fontSize: 22, color: card[3], fontWeight: 960 }}>{card[0]}</div>
              <div style={{ marginTop: 10, fontSize: 35, fontWeight: 960 }}>{card[1]}</div>
              <div style={{ marginTop: 14, fontSize: 21, color: "#4B5563", lineHeight: 1.25 }}>{card[2]}</div>
            </div>
          );
        })}
      </div>
      <CleanHeadline text="卖点不是罗列，是按购买阻力推进" left={66} top={1020} palette={palette} progress={progress} />
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
      <CommuteWindow frame={frame} palette={palette} />
      <Trail layers={5} lagInFrames={2} trailOpacity={0.18}>
        <CoffeeHeroProduct frame={frame} palette={palette} large left={462} top={380} />
      </Trail>
      <HandSilhouette frame={frame} />
      <div
        style={{
          position: "absolute",
          left: 76,
          top: 286,
          width: 336,
          padding: "28px 26px",
          borderRadius: 30,
          background: "rgba(255,255,255,0.9)",
          color: "#111827",
          boxShadow: "0 30px 90px rgba(0,0,0,0.28)",
          transform: `translateX(${interpolate(progress, [0, 1], [-28, 18])}px) rotate(-3deg)`,
        }}
      >
        <div style={{ fontSize: 21, color: palette.accent, fontWeight: 960 }}>SCENE FIT</div>
        <div style={{ marginTop: 12, fontSize: 43, fontWeight: 980, lineHeight: 1.02 }}>
          早八
          <br />
          一口清醒
        </div>
        <div style={{ marginTop: 18, fontSize: 21, color: "#4B5563", lineHeight: 1.26 }}>
          冰感不腻，路上就能喝。
        </div>
      </div>
      <CleanHeadline text="把产品放进真实使用路线上" left={66} top={1014} palette={palette} progress={progress} />
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
      <CoffeeHeroProduct frame={frame} palette={palette} large left={560} top={318} />
      {comments.map((comment, index) => (
        <div
          key={comment}
          style={{
            position: "absolute",
            left: 78 + index * 34,
            top: 230 + index * 170,
            width: 600,
            minHeight: 126,
            borderRadius: 30,
            background: "rgba(255,255,255,0.92)",
            color: "#111827",
            padding: "24px 28px",
            boxShadow: "0 28px 86px rgba(0,0,0,0.24)",
            transform: `translateX(${interpolate(progress, [0, 1], [-48 + index * 10, 18 - index * 8])}px) rotate(${[-3, 2, -1][index]}deg)`,
          }}
        >
          <div style={{ display: "flex", gap: 7, color: "#FFB84D", fontSize: 25, fontWeight: 960 }}>
            {"★★★★★".slice(0, 4 + (index % 2))}
          </div>
          <div style={{ marginTop: 10, fontSize: 34, lineHeight: 1.05, fontWeight: 960 }}>{comment}</div>
          <div style={{ marginTop: 10, fontSize: 18, color: "#6B7280", fontWeight: 800 }}>试饮反馈 / 可替换真实评论</div>
        </div>
      ))}
      <CleanHeadline text="评价卡片只保留能转化的证据" left={66} top={1022} palette={palette} progress={progress} />
    </>
  );
}

function CtaCoffee({
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
      <StorePoster frame={frame} palette={palette} />
      <CoffeeHeroProduct frame={frame} palette={palette} large left={330} top={420} />
      <div
        style={{
          position: "absolute",
          right: 78,
          top: 236,
          width: 326,
          padding: "26px 26px 30px",
          borderRadius: 32,
          background: "rgba(255,255,255,0.94)",
          color: "#111827",
          boxShadow: "0 36px 104px rgba(0,0,0,0.32)",
          transform: `translateY(${interpolate(progress, [0, 1], [44, -12])}px) rotate(3deg)`,
        }}
      >
        <div style={{ fontSize: 21, color: palette.accent, fontWeight: 960 }}>LIMITED DROP</div>
        <div style={{ marginTop: 12, fontSize: 46, lineHeight: 0.98, fontWeight: 980 }}>
          今日
          <br />
          去试一杯
        </div>
        <div style={{ marginTop: 18, fontSize: 20, color: "#4B5563", lineHeight: 1.28 }}>
          低糖果香冷萃，限时上新。
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 76,
          bottom: 396,
          width: 170,
          height: 170,
          borderRadius: 24,
          background:
            "repeating-linear-gradient(90deg, #111827 0 14px, #fff 14px 27px), repeating-linear-gradient(0deg, transparent 0 13px, rgba(255,255,255,0.35) 13px 25px)",
          border: "12px solid rgba(255,255,255,0.9)",
          boxShadow: "0 26px 78px rgba(0,0,0,0.3)",
        }}
      />
      <CleanHeadline text="结尾只给一个动作：收藏，再到店" left={66} top={1018} palette={palette} progress={progress} />
    </>
  );
}

function CoffeeHeroProduct({
  frame,
  palette,
  large = false,
  left = 370,
  top = 128,
}: {
  frame: number;
  palette: (typeof stageColors)[number];
  large?: boolean;
  left?: number;
  top?: number;
}) {
  const scale = large ? 1.2 : 1;
  const bob = Math.sin(frame / 18) * 8;
  const shine = 22 + Math.sin(frame / 19) * 14;

  return (
    <div
      style={{
        position: "absolute",
        left,
        top: top + bob,
        width: 282,
        height: 452,
        transform: `scale(${scale}) rotate(${Math.sin(frame / 54) * 1.6}deg)`,
        transformOrigin: "50% 70%",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 17,
          top: 396,
          width: 250,
          height: 48,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.32)",
          filter: "blur(14px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 52,
          top: 0,
          width: 178,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(223,248,255,0.78))",
          border: "5px solid rgba(255,255,255,0.94)",
          boxShadow: "0 10px 34px rgba(255,255,255,0.2)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 42,
          top: 28,
          width: 198,
          height: 356,
          clipPath: "polygon(6% 0, 94% 0, 82% 100%, 18% 100%)",
          borderRadius: 28,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(244,252,255,0.55) 20%, rgba(108,64,37,0.9) 54%, rgba(15,23,42,0.94) 100%)",
          boxShadow: "0 38px 104px rgba(0,0,0,0.42)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: shine,
            top: 8,
            width: 28,
            height: 318,
            borderRadius: 999,
            background: "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.05))",
            filter: "blur(1px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            top: 132 + Math.sin(frame / 14) * 8,
            height: 72,
            borderRadius: "50%",
            background: `linear-gradient(90deg, ${palette.accent}, ${palette.second})`,
            opacity: 0.86,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 34,
            right: 34,
            top: 220,
            height: 82,
            borderRadius: 18,
            background: "rgba(255,255,255,0.88)",
            color: "#111827",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontSize: 23,
            lineHeight: 1.05,
            fontWeight: 980,
          }}
        >
          低糖
          <br />
          冷萃
        </div>
        <Condensation frame={frame} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 50,
          top: 18,
          width: 182,
          height: 54,
          borderRadius: "50%",
          border: "5px solid rgba(255,255,255,0.72)",
        }}
      />
    </div>
  );
}

function Condensation({ frame }: { frame: number }) {
  return (
    <>
      {new Array(18).fill(0).map((_, index) => {
        const x = 28 + ((index * 37) % 138);
        const y = 40 + ((index * 53 + Math.floor(frame / 3)) % 250);
        const size = 4 + (index % 3) * 2;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.52)",
              boxShadow: "0 0 10px rgba(255,255,255,0.3)",
            }}
          />
        );
      })}
    </>
  );
}

function MacroLiquidPlate({
  frame,
  palette,
}: {
  frame: number;
  palette: (typeof stageColors)[number];
}) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: -180,
          top: 318,
          width: 1450,
          height: 590,
          borderRadius: "50%",
          background: `radial-gradient(circle at 46% 43%, ${palette.accent}AA, rgba(93,52,34,0.92) 26%, rgba(14,20,29,0.96) 62%, transparent 72%)`,
          transform: `rotate(${Math.sin(frame / 42) * 2}deg)`,
          filter: "blur(0.2px)",
        }}
      />
      {new Array(18).fill(0).map((_, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: 120 + ((index * 71 + frame * 2) % 860),
            top: 344 + Math.sin((frame + index * 18) / 16) * 94,
            width: 18 + (index % 4) * 8,
            height: 18 + (index % 4) * 8,
            borderRadius: "50%",
            background: index % 2 === 0 ? palette.second : "rgba(255,255,255,0.72)",
            opacity: 0.24,
            filter: "blur(0.4px)",
          }}
        />
      ))}
    </div>
  );
}

function LiquidPour({
  frame,
  palette,
  left,
  top,
  height,
}: {
  frame: number;
  palette: (typeof stageColors)[number];
  left: number;
  top: number;
  height: number;
}) {
  const pourHeight = interpolate(frame % 84, [0, 14, 84], [0, height, height], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: 92,
        height: pourHeight,
        borderRadius: "0 0 42px 42px",
        background: `linear-gradient(180deg, ${palette.accent}, rgba(87,48,31,0.94))`,
        opacity: 0.92,
        filter: "blur(0.3px)",
        boxShadow: `0 0 38px ${palette.accent}44`,
      }}
    />
  );
}

function CitrusSlice({
  frame,
  left,
  top,
  scale = 1,
}: {
  frame: number;
  left: number;
  top: number;
  scale?: number;
}) {
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
        transform: `scale(${scale}) rotate(${frame * 0.8}deg)`,
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
  scale = 1,
}: {
  frame: number;
  left: number;
  top: number;
  delay: number;
  scale?: number;
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
        transform: `scale(${scale}) rotate(${Math.sin((frame + delay) / 22) * 12}deg)`,
      }}
    />
  );
}

function FloatingTastePill({
  text,
  left,
  top,
  palette,
  progress,
  delay = 0,
}: {
  text: string;
  left: number;
  top: number;
  palette: (typeof stageColors)[number];
  progress: number;
  delay?: number;
}) {
  const lift = interpolate(clamp(progress - delay, 0, 1), [0, 1], [34, -18]);

  return (
    <div
      style={{
        position: "absolute",
        left,
        top: top + lift,
        padding: "18px 25px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.9)",
        color: "#111827",
        fontSize: 34,
        fontWeight: 980,
        boxShadow: `0 28px 80px rgba(0,0,0,0.28), 0 0 38px ${palette.accent}44`,
      }}
    >
      {text}
    </div>
  );
}

function CleanHeadline({
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
        left: Math.max(left, 112),
        top,
        right: 92,
        color: "#FFFFFF",
        transform: `translateY(${interpolate(progress, [0, 0.2, 1], [34, 0, -10], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}px)`,
      }}
    >
      <div
        style={{
          width: 96,
          height: 7,
          borderRadius: 999,
          background: `linear-gradient(90deg, ${palette.accent}, ${palette.second})`,
          boxShadow: `0 0 30px ${palette.accent}66`,
        }}
      />
      <div
        style={{
          marginTop: 18,
          fontSize: 48,
          lineHeight: 1.02,
          fontWeight: 980,
          textShadow: "0 20px 70px rgba(0,0,0,0.58)",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function IngredientRings({
  frame,
  palette,
}: {
  frame: number;
  palette: (typeof stageColors)[number];
}) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {new Array(6).fill(0).map((_, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: -60 + index * 174,
            top: 142 + Math.sin((frame + index * 20) / 18) * 24,
            width: 290,
            height: 620,
            borderRadius: 999,
            border: `3px solid ${index % 2 ? palette.accent : palette.second}`,
            opacity: 0.13,
            transform: `rotate(${12 + index * 16}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function CoffeeBeanCluster({ frame }: { frame: number }) {
  return (
    <>
      {new Array(8).fill(0).map((_, item) => (
        <div
          key={item}
          style={{
            position: "absolute",
            left: 28 + (item % 4) * 52,
            top: 56 + Math.floor(item / 4) * 94 + Math.sin((frame + item * 8) / 12) * 7,
            width: 48,
            height: 64,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #633A27, #161D2B)",
            boxShadow: "0 18px 34px rgba(0,0,0,0.18)",
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

function CommuteWindow({
  frame,
  palette,
}: {
  frame: number;
  palette: (typeof stageColors)[number];
}) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: 86,
          right: 86,
          top: 150,
          height: 720,
          borderRadius: 46,
          background:
            "linear-gradient(180deg, rgba(154,211,255,0.18), rgba(255,255,255,0.08)), linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
          border: "1px solid rgba(255,255,255,0.24)",
          overflow: "hidden",
          boxShadow: "inset 0 0 90px rgba(255,255,255,0.08), 0 34px 120px rgba(0,0,0,0.28)",
        }}
      >
        {new Array(8).fill(0).map((_, item) => (
          <div
            key={item}
            style={{
              position: "absolute",
              left: -260 + ((frame * (4.1 + item * 0.55)) % 1240),
              top: 90 + item * 76,
              width: 360,
              height: item % 2 ? 5 : 3,
              background: item % 2 ? palette.accent : "rgba(255,255,255,0.3)",
              opacity: 0.34,
              filter: "blur(0.4px)",
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: 76,
            right: 76,
            top: 86,
            height: 300,
            borderRadius: 34,
            border: "2px solid rgba(255,255,255,0.28)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 112,
            right: 112,
            bottom: 132,
            height: 78,
            borderRadius: 999,
            background: "rgba(255,255,255,0.16)",
          }}
        />
      </div>
    </div>
  );
}

function HandSilhouette({ frame }: { frame: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 318,
        top: 720 + Math.sin(frame / 22) * 8,
        width: 470,
        height: 260,
        borderRadius: "54% 46% 30% 70%",
        background: "linear-gradient(135deg, rgba(20,16,14,0.86), rgba(86,51,38,0.5))",
        filter: "blur(0.2px)",
        transform: "rotate(-10deg)",
      }}
    />
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
      {new Array(5).fill(0).map((_, item) => (
        <div
          key={item}
          style={{
            position: "absolute",
            left: 26 + item * 150,
            top: 132 + Math.sin((frame + item * 24) / 18) * 34,
            width: 300,
            height: 760,
            borderRadius: 999,
            border: `3px solid ${item % 2 === 0 ? palette.accent : palette.second}`,
            opacity: 0.14,
            transform: `rotate(${12 + item * 18}deg)`,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: -260,
          right: -260,
          top: 590,
          height: 240,
          background: `linear-gradient(90deg, transparent, ${palette.accent}22, ${palette.second}22, transparent)`,
          filter: "blur(26px)",
          transform: `translateX(${Math.sin(frame / 28) * 80}px) rotate(-8deg)`,
        }}
      />
    </div>
  );
}

function StorePoster({
  frame,
  palette,
}: {
  frame: number;
  palette: (typeof stageColors)[number];
}) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: 56,
          right: 56,
          top: 134,
          height: 820,
          borderRadius: 46,
          background:
            "linear-gradient(150deg, rgba(255,141,165,0.24), rgba(255,184,77,0.14) 48%, rgba(255,255,255,0.06))",
          border: "1px solid rgba(255,255,255,0.24)",
          boxShadow: "0 42px 132px rgba(0,0,0,0.35)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -110,
            top: 246,
            width: 1220,
            height: 270,
            background: `linear-gradient(90deg, ${palette.accent}, ${palette.second})`,
            opacity: 0.22,
            transform: `rotate(${-8 + Math.sin(frame / 30) * 1.2}deg)`,
            filter: "blur(2px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 70,
            top: 78,
            fontSize: 96,
            lineHeight: 0.9,
            fontWeight: 980,
            color: "rgba(255,255,255,0.9)",
          }}
        >
          COLD
          <br />
          BREW
        </div>
        <div
          style={{
            position: "absolute",
            left: 74,
            bottom: 74,
            width: 400,
            fontSize: 25,
            lineHeight: 1.28,
            color: "#F5F7FB",
            fontWeight: 780,
          }}
        >
          低糖果香冷萃，今天到店试一杯。
        </div>
      </div>
    </div>
  );
}

function ForegroundOccluders({
  frame,
  palette,
}: {
  frame: number;
  palette: (typeof stageColors)[number];
}) {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          style={{
            position: "absolute",
            left: -280 + ((frame * (2.3 + item * 0.8) + item * 360) % 1480),
            top: -120,
            width: 150 + item * 44,
            height: 2200,
            background: `linear-gradient(90deg, transparent, ${item === 1 ? palette.second : palette.accent}24, transparent)`,
            filter: "blur(18px)",
            transform: `skewX(${-18 + item * 9}deg)`,
            opacity: 0.42,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 220px rgba(0,0,0,0.54)",
        }}
      />
    </AbsoluteFill>
  );
}

const adCaptionTokens = [
  ["别再靠老套路，", "先抓住", "一口清爽"],
  ["先给果香，", "再讲低糖，", "最后给场景"],
  ["把新品", "放进真实通勤路上"],
  ["用试饮反馈", "变成购买证据"],
  ["收藏这杯，", "今天到店试试"],
] as const;

function CoffeeCaption({ scene }: { scene: RenderScene }) {
  const frame = useCurrentFrame();
  const tokens = adCaptionTokens[scene.index % adCaptionTokens.length] ?? [
    compact(scene.subtitle, 18),
  ];
  const activeIndex = Math.min(
    tokens.length - 1,
    Math.floor((frame / Math.max(1, scene.durationFrames)) * tokens.length),
  );

  return (
    <span>
      {tokens.map((token, index) => {
        const active = index === activeIndex;
        const hot = /低糖|冷萃|清爽|果香|通勤|限时|收藏|到店|试饮|证据|真实/i.test(token);
        return (
          <span
            key={`${token}-${index}`}
            style={{
              display: "inline-block",
              marginRight: 12,
              marginBottom: 6,
              color: active || hot ? "#FFE08A" : "#FFFFFF",
              transform: active ? "translateY(-6px) scale(1.07)" : "translateY(0) scale(1)",
              textShadow: active
                ? "0 12px 32px rgba(255,224,138,0.46)"
                : "0 14px 40px rgba(0,0,0,0.48)",
            }}
          >
            {token}
          </span>
        );
      })}
    </span>
  );
}

function CoffeeProgress({
  scene,
  palette,
  totalScenes,
}: {
  scene: RenderScene;
  palette: (typeof stageColors)[number];
  totalScenes: number;
}) {
  const frame = useCurrentFrame();
  const progress = clamp(frame / scene.durationFrames, 0, 1);
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        right: 72,
        bottom: 58,
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      {new Array(totalScenes).fill(0).map((_, index) => (
        <div
          key={index}
          style={{
            flex: 1,
            height: 8,
            borderRadius: 999,
            background: "rgba(255,255,255,0.14)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: index < scene.index ? "100%" : index === scene.index ? `${progress * 100}%` : "0%",
              height: "100%",
              borderRadius: 999,
              background: `linear-gradient(90deg, ${palette.accent}, ${palette.second})`,
            }}
          />
        </div>
      ))}
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
        left: -320 + (frame % 260) * 5,
        top: 0,
        width: 330,
        height: 1920,
        background: `linear-gradient(90deg, transparent, ${palette.accent}26, transparent)`,
        transform: "skewX(-14deg)",
      }}
    />
  );
}

function CoffeeTexture({ intensity = 0.2 }: { intensity?: number }) {
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: intensity,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "118px 118px",
        }}
      />
      {new Array(58).fill(0).map((_, item) => {
        const nx = noise2D("coffee-grain-x", item * 0.17, 0.31);
        const ny = noise2D("coffee-grain-y", item * 0.11, 0.77);
        return (
          <div
            key={item}
            style={{
              position: "absolute",
              left: 40 + ((nx + 1) / 2) * 1000,
              top: 70 + ((ny + 1) / 2) * 1780,
              width: item % 5 === 0 ? 5 : 3,
              height: item % 5 === 0 ? 5 : 3,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.34)",
              opacity: 0.18 + (item % 4) * 0.04,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

function CoffeeFinal({ timeline }: { timeline: RenderTimeline }) {
  const frame = useCurrentFrame();
  const pop = spring({ frame, fps: 30, config: { damping: 150, mass: 0.8 } });
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 42%, rgba(255,141,165,0.46), rgba(255,141,165,0) 42%), linear-gradient(180deg, #101724 0%, #1D1222 100%)",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: 70,
      }}
    >
      <CoffeeTexture intensity={0.3} />
      <MacroLiquidPlate frame={frame} palette={stageColors[4]} />
      <CoffeeHeroProduct frame={frame} palette={stageColors[4]} large left={404} top={250} />
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          bottom: 140,
          transform: `translateY(${interpolate(pop, [0, 1], [44, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 28, color: "#FFB84D", fontWeight: 960 }}>FINAL CUT READY</div>
        <div style={{ marginTop: 20, fontSize: 72, lineHeight: 1, fontWeight: 980 }}>
          {compact(timeline.captionTitle, 24)}
        </div>
        <div style={{ marginTop: 26, fontSize: 25, color: "#D8E3F0", lineHeight: 1.35 }}>
          有声成片 / 结构可解释 / 缺口可补全 / 适合答辩展示
        </div>
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
