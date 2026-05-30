import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { analyzeSample, generateMigratedPlan } from "../src/lib/ai";
import { renderProjectMarkdown } from "../src/lib/markdown";
import { extractPreviewFrameSet, inspectMedia } from "../src/lib/media";
import { mediaMetaSchema } from "../src/lib/schemas";

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

async function main() {
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
  const markdown = renderProjectMarkdown({
    title: args.projectTitle,
    analysis: analysisResult.analysis,
    plan: planResult.plan,
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
    diagnostics: {
      analysisUsedFallback: analysisResult.usedFallback,
      planUsedFallback: planResult.usedFallback,
      aiError: analysisResult.aiError || planResult.aiError,
      directVideoUsed: analysisResult.directVideoUsed,
      visionFrameCount: analysisResult.visionFrameCount,
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
