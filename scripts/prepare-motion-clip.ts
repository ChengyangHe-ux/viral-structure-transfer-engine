import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";

type Args = {
  input: string;
  out: string;
  crop: string;
  fps: number;
  crf: number;
  preset: string;
  stabilizer: "deshake" | "vidstab" | "off";
};

function parseArgs(argv: string[]): Args {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item?.startsWith("--")) parsed[item.slice(2)] = argv[index + 1] ?? "";
  }

  if (!parsed.input) throw new Error("Missing --input <video.mp4>");
  if (!parsed.out) throw new Error("Missing --out <video.mp4>");

  return {
    input: parsed.input,
    out: parsed.out,
    crop: parsed.crop || "956:1700:80:0",
    fps: Number(parsed.fps || 30),
    crf: Number(parsed.crf || 17),
    preset: parsed.preset || "medium",
    stabilizer:
      parsed.stabilizer === "vidstab"
        ? "vidstab"
        : parsed.stabilizer === "off" || parsed.stabilize === "false"
          ? "off"
          : "deshake",
  };
}

function run(command: string, args: string[]) {
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

async function prepareMotionClip(args: Args) {
  const inputPath = path.resolve(process.cwd(), args.input);
  const outputPath = path.resolve(process.cwd(), args.out);
  const outputDir = path.dirname(outputPath);
  const transformsPath = path.join(os.tmpdir(), `motion-${randomUUID()}.trf`);

  await mkdir(outputDir, { recursive: true });
  await rm(transformsPath, { force: true });

  const normalizedFps = Number.isFinite(args.fps) && args.fps > 0 ? Math.round(args.fps) : 30;
  const crf = Number.isFinite(args.crf) ? Math.max(0, Math.min(51, Math.round(args.crf))) : 17;

  if (args.stabilizer === "vidstab") {
    await run(ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-vf",
      `vidstabdetect=shakiness=4:accuracy=9:stepsize=6:mincontrast=0.02:result=${transformsPath}`,
      "-f",
      "null",
      "-",
    ]);
  }

  const stabilizationFilter =
    args.stabilizer === "vidstab"
    ? `vidstabtransform=input=${transformsPath}:smoothing=24:optzoom=2:zoom=3`
    : args.stabilizer === "deshake"
      ? "deshake=rx=16:ry=16:edge=mirror:blocksize=16:contrast=125:search=exhaustive"
      : "null";
  const filter = [
    stabilizationFilter,
    `crop=${args.crop}`,
    "scale=1080:1920",
    `fps=${normalizedFps}`,
    "setsar=1",
  ].join(",");

  await run(ffmpegPath, [
    "-y",
    "-i",
    inputPath,
    "-vf",
    filter,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    args.preset,
    "-crf",
    String(crf),
    outputPath,
  ]);

  await rm(transformsPath, { force: true });
  console.log(`[video:prepare-motion] OK: ${outputPath}`);
}

await prepareMotionClip(parseArgs(process.argv.slice(2)));
