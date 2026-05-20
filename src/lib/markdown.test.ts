import { describe, expect, it } from "vitest";

import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";
import { renderAnalysisMarkdown, renderPlanMarkdown } from "@/lib/markdown";

describe("markdown rendering", () => {
  it("renders analysis as an editable markdown table", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "样例",
      sampleNotes: "强 Hook、证据推进、结尾转化。",
    });
    const markdown = renderAnalysisMarkdown(analysis);

    expect(markdown).toContain("## 样例结构拆解");
    expect(markdown).toContain("| 时间段 | 镜头目的 |");
  });

  it("renders migrated plan fields required by the MVP", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "样例",
      sampleNotes: "强 Hook、证据推进、结尾转化。",
    });
    const plan = createFallbackPlan({
      projectTitle: "测试项目",
      targetBrief: "一款 AI 简历优化工具",
      analysis,
    });
    const markdown = renderPlanMarkdown(plan);

    expect(markdown).toContain("口播/字幕");
    expect(markdown).toContain("可替换素材");
    expect(markdown).toContain("稳妥转化版");
  });
});
