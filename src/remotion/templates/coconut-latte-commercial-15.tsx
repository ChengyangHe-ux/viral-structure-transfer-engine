import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { RenderTimeline } from "@/lib/render-timeline";
import type { MigratedVideoPlan } from "@/lib/schemas";

export type CoconutLatteCommercial15Props = {
  title: string;
  productName?: string;
  plan: MigratedVideoPlan | null;
  renderTimeline: RenderTimeline | null;
};

const TOTAL_FRAMES = 15 * 30;
const scenes = [
  { start: 0, end: 90, accent: "#27D7B7", warm: "#FFB25F" },
  { start: 90, end: 210, accent: "#F6E7B7", warm: "#B46A36" },
  { start: 210, end: 330, accent: "#88C7FF", warm: "#FF7A8A" },
  { start: 330, end: 450, accent: "#FF637D", warm: "#35D6BD" },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sceneOpacity(frame: number, index: number) {
  const scene = scenes[index]!;
  return (
    interpolate(frame, [scene.start, scene.start + 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    interpolate(frame, [scene.end - 14, scene.end], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
}

function sceneProgress(frame: number, index: number) {
  const scene = scenes[index]!;
  return interpolate(frame, [scene.start, scene.end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
}

function localFrame(frame: number, index: number) {
  const scene = scenes[index]!;
  return clamp(frame - scene.start, 0, scene.end - scene.start);
}

export function CoconutLatteCommercial15({
  title,
  productName = "生椰轻乳拿铁",
  renderTimeline,
}: CoconutLatteCommercial15Props) {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: "#F6F5EA",
        color: "#121417",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "PingFang SC", "Microsoft YaHei", Arial',
        overflow: "hidden",
      }}
    >
      {renderTimeline?.audioBedPath ? (
        <Audio
          src={staticFile(renderTimeline.audioBedPath)}
          volume={(audioFrame) => {
            const fadeIn = interpolate(audioFrame, [0, 24], [0, 0.94], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const fadeOut = interpolate(audioFrame, [TOTAL_FRAMES - 42, TOTAL_FRAMES], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return fadeIn * fadeOut;
          }}
        />
      ) : null}

      <StudioBase frame={frame} />
      <HookScene frame={frame} title={title} productName={productName} />
      <PourScene frame={frame} productName={productName} />
      <CommuteScene frame={frame} productName={productName} />
      <CtaScene frame={frame} productName={productName} />
      <TransitionFlash frame={frame} />
      <FilmTexture frame={frame} />
      <ProgressRail frame={frame} />
    </AbsoluteFill>
  );
}

function StudioBase({ frame }: { frame: number }) {
  const drift = interpolate(frame, [0, TOTAL_FRAMES], [-120, 90]);
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 48% 20%, rgba(255,255,255,0.96), rgba(255,255,255,0) 28%), linear-gradient(180deg, #F7F4E8 0%, #E4F2E9 46%, #1B3939 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -240 + drift * 0.16,
          top: 142,
          width: 820,
          height: 820,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(39,215,183,0.28), rgba(39,215,183,0.08) 44%, rgba(39,215,183,0) 70%)",
          filter: "blur(8px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -260 - drift * 0.1,
          top: 330,
          width: 720,
          height: 720,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,178,95,0.26), rgba(255,178,95,0.08) 46%, rgba(255,178,95,0) 72%)",
          filter: "blur(12px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -80,
          right: -80,
          bottom: -90,
          height: 560,
          borderRadius: "50% 50% 0 0",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.92), rgba(235,222,194,0.42) 42%, rgba(33,51,49,0.92) 100%)",
          boxShadow: "0 -60px 160px rgba(255,255,255,0.2)",
        }}
      />
    </AbsoluteFill>
  );
}

function HookScene({
  frame,
  title,
  productName,
}: {
  frame: number;
  title: string;
  productName: string;
}) {
  const opacity = sceneOpacity(frame, 0);
  const progress = sceneProgress(frame, 0);
  const { fps } = useVideoConfig();
  const pop = spring({
    fps,
    frame: localFrame(frame, 0),
    config: { damping: 160, stiffness: 170, mass: 0.82 },
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(33,57,57,0.16) 100%)",
        }}
      />
      <TopBrand text="LIGHT COCONUT LATTE" />
      <div
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          top: 178,
          transform: `translateY(${interpolate(pop, [0, 1], [54, 0])}px)`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 48,
            padding: "0 20px",
            borderRadius: 999,
            background: "rgba(18,20,23,0.82)",
            color: "#F5F0DE",
            fontSize: 22,
            fontWeight: 900,
            boxShadow: "0 16px 44px rgba(0,0,0,0.18)",
          }}
        >
          15 秒新品广告片
        </div>
        <div
          style={{
            marginTop: 28,
            color: "#13201E",
            fontSize: 84,
            lineHeight: 0.96,
            fontWeight: 980,
            letterSpacing: 0,
            textShadow: "0 24px 80px rgba(255,255,255,0.44)",
          }}
        >
          {title || productName}
        </div>
        <div
          style={{
            marginTop: 22,
            color: "#2D514D",
            fontSize: 34,
            lineHeight: 1.22,
            fontWeight: 760,
            maxWidth: 720,
          }}
        >
          低糖、椰香、咖啡后劲，把下午三点拉回来。
        </div>
      </div>

      <LightSweep frame={frame} opacity={0.6} />
      <GlassCup
        frame={frame}
        productName={productName}
        left={350}
        top={626}
        scale={1.26 + progress * 0.04}
        rotate={interpolate(progress, [0, 1], [-3, 1])}
        glow="#27D7B7"
      />
      <IngredientOrbit frame={frame} opacity={0.96} />
      <CaptionBlock
        frame={localFrame(frame, 0)}
        lines={[
          { text: "别划走", accent: true },
          { text: "关键不是甜", accent: false },
          { text: "是喝完很轻松", accent: true },
        ]}
        accent="#27D7B7"
      />
    </AbsoluteFill>
  );
}

function PourScene({ frame, productName }: { frame: number; productName: string }) {
  const opacity = sceneOpacity(frame, 1);
  const progress = sceneProgress(frame, 1);
  const sceneFrame = localFrame(frame, 1);
  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 56% 30%, rgba(246,231,183,0.84), rgba(246,231,183,0) 27%), linear-gradient(180deg, #18241F 0%, #27504C 54%, #0D1517 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -80,
          top: 114,
          width: 1240,
          height: 1240,
          borderRadius: "50%",
          background:
            "conic-gradient(from 90deg, rgba(255,255,255,0.12), rgba(180,106,54,0.42), rgba(246,231,183,0.3), rgba(39,215,183,0.16), rgba(255,255,255,0.12))",
          transform: `rotate(${interpolate(progress, [0, 1], [-18, 52])}deg) scale(${1.02 + progress * 0.08})`,
          filter: "blur(1px)",
        }}
      />
      <PourStream frame={sceneFrame} />
      <MacroCup frame={sceneFrame} productName={productName} />
      <FloatingClaims
        frame={sceneFrame}
        claims={["椰香先出来", "咖啡后劲跟上", "甜感收得更轻"]}
        accent="#F6E7B7"
      />
      <CaptionBlock
        frame={sceneFrame}
        lines={[
          { text: "椰香先出来", accent: true },
          { text: "咖啡后劲跟上", accent: false },
          { text: "甜感收得轻", accent: true },
        ]}
        accent="#F6E7B7"
        dark
      />
    </AbsoluteFill>
  );
}

function CommuteScene({ frame, productName }: { frame: number; productName: string }) {
  const opacity = sceneOpacity(frame, 2);
  const progress = sceneProgress(frame, 2);
  const sceneFrame = localFrame(frame, 2);
  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, #ECF7FF 0%, #A8D8F7 36%, #23384C 100%)",
        }}
      />
      <CityWindow frame={sceneFrame} />
      <DeskProps frame={sceneFrame} />
      <GlassCup
        frame={frame}
        productName={productName}
        left={548}
        top={682}
        scale={0.96}
        rotate={interpolate(progress, [0, 1], [2, -1])}
        glow="#88C7FF"
      />
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 360,
          top: 214,
          color: "#12202B",
          transform: `translateY(${interpolate(progress, [0, 1], [40, -12])}px)`,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 920, color: "#18607D" }}>AFTERNOON RESET</div>
        <div
          style={{
            marginTop: 22,
            fontSize: 78,
            lineHeight: 0.98,
            fontWeight: 980,
            letterSpacing: 0,
          }}
        >
          下午三点
          <br />
          轻一点醒
        </div>
        <div style={{ marginTop: 24, fontSize: 30, lineHeight: 1.28, fontWeight: 760 }}>
          试饮反馈：醒得柔和，不会越喝越腻。
        </div>
      </div>
      <CaptionBlock
        frame={sceneFrame}
        lines={[
          { text: "下午三点", accent: false },
          { text: "醒得柔和", accent: true },
          { text: "不腻口", accent: true },
        ]}
        accent="#88C7FF"
      />
    </AbsoluteFill>
  );
}

function CtaScene({ frame, productName }: { frame: number; productName: string }) {
  const opacity = sceneOpacity(frame, 3);
  const progress = sceneProgress(frame, 3);
  const sceneFrame = localFrame(frame, 3);
  const { fps } = useVideoConfig();
  const pop = spring({
    fps,
    frame: sceneFrame,
    config: { damping: 150, stiffness: 180, mass: 0.72 },
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 20%, rgba(255,255,255,0.95), rgba(255,255,255,0) 25%), linear-gradient(180deg, #FFF7EA 0%, #FFE1D4 40%, #173534 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          top: 132,
          textAlign: "center",
          color: "#16201E",
          transform: `translateY(${interpolate(pop, [0, 1], [48, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 930, color: "#D93558" }}>TODAY ONLY / NEW</div>
        <div
          style={{
            marginTop: 20,
            fontSize: 86,
            lineHeight: 0.96,
            fontWeight: 990,
            letterSpacing: 0,
          }}
        >
          今天下午
          <br />
          别硬扛
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 100,
          right: 100,
          top: 618,
          height: 750,
          borderRadius: 34,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255,255,255,0.18))",
          border: "1px solid rgba(255,255,255,0.56)",
          boxShadow: "0 50px 120px rgba(0,0,0,0.32)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 50% 32%, rgba(255,99,125,0.18), rgba(255,99,125,0) 38%)",
          }}
        />
        <GlassCup
          frame={frame}
          productName={productName}
          left={235}
          top={104}
          scale={0.94 + progress * 0.03}
          rotate={-2}
          glow="#FF637D"
        />
        <GlassCup
          frame={frame + 10}
          productName={productName}
          left={438}
          top={150}
          scale={0.78 + progress * 0.025}
          rotate={4}
          glow="#35D6BD"
          secondary
        />
        <div
          style={{
            position: "absolute",
            left: 62,
            right: 62,
            bottom: 56,
            height: 94,
            borderRadius: 999,
            background: "#151B1A",
            color: "#FFF5E4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            fontWeight: 980,
            boxShadow: "0 20px 55px rgba(0,0,0,0.26)",
          }}
        >
          去试这杯 {productName}
        </div>
      </div>
      <PriceBurst frame={sceneFrame} />
      <CaptionBlock
        frame={sceneFrame}
        lines={[
          { text: "先去试这一杯", accent: true },
          { text: productName, accent: false },
        ]}
        accent="#FF637D"
        dark
      />
    </AbsoluteFill>
  );
}

function TopBrand({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        top: 72,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        color: "#183331",
        fontWeight: 920,
        fontSize: 21,
        letterSpacing: 0,
      }}
    >
      <span>{text}</span>
      <span>LOW SUGAR</span>
    </div>
  );
}

function GlassCup({
  frame,
  productName,
  left,
  top,
  scale,
  rotate,
  glow,
  secondary = false,
}: {
  frame: number;
  productName: string;
  left: number;
  top: number;
  scale: number;
  rotate: number;
  glow: string;
  secondary?: boolean;
}) {
  const bob = Math.sin(frame / 24) * 7;
  const cupWidth = 300;
  const cupHeight = 530;
  const label = secondary ? "LIGHT" : productName;

  return (
    <div
      style={{
        position: "absolute",
        left,
        top: top + bob,
        width: cupWidth,
        height: 720,
        transform: `scale(${scale}) rotate(${rotate}deg)`,
        transformOrigin: "50% 78%",
        filter: `drop-shadow(0 42px 70px rgba(0,0,0,0.26)) drop-shadow(0 0 42px ${glow}55)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 124,
          top: -110,
          width: 24,
          height: 265,
          borderRadius: 999,
          background: "linear-gradient(90deg, #FFF9E9, #CDEBE1 44%, #FFFFFF)",
          transform: "rotate(-9deg)",
          boxShadow: "inset 4px 0 10px rgba(0,0,0,0.08)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 36,
          top: 56,
          width: 230,
          height: 68,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(255,255,255,0.96), rgba(236,241,223,0.72) 48%, rgba(255,255,255,0.28) 75%)",
          border: "2px solid rgba(255,255,255,0.7)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 20,
          top: 96,
          width: 260,
          height: cupHeight,
          clipPath: "polygon(6% 0, 94% 0, 82% 100%, 18% 100%)",
          borderRadius: 28,
          overflow: "hidden",
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.62), rgba(255,255,255,0.22) 18%, rgba(255,255,255,0.06) 58%, rgba(255,255,255,0.44))",
          border: "2px solid rgba(255,255,255,0.54)",
          boxShadow: "inset 18px 0 30px rgba(255,255,255,0.28), inset -26px 0 42px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "38px 0 0",
            background:
              "linear-gradient(180deg, #F7F0D2 0%, #F4DEAC 22%, #B56F38 39%, #8B4E28 61%, #E9D6A9 79%, #F9F4DE 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -20,
            right: -20,
            top: 172 + Math.sin(frame / 18) * 12,
            height: 125,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at 48% 42%, rgba(255,255,255,0.76), rgba(255,255,255,0.24) 35%, rgba(139,78,40,0.26) 70%)",
            transform: `rotate(${Math.sin(frame / 31) * 7}deg)`,
          }}
        />
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={`ice-${index}`}
            style={{
              position: "absolute",
              left: 56 + ((index * 43) % 132),
              top: 86 + ((index * 67) % 230),
              width: 48 + (index % 3) * 8,
              height: 42 + (index % 2) * 10,
              borderRadius: 10,
              background: "rgba(255,255,255,0.36)",
              border: "1px solid rgba(255,255,255,0.5)",
              transform: `rotate(${(index - 3) * 11 + Math.sin(frame / 20 + index) * 5}deg)`,
              boxShadow: "inset 6px 8px 16px rgba(255,255,255,0.18)",
            }}
          />
        ))}
        {Array.from({ length: 28 }).map((_, index) => (
          <div
            key={`drop-${index}`}
            style={{
              position: "absolute",
              left: 24 + ((index * 37) % 196),
              top: 36 + ((index * 73) % 430),
              width: 5 + (index % 4),
              height: 10 + (index % 5),
              borderRadius: 999,
              background: "rgba(255,255,255,0.55)",
              opacity: 0.32 + (index % 4) * 0.1,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: 48,
            right: 48,
            top: 294,
            height: 96,
            borderRadius: 22,
            background: "rgba(18,24,23,0.78)",
            color: "#FFF5E4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 18px",
            fontSize: secondary ? 22 : 24,
            lineHeight: 1.08,
            fontWeight: 980,
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 26,
          top: cupHeight + 102,
          width: 250,
          height: 45,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.24)",
          filter: "blur(10px)",
        }}
      />
    </div>
  );
}

function IngredientOrbit({ frame, opacity }: { frame: number; opacity: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, opacity }}>
      {Array.from({ length: 11 }).map((_, index) => {
        const angle = frame / 44 + index * 0.72;
        const x = 536 + Math.cos(angle) * (270 + (index % 3) * 42);
        const y = 1050 + Math.sin(angle) * (410 + (index % 2) * 36);
        const coconut = index % 2 === 0;
        return (
          <div
            key={`ingredient-${index}`}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: coconut ? 62 : 42,
              height: coconut ? 34 : 42,
              borderRadius: coconut ? "55% 45% 54% 46%" : "50%",
              background: coconut
                ? "linear-gradient(135deg, #FFF9E8, #D5B380 55%, #7C4A27)"
                : "radial-gradient(circle at 36% 32%, #FFF4D6, #C87B36 52%, #663116)",
              transform: `rotate(${frame * 0.9 + index * 27}deg)`,
              boxShadow: "0 18px 38px rgba(0,0,0,0.2)",
            }}
          />
        );
      })}
    </div>
  );
}

function PourStream({ frame }: { frame: number }) {
  const fall = interpolate(frame, [0, 35, 110], [-180, 0, 70], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 524,
          top: -40 + fall,
          width: 58,
          height: 750,
          borderRadius: 999,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.3), #FFF2C8 38%, #C98748 60%, rgba(255,255,255,0.28))",
          filter: "blur(0.4px)",
          transform: `rotate(${Math.sin(frame / 16) * 2.2}deg)`,
          boxShadow: "0 0 34px rgba(246,231,183,0.42)",
        }}
      />
      {Array.from({ length: 18 }).map((_, index) => (
        <div
          key={`pour-drop-${index}`}
          style={{
            position: "absolute",
            left: 486 + ((index * 31) % 126),
            top: 120 + ((frame * (5 + (index % 4)) + index * 91) % 780),
            width: 12 + (index % 5) * 4,
            height: 18 + (index % 4) * 6,
            borderRadius: 999,
            background: index % 3 === 0 ? "#FFF0C4" : "#C98748",
            opacity: 0.24 + (index % 4) * 0.12,
            filter: "blur(0.2px)",
          }}
        />
      ))}
    </>
  );
}

function MacroCup({ frame, productName }: { frame: number; productName: string }) {
  const rotate = Math.sin(frame / 38) * 4;
  return (
    <div
      style={{
        position: "absolute",
        left: 78,
        right: 78,
        bottom: 214,
        height: 790,
        borderRadius: 56,
        overflow: "hidden",
        boxShadow: "0 42px 120px rgba(0,0,0,0.42)",
        background:
          "radial-gradient(ellipse at 50% 30%, #FFF3D0 0%, #B46A36 38%, #57311F 64%, #151A19 100%)",
        transform: `rotate(${rotate}deg) scale(${1 + Math.sin(frame / 52) * 0.012})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -140,
          right: -140,
          top: 84,
          height: 480,
          borderRadius: "50%",
          background:
            "conic-gradient(from 140deg, #FFF7DB, #B46A36, #5C2F18, #F0D090, #FFF7DB)",
          transform: `rotate(${frame * 0.7}deg)`,
          opacity: 0.82,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 72,
          bottom: 76,
          padding: "18px 24px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.88)",
          color: "#38210F",
          fontSize: 26,
          fontWeight: 940,
        }}
      >
        {productName}
      </div>
    </div>
  );
}

function FloatingClaims({
  frame,
  claims,
  accent,
}: {
  frame: number;
  claims: string[];
  accent: string;
}) {
  return (
    <>
      {claims.map((claim, index) => {
        const start = 12 + index * 28;
        const opacity = interpolate(frame, [start, start + 8, start + 46, start + 58], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={claim}
            style={{
              position: "absolute",
              left: index === 1 ? 624 : 76,
              top: 244 + index * 148,
              opacity,
              padding: "18px 24px",
              borderRadius: 20,
              background: "rgba(255,255,255,0.14)",
              color: "#FFF9E8",
              border: "1px solid rgba(255,255,255,0.28)",
              fontSize: 34,
              fontWeight: 940,
              boxShadow: `0 20px 60px ${accent}24`,
              transform: `translateY(${interpolate(opacity, [0, 1], [28, 0])}px)`,
            }}
          >
            {claim}
          </div>
        );
      })}
    </>
  );
}

function CityWindow({ frame }: { frame: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 52,
        right: 52,
        top: 120,
        height: 740,
        borderRadius: 46,
        overflow: "hidden",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.74), rgba(255,255,255,0.24))",
        boxShadow: "0 36px 100px rgba(14,41,66,0.24)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, #CFF0FF 0%, #F8FCFF 48%, #B2D2E6 100%)",
        }}
      />
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={`tower-${index}`}
          style={{
            position: "absolute",
            left: ((index * 168 - frame * 2.2) % 1160) - 80,
            bottom: 0,
            width: 92 + (index % 3) * 30,
            height: 260 + (index % 4) * 72,
            borderRadius: "18px 18px 0 0",
            background:
              "linear-gradient(180deg, rgba(47,96,123,0.45), rgba(18,48,66,0.72))",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 110,
          height: 8,
          background: "rgba(255,255,255,0.65)",
        }}
      />
    </div>
  );
}

function DeskProps({ frame }: { frame: number }) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: -30,
          right: -30,
          bottom: -40,
          height: 660,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.2), rgba(36,48,56,0.98))",
          transform: "skewY(-4deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 76,
          bottom: 280,
          width: 424,
          height: 300,
          borderRadius: 34,
          background: "#121B20",
          boxShadow: "0 34px 80px rgba(0,0,0,0.35)",
          transform: `rotate(${-6 + Math.sin(frame / 55) * 1.2}deg)`,
        }}
      >
        {Array.from({ length: 18 }).map((_, index) => (
          <div
            key={`key-${index}`}
            style={{
              position: "absolute",
              left: 32 + (index % 6) * 58,
              top: 36 + Math.floor(index / 6) * 64,
              width: 42,
              height: 30,
              borderRadius: 8,
              background: "rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          right: 78,
          bottom: 322,
          width: 224,
          height: 386,
          borderRadius: 38,
          background:
            "linear-gradient(180deg, #111827 0%, #1F2937 100%)",
          border: "7px solid rgba(255,255,255,0.18)",
          boxShadow: "0 34px 80px rgba(0,0,0,0.32)",
          transform: `rotate(${8 + Math.sin(frame / 47)}deg)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 24,
            right: 24,
            top: 86,
            height: 18,
            borderRadius: 999,
            background: "#88C7FF",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 24,
            right: 58,
            top: 132,
            height: 12,
            borderRadius: 999,
            background: "rgba(255,255,255,0.62)",
          }}
        />
      </div>
    </>
  );
}

function PriceBurst({ frame }: { frame: number }) {
  const { fps } = useVideoConfig();
  const pop = spring({ fps, frame, config: { damping: 130, stiffness: 230 } });
  return (
    <div
      style={{
        position: "absolute",
        right: 82,
        top: 510,
        width: 178,
        height: 178,
        borderRadius: "50%",
        background: "#151B1A",
        color: "#FFF5E4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontSize: 30,
        lineHeight: 1.08,
        fontWeight: 980,
        boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
        transform: `scale(${0.65 + pop * 0.35}) rotate(${interpolate(frame, [0, 120], [-10, 4], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}deg)`,
      }}
    >
      新品
      <br />
      轻负担
    </div>
  );
}

function CaptionBlock({
  frame,
  lines,
  accent,
  dark = false,
}: {
  frame: number;
  lines: { text: string; accent: boolean }[];
  accent: string;
  dark?: boolean;
}) {
  const opacity = interpolate(frame, [0, 10, 102, 118], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 68,
        right: 68,
        bottom: 112,
        opacity,
        color: dark ? "#FFF8EA" : "#101817",
        textAlign: "center",
        textShadow: dark ? "0 12px 34px rgba(0,0,0,0.38)" : "0 10px 28px rgba(255,255,255,0.55)",
      }}
    >
      {lines.map((line, index) => {
        const active = interpolate(frame, [index * 10, index * 10 + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={`${line.text}-${index}`}
            style={{
              display: "inline-block",
              margin: "0 8px 12px",
              padding: line.accent ? "10px 18px" : "6px 4px",
              borderRadius: line.accent ? 18 : 0,
              background: line.accent ? accent : "transparent",
              color: line.accent ? "#111513" : undefined,
              fontSize: index === 0 ? 46 : 54,
              lineHeight: 1.04,
              fontWeight: 980,
              letterSpacing: 0,
              transform: `translateY(${interpolate(active, [0, 1], [18, 0])}px) scale(${line.accent ? 1 + active * 0.035 : 1})`,
              boxShadow: line.accent ? `0 18px 48px ${accent}55` : undefined,
            }}
          >
            {line.text}
          </div>
        );
      })}
    </div>
  );
}

function LightSweep({ frame, opacity }: { frame: number; opacity: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: -420 + ((frame * 8) % 1500),
        top: 0,
        width: 260,
        height: 1920,
        background:
          "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.72), rgba(255,255,255,0))",
        transform: "skewX(-18deg)",
        opacity,
        mixBlendMode: "screen",
      }}
    />
  );
}

function TransitionFlash({ frame }: { frame: number }) {
  const cuts = [90, 210, 330];
  const opacity = cuts.reduce((max, cut) => {
    const value = interpolate(Math.abs(frame - cut), [0, 12], [0.34, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return Math.max(max, value);
  }, 0);
  return <AbsoluteFill style={{ background: "#FFF8EA", opacity, mixBlendMode: "screen" }} />;
}

function FilmTexture({ frame }: { frame: number }) {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 58 }).map((_, index) => (
        <div
          key={`grain-${index}`}
          style={{
            position: "absolute",
            left: `${(index * 37 + frame * 0.7) % 100}%`,
            top: `${(index * 71 + frame * 0.45) % 100}%`,
            width: 2 + (index % 3),
            height: 2 + (index % 4),
            borderRadius: "50%",
            background: index % 2 ? "rgba(255,255,255,0.26)" : "rgba(0,0,0,0.08)",
            opacity: 0.2,
          }}
        />
      ))}
      <AbsoluteFill
        style={{
          boxShadow: "inset 0 0 180px rgba(0,0,0,0.22)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      />
    </AbsoluteFill>
  );
}

function ProgressRail({ frame }: { frame: number }) {
  const progress = clamp(frame / TOTAL_FRAMES, 0, 1);
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        bottom: 46,
        height: 7,
        borderRadius: 999,
        background: "rgba(255,255,255,0.28)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${progress * 100}%`,
          height: "100%",
          borderRadius: 999,
          background: "linear-gradient(90deg, #27D7B7, #FFB25F, #FF637D)",
        }}
      />
    </div>
  );
}

