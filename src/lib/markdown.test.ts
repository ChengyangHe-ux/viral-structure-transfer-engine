import { describe, expect, it } from "vitest";

import { createFallbackAnalysis, createFallbackPlan } from "@/lib/fallbacks";
import {
  attachEditingTechniquesToPlan,
  retrieveEditingTechniques,
} from "@/lib/editing-techniques";
import { attachPlanEvaluation } from "@/lib/evaluation";
import { attachMaterialAdaptation } from "@/lib/materials";
import {
  renderAnalysisMarkdown,
  renderPlanMarkdown,
  renderProjectMarkdown,
} from "@/lib/markdown";

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
    const basePlan = createFallbackPlan({
      projectTitle: "测试项目",
      targetBrief: "一款 AI 简历优化工具",
      userMaterials: "有产品界面截图、操作录屏和领取链接。",
      analysis,
    });
    const planWithTechniques = attachEditingTechniquesToPlan({
      plan: basePlan,
      techniques: retrieveEditingTechniques({
        targetBrief: basePlan.targetBrief,
        userMaterials: "有产品界面截图、操作录屏和领取链接。",
        analysis,
      }),
    });
    const plan = attachPlanEvaluation(
      attachMaterialAdaptation({
        plan: planWithTechniques,
        targetBrief: basePlan.targetBrief,
        userMaterials: "有产品界面截图、操作录屏和领取链接。",
      }),
      analysis,
    );
    const markdown = renderPlanMarkdown(plan);

    expect(markdown).toContain("口播/字幕");
    expect(markdown).toContain("可替换素材");
    expect(markdown).toContain("稳妥转化版");
    expect(markdown).toContain("剪辑手法命中");
    expect(markdown).toContain("质量诊断看板");
    expect(markdown).toContain("素材缺口与补全");
    expect(markdown).toContain("真实素材资产盘点");
    expect(markdown).toContain("质量诊断");
  });

  it("renders a project-level migration map for submission review", () => {
    const analysis = createFallbackAnalysis({
      sampleTitle: "样例",
      sampleNotes: "强 Hook、证据推进、结尾转化。",
    });
    const basePlan = createFallbackPlan({
      projectTitle: "测试项目",
      targetBrief: "一款 AI 简历优化工具",
      userMaterials: "有产品界面截图、操作录屏和领取链接。",
      analysis,
    });
    const plan = attachMaterialAdaptation({
      plan: basePlan,
      targetBrief: basePlan.targetBrief,
      userMaterials: "有产品界面截图、操作录屏和领取链接。",
    });

    const markdown = renderProjectMarkdown({
      title: "测试项目",
      analysis,
      plan,
    });

    expect(markdown).toContain("## 结构迁移映射");
    expect(markdown).toContain("## 手法迁移配方");
    expect(markdown).toContain("## 样例-结果手法对比");
    expect(markdown).toContain("## 竖屏分镜预览");
    expect(markdown).toContain("## 展示证据矩阵");
    expect(markdown).toContain("## 创作能力清单");
    expect(markdown).toContain("基础闭环完成度");
    expect(markdown).toContain("亮点分");
    expect(markdown).toContain("源样例时间段");
    expect(markdown).toContain("样例节拍");
    expect(markdown).toContain("补全动作");
    expect(markdown).toContain("真实素材适配");
  });
});
