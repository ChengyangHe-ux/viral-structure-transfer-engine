import { describe, expect, it } from "vitest";

import {
  decideSceneAssetUsage,
  heroVideoApprovalFlag,
  isSceneVideoAllowed,
  type VisualAssetManifest,
} from "@/lib/render-policy";

describe("render policy", () => {
  it("rejects generated video for hero close-up slots", () => {
    const manifest: VisualAssetManifest = {
      assets: [
        {
          id: "hero-video",
          path: "render-sources/hero.mp4",
          kind: "video",
          slotKind: "hero",
          sceneIndex: 0,
          source: "generated-video",
          riskFlags: [],
        },
        {
          id: "hero-image",
          path: "render-sources/hero.png",
          kind: "image",
          slotKind: "hero",
          sceneIndex: 0,
          source: "aigc-image",
          riskFlags: [],
        },
      ],
    };

    const [heroDecision] = decideSceneAssetUsage(manifest, 4);

    expect(heroDecision).toMatchObject({
      sceneIndex: 0,
      imagePath: "render-sources/hero.png",
      videoPath: "render-sources/hero.mp4",
      useVideo: false,
      riskLevel: "high",
    });
    expect(isSceneVideoAllowed(heroDecision)).toBe(false);
  });

  it("allows generated video for broll and transition slots", () => {
    const manifest: VisualAssetManifest = {
      assets: [
        {
          id: "broll-video",
          path: "render-sources/broll.mp4",
          kind: "video",
          slotKind: "broll",
          sceneIndex: 2,
          source: "generated-video",
          riskFlags: [],
        },
      ],
    };

    const decisions = decideSceneAssetUsage(manifest, 4);

    expect(decisions[2]).toMatchObject({
      sceneIndex: 2,
      videoPath: "render-sources/broll.mp4",
      useVideo: true,
      riskLevel: "medium",
    });
    expect(isSceneVideoAllowed(decisions[2])).toBe(true);
  });

  it("records human approval when generated hero video is explicitly allowed", () => {
    const manifest: VisualAssetManifest = {
      assets: [
        {
          id: "approved-hero-video",
          path: "render-sources/approved-hero.mp4",
          kind: "video",
          slotKind: "hero",
          sceneIndex: 0,
          source: "generated-video",
          riskFlags: [heroVideoApprovalFlag],
        },
      ],
    };

    const [heroDecision] = decideSceneAssetUsage(manifest, 1);

    expect(heroDecision?.useVideo).toBe(true);
    expect(isSceneVideoAllowed(heroDecision)).toBe(true);
  });
});
