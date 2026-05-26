import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import { path as ffprobePath } from "@ffprobe-installer/ffprobe";

import {
  defaultVideoQualityThresholds,
  evaluateVideoQuality,
  parseFpsRatio,
  parseVolumeStats,
  type VideoQualityProbe,
  type VideoQualityThresholds,
} from "../src/lib/video-quality";

type Args = {
  input: string;
  thresholds: VideoQualityThresholds;
};

type FfprobeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  duration?: string;
  bit_rate?: string;
  sample_rate?: string;
  channels?: number;
};

type FfprobePayload = {
  streams?: FfprobeStream[];
  format?: {
    duration?: string;
    bit_rate?: string;
  };
};

function parseNumber(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseArgs(argv: string[]): Args {
  const thresholds = { ...defaultVideoQualityThresholds };
  let input = "";

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    const next = argv[index + 1];
    if (item === "--input") input = next ?? "";
    if (item === "--min-video-bitrate") thresholds.minVideoBitrate = Number(next);
    if (item === "--min-duration") thresholds.minDurationSeconds = Number(next);
    if (item === "--max-duration") thresholds.maxDurationSeconds = Number(next);
    if (item === "--min-mean-volume") thresholds.minMeanVolumeDb = Number(next);
    if (item === "--max-peak-volume") thresholds.maxPeakVolumeDb = Number(next);
  }

  if (!input) throw new Error("Missing --input <video.mp4>");
  return { input, thresholds };
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

async function probeVideo(inputPath: string): Promise<VideoQualityProbe> {
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

  const volume =
    audio?.codec_name
      ? parseVolumeStats(
          (
            await run(ffmpegPath, [
              "-hide_banner",
              "-nostats",
              "-i",
              inputPath,
              "-af",
              "volumedetect",
              "-f",
              "null",
              "-",
            ])
          ).stderr,
        )
      : { meanVolumeDb: null, maxVolumeDb: null };

  return {
    inputPath,
    width: video.width ?? 0,
    height: video.height ?? 0,
    fps: parseFpsRatio(video.r_frame_rate),
    durationSeconds: parseNumber(video.duration || payload.format?.duration),
    videoBitrate: parseNumber(video.bit_rate || payload.format?.bit_rate),
    audioCodec: audio?.codec_name ?? null,
    audioSampleRate: audio?.sample_rate ? Number(audio.sample_rate) : null,
    audioChannels: audio?.channels ?? null,
    audioBitrate: audio?.bit_rate ? Number(audio.bit_rate) : null,
    meanVolumeDb: volume.meanVolumeDb,
    maxVolumeDb: volume.maxVolumeDb,
  };
}

function printReport(probe: VideoQualityProbe, result: ReturnType<typeof evaluateVideoQuality>) {
  const videoMbps = (probe.videoBitrate / 1_000_000).toFixed(2);
  const audioKbps = probe.audioBitrate ? `${Math.round(probe.audioBitrate / 1000)}kbps` : "n/a";
  console.log(`[video:check] ${result.passed ? "OK" : "FAILED"}: ${probe.inputPath}`);
  console.log(
    `- video: ${probe.width}x${probe.height}, ${probe.fps.toFixed(2)}fps, ${probe.durationSeconds.toFixed(
      2,
    )}s, ${videoMbps} Mbps`,
  );
  console.log(
    `- audio: ${probe.audioCodec ?? "missing"}, ${probe.audioSampleRate ?? "n/a"}Hz, ${
      probe.audioChannels ?? "n/a"
    }ch, ${audioKbps}, mean ${probe.meanVolumeDb ?? "n/a"} dB, peak ${probe.maxVolumeDb ?? "n/a"} dB`,
  );
  console.log(`- score: ${result.score}/100`);
  for (const issue of result.issues) {
    console.log(`- issue: ${issue.metric} expected ${issue.expected}, actual ${issue.actual}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), args.input);
  if (!existsSync(inputPath)) throw new Error(`Video not found: ${args.input}`);

  const probe = await probeVideo(inputPath);
  const result = evaluateVideoQuality(probe, args.thresholds);
  printReport(probe, result);
  if (!result.passed) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(`[video:check] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
