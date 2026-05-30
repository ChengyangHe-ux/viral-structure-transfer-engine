import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { demoPresets } from "../src/lib/demo-presets";
import { buildOfflineDemoCase } from "../src/lib/offline-demo-case";
import { evaluateChampionRubric } from "../src/lib/champion-rubric";
import { buildTechniqueTransferRecipe } from "../src/lib/technique-transfer";

type QualityReport = {
  result?: {
    passed?: boolean;
    score?: number;
    issues?: string[];
  };
  probe?: {
    width?: number;
    height?: number;
    fps?: number;
    durationSeconds?: number;
    audioCodec?: string;
  };
};

function fail(message: string): never {
  console.error(`\n[champion-check] ${message}\n`);
  process.exit(1);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function checkOfflineCases() {
  const rows = demoPresets.map((preset) => {
    const { analysis, plan } = buildOfflineDemoCase(preset);
    const techniqueTransfer = buildTechniqueTransferRecipe({ analysis, plan });
    const report = evaluateChampionRubric({
      analysis,
      plan,
      techniqueTransfer,
      finalVideoReady: true,
    });

    return {
      label: preset.label,
      verdict: report.verdict,
      baseScore: report.baseScore,
      bonusScore: report.bonusScore,
      failedItems: report.items
        .filter((item) => !item.passed)
        .map((item) => `${item.label} ${item.score}/${item.maxScore}`),
    };
  });

  console.log("[champion-check] Official rubric readiness");
  for (const row of rows) {
    console.log(
      `- ${row.label}: ${row.baseScore}/100 + ${row.bonusScore}/10 (${row.verdict})`,
    );
  }

  const failed = rows.filter((row) => row.verdict !== "champion-ready");
  if (failed.length) {
    fail(
      `Expected every offline case to be champion-ready:\n${failed
        .map((row) => `- ${row.label}: ${row.failedItems.join("；")}`)
        .join("\n")}`,
    );
  }
}

function checkFinalDemo() {
  const finalDir = path.resolve(process.cwd(), "submissions", "final-coconut-latte");
  const qualityPath = path.join(finalDir, "quality-report.json");
  const caseMdPath = path.join(finalDir, "final-flow", "case.md");
  const finalVideoPath = path.join(finalDir, "final-video.mp4");

  if (!existsSync(qualityPath) || !existsSync(caseMdPath) || !existsSync(finalVideoPath)) {
    console.log("[champion-check] Final demo not found; skipping final-video gate.");
    return;
  }

  const quality = readJson<QualityReport>(qualityPath);
  const result = quality.result;
  if (!result?.passed || result.score !== 100) {
    fail(
      `Expected final video quality score 100/100; got ${result?.score ?? "missing"} (${result?.issues?.join("; ") || "no details"})`,
    );
  }

  const caseMarkdown = readFileSync(caseMdPath, "utf8");
  const requiredSections = [
    "## 手法迁移配方",
    "## 样例-结果手法对比",
    "## 评分证据矩阵",
    "## 官方评分表拆解",
    "#### 真实素材资产盘点",
  ];
  const missingSections = requiredSections.filter((section) => !caseMarkdown.includes(section));
  if (missingSections.length) {
    fail(`Final case Markdown misses evidence sections:\n- ${missingSections.join("\n- ")}`);
  }

  console.log(
    `[champion-check] Final demo OK: ${quality.probe?.width}x${quality.probe?.height}, ${quality.probe?.fps}fps, ${quality.probe?.durationSeconds}s, audio ${quality.probe?.audioCodec}, score ${result.score}/100`,
  );
}

checkOfflineCases();
checkFinalDemo();
console.log("[champion-check] OK: championship evidence gate passed");
