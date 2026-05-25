import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { demoPresets } from "../src/lib/demo-presets";
import { buildOfflineDemoCase } from "../src/lib/offline-demo-case";

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
    "生成过程只使用本地 fallback + RAG 剪辑技巧库，不依赖模型密钥，便于比赛现场离线演示与快速校验。",
    "",
    "## 冲奖目标",
    "",
    "- 90+：大奖冲刺，可作为主演示案例。",
    "- 82-89：可上交，但建议继续补强真实素材或剪辑证据。",
    "- 低于 82：需要先补结构、素材或答辩证据。",
    "",
    "## 列表",
    "",
  ];

  for (const preset of demoPresets) {
    const slug = slugify(preset.label || preset.projectTitle);
    const baseName = `demo-${slug}`;
    const mdPath = path.join(outDir, `${baseName}.md`);
    const jsonPath = path.join(outDir, `${baseName}.json`);

    const { analysis, plan, markdown } = buildOfflineDemoCase(preset);

    await writeFile(mdPath, markdown, "utf8");
    await writeFile(
      jsonPath,
      JSON.stringify({ preset, analysis, plan }, null, 2),
      "utf8",
    );

    indexLines.push(
      `- ${preset.label}：./${path.basename(mdPath)}（大奖目标 ${plan.awardReadiness?.overallScore ?? "--"}/100，${plan.retrievedTechniques.map((technique) => technique.title).slice(0, 3).join(" / ")}）`,
    );
  }

  await writeFile(path.join(outDir, "README.md"), `${indexLines.join("\n")}\n`, "utf8");
}

await main();
