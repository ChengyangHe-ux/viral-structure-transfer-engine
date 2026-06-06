import { describe, expect, it } from "vitest";

import {
  buildCinematicConcatPlan,
  buildCinematicEditPlan,
  buildCinematicMaterialRenderPlan,
  buildCinematicShotDecision,
  cinematicPromptBlock,
} from "@/lib/cinematic-editing";
import type { AdaptiveTransferStoryboardShot } from "@/lib/adaptive-video-storyboard";

function shot(overrides: Partial<AdaptiveTransferStoryboardShot> = {}): AdaptiveTransferStoryboardShot {
  return {
    order: 1,
    slotId: "hook",
    role: "开头吸引镜头",
    visual: "目标内容唯一锚点：AI 简历工具。结果画面前置。",
    rhythm: "重拍切入",
    audio: "先给结果，再解释怎么做",
    editPoint: "少字强字幕",
    sourceTimeRange: "0-3s",
    targetTimeRange: "0-5s",
    transferredTechnique: "结果前置和快切节奏",
    durationSeconds: 5,
    ...overrides,
  };
}

describe("cinematic editing", () => {
  it("builds stage-specific cinematic decisions without black bars", () => {
    const plan = buildCinematicEditPlan({
      storyboard: [
        shot(),
        shot({ order: 2, slotId: "usage", role: "使用过程镜头" }),
        shot({ order: 3, slotId: "proof", role: "证据强化镜头" }),
        shot({ order: 4, slotId: "cta", role: "结尾收束镜头" }),
      ],
    });

    expect(plan.label).toBe("大片精剪");
    expect(plan.negativeRules.join(" ")).toContain("不加上下黑边");
    expect(plan.decisions.map((decision) => decision.stage)).toEqual([
      "hook",
      "process",
      "proof",
      "cta",
    ]);
    expect(plan.decisions[0]?.motionPlan).toContain("速度坡度");
    expect(plan.decisions[2]?.cameraTreatment).toContain("稳定");
  });

  it("adds cinematic language to AIGC prompt blocks", () => {
    const decision = buildCinematicShotDecision({ shot: shot() });
    const prompt = cinematicPromptBlock(decision);

    expect(prompt).toContain("大片精剪要求");
    expect(prompt).toContain("电影广告级开场镜头");
    expect(prompt).toContain("禁止黑边");
    expect(prompt).toContain("Logo");
  });

  it("turns cinematic decisions into executable material render plans", () => {
    const hookPlan = buildCinematicMaterialRenderPlan({
      decision: buildCinematicShotDecision({ shot: shot() }),
      slotId: "hook",
    });
    const proofPlan = buildCinematicMaterialRenderPlan({
      decision: buildCinematicShotDecision({
        shot: shot({ order: 3, slotId: "proof", role: "证据强化镜头" }),
      }),
      slotId: "proof",
    });

    expect(hookPlan.cropFilter).toContain("crop=1080:1920");
    expect(hookPlan.cropFilter).toContain("(in_h-out_h)*0.36");
    expect(hookPlan.imageZoomExpression).toContain("1.13");
    expect(hookPlan.trimBias).toBe("start");
    expect(hookPlan.segmentPolishFilters.join(",")).toContain("unsharp");

    expect(proofPlan.trimBias).toBe("end");
    expect(proofPlan.imageZoomExpression).toContain("1.08");
    expect(proofPlan.executionSummary).toContain("证据镜头");
  });

  it("builds a cinematic concat plan with subtle cross-segment transitions", () => {
    const concatPlan = buildCinematicConcatPlan({
      inputCount: 3,
      segmentSeconds: 5,
    });

    expect(concatPlan.outputLabel).toBe("[vout]");
    expect(concatPlan.filterComplex).toContain("[0:v]scale=1080:1920");
    expect(concatPlan.filterComplex).toContain("xfade=transition=fade");
    expect(concatPlan.filterComplex).toContain("offset=4.82");
    expect(concatPlan.filterComplex).toContain("offset=9.64");
    expect(concatPlan.summary).toContain("轻交叠转场");
  });
});
