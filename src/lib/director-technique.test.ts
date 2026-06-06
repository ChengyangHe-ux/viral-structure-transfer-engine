import { describe, expect, it } from "vitest";

import {
  buildDirectorTransferPlan,
  buildTechniqueProfile,
  buildTransferSlots,
} from "@/lib/director-technique";
import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";
import { attachMaterialAdaptation } from "@/lib/materials";
import type { VideoStructureAnalysis } from "@/lib/schemas";

function analysisWithBeat(
  title: string,
  beatPatch: Partial<VideoStructureAnalysis["beatMap"][number]>,
) {
  const analysis = createFallbackAnalysis({
    sampleTitle: title,
    sampleNotes: "用于测试样例人物和镜头语言提取。",
  });
  return {
    ...analysis,
    beatMap: [
      {
        ...analysis.beatMap[0]!,
        ...beatPatch,
      },
      ...analysis.beatMap.slice(1),
    ],
  };
}

describe("director technique model", () => {
  it("extracts presenter persona without copying sample identity", () => {
    const analysis = analysisWithBeat("真人口播样例", {
      shotPurpose: "达人半身口播讲解痛点",
      visualObservation: "真人露脸站在镜头前，半身构图，对着镜头讲解",
      transferableRule: "迁移口播站位和表情节奏，不迁移具体人物",
    });

    const profile = buildTechniqueProfile(analysis);
    const presenter = profile.personaRequirements.find((item) => item.mode === "presenter");

    expect(presenter?.identityPolicy).toContain("不复制样例人物身份");
    expect(profile.forbiddenToCopy.join(" ")).toContain("品牌");
  });

  it("extracts hands persona for operation-led samples", () => {
    const analysis = analysisWithBeat("手部操作样例", {
      shotPurpose: "手部操作展示制作过程",
      visualObservation: "手部拿起产品并完成倒入、点击和局部细节演示",
      transferableRule: "迁移手部动作节奏和过程拆分",
    });

    const profile = buildTechniqueProfile(analysis);

    expect(profile.personaRequirements.some((item) => item.mode === "hands")).toBe(true);
    expect(profile.shotLanguageRules.some((item) => item.framing === "close-up")).toBe(true);
  });

  it("keeps product-only samples from forcing people into the new video", () => {
    const analysis = analysisWithBeat("产品特写样例", {
      shotPurpose: "产品主视觉和细节特写",
      visualObservation: "商品包装、杯身、成品特写占满画面，没有真人出镜",
      transferableRule: "迁移主体特写和结果前置，不迁移原商品",
    });

    const profile = buildTechniqueProfile(analysis);

    expect(profile.personaRequirements.some((item) => item.mode === "product-only")).toBe(true);
    expect(profile.personaRequirements.find((item) => item.mode === "product-only")?.presence).toBe(
      "avoid",
    );
  });

  it("builds material requirement matrix from image, video, and copy inputs", () => {
    const analysis = analysisWithBeat("AI 工具样例", {
      shotPurpose: "界面录屏证明工具效果",
      visualObservation: "屏幕录制展示点击流程、前后对比和用户反馈截图",
      transferableRule: "迁移界面推进和证据顺序，不迁移样例 UI",
    });
    const basePlan = createFallbackPlan({
      projectTitle: "AI 简历工具",
      targetBrief: "面向大学生的 AI 简历优化工具",
      userMaterials:
        "产品界面截图 3 张、简历优化前后对比图 1 张、10 秒操作录屏 1 条、用户反馈文案文件、领取链接。",
      analysis,
    });
    const plan = attachMaterialAdaptation({
      plan: basePlan,
      targetBrief: basePlan.targetBrief,
      userMaterials:
        "产品界面截图 3 张、简历优化前后对比图 1 张、10 秒操作录屏 1 条、用户反馈文案文件、领取链接。",
    });

    const transfer = buildDirectorTransferPlan({ analysis, plan });

    expect(transfer.transferSlots.length).toBe(plan.versions[0]!.scriptBeats.length);
    expect(transfer.materialRequirementMatrix.some((row) => row.matchedAssets.length > 0)).toBe(
      true,
    );
    expect(
      transfer.transferSlots.some((slot) => slot.preferredMaterialKinds.includes("video")),
    ).toBe(true);
  });

  it("keeps non-copy constraints on every transfer slot", () => {
    const analysis = analysisWithBeat("品牌广告样例", {
      shotPurpose: "品牌商品强 Hook",
      visualObservation: "原品牌包装和门店场景快速闪现",
      transferableRule: "迁移结果前置和快切节奏",
    });
    const plan = createFallbackPlan({
      projectTitle: "低糖拿铁",
      targetBrief: "一款低糖生椰轻乳拿铁",
      userMaterials: "",
      analysis,
    });

    const slots = buildTransferSlots({ analysis, plan });

    expect(slots.every((slot) => slot.nonCopyable.join(" ").includes("不复制样例"))).toBe(true);
    expect(slots[0]?.transferableTechnique).toContain("迁移结果前置");
  });
});
