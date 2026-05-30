import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderProjectMarkdown } from "../src/lib/markdown";
import { extractPreviewFrameSet, inspectMedia } from "../src/lib/media";
import { mediaMetaSchema } from "../src/lib/schemas";
import { buildTechniqueTransferRecipe } from "../src/lib/technique-transfer";

type EnvMap = Record<string, string>;

type Args = {
  sampleVideo: string;
  outDir: string;
  projectTitle: string;
  sampleTitle: string;
  sampleNotes: string;
  targetBrief: string;
  userMaterials: string;
  direction: string;
};

function parseArgs(argv: string[]): Args {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item?.startsWith("--")) parsed[item.slice(2)] = argv[index + 1] ?? "";
  }

  if (!parsed["sample-video"]) {
    throw new Error("Missing --sample-video <path-to-mp4>");
  }

  return {
    sampleVideo: parsed["sample-video"],
    outDir: parsed["out-dir"] || "outputs/full-flow-demo",
    projectTitle: parsed["project-title"] || "生椰轻乳拿铁全流程演示",
    sampleTitle: parsed["sample-title"] || "生椰轻乳拿铁样例广告",
    sampleNotes:
      parsed["sample-notes"] ||
      "请从整段样例视频中拆解开头吸引、镜头节奏、字幕包装、卖点推进、画面风格和 CTA。",
    targetBrief:
      parsed["target-brief"] ||
      "一款面向通勤和学习场景的生椰轻乳拿铁，主打低糖、椰香、咖啡后劲和下午三点轻负担提神。",
    userMaterials:
      parsed["user-materials"] ||
      "已有素材：商品杯近景、倒入咖啡微距、工位场景、双杯收尾图；缺少真人试饮评价和门店实拍。",
    direction:
      parsed.direction ||
      "比赛演示：强调样例结构拆解、素材缺口补全、多版本方案和可渲染 15 秒竖屏成片。",
  };
}

function parseEnvFile(content: string): EnvMap {
  const env: EnvMap = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!key) continue;
    env[key] = rawValue?.trim().replace(/^['"]|['"]$/g, "") ?? "";
  }
  return env;
}

async function loadLocalEnv() {
  const originalKeys = new Set(Object.keys(process.env));
  for (const file of [".env", ".env.local"]) {
    try {
      const fileEnv = parseEnvFile(await readFile(path.resolve(process.cwd(), file), "utf8"));
      for (const [key, value] of Object.entries(fileEnv)) {
        if (!value) continue;
        if (originalKeys.has(key) && process.env[key]) continue;
        process.env[key] = value;
      }
    } catch {
      // Local env files are optional.
    }
  }
}

async function main() {
  await loadLocalEnv();
  const { analyzeSample, generateMigratedPlan } = await import("../src/lib/ai");
  const args = parseArgs(process.argv.slice(2));
  const sampleVideoPath = path.resolve(process.cwd(), args.sampleVideo);
  const outDir = path.resolve(process.cwd(), args.outDir);
  await mkdir(outDir, { recursive: true });

  const inspected = await inspectMedia(sampleVideoPath);
  const previewFrameSet = await extractPreviewFrameSet(
    sampleVideoPath,
    inspected.durationSeconds,
  );
  const mediaMeta = mediaMetaSchema.parse({
    ...inspected,
    previewFrames: previewFrameSet.frameIds,
    frameTimestamps: previewFrameSet.timestamps,
    sourceKind: "upload",
  });

  const analysisResult = await analyzeSample({
    sampleTitle: args.sampleTitle,
    sampleNotes: args.sampleNotes,
    mediaPath: sampleVideoPath,
    mediaMeta,
  });
  const planResult = await generateMigratedPlan({
    projectTitle: args.projectTitle,
    targetBrief: args.targetBrief,
    userMaterials: args.userMaterials,
    direction: args.direction,
    analysis: analysisResult.analysis,
  });
  const techniqueTransfer = buildTechniqueTransferRecipe({
    analysis: analysisResult.analysis,
    plan: planResult.plan,
  });
  const markdown = renderProjectMarkdown({
    title: args.projectTitle,
    analysis: analysisResult.analysis,
    plan: planResult.plan,
    techniqueTransfer,
    source: "scripts/run-full-demo.ts",
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    input: {
      sampleVideo: sampleVideoPath,
      projectTitle: args.projectTitle,
      sampleTitle: args.sampleTitle,
      targetBrief: args.targetBrief,
      userMaterials: args.userMaterials,
      direction: args.direction,
    },
    mediaMeta,
    analysis: analysisResult.analysis,
    plan: planResult.plan,
    techniqueTransfer,
    materialAssets: planResult.plan.materialAdaptation?.assets ?? [],
    diagnostics: {
      analysisUsedFallback: analysisResult.usedFallback,
      planUsedFallback: planResult.usedFallback,
      aiError: analysisResult.aiError || planResult.aiError,
      directVideoUsed: analysisResult.directVideoUsed,
      visionFrameCount: analysisResult.visionFrameCount,
      multiSampleSupported: true,
      materialAssetCount: planResult.plan.materialAdaptation?.assets.length ?? 0,
    },
  };

  const jsonPath = path.join(outDir, "case.json");
  const mdPath = path.join(outDir, "case.md");
  const evidenceMarkdown = `## 全流程运行证据

- 样例视频：${sampleVideoPath}
- 媒体解析：${mediaMeta.durationSeconds?.toFixed(2) ?? "--"}s，${mediaMeta.width ?? "--"}x${mediaMeta.height ?? "--"}，FPS ${mediaMeta.frameRate ?? "--"}
- 整段视频理解：${analysisResult.directVideoUsed ? "已启用" : "未启用/已降级"}
- 时间轴关键帧：${analysisResult.visionFrameCount} 帧（${mediaMeta.frameTimestamps.map((seconds) => `${seconds.toFixed(1)}s`).join(" / ") || "--"}）
- 样例拆解：${analysisResult.usedFallback ? "本地保底" : "AI 生成"}
- 迁移方案：${planResult.usedFallback ? "本地保底" : "AI 生成"}
- 真实素材资产：${planResult.plan.materialAdaptation?.assets.length ?? 0} 个
- 多样例能力：API 支持主样例 + 补充样例合并，导出稿会保留来源样例标题
- 诊断信息：${analysisResult.aiError || planResult.aiError || "无"}

`;
  await writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  await writeFile(mdPath, markdown.replace("\n## 样例结构拆解", `\n${evidenceMarkdown}## 样例结构拆解`), "utf8");

  console.log("[demo:full-flow] OK");
  console.log(`- markdown: ${mdPath}`);
  console.log(`- json: ${jsonPath}`);
  console.log(`- directVideoUsed: ${analysisResult.directVideoUsed}`);
  console.log(`- visionFrameCount: ${analysisResult.visionFrameCount}`);
  console.log(`- analysisFallback: ${analysisResult.usedFallback}`);
  console.log(`- planFallback: ${planResult.usedFallback}`);
}

await main();
