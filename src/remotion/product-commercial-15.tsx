import {
  AbsoluteFill,
  Easing,
  Video,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type ProductCommercial15Props = {
  sourceVideoPath?: string | null;
  productName?: string;
  title?: string;
};

const scenes = [
  { from: 0, to: 60 },
  { from: 60, to: 150 },
  { from: 150, to: 270 },
  { from: 270, to: 360 },
  { from: 360, to: 450 },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sceneFrame(frame: number, sceneIndex: number) {
  return clamp(frame - scenes[sceneIndex]!.from, 0, scenes[sceneIndex]!.to - scenes[sceneIndex]!.from);
}

function sceneOpacity(frame: number, sceneIndex: number) {
  const scene = scenes[sceneIndex]!;
  return (
    interpolate(frame, [scene.from, scene.from + 10], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    interpolate(frame, [scene.to - 12, scene.to], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
}

function inOut(frame: number, sceneIndex: number) {
  const local = sceneFrame(frame, sceneIndex);
  const duration = scenes[sceneIndex]!.to - scenes[sceneIndex]!.from;
  return interpolate(local, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
}

export function ProductCommercial15({
  sourceVideoPath,
  productName = "天然矿泉水",
  title = "这一口，很清冽",
}: ProductCommercial15Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = frame / 450;
  const videoSrc = sourceVideoPath
    ? sourceVideoPath.startsWith("http://") ||
      sourceVideoPath.startsWith("https://") ||
      sourceVideoPath.startsWith("/")
      ? sourceVideoPath
      : staticFile(sourceVideoPath)
    : null;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#DCEFED",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "PingFang SC", "Microsoft YaHei", Arial',
        color: "#F8FFFD",
        overflow: "hidden",
      }}
    >
      <AquaBackdrop frame={frame} />
      {videoSrc ? (
        <Video
          src={videoSrc}
          muted
          delayRenderTimeoutInMilliseconds={120000}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.1,
            transform: `scale(${1.18 + progress * 0.07}) translateY(${interpolate(progress, [0, 1], [0, -18])}px)`,
            filter: "blur(28px) saturate(1.28) contrast(1.08) brightness(1.04)",
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(180deg, #DCF5F4 0%, #A8DAD8 44%, #244746 100%)",
          }}
        />
      )}

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(4,18,23,0.26) 0%, rgba(4,18,23,0.03) 34%, rgba(4,18,23,0.24) 70%, rgba(4,18,23,0.72) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(5, 41, 49, 0.48) 0%, rgba(5, 41, 49, 0.08) 42%, rgba(255,255,255,0.06) 100%)",
        }}
      />

      <WaterLines frame={frame} />
      <SceneImageStacks frame={frame} productName={productName} />
      <BottleHero frame={frame} productName={productName} />
      <TopBrand productName={productName} />
      <HookScene frame={frame} fps={fps} title={title} />
      <SourceScene frame={frame} />
      <ScenarioScene frame={frame} />
      <TextureScene frame={frame} />
      <CtaScene frame={frame} productName={productName} />
      <FlashCut frame={frame} />
      <ProgressBar frame={frame} />
    </AbsoluteFill>
  );
}

function AquaBackdrop({ frame }: { frame: number }) {
  const drift = interpolate(frame, [0, 450], [-80, 90]);

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, #F3FFFC 0%, #BDE4E1 38%, #4A8586 72%, #0B343A 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.58), rgba(255,255,255,0) 44%), linear-gradient(25deg, rgba(24,108,121,0.34), rgba(255,255,255,0) 48%)",
        }}
      />
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: -170 + index * 280 + drift * (index % 2 ? -0.25 : 0.2),
            top: 260 + index * 220,
            width: 760,
            height: 2,
            background:
              "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.42), rgba(255,255,255,0))",
            transform: `rotate(${-14 + index * 5}deg)`,
            opacity: 0.55,
          }}
        />
      ))}
    </AbsoluteFill>
  );
}

function BottleHero({ frame, productName }: { frame: number; productName: string }) {
  const float = Math.sin(frame / 34) * 10;
  const turn = interpolate(frame, [0, 150, 270, 360, 450], [-2.2, 1.8, -1.2, 2.6, 0.6]);
  const shine = interpolate(frame % 120, [0, 70, 120], [-90, 160, 260]);
  const right = interpolate(frame, [0, 120, 270, 360, 450], [-26, -118, -62, 54, 118]);
  const top = interpolate(frame, [0, 120, 270, 360, 450], [330, 245, 310, 255, 165]);
  const scale = interpolate(frame, [0, 120, 270, 360, 450], [1, 0.86, 0.92, 0.98, 0.74]);

  return (
    <div
      style={{
        position: "absolute",
        right,
        top: top + float,
        width: 430,
        height: 1030,
        transform: `rotate(${turn}deg) scale(${scale})`,
        transformOrigin: "center top",
        filter: "drop-shadow(0 42px 72px rgba(0, 31, 36, 0.34))",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 146,
          top: 0,
          width: 138,
          height: 118,
          borderRadius: "34px 34px 18px 18px",
          background:
            "linear-gradient(90deg, rgba(242,255,252,0.9), rgba(145,206,205,0.9), rgba(248,255,253,0.92))",
          border: "1px solid rgba(255,255,255,0.72)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 82,
          top: 96,
          width: 266,
          height: 885,
          borderRadius: "120px 120px 94px 94px",
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.55), rgba(156,219,219,0.28) 24%, rgba(255,255,255,0.72) 50%, rgba(66,142,150,0.2) 78%, rgba(255,255,255,0.48))",
          border: "1px solid rgba(255,255,255,0.76)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 20,
            borderRadius: "104px 104px 82px 82px",
            border: "1px solid rgba(255,255,255,0.48)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: shine,
            top: 0,
            width: 74,
            height: "100%",
            transform: "skewX(-14deg)",
            background:
              "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.72), rgba(255,255,255,0))",
            opacity: 0.54,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 28,
            right: 28,
            top: 392,
            height: 188,
            borderRadius: 6,
            background: "rgba(248,255,253,0.88)",
            color: "#073037",
            padding: "30px 24px",
            textAlign: "center",
            boxShadow: "0 18px 54px rgba(3, 56, 63, 0.16)",
          }}
        >
          <div style={{ fontSize: 52, lineHeight: 1, fontWeight: 900 }}>MIZU</div>
          <div style={{ marginTop: 12, fontSize: 20, fontWeight: 680 }}>{productName}</div>
          <div style={{ marginTop: 10, fontSize: 14, opacity: 0.62 }}>NATURAL MINERAL WATER</div>
        </div>
      </div>
    </div>
  );
}

const visualScenes = [
  {
    sceneIndex: 0,
    tiles: [
      { kind: "pack", label: "冰感瓶身", x: 66, y: 180, w: 245, h: 330, rotate: -4, delay: 0 },
      { kind: "splash", label: "清冽水花", x: 330, y: 245, w: 260, h: 210, rotate: 3, delay: 8 },
      { kind: "macro", label: "凝露细节", x: 120, y: 530, w: 300, h: 240, rotate: 2, delay: 15 },
    ],
  },
  {
    sceneIndex: 1,
    tiles: [
      { kind: "mountain", label: "天然水源", x: 420, y: 330, w: 292, h: 248, rotate: -5, delay: 0 },
      { kind: "mineral", label: "矿物质感", x: 120, y: 520, w: 250, h: 280, rotate: 4, delay: 10 },
      { kind: "splash", label: "入口轻盈", x: 420, y: 635, w: 220, h: 190, rotate: 6, delay: 18 },
    ],
  },
  {
    sceneIndex: 2,
    tiles: [
      { kind: "commute", label: "通勤", x: 610, y: 260, w: 300, h: 230, rotate: 3, delay: 0 },
      { kind: "gym", label: "运动", x: 575, y: 530, w: 260, h: 255, rotate: -5, delay: 12 },
      { kind: "desk", label: "办公", x: 650, y: 830, w: 250, h: 210, rotate: 4, delay: 24 },
    ],
  },
  {
    sceneIndex: 3,
    tiles: [
      { kind: "macro", label: "口感清透", x: 480, y: 260, w: 300, h: 300, rotate: 5, delay: 0 },
      { kind: "splash", label: "不甜不腻", x: 125, y: 480, w: 280, h: 230, rotate: -4, delay: 8 },
      { kind: "mineral", label: "随时补水", x: 520, y: 665, w: 250, h: 250, rotate: -2, delay: 18 },
    ],
  },
  {
    sceneIndex: 4,
    tiles: [
      { kind: "pack", label: "单瓶装", x: 620, y: 230, w: 230, h: 315, rotate: -5, delay: 0 },
      { kind: "pack", label: "家庭装", x: 785, y: 470, w: 210, h: 285, rotate: 5, delay: 8 },
      { kind: "splash", label: "尝鲜优惠", x: 540, y: 705, w: 260, h: 200, rotate: 2, delay: 16 },
    ],
  },
] as const;

function SceneImageStacks({
  frame,
  productName,
}: {
  frame: number;
  productName: string;
}) {
  return (
    <>
      {visualScenes.map((scene) => (
        <div
          key={scene.sceneIndex}
          style={{
            position: "absolute",
            inset: 0,
            opacity: sceneOpacity(frame, scene.sceneIndex),
          }}
        >
          {scene.tiles.map((tile, index) => (
            <VisualTile
              key={`${scene.sceneIndex}-${tile.kind}-${index}`}
              frame={frame}
              sceneIndex={scene.sceneIndex}
              productName={productName}
              {...tile}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function VisualTile({
  frame,
  sceneIndex,
  productName,
  kind,
  label,
  x,
  y,
  w,
  h,
  rotate,
  delay,
}: {
  frame: number;
  sceneIndex: number;
  productName: string;
  kind: "pack" | "splash" | "macro" | "mountain" | "mineral" | "commute" | "gym" | "desk";
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
  delay: number;
}) {
  const local = sceneFrame(frame, sceneIndex);
  const appear = interpolate(local, [delay, delay + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const drift = interpolate(local, [0, scenes[sceneIndex]!.to - scenes[sceneIndex]!.from], [0, -18]);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + drift,
        width: w,
        height: h,
        borderRadius: 8,
        overflow: "hidden",
        opacity: appear * 0.92,
        transform: `translateY(${interpolate(appear, [0, 1], [46, 0])}px) scale(${interpolate(appear, [0, 1], [0.92, 1])}) rotate(${rotate}deg)`,
        boxShadow: "0 24px 70px rgba(2, 40, 45, 0.28)",
        border: "1px solid rgba(255,255,255,0.45)",
        background: "rgba(240,255,252,0.2)",
      }}
    >
      <TileArt kind={kind} productName={productName} />
      <div
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: 14,
          padding: "10px 12px",
          borderRadius: 4,
          background: "rgba(7,48,55,0.66)",
          color: "#F8FFFD",
          fontSize: 18,
          fontWeight: 760,
          backdropFilter: "blur(8px)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function TileArt({
  kind,
  productName,
}: {
  kind: "pack" | "splash" | "macro" | "mountain" | "mineral" | "commute" | "gym" | "desk";
  productName: string;
}) {
  if (kind === "pack") {
    return (
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #EFFFFB, #7ABFC2)" }}>
        <div style={{ position: "absolute", left: "36%", top: 34, width: "28%", height: "70%", borderRadius: 42, background: "rgba(255,255,255,0.48)", border: "1px solid rgba(255,255,255,0.78)" }} />
        <div style={{ position: "absolute", left: "31%", top: "46%", width: "38%", height: 54, borderRadius: 4, background: "#F8FFFD", color: "#073037", fontSize: 15, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{productName}</div>
      </AbsoluteFill>
    );
  }

  if (kind === "mountain") {
    return (
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #DDF8F6 0%, #8BC9CC 58%, #1F666D 100%)" }}>
        <div style={{ position: "absolute", left: -20, right: -20, bottom: 0, height: "58%", clipPath: "polygon(0 62%, 22% 18%, 40% 52%, 58% 12%, 78% 58%, 100% 25%, 100% 100%, 0 100%)", background: "rgba(7,48,55,0.5)" }} />
        <div style={{ position: "absolute", left: -10, right: -10, bottom: 0, height: "38%", background: "rgba(255,255,255,0.24)" }} />
      </AbsoluteFill>
    );
  }

  if (kind === "commute" || kind === "gym" || kind === "desk") {
    const accent = kind === "gym" ? "#D6F1EA" : kind === "desk" ? "#F3FFFC" : "#C3E8E5";
    return (
      <AbsoluteFill style={{ background: `linear-gradient(145deg, ${accent}, #2A747B)` }}>
        <div style={{ position: "absolute", left: 26, top: 32, width: 92, height: 92, borderRadius: 8, background: "rgba(255,255,255,0.36)" }} />
        <div style={{ position: "absolute", right: 24, top: 52, width: 112, height: 160, borderRadius: 8, border: "2px solid rgba(255,255,255,0.56)" }} />
        <div style={{ position: "absolute", left: 28, right: 28, bottom: 50, height: 5, background: "rgba(255,255,255,0.55)" }} />
        <div style={{ position: "absolute", left: 28, width: 140, bottom: 72, height: 5, background: "rgba(255,255,255,0.35)" }} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        background:
          kind === "macro"
            ? "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.88), rgba(139,213,212,0.7) 38%, #2A747B 100%)"
            : kind === "mineral"
              ? "linear-gradient(135deg, #F1FFFC, #73BFC3 45%, #15505A)"
              : "radial-gradient(circle at 35% 32%, rgba(255,255,255,0.9), rgba(178,232,229,0.5) 28%, #2A747B 100%)",
      }}
    >
      {[0, 1, 2, 3, 4].map((index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: `${18 + index * 15}%`,
            top: `${20 + (index % 2) * 22}%`,
            width: 34 + index * 9,
            height: 34 + index * 9,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.56)",
            background: "rgba(255,255,255,0.18)",
          }}
        />
      ))}
    </AbsoluteFill>
  );
}

function TopBrand({ productName }: { productName: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 68,
        left: 64,
        right: 64,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 24,
        fontWeight: 650,
        color: "rgba(250,255,253,0.92)",
      }}
    >
      <div>{productName}</div>
      <div style={{ fontSize: 18, fontWeight: 500, opacity: 0.74 }}>15s CLEAN WATER CUT</div>
    </div>
  );
}

function HookScene({ frame, fps, title }: { frame: number; fps: number; title: string }) {
  const opacity = sceneOpacity(frame, 0);
  const local = sceneFrame(frame, 0);
  const enter = spring({ fps, frame: local, config: { damping: 145, mass: 0.85 } });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 210,
          transform: `translateY(${interpolate(enter, [0, 1], [36, 0])}px)`,
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 560,
            color: "rgba(239,255,251,0.82)",
          }}
        >
          不是甜，是清冽
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 86,
            lineHeight: 0.96,
            fontWeight: 860,
            color: "#FFFFFF",
            textShadow: "0 20px 58px rgba(0,0,0,0.36)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 26,
            width: 168,
            height: 4,
            borderRadius: 99,
            background: "#FFFFFF",
            transform: `scaleX(${interpolate(local, [6, 28], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })})`,
            transformOrigin: "left center",
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

function SourceScene({ frame }: { frame: number }) {
  const opacity = sceneOpacity(frame, 1);
  const progress = inOut(frame, 1);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: 305,
          color: "#FFFFFF",
          transform: `translateX(${interpolate(progress, [0, 1], [-28, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 26, opacity: 0.78 }}>天然矿泉水源</div>
        <div style={{ marginTop: 12, fontSize: 64, lineHeight: 1.05, fontWeight: 820 }}>
          水感干净
          <br />
          入口轻盈
        </div>
      </div>
      <FeatureRail
        frame={frame}
        sceneIndex={1}
        items={["天然矿泉", "清冽口感", "低负担补水"]}
      />
    </AbsoluteFill>
  );
}

function ScenarioScene({ frame }: { frame: number }) {
  const opacity = sceneOpacity(frame, 2);
  const local = sceneFrame(frame, 2);
  const cards = [
    { label: "通勤包里", sub: "轻松带走", delay: 0 },
    { label: "运动之后", sub: "快速补水", delay: 14 },
    { label: "办公桌边", sub: "清爽续航", delay: 28 },
  ];

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 190,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {cards.map((card) => {
          const cardIn = interpolate(local, [card.delay, card.delay + 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          return (
            <div
              key={card.label}
              style={{
                width: 500,
                padding: "22px 0",
                borderBottom: "1px solid rgba(255,255,255,0.42)",
                color: "#FFFFFF",
                textShadow: "0 14px 34px rgba(0,0,0,0.28)",
                transform: `translateX(${interpolate(cardIn, [0, 1], [-54, 0])}px)`,
                opacity: cardIn,
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 820 }}>{card.label}</div>
              <div style={{ marginTop: 8, fontSize: 22, opacity: 0.7 }}>{card.sub}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function TextureScene({ frame }: { frame: number }) {
  const opacity = sceneOpacity(frame, 3);
  const local = sceneFrame(frame, 3);
  const slide = interpolate(local, [0, 30], [44, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 230,
          transform: `translateY(${slide}px)`,
        }}
      >
        <div style={{ fontSize: 30, opacity: 0.78 }}>喝水这件小事</div>
        <div style={{ marginTop: 14, fontSize: 74, lineHeight: 1.02, fontWeight: 860 }}>
          也值得
          <br />
          认真一点
        </div>
        <div style={{ marginTop: 28, display: "flex", gap: 14 }}>
          <MiniSpec text="不甜不腻" />
          <MiniSpec text="口感清透" />
          <MiniSpec text="随时补水" />
        </div>
      </div>
    </AbsoluteFill>
  );
}

function CtaScene({
  frame,
  productName,
}: {
  frame: number;
  productName: string;
}) {
  const opacity = sceneOpacity(frame, 4);
  const local = sceneFrame(frame, 4);
  const panel = interpolate(local, [0, 22], [160, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 520,
          background: "rgba(248, 255, 253, 0.94)",
          color: "#073037",
          padding: "58px 64px",
          transform: `translateY(${panel}px)`,
          boxShadow: "0 -28px 80px rgba(0,0,0,0.24)",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 620, opacity: 0.66 }}>{productName}</div>
        <div style={{ marginTop: 16, fontSize: 70, lineHeight: 1.02, fontWeight: 880 }}>
          把清冽
          <br />
          带在身边
        </div>
        <div
          style={{
            marginTop: 34,
            display: "inline-flex",
            padding: "18px 24px",
            borderRadius: 4,
            background: "#08333A",
            color: "#F8FFFD",
            fontSize: 28,
            fontWeight: 750,
          }}
        >
          评论「补水」领取尝鲜优惠
        </div>
      </div>
    </AbsoluteFill>
  );
}

function FeatureRail({
  frame,
  sceneIndex,
  items,
}: {
  frame: number;
  sceneIndex: number;
  items: string[];
}) {
  const local = sceneFrame(frame, sceneIndex);

  return (
    <div
      style={{
        position: "absolute",
        right: 52,
        bottom: 190,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {items.map((item, index) => {
        const appear = interpolate(local, [index * 10, index * 10 + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        return (
          <div
            key={item}
            style={{
              padding: "16px 20px",
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.52)",
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(10px)",
              fontSize: 24,
              fontWeight: 690,
              transform: `translateY(${interpolate(appear, [0, 1], [24, 0])}px)`,
              opacity: appear,
            }}
          >
            {item}
          </div>
        );
      })}
    </div>
  );
}

function MiniSpec({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "14px 18px",
        borderRadius: 4,
        background: "rgba(255,255,255,0.16)",
        border: "1px solid rgba(255,255,255,0.32)",
        color: "#FFFFFF",
        fontSize: 23,
        fontWeight: 700,
      }}
    >
      {text}
    </div>
  );
}

function WaterLines({ frame }: { frame: number }) {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: 64 + index * 150,
            top: interpolate((frame + index * 26) % 130, [0, 130], [-260, 1980]),
            width: 1,
            height: 220,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.42), rgba(255,255,255,0))",
            opacity: 0.45,
          }}
        />
      ))}
    </>
  );
}

function FlashCut({ frame }: { frame: number }) {
  const cuts = [60, 150, 270, 360];
  const opacity = cuts.reduce((max, cut) => {
    const distance = Math.abs(frame - cut);
    const value = interpolate(distance, [0, 8], [0.22, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return Math.max(max, value);
  }, 0);

  return <AbsoluteFill style={{ background: "#FFFFFF", opacity }} />;
}

function ProgressBar({ frame }: { frame: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 64,
        right: 64,
        bottom: 50,
        height: 3,
        background: "rgba(255,255,255,0.24)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${(frame / 450) * 100}%`,
          background: "#F8FFFD",
        }}
      />
    </div>
  );
}
