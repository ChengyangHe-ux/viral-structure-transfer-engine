import { describe, expect, it } from "vitest";

import {
  decideSceneAssetUsage,
  heroVideoApprovalFlag,
  isSceneVideoAllowed,
} from "@/lib/render-policy";
import {
  classifyBeatFocus,
  compactText,
  calculateSceneOpacity,
  extractHighlightText,
  getFocusSceneStyle,
  getMaterialFitSummary,
  splitSubtitleLines,
} from "@/remotion/video-style";

describe("video-style", () => {
  it("classifies CTA before generic benefit wording", () => {
    expect(classifyBeatFocus("结尾行动：收藏领取方案，推动转化")).toBe("CTA");
  });

  it("classifies hook and evidence beats", () => {
    expect(classifyBeatFocus("开头反差抢停留")).toBe("Hook");
    expect(classifyBeatFocus("用用户反馈和数据证明可信")).toBe("证据");
  });

  it("returns varied fallback scene styles for generic beats", () => {
    const first = getFocusSceneStyle("推进", 0);
    const second = getFocusSceneStyle("推进", 1);

    expect(first.accent).not.toBe(second.accent);
  });

  it("splits subtitle text into bounded lines", () => {
    const lines = splitSubtitleLines(
      "别再用老方法做学习平板了，关键其实是这一点。",
      8,
      3,
    );

    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.every((line) => line.length <= 9)).toBe(true);
  });

  it("packs short punctuation chunks instead of wasting subtitle rows", () => {
    const lines = splitSubtitleLines(
      "第二，它不是看起来高级，而是真的能在日常场景里少踩坑。",
      15,
      3,
    );

    expect(lines).toEqual(["第二，它不是看起来高级，", "而是真的能在日常场景里少踩坑。"]);
  });

  it("summarizes material fit for on-video badges", () => {
    expect(getMaterialFitSummary("matched")).toMatchObject({
      fit: "matched",
      label: "素材可用",
    });
    expect(getMaterialFitSummary("missing")).toMatchObject({
      fit: "missing",
      label: "缺口待补",
    });
  });

  it("compacts and extracts highlight text", () => {
    expect(compactText("abcdef", 4)).toBe("abc…");
    expect(extractHighlightText("把商品信息提前，让用户马上理解价值", 6)).toBe("把商品信息…");
  });

  it("keeps generated video out of the first commercial scene by default", () => {
    const [heroDecision] = decideSceneAssetUsage(
      {
        assets: [
          {
            id: "generated-closeup",
            path: "render-sources/generated-closeup.mp4",
            kind: "video",
            slotKind: "hero",
            sceneIndex: 0,
            source: "generated-video",
            riskFlags: [],
          },
        ],
      },
      4,
    );

    expect(heroDecision?.useVideo).toBe(false);
    expect(isSceneVideoAllowed(heroDecision)).toBe(false);
  });

  it("allows a generated hero video only after explicit human approval", () => {
    const [heroDecision] = decideSceneAssetUsage(
      {
        assets: [
          {
            id: "approved-generated-closeup",
            path: "render-sources/approved-closeup.mp4",
            kind: "video",
            slotKind: "hero",
            sceneIndex: 0,
            source: "generated-video",
            riskFlags: [heroVideoApprovalFlag],
          },
        ],
      },
      4,
    );

    expect(heroDecision?.useVideo).toBe(true);
    expect(isSceneVideoAllowed(heroDecision)).toBe(true);
  });

  it("keeps commercial scene cut frames visually covered", () => {
    const firstSceneAtCut = calculateSceneOpacity({ frame: 90, start: 90, end: 210 });
    const secondSceneAtCut = calculateSceneOpacity({ frame: 210, start: 210, end: 330 });
    const thirdSceneAtCut = calculateSceneOpacity({ frame: 330, start: 330, end: 450 });
    const previousSceneBeforeCut = calculateSceneOpacity({ frame: 209, start: 90, end: 210 });

    expect(firstSceneAtCut).toBeGreaterThan(0.35);
    expect(secondSceneAtCut).toBeGreaterThan(0.35);
    expect(thirdSceneAtCut).toBeGreaterThan(0.35);
    expect(previousSceneBeforeCut).toBeGreaterThan(0);
  });
});
