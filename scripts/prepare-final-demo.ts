import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";

type Args = {
  outDir: string;
  title: string;
  productName: string;
  sampleVideo?: string;
  assetManifest?: string;
  composition: string;
  quality: "high" | "draft";
};

function parseArgs(argv: string[]): Args {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item?.startsWith("--")) parsed[item.slice(2)] = argv[index + 1] ?? "";
  }

  return {
    outDir: parsed["out-dir"] || "submissions/final-coconut-latte",
    title: parsed.title || "别把它当普通拿铁",
    productName: parsed["product-name"] || "生椰轻乳拿铁",
    sampleVideo: parsed["sample-video"],
    assetManifest: parsed["asset-manifest"],
    composition: parsed.composition || "CoconutLatteAigcCommercial15",
    quality: parsed.quality === "draft" ? "draft" : "high",
  };
}

function firstExisting(paths: string[]) {
  return paths.find((item) => existsSync(path.resolve(process.cwd(), item))) ?? paths[0]!;
}

function defaultImageAssets() {
  const assets = [
    "outputs/zhipu-video-assets/processed/hero-cup.png",
    "outputs/zhipu-video-assets/processed/pour-macro.png",
    "outputs/zhipu-video-assets/processed/commute-desk-v2.png",
    "outputs/zhipu-video-assets/processed/cta-packshot.png",
  ];
  return assets.every((asset) => existsSync(path.resolve(process.cwd(), asset))) ? assets : [];
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    console.log(`[demo:final] $ ${command} ${args.join(" ")}`);
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function extractFrame({
  inputPath,
  outputPath,
  atSeconds,
}: {
  inputPath: string;
  outputPath: string;
  atSeconds: number;
}) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await runCommand(ffmpegPath, [
    "-y",
    "-ss",
    String(atSeconds),
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-vf",
    "scale=540:-1",
    outputPath,
  ]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(process.cwd(), args.outDir);
  const finalFlowDir = path.join(outDir, "final-flow");
  const finalVideoPath = path.join(outDir, "final-video.mp4");
  const qualityReportPath = path.join(outDir, "quality-report.json");
  const keyframesDir = path.join(outDir, "keyframes");
  await mkdir(outDir, { recursive: true });
  await rm(keyframesDir, { recursive: true, force: true });

  const sampleVideo = args.sampleVideo
    ? args.sampleVideo
    : firstExisting([
        "renders/coconut-latte-zhipu-motion-stable-15.mp4",
        "renders/full-flow-demo-no-shake-15.mp4",
      ]);

  await runCommand("tsx", ["scripts/install-media-binaries.ts"]);
  await runCommand("tsx", [
    "scripts/run-full-demo.ts",
    "--sample-video",
    sampleVideo,
    "--out-dir",
    finalFlowDir,
  ]);

  const renderArgs = [
    "scripts/render-video.ts",
    "--input",
    path.join(finalFlowDir, "case.json"),
    "--out",
    finalVideoPath,
    "--composition",
    args.composition,
    "--quality",
    args.quality,
    "--title",
    args.title,
    "--product-name",
    args.productName,
  ];

  if (args.assetManifest && existsSync(path.resolve(process.cwd(), args.assetManifest))) {
    renderArgs.push("--asset-manifest", args.assetManifest);
  } else {
    if (args.assetManifest) {
      console.log(`[demo:final] asset manifest not found, falling back to stable image assets: ${args.assetManifest}`);
    }
    const images = defaultImageAssets();
    if (images.length > 0) {
      renderArgs.push("--image-assets", images.join(","));
    }
  }

  await runCommand("tsx", renderArgs);
  await runCommand("tsx", [
    "scripts/video-quality-check.ts",
    "--input",
    finalVideoPath,
    "--min-duration",
    "14",
    "--max-duration",
    "16",
    "--json-out",
    qualityReportPath,
  ]);

  const keyframes = [
    { at: 1, file: path.join(keyframesDir, "frame-01s.png") },
    { at: 8, file: path.join(keyframesDir, "frame-08s.png") },
    { at: 13, file: path.join(keyframesDir, "frame-13s.png") },
  ];
  for (const keyframe of keyframes) {
    await extractFrame({
      inputPath: finalVideoPath,
      outputPath: keyframe.file,
      atSeconds: keyframe.at,
    });
  }

  const reportPath = path.join(outDir, "final-demo-report.md");
  const report = `# 最终演示包

生成时间：${new Date().toISOString()}

## 文件

- 成片：${finalVideoPath}
- 质量报告：${qualityReportPath}
- 全流程 Markdown：${path.join(finalFlowDir, "case.md")}
- 全流程 JSON：${path.join(finalFlowDir, "case.json")}
- 关键帧 1s：${keyframes[0]!.file}
- 关键帧 8s：${keyframes[1]!.file}
- 关键帧 13s：${keyframes[2]!.file}

## 生成策略

- 视频模型只用于补充素材槽位，例如 B-roll、氛围镜头、转场垫片。
- 开场商品主视觉默认使用稳定图片 + Remotion 可控推镜，避免生成视频在杯身、冰块、液体边缘出现逐帧形变。
- 画面包装会显示结构标签、节奏卡点、卖点证据卡和“补素材”来源，让评委直接看到结构迁移与素材补全。
- 最终成片由 Remotion 白名单组件渲染，字幕、CTA、节奏、音频和质量门禁都可复现。
`;
  await writeFile(reportPath, report, "utf8");

  console.log("[demo:final] OK");
  console.log(`- video: ${finalVideoPath}`);
  console.log(`- report: ${reportPath}`);
}

await main();
