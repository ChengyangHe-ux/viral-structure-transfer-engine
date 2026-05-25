import { readFile, mkdir, rm, symlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import { path as ffprobePath } from "@ffprobe-installer/ffprobe";

type Args = {
  input: string;
  out: string;
  compositionId: string;
  title?: string;
  productName?: string;
  sourceVideo?: string;
  quality: "high" | "draft";
};

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item) continue;
    if (item === "--input") args.input = argv[index + 1];
    if (item === "--out") args.out = argv[index + 1];
    if (item === "--composition") args.compositionId = argv[index + 1];
    if (item === "--title") args.title = argv[index + 1];
    if (item === "--product-name") args.productName = argv[index + 1];
    if (item === "--source-video") args.sourceVideo = argv[index + 1];
    if (item === "--quality") args.quality = argv[index + 1] as Args["quality"];
  }

  if (!args.input) throw new Error("Missing --input <plan.json>");
  if (!args.out) throw new Error("Missing --out <output.mp4>");
  return {
    input: args.input,
    out: args.out,
    compositionId: args.compositionId || "VideoFromPlan",
    title: args.title,
    productName: args.productName,
    sourceVideo: args.sourceVideo,
    quality: args.quality === "draft" ? "draft" : "high",
  };
}

async function loadPlanJson(inputPath: string) {
  const content = await readFile(inputPath, "utf8");
  const data: unknown = JSON.parse(content);
  if (data && typeof data === "object" && "plan" in data) {
    const container = data as { plan: unknown; preset?: { projectTitle?: string } };
    return { plan: container.plan, title: container.preset?.projectTitle };
  }
  return { plan: data, title: undefined };
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
}

async function prepareStaticSourceVideo(sourceVideo: string | undefined) {
  if (!sourceVideo) return { sourceVideoPath: null, cleanupPath: null };

  const resolvedSource = path.resolve(process.cwd(), sourceVideo);
  const renderSourceDir = path.resolve(process.cwd(), "public", "render-sources");
  const fileName = `${randomUUID()}.mp4`;
  const cleanupPath = path.join(renderSourceDir, fileName);

  await mkdir(renderSourceDir, { recursive: true });
  await runCommand(ffmpegPath, [
    "-y",
    "-i",
    resolvedSource,
    "-t",
    "15",
    "-vf",
    "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1",
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    cleanupPath,
  ]);

  return {
    sourceVideoPath: `render-sources/${fileName}`,
    cleanupPath,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const resolvedInput = path.resolve(process.cwd(), args.input);
  const resolvedOut = path.resolve(process.cwd(), args.out);

  await mkdir(path.dirname(resolvedOut), { recursive: true });

  const { plan, title } = await loadPlanJson(resolvedInput);
  const { sourceVideoPath, cleanupPath } = await prepareStaticSourceVideo(args.sourceVideo);
  const inputProps = {
    plan,
    title: args.title || title || "爆款结构迁移引擎（结构演示稿）",
    productName: args.productName || "天然矿泉水",
    sourceVideoPath,
  };

  const binariesDirectory = path.resolve(process.cwd(), ".remotion-binaries");
  await mkdir(binariesDirectory, { recursive: true });
  await rm(path.join(binariesDirectory, "ffmpeg"), { force: true });
  await rm(path.join(binariesDirectory, "ffprobe"), { force: true });
  await symlink(ffmpegPath, path.join(binariesDirectory, "ffmpeg"));
  await symlink(ffprobePath, path.join(binariesDirectory, "ffprobe"));

  try {
    const entry = path.resolve(process.cwd(), "src", "remotion", "index.ts");
    const bundled = await bundle({
      entryPoint: entry,
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...(config.resolve ?? {}),
          alias: {
            ...((config.resolve?.alias as Record<string, string>) ?? {}),
            "@": path.resolve(process.cwd(), "src"),
          },
        },
      }),
    });

    const composition = await selectComposition({
      serveUrl: bundled,
      id: args.compositionId,
      inputProps,
      binariesDirectory,
    });

    const qualitySettings =
      args.quality === "draft"
        ? ({
            crf: 30,
            x264Preset: "veryfast",
          } as const)
        : ({
            crf: 18,
            x264Preset: "medium",
          } as const);

    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: "h264",
      audioCodec: "mp3",
      outputLocation: resolvedOut,
      inputProps,
      binariesDirectory,
      overwrite: true,
      pixelFormat: "yuv420p",
      ...qualitySettings,
    });
  } finally {
    if (cleanupPath) {
      await rm(cleanupPath, { force: true });
    }
  }

  console.log(`[video:render] OK: ${resolvedOut}`);
}

await main();
