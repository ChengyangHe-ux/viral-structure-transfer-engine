import { describe, expect, it } from "vitest";

import { buildAssSubtitle, subtitleForShot } from "@/lib/video-packaging";
import type { AdaptiveTransferStoryboardShot } from "@/lib/adaptive-video-storyboard";

function shot(overrides: Partial<AdaptiveTransferStoryboardShot> = {}): AdaptiveTransferStoryboardShot {
  return {
    order: 1,
    slotId: "hook",
    role: "强钩子建立注意力",
    visual: "产品特写",
    rhythm: "快速切入",
    audio: "口播：3秒看懂这个工具的真正价值。字幕手法参考：大字压屏",
    editPoint: "底部字幕",
    sourceTimeRange: "0-5s",
    targetTimeRange: "0-5s",
    transferredTechnique: "先给结果",
    durationSeconds: 5,
    ...overrides,
  };
}

describe("video packaging subtitles", () => {
  it("cleans target subtitles without leaking style-reference text", () => {
    expect(subtitleForShot(shot(), 0)).toBe("3秒看懂这个工具的真正价值");
  });

  it("shortens noisy generated copy into readable two-line captions", () => {
    expect(
      subtitleForShot(
        shot({
          audio: "别再用老方法做做雪糕了，关键其实是这一点。；字幕手法参考：顶部长标题",
        }),
        0,
      ),
    ).toBe("别再用老方法做雪糕了");

    expect(
      subtitleForShot(
        shot({
          audio: "第一，它把最麻烦的一步提前处理掉，用户不需要重新学习流程。",
        }),
        1,
      ),
    ).toBe("最麻烦的一步\\N提前处理掉");
  });

  it("prefers target visual context over abstract voiceover copy", () => {
    const visual =
      "目标内容唯一锚点：做雪糕。第2段5秒，围绕「做雪糕」。迁移到新主题的画面：操作过程、使用前后对比、用户评价片段。";

    expect(
      subtitleForShot(
        shot({
          role: "主体识别与内容转向；卖点密集展开；效果证明与场景化落地",
          visual,
          audio: "第一，它把最麻烦的一步提前处理掉，用户不需要重新学习流程。",
        }),
        1,
      ),
    ).toBe("搅到顺滑\\N口感才细腻");

    expect(
      subtitleForShot(
        shot({
          role: "效果证明与场景化落地；结尾收束与转化引导",
          visual,
          audio: "效果、成本和上手门槛一次解决。",
        }),
        2,
      ),
    ).toBe("入模冷冻\\N最后看成品");
  });

  it("builds ASS subtitle events for each storyboard shot", () => {
    const ass = buildAssSubtitle({
      storyboard: [
        shot(),
        shot({
          order: 2,
          role: "卖点推进",
          audio: "第一，先把最麻烦的一步处理掉。",
          targetTimeRange: "5-10s",
        }),
      ],
      segmentSeconds: 5,
    });

    expect(ass).toContain("Style: Default");
    expect(ass).toContain("强钩子");
    expect(ass).toContain("卖点推进");
    expect(ass).toContain("Dialogue: 0,0:00:00.00,0:00:05.00");
    expect(ass).toContain("Dialogue: 0,0:00:05.00,0:00:10.00");
    expect(ass).toContain("3秒看懂这个工具的真正价值");
    expect(ass).not.toContain("字幕手法参考");
  });
});
