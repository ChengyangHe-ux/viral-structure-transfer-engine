import { describe, expect, it } from "vitest";

import { buildAdaptiveTransferStoryboard } from "@/lib/adaptive-video-storyboard";
import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";

describe("adaptive transfer storyboard", () => {
  it("keeps a 15 second user requirement without hard-coding fixed roles", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "饮品爆款样片",
      sampleNotes: "开头结果前置，中段场景切换，结尾干净 CTA。",
    });
    const plan = createFallbackPlan({
      projectTitle: "露营咖啡",
      targetBrief: "做一个 15 秒露营咖啡新品视频，开头要抓人。",
      userMaterials: "咖啡杯特写、营地桌面、手冲过程、产品包装图。",
      analysis,
    });

    const storyboard = buildAdaptiveTransferStoryboard({
      analysis,
      beats: plan.versions[0]!.scriptBeats,
      targetBrief: plan.targetBrief,
      userMaterials: "咖啡杯特写、营地桌面、手冲过程、产品包装图。",
      segmentSeconds: 5,
    });

    expect(storyboard.targetDurationSeconds).toBe(15);
    expect(storyboard.shots).toHaveLength(3);
    expect(storyboard.shots[0]!.role).toContain("抓住注意力");
    expect(storyboard.shots[1]!.transferredTechnique).toContain("解释为什么成立");
    expect(storyboard.shots[0]!.visual).toContain("只迁移样片手法");
    expect(storyboard.strategy).toContain("自适应迁移");
  });

  it("uses sample duration and beat map to expand beyond three segments", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "长节奏样片",
      sampleNotes: "Hook、证据、收益、背书、CTA。",
      mediaMeta: { durationSeconds: 30, previewFrames: [], frameTimestamps: [], sourceKind: "manual" },
    });
    const plan = createFallbackPlan({
      projectTitle: "学习平板",
      targetBrief: "学习平板介绍视频，需要迁移样例节奏。",
      userMaterials: "平板正面图、错题页截图、家长周报截图。",
      analysis,
    });

    const storyboard = buildAdaptiveTransferStoryboard({
      analysis,
      beats: plan.versions[0]!.scriptBeats,
      targetBrief: plan.targetBrief,
      userMaterials: "平板正面图、错题页截图、家长周报截图。",
      segmentSeconds: 5,
    });

    expect(storyboard.targetDurationSeconds).toBe(30);
    expect(storyboard.shots).toHaveLength(6);
    expect(storyboard.sourceBeatCount).toBe(analysis.beatMap.length);
    expect(storyboard.shots.at(-1)!.transferredTechnique).toContain("完成转化");
  });
});
