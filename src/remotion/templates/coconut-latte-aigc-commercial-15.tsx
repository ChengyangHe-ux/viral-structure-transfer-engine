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
import type { TechniqueTransferScene } from "@/lib/technique-transfer";
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
type SceneRange = {
  start: number;
  end: number;
  accent: string;
  title: string;
};

type TransferredScene = {
  range: SceneRange;
  transfer?: TechniqueTransferScene;
};

const fallbackSceneRanges = [
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

function sceneOpacity(frame: number, scene: SceneRange) {
  return calculateSceneOpacity({
    frame,
    start: scene.start,
    end: scene.end,
    fadeInFrames: 12,
    fadeOutFrames: 16,
    overlapInFrames: 14,
  });
}

function sceneProgress(frame: number, scene: SceneRange) {
  return interpolate(frame, [scene.start, scene.end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
}

function localFrame(frame: number, scene: SceneRange) {
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

function compactText(text: string | undefined, maxLength: number) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1))}…`;
}

function transferText(transfer: TechniqueTransferScene | undefined) {
  if (!transfer) return "";
  return [
    transfer.sourcePurpose,
    transfer.transferableRule,
    transfer.outputPurpose,
    transfer.outputLine,
    transfer.mappedTechnique,
  ].join(" ");
}

function isCtaTransfer(transfer: TechniqueTransferScene | undefined) {
  return /cta|结尾|行动|转化|收束|入口|收藏|领取|购买|下单/i.test(transferText(transfer));
}

function isProofTransfer(transfer: TechniqueTransferScene | undefined) {
  return /证据|背书|可信|证明|评价|参数|为什么|成立|商品|特写|第一/.test(transferText(transfer));
}

function isBenefitTransfer(transfer: TechniqueTransferScene | undefined) {
  return /收益|场景|适用|使用|通勤|工位|下午|第二|利益|价值/.test(transferText(transfer));
}

function uniqueTransfers(items: Array<TechniqueTransferScene | undefined>) {
  const seen = new Set<number>();
  return items.filter((item): item is TechniqueTransferScene => {
    if (!item || seen.has(item.index)) return false;
    seen.add(item.index);
    return true;
  });
}

function selectCommercialTransfers(renderTimeline: RenderTimeline | null) {
  const transfers = renderTimeline?.transferRecipe?.sceneTransfers ?? [];
  if (!transfers.length) return [] as TechniqueTransferScene[];

  const first = transfers[0];
  const cta = [...transfers].reverse().find(isCtaTransfer) ?? transfers.at(-1);
  const proof = transfers.find((transfer, index) => index > 0 && isProofTransfer(transfer));
  const benefit = transfers.find(
    (transfer, index) =>
      index > 0 && transfer.index !== proof?.index && transfer.index !== cta?.index && isBenefitTransfer(transfer),
  );
  const picked = uniqueTransfers([first, proof, benefit, cta]);
  for (const transfer of transfers) {
    if (picked.length >= 4) break;
    if (!picked.some((item) => item.index === transfer.index)) picked.push(transfer);
  }

  return picked.slice(0, 4);
}

function allocateFrameDurations(transfers: TechniqueTransferScene[]) {
  const count = Math.max(1, transfers.length);
  const minimum = count >= 4 ? 76 : 90;
  const weights = transfers.map((transfer) => Math.max(0.04, transfer.durationWeight || 0.1));
  const fixed = new Set<number>();
  const durations = new Array(count).fill(0) as number[];

  for (let pass = 0; pass < count; pass += 1) {
    const remainingTotal = TOTAL_FRAMES - [...fixed].reduce((sum, index) => sum + durations[index]!, 0);
    const remainingWeight = weights.reduce(
      (sum, weight, index) => (fixed.has(index) ? sum : sum + weight),
      0,
    );
    let changed = false;
    for (let index = 0; index < count; index += 1) {
      if (fixed.has(index)) continue;
      const duration = Math.round((weights[index]! / remainingWeight) * remainingTotal);
      if (duration < minimum) {
        durations[index] = minimum;
        fixed.add(index);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const fixedTotal = [...fixed].reduce((sum, index) => sum + durations[index]!, 0);
  const remainingIndices = weights.map((_, index) => index).filter((index) => !fixed.has(index));
  const remainingWeight = remainingIndices.reduce((sum, index) => sum + weights[index]!, 0);
  let cursorTotal = fixedTotal;
  for (const index of remainingIndices) {
    durations[index] = Math.round((weights[index]! / remainingWeight) * (TOTAL_FRAMES - fixedTotal));
    cursorTotal += durations[index]!;
  }
  durations[count - 1] = Math.max(minimum, durations[count - 1]! + (TOTAL_FRAMES - cursorTotal));

  return durations;
}

function buildTransferredScenes(renderTimeline: RenderTimeline | null): TransferredScene[] {
  const transfers = selectCommercialTransfers(renderTimeline);
  if (!transfers.length) {
    return fallbackSceneRanges.map((range) => ({ range }));
  }

  const durations = allocateFrameDurations(transfers);
  let cursor = 0;
  return fallbackSceneRanges.map((fallback, index) => {
    const transfer = transfers[index];
    if (!transfer) return { range: fallback };
    const duration = index === transfers.length - 1 ? TOTAL_FRAMES - cursor : durations[index]!;
    const range = {
      ...fallback,
      start: cursor,
      end: index === transfers.length - 1 ? TOTAL_FRAMES : cursor + duration,
      title: compactText(transfer.outputPurpose, 18) || fallback.title,
    };
    cursor = range.end;
    return { range, transfer };
  });
}

function transferHeadline(transfer: TechniqueTransferScene | undefined, fallback: string) {
  return compactText(transfer?.outputPurpose, 16) || fallback;
}

function transferSubline(transfer: TechniqueTransferScene | undefined, fallback: string) {
  if (!transfer) return fallback;
  return compactText(`源 ${transfer.sampleTimeRange}：${transfer.transferableRule}`, 31);
}

function transferCaption(transfer: TechniqueTransferScene | undefined, fallback: string[]) {
  if (!transfer) return fallback;
  const materialLabel =
    transfer.materialFit === "missing"
      ? "补素材"
      : transfer.materialFit === "partial"
        ? "包装补全"
        : "素材已匹配";
  const tags = [
    `源${transfer.sampleTimeRange.replace(/秒/g, "s")}`,
    compactText(transfer.outputPurpose, 7),
    materialLabel,
  ].filter(Boolean);
  return tags.length >= 3 ? tags.slice(0, 3) : fallback;
}

function sourceFocusLabel(transfer: TechniqueTransferScene) {
  const text = transferText(transfer);
  if (/hook|开头|停留|吸引|反差/i.test(text)) return "HOOK";
  if (/cta|结尾|行动|转化|收束|入口/i.test(text)) return "CTA";
  if (/证据|背书|可信|证明|评价|参数/.test(text)) return "证据";
  if (/收益|场景|使用|适用|通勤|工位/.test(text)) return "场景";
  return "推进";
}

function transferStructure(transfer: TechniqueTransferScene | undefined, fallback: string) {
  if (!transfer) return fallback;
  return `${sourceFocusLabel(transfer)} / 源 ${transfer.sampleTimeRange}`;
}

function transferGapLabel(transfer: TechniqueTransferScene | undefined, fallback: string) {
  if (!transfer) return fallback;
  return compactText(`${transfer.materialSlotName}：${transfer.completionPlan}`, 32);
}

function materialActionLabel(transfer: TechniqueTransferScene | undefined) {
  if (!transfer) return "补素材";
  if (transfer.materialFit === "missing") return "补素材";
  if (transfer.materialFit === "partial") return "包装补全";
  return "素材";
}

function transferProofItems(transfer: TechniqueTransferScene | undefined, fallback: string[]) {
  if (!transfer) return fallback;
  return [
    `样例 ${transfer.sampleTimeRange}`,
    compactText(transfer.transferableRule, 12),
    compactText(transfer.outputPurpose, 12),
  ];
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
  const transferredScenes = buildTransferredScenes(renderTimeline);
  const cutFrames = transferredScenes
    .slice(1)
    .map((scene) => scene.range.start)
    .filter((cut) => cut > 0 && cut < TOTAL_FRAMES);

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
        sceneRange={transferredScenes[0]?.range ?? fallbackSceneRanges[0]}
        transfer={transferredScenes[0]?.transfer}
        imagePath={imageForScene({ imageAssets, sceneAssetDecisions, index: 0 })}
        videoPath={
          decisionAt(sceneAssetDecisions, 0)?.riskFlags.includes(heroVideoApprovalFlag)
            ? videoForScene({ videoAssets, sceneAssetDecisions, index: 0 })
            : null
        }
        eyebrow="NEW / LOW SUGAR"
        headline={transferHeadline(transferredScenes[0]?.transfer, title || fallbackSceneRanges[0].title)}
        subline={transferSubline(
          transferredScenes[0]?.transfer,
          "低糖、椰香、咖啡后劲，把下午三点拉回来。",
        )}
        caption={transferCaption(transferredScenes[0]?.transfer, ["别划走", "关键不是甜", "是喝完很轻松"])}
        structure={transferStructure(transferredScenes[0]?.transfer, "HOOK / 结果前置")}
        gapLabel={transferGapLabel(transferredScenes[0]?.transfer, "稳定商品图 + Remotion 推镜")}
        proofItems={transferProofItems(transferredScenes[0]?.transfer, [
          "样例开头迁移",
          "反差字幕",
          "0-3s 抢停留",
        ])}
      />
      <AigcScene
        frame={frame}
        index={1}
        sceneRange={transferredScenes[1]?.range ?? fallbackSceneRanges[1]}
        transfer={transferredScenes[1]?.transfer}
        imagePath={imageForScene({ imageAssets, sceneAssetDecisions, index: 1 })}
        videoPath={videoForScene({ videoAssets, sceneAssetDecisions, index: 1 })}
        eyebrow="CREAMY POUR"
        headline={transferHeadline(transferredScenes[1]?.transfer, fallbackSceneRanges[1].title)}
        subline={transferSubline(transferredScenes[1]?.transfer, "咖啡后劲跟上，甜感收得更轻。")}
        caption={transferCaption(transferredScenes[1]?.transfer, ["椰香先出来", "咖啡后劲跟上", "甜感收得轻"])}
        structure={transferStructure(transferredScenes[1]?.transfer, "证据 / 卖点推进")}
        gapLabel={transferGapLabel(transferredScenes[1]?.transfer, "AIGC 微距补制作镜头")}
        proofItems={transferProofItems(transferredScenes[1]?.transfer, ["椰香", "低糖", "咖啡后劲"])}
        dark
      />
      <AigcScene
        frame={frame}
        index={2}
        sceneRange={transferredScenes[2]?.range ?? fallbackSceneRanges[2]}
        transfer={transferredScenes[2]?.transfer}
        imagePath={imageForScene({ imageAssets, sceneAssetDecisions, index: 2 })}
        videoPath={videoForScene({ videoAssets, sceneAssetDecisions, index: 2 })}
        eyebrow="AFTERNOON RESET"
        headline={transferHeadline(transferredScenes[2]?.transfer, fallbackSceneRanges[2].title)}
        subline={transferSubline(
          transferredScenes[2]?.transfer,
          "通勤、工位、赶作业，都要醒得柔和一点。",
        )}
        caption={transferCaption(transferredScenes[2]?.transfer, ["下午三点", "醒得柔和", "不腻口"])}
        structure={transferStructure(transferredScenes[2]?.transfer, "场景 / 素材适配")}
        gapLabel={transferGapLabel(transferredScenes[2]?.transfer, "通勤场景补全")}
        proofItems={transferProofItems(transferredScenes[2]?.transfer, ["工位", "通勤", "下午三点"])}
      />
      <AigcScene
        frame={frame}
        index={3}
        sceneRange={transferredScenes[3]?.range ?? fallbackSceneRanges[3]}
        transfer={transferredScenes[3]?.transfer}
        imagePath={imageForScene({ imageAssets, sceneAssetDecisions, index: 3 })}
        videoPath={videoForScene({ videoAssets, sceneAssetDecisions, index: 3 })}
        eyebrow="TRY TODAY"
        headline={transferHeadline(transferredScenes[3]?.transfer, fallbackSceneRanges[3].title)}
        subline={transferSubline(transferredScenes[3]?.transfer, `低糖轻乳 · ${productName}`)}
        caption={transferCaption(transferredScenes[3]?.transfer, ["低糖轻乳", "下午三点", "来一杯"])}
        structure={transferStructure(transferredScenes[3]?.transfer, "CTA / 转化收束")}
        gapLabel={transferGapLabel(transferredScenes[3]?.transfer, "主视觉复用 + 行动入口")}
        proofItems={transferProofItems(transferredScenes[3]?.transfer, ["限时", "低糖轻乳", "到店"])}
        dark
        cta
      />

      <CommercialLightLeaks cuts={cutFrames} />
      <CutFlashes frame={frame} cuts={cutFrames} />
      <ProgressRail frame={frame} />
      <FilmGrain frame={frame} />
    </AbsoluteFill>
  );
}

function AigcScene({
  frame,
  index,
  sceneRange,
  transfer,
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
  sceneRange: SceneRange;
  transfer?: TechniqueTransferScene;
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
  const opacity = sceneOpacity(frame, sceneRange);
  const progress = sceneProgress(frame, sceneRange);
  const local = localFrame(frame, sceneRange);
  const enter = spring({ frame: local, fps, config: { damping: 160, stiffness: 190, mass: 0.78 } });
  const scene = sceneRange;
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
        transfer={transfer}
        accent={scene.accent}
        dark={dark}
      />
      <GapFillLabel
        frame={local}
        text={gapLabel}
        label={materialActionLabel(transfer)}
        accent={scene.accent}
        dark={dark}
      />
      {cta ? <CtaButton text={subline} accent={scene.accent} /> : null}
      <CaptionBlock frame={local} caption={caption} accent={scene.accent} dark={dark} />
      <SceneBadge index={index} accent={scene.accent} dark={dark} />
    </AbsoluteFill>
  );
}

function CommercialLightLeaks({ cuts }: { cuts: number[] }) {
  const hueShifts = [28, 204, 338];

  return (
    <>
      {cuts.map((cut, index) => (
        <LightLeak
          durationInFrames={28}
          from={cut - 14}
          hueShift={hueShifts[index % hueShifts.length] ?? 28}
          key={cut}
          seed={12 + index * 17}
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
  transfer,
  accent,
  dark,
}: {
  frame: number;
  items: string[];
  transfer?: TechniqueTransferScene;
  accent: string;
  dark: boolean;
}) {
  const visibleItems = transfer
    ? [
        `源 ${transfer.sampleTimeRange}`,
        compactText(transfer.transferableRule, 14),
        compactText(transfer.outputPurpose, 14),
      ]
    : items;

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
      {visibleItems.map((item, index) => {
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
  label,
  accent,
  dark,
}: {
  frame: number;
  text: string;
  label: string;
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
      <span style={{ color: accent, fontWeight: 990 }}>{label}</span>
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

function CutFlashes({ frame, cuts }: { frame: number; cuts: number[] }) {
  const opacity = cuts.reduce((max, cut) => {
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
