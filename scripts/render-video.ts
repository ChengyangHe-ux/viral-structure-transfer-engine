import { readFile, mkdir, rm, symlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import { path as ffprobePath } from "@ffprobe-installer/ffprobe";

import { buildRenderTimelineFromPlan, renderTimelineSchema } from "../src/lib/render-timeline";
import { migratedVideoPlanSchema } from "../src/lib/schemas";
import { writeSyntheticVideoAudio } from "./synthesize-video-audio";

type Args = {
  input: string;
  out: string;
  compositionId: string;
  title?: string;
  productName?: string;
  sourceVideo?: string;
  quality: "high" | "draft";
  audioMode: "auto" | "off";
};

type LoadedRenderInput = {
  plan: unknown;
  renderTimeline: unknown;
  title?: string;
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
    if (item === "--audio-mode") args.audioMode = argv[index + 1] as Args["audioMode"];
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
    audioMode: args.audioMode === "off" ? "off" : "auto",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function loadPlanJson(inputPath: string): Promise<LoadedRenderInput> {
  const content = await readFile(inputPath, "utf8");
  const data: unknown = JSON.parse(content);
  if (isRecord(data) && ("plan" in data || "renderTimeline" in data)) {
    const preset = isRecord(data.preset) ? data.preset : null;
    return {
      plan: data.plan ?? null,
      renderTimeline: data.renderTimeline ?? null,
      title: typeof preset?.projectTitle === "string" ? preset.projectTitle : undefined,
    };
  }
  return { plan: data, renderTimeline: null, title: undefined };
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

async function prepareSyntheticAudio({
  renderTimeline,
  audioMode,
}: {
  renderTimeline: ReturnType<typeof renderTimelineSchema.parse>;
  audioMode: Args["audioMode"];
}) {
  if (audioMode === "off") return { renderTimeline, cleanupPath: null };

  const renderAudioDir = path.resolve(process.cwd(), "public", "render-audio");
  const fileName = `${randomUUID()}.wav`;
  const cleanupPath = path.join(renderAudioDir, fileName);
  await writeSyntheticVideoAudio({
    outputPath: cleanupPath,
    durationSeconds: renderTimeline.totalFrames / renderTimeline.fps,
    fps: renderTimeline.fps,
    audioCues: renderTimeline.audioCues,
  });

  return {
    renderTimeline: renderTimelineSchema.parse({
      ...renderTimeline,
      audioBedPath: `render-audio/${fileName}`,
    }),
    cleanupPath,
  };
}

async function buildHighQualityInput({
  plan,
  renderTimeline,
  sourceVideoPath,
  audioMode,
}: {
  plan: unknown;
  renderTimeline: unknown;
  sourceVideoPath: string | null;
  audioMode: Args["audioMode"];
}) {
  const parsedPlan = migratedVideoPlanSchema.parse(plan);
  const parsedTimeline = renderTimeline
    ? renderTimelineSchema.parse(renderTimeline)
    : buildRenderTimelineFromPlan({
        plan: parsedPlan,
        materials: sourceVideoPath
          ? [
              {
                slotId: "hero",
                slotName: "商品/主体特写",
                src: sourceVideoPath,
                kind: "video",
                label: "用户上传真实素材",
                fit: "partial",
                completionPlan: "用真实素材做背景运动，并叠加卖点字幕与包装卡片补足结构。",
              },
            ]
          : [],
      });
  return prepareSyntheticAudio({ renderTimeline: parsedTimeline, audioMode });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const resolvedInput = path.resolve(process.cwd(), args.input);
  const resolvedOut = path.resolve(process.cwd(), args.out);

  await mkdir(path.dirname(resolvedOut), { recursive: true });

  const { plan, renderTimeline, title } = await loadPlanJson(resolvedInput);
  const { sourceVideoPath, cleanupPath } = await prepareStaticSourceVideo(args.sourceVideo);
  const cleanupPaths = [cleanupPath].filter(Boolean) as string[];
  const highQualityCompositionIds = new Set(["HighQualityShort", "CoffeeLaunchShort"]);
  const highQualityInput =
    highQualityCompositionIds.has(args.compositionId)
      ? await buildHighQualityInput({
          plan,
          renderTimeline,
          sourceVideoPath,
          audioMode: args.audioMode,
        })
      : null;
  if (highQualityInput?.cleanupPath) cleanupPaths.push(highQualityInput.cleanupPath);

  const inputProps = {
    plan,
    title: args.title || title || "爆款结构迁移引擎（结构演示稿）",
    productName: args.productName || "天然矿泉水",
    sourceVideoPath,
    renderTimeline: highQualityInput?.renderTimeline ?? null,
  };

  const binariesDirectory = path.resolve(process.cwd(), ".remotion-binaries");
  await mkdir(binariesDirectory, { recursive: true });
  await rm(path.join(binariesDirectory, "ffmpeg"), { force: true });
  await rm(path.join(binariesDirectory, "ffprobe"), { force: true });
  await symlink(ffmpegPath, path.join(binariesDirectory, "ffmpeg"));
  await symlink(ffprobePath, path.join(binariesDirectory, "ffprobe"));

  try {
    const entry = path.resolve(process.cwd(), "src", "remotion", "index.ts");
    const chromiumOptions = highQualityCompositionIds.has(args.compositionId)
      ? ({ gl: "angle" } as const)
      : undefined;
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
      chromiumOptions,
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
      chromiumOptions,
      overwrite: true,
      pixelFormat: "yuv420p",
      ...qualitySettings,
    });
  } finally {
    for (const filePath of cleanupPaths) {
      await rm(filePath, { force: true });
    }
  }

  console.log(`[video:render] OK: ${resolvedOut}`);
}

await main();
