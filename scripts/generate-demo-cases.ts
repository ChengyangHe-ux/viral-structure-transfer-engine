import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { demoPresets } from "../src/lib/demo-presets";
import { createFallbackAnalysis, createFallbackPlan } from "../src/lib/fallbacks";
import { attachPlanEvaluation } from "../src/lib/evaluation";
import { attachMaterialAdaptation } from "../src/lib/materials";
import { renderProjectMarkdown } from "../src/lib/markdown";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s/|]+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const outDir = path.resolve(process.cwd(), "cases", "generated");
  await mkdir(outDir, { recursive: true });

  const indexLines: string[] = [
    "# 生成案例（离线可复现）",
    "",
    "这些案例由 `npm run cases:generate` 根据 `src/lib/demo-presets.ts` 生成。",
    "生成过程只使用本地 fallback 规则，不依赖模型密钥，便于比赛现场离线演示与快速校验。",
    "",
    "## 列表",
    "",
  ];

  for (const preset of demoPresets) {
    const slug = slugify(preset.label || preset.projectTitle);
    const baseName = `demo-${slug}`;
    const mdPath = path.join(outDir, `${baseName}.md`);
    const jsonPath = path.join(outDir, `${baseName}.json`);

    const analysis = createFallbackAnalysis({
      sampleTitle: preset.sampleTitle,
      sampleNotes: preset.sampleNotes,
    });

    const plan = attachPlanEvaluation(
      attachMaterialAdaptation({
        plan: createFallbackPlan({
          projectTitle: preset.projectTitle,
          targetBrief: preset.targetBrief,
          userMaterials: preset.userMaterials,
          analysis,
        }),
        targetBrief: preset.targetBrief,
        userMaterials: preset.userMaterials,
      }),
      analysis,
    );

    const markdown = renderProjectMarkdown({
      title: preset.projectTitle,
      analysis,
      plan,
      source: "cases/generated (auto)",
    });

    await writeFile(mdPath, markdown, "utf8");
    await writeFile(
      jsonPath,
      JSON.stringify({ preset, analysis, plan }, null, 2),
      "utf8",
    );

    indexLines.push(`- ${preset.label}：./${path.basename(mdPath)}`);
  }

  await writeFile(path.join(outDir, "README.md"), `${indexLines.join("\n")}\n`, "utf8");
}

await main();

