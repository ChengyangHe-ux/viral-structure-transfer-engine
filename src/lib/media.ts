import { spawn } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { mediaMetaSchema, type MediaMeta } from "@/lib/schemas";

const uploadDir = path.join(process.cwd(), "data", "uploads");
const frameDir = path.join(process.cwd(), "data", "frames");

const frameIdPattern = /^[0-9a-fA-F-]{36}\.jpg$/;

function runCommand(command: string, args: string[]) {
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

async function commandAvailable(command: string) {
  try {
    await runCommand(command, ["-version"]);
    return true;
  } catch {
    return false;
  }
}

function safeFileName(name: string) {
  const ext = path.extname(name).slice(0, 12) || ".mp4";
  const base = path
    .basename(name, ext)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "sample"}-${randomUUID()}${ext}`;
}

export function isSafeFrameId(frameId: string) {
  return frameIdPattern.test(frameId);
}

export async function saveUploadedVideo(file: File) {
  await mkdir(uploadDir, { recursive: true });
  const fileName = safeFileName(file.name);
  const filePath = path.join(uploadDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);
  return filePath;
}

export async function inspectMedia(filePath: string): Promise<MediaMeta> {
  const hasFfprobe = await commandAvailable("ffprobe");
  if (!hasFfprobe) {
    return mediaMetaSchema.parse({ sourceKind: "upload", previewFrames: [] });
  }

  try {
    const { stdout } = await runCommand("ffprobe", [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      filePath,
    ]);
    const payload = JSON.parse(stdout) as {
      streams?: Array<{
        codec_type?: string;
        width?: number;
        height?: number;
        r_frame_rate?: string;
      }>;
      format?: { duration?: string };
    };
    const video = payload.streams?.find((stream) => stream.codec_type === "video");
    const hasAudio = payload.streams?.some((stream) => stream.codec_type === "audio");
    const duration = Number(payload.format?.duration);

    return mediaMetaSchema.parse({
      durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : undefined,
      width: video?.width,
      height: video?.height,
      frameRate: video?.r_frame_rate,
      hasAudio,
      previewFrames: [],
      sourceKind: "upload",
    });
  } catch {
    return mediaMetaSchema.parse({ sourceKind: "upload", previewFrames: [] });
  }
}

export async function extractPreviewFrames(filePath: string, duration?: number) {
  const hasFfmpeg = await commandAvailable("ffmpeg");
  if (!hasFfmpeg) {
    return [];
  }

  await mkdir(frameDir, { recursive: true });
  const offsets = duration && duration > 8 ? [1, duration * 0.3, duration * 0.6] : [1];
  const frameIds: string[] = [];

  for (const offset of offsets) {
    const frameId = `${randomUUID()}.jpg`;
    const framePath = path.join(frameDir, frameId);
    try {
      await runCommand("ffmpeg", [
        "-y",
        "-ss",
        String(Math.max(0, offset)),
        "-i",
        filePath,
        "-frames:v",
        "1",
        "-q:v",
        "3",
        framePath,
      ]);
      frameIds.push(frameId);
    } catch {
      // Frame extraction is best-effort; the scripted MVP can still proceed.
    }
  }

  return frameIds;
}

export function describeMediaForPrompt(mediaMeta?: MediaMeta) {
  if (!mediaMeta) {
    return "未提供可读取的视频元数据。";
  }

  const parts = [
    mediaMeta.durationSeconds ? `时长约 ${mediaMeta.durationSeconds.toFixed(1)} 秒` : null,
    mediaMeta.width && mediaMeta.height
      ? `分辨率 ${mediaMeta.width}x${mediaMeta.height}`
      : null,
    mediaMeta.frameRate ? `帧率 ${mediaMeta.frameRate}` : null,
    typeof mediaMeta.hasAudio === "boolean"
      ? mediaMeta.hasAudio
        ? "包含音频"
        : "未检测到音频"
      : null,
    mediaMeta.previewFrames.length
      ? `已抽取 ${mediaMeta.previewFrames.length} 张预览帧`
      : null,
  ].filter(Boolean);

  return parts.length ? parts.join("；") : "视频元数据有限。";
}
