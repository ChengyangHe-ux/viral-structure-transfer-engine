import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

import { path as ffprobePath } from "@ffprobe-installer/ffprobe";

import { slotKindSchema } from "../src/lib/render-policy";
import { parseFpsRatio } from "../src/lib/video-quality";
import { scoreGeneratedVideoAsset } from "../src/lib/video-asset-quality";

type Args = {
  input: string;
  slot: string;
  jsonOut?: string;
};

type FfprobeStream = {
  codec_type?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  duration?: string;
};

type FfprobePayload = {
  streams?: FfprobeStream[];
  format?: {
    duration?: string;
  };
};

function parseArgs(argv: string[]): Args {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item?.startsWith("--")) parsed[item.slice(2)] = argv[index + 1] ?? "";
  }
  if (!parsed.input) throw new Error("Missing --input <video.mp4>");
  if (!parsed.slot) throw new Error("Missing --slot <hero|product-closeup|broll|transition|atmosphere|cta>");
  return {
    input: parsed.input,
    slot: parsed.slot,
    jsonOut: parsed["json-out"],
  };
}

function parseNumber(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function run(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
}

async function probeAsset(inputPath: string) {
  const { stdout } = await run(ffprobePath, [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    inputPath,
  ]);
  const payload = JSON.parse(stdout) as FfprobePayload;
  const video = payload.streams?.find((stream) => stream.codec_type === "video");
  const audio = payload.streams?.find((stream) => stream.codec_type === "audio");
  if (!video) throw new Error("No video stream found");

  return {
    width: video.width ?? 0,
    height: video.height ?? 0,
    fps: parseFpsRatio(video.r_frame_rate),
    durationSeconds: parseNumber(video.duration || payload.format?.duration),
    hasAudio: Boolean(audio),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), args.input);
  if (!existsSync(inputPath)) throw new Error(`Video not found: ${args.input}`);

  const slotKind = slotKindSchema.parse(args.slot);
  const probed = await probeAsset(inputPath);
  const report = scoreGeneratedVideoAsset({
    inputPath,
    slotKind,
    ...probed,
  });

  if (args.jsonOut) {
    const outPath = path.resolve(process.cwd(), args.jsonOut);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
  }

  console.log(`[video:assess] ${report.verdict.toUpperCase()}: ${inputPath}`);
  console.log(`- score: ${report.score}/100`);
  console.log(`- recommendedUse: ${report.recommendedUse}`);
  console.log(`- riskFlags: ${report.riskFlags.join(", ") || "none"}`);
}

await main();
