import { Composition } from "remotion";

import { VideoFromPlan, type VideoFromPlanProps } from "@/remotion/video-from-plan";

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
        defaultProps={{
          title: "爆款结构迁移引擎（结构演示稿）",
          plan: null,
        } satisfies VideoFromPlanProps}
      />
    </>
  );
}
