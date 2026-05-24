import { readFile, mkdir, rm, symlink } from "node:fs/promises";
import path from "node:path";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import { path as ffprobePath } from "@ffprobe-installer/ffprobe";

type Args = {
  input: string;
  out: string;
  compositionId: string;
  title?: string;
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
    if (item === "--quality") args.quality = argv[index + 1] as Args["quality"];
  }

  if (!args.input) throw new Error("Missing --input <plan.json>");
  if (!args.out) throw new Error("Missing --out <output.mp4>");
  return {
    input: args.input,
    out: args.out,
    compositionId: args.compositionId || "VideoFromPlan",
    title: args.title,
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const resolvedInput = path.resolve(process.cwd(), args.input);
  const resolvedOut = path.resolve(process.cwd(), args.out);

  await mkdir(path.dirname(resolvedOut), { recursive: true });

  const { plan, title } = await loadPlanJson(resolvedInput);

  const binariesDirectory = path.resolve(process.cwd(), ".remotion-binaries");
  await mkdir(binariesDirectory, { recursive: true });
  await rm(path.join(binariesDirectory, "ffmpeg"), { force: true });
  await rm(path.join(binariesDirectory, "ffprobe"), { force: true });
  await symlink(ffmpegPath, path.join(binariesDirectory, "ffmpeg"));
  await symlink(ffprobePath, path.join(binariesDirectory, "ffprobe"));

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
    inputProps: { plan, title: args.title || title || "爆款结构迁移引擎（结构演示稿）" },
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
    outputLocation: resolvedOut,
    inputProps: { plan, title: args.title || title || "爆款结构迁移引擎（结构演示稿）" },
    binariesDirectory,
    overwrite: true,
    pixelFormat: "yuv420p",
    ...qualitySettings,
  });

  console.log(`[video:render] OK: ${resolvedOut}`);
}

await main();
