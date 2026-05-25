import { describe, expect, it } from "vitest";

import {
  attachEditingTechniquesToPlan,
  formatEditingTechniquesForPrompt,
  retrieveEditingTechniques,
} from "@/lib/editing-techniques";
import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";

describe("editing technique retrieval", () => {
  it("retrieves scene, product, and hook techniques for a polished product brief", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "饮品样例",
      sampleNotes: "0-3 秒先给清爽结果，中段切换多个生活场景，结尾 CTA。",
    });

    const hits = retrieveEditingTechniques({
      targetBrief: "15秒矿泉水介绍视频，要高级、有真实视频素材、场景切换明显、开头抓人。",
      userMaterials: "有瓶身特写、开盖水滴、运动后饮用、办公桌面、户外山泉感素材。",
      direction: "避免PPT感，补B-roll、卡点字幕和自然转场。",
      analysis,
      limit: 5,
    });

    const hitIds = hits.map((hit) => hit.id);
    expect(hitIds).toContain("scene-ladder-broll");
    expect(hitIds).toContain("sensory-macro-product");
    expect(hitIds).toContain("result-first-cold-open");
    expect(hits[0].score).toBeGreaterThan(hits[hits.length - 1].score);
    expect(formatEditingTechniquesForPrompt(hits)).toContain("应用方式");
  });

  it("attaches retrieved techniques to plan notes and timeline hints", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "样例",
      sampleNotes: "强 Hook、证据推进、场景切换、结尾转化。",
    });
    const plan = createFallbackPlan({
      projectTitle: "矿泉水项目",
      targetBrief: "高端矿泉水 15 秒介绍",
      userMaterials: "瓶身特写、饮用场景、购买入口。",
      analysis,
    });
    const techniques = retrieveEditingTechniques({
      targetBrief: plan.targetBrief,
      userMaterials: "瓶身特写、饮用场景、购买入口。",
      analysis,
    });

    const attached = attachEditingTechniquesToPlan({ plan, techniques });

    expect(attached.retrievedTechniques.length).toBeGreaterThan(0);
    expect(attached.productionNotes[0]).toContain("RAG剪辑技巧");
    expect(attached.versions[0].scriptBeats[0].transitionAndRhythm).toContain("RAG");
  });
});
