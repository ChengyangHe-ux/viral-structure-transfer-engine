import { Composition } from "remotion";

import {
  ProductCommercial15,
  type ProductCommercial15Props,
} from "@/remotion/product-commercial-15";
import {
  HighQualityShort,
  type HighQualityShortProps,
} from "@/remotion/templates/high-quality-short";
import {
  CoffeeLaunchShort,
  type CoffeeLaunchShortProps,
} from "@/remotion/templates/coffee-launch-short";
import {
  CoconutLatteCommercial15,
  type CoconutLatteCommercial15Props,
} from "@/remotion/templates/coconut-latte-commercial-15";
import {
  CoconutLatteAigcCommercial15,
  type CoconutLatteAigcCommercial15Props,
} from "@/remotion/templates/coconut-latte-aigc-commercial-15";
import { VideoFromPlan, type VideoFromPlanProps } from "@/remotion/video-from-plan";
import { calculateVideoFramesFromPlan } from "@/remotion/video-metadata";

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="VideoFromPlan"
        component={VideoFromPlan}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={30 * 40}
        calculateMetadata={async ({ props }) => {
          const { totalFrames } = calculateVideoFramesFromPlan({
            plan: (props.plan ?? null) as VideoFromPlanProps["plan"],
            fps: 30,
          });
          return { durationInFrames: totalFrames };
        }}
        defaultProps={{
          title: "爆款结构迁移引擎（结构演示稿）",
          plan: null,
          analysis: null,
        } satisfies VideoFromPlanProps}
      />
      <Composition
        id="HighQualityShort"
        component={HighQualityShort}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={30 * 42}
        calculateMetadata={async ({ props }) => {
          const renderTimeline = (props.renderTimeline ??
            null) as HighQualityShortProps["renderTimeline"];
          return {
            durationInFrames: renderTimeline?.totalFrames
              ? renderTimeline.totalFrames
              : 30 * 42,
          };
        }}
        defaultProps={{
          title: "爆款结构迁移引擎（高质量成片）",
          plan: null,
          renderTimeline: null,
        } satisfies HighQualityShortProps}
      />
      <Composition
        id="ProductCommercial15"
        component={ProductCommercial15}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={30 * 15}
        defaultProps={{
          title: "这一口，很清冽",
          productName: "天然矿泉水",
          sourceVideoPath: null,
        } satisfies ProductCommercial15Props}
      />
      <Composition
        id="CoffeeLaunchShort"
        component={CoffeeLaunchShort}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={30 * 38}
        calculateMetadata={async ({ props }) => {
          const renderTimeline = (props.renderTimeline ??
            null) as CoffeeLaunchShortProps["renderTimeline"];
          return {
            durationInFrames: renderTimeline?.totalFrames
              ? renderTimeline.totalFrames
              : 30 * 38,
          };
        }}
        defaultProps={{
          title: "咖啡新品高质量有声版",
          plan: null,
          renderTimeline: null,
        } satisfies CoffeeLaunchShortProps}
      />
      <Composition
        id="CoconutLatteCommercial15"
        component={CoconutLatteCommercial15}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={30 * 15}
        defaultProps={{
          title: "别把它当普通拿铁",
          productName: "生椰轻乳拿铁",
          plan: null,
          renderTimeline: null,
        } satisfies CoconutLatteCommercial15Props}
      />
      <Composition
        id="CoconutLatteAigcCommercial15"
        component={CoconutLatteAigcCommercial15}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={30 * 15}
        defaultProps={{
          title: "别把它当普通拿铁",
          productName: "生椰轻乳拿铁",
          plan: null,
          renderTimeline: null,
          imageAssets: [],
          videoAssets: [],
          sceneAssetDecisions: [],
        } satisfies CoconutLatteAigcCommercial15Props}
      />
    </>
  );
}
