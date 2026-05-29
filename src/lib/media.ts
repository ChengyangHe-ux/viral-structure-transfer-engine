import { spawn } from "child_process";
import { access, mkdir, readFile, readdir, stat, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { mediaMetaSchema, type MediaMeta } from "@/lib/schemas";

const uploadDir = path.join(process.cwd(), "data", "uploads");
const frameDir = path.join(process.cwd(), "data", "frames");

const frameIdPattern = /^[0-9a-fA-F-]{36}\.jpg$/;

export type PreviewFrameImage = {
  frameId: string;
  data: Buffer;
  mediaType: "image/jpeg";
  label: string;
  timestampSeconds?: number;
};

export type ExtractedPreviewFrames = {
  frameIds: string[];
  timestamps: number[];
};

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

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveBinary(command: "ffprobe" | "ffmpeg") {
  try {
    await runCommand(command, ["-version"]);
    return command;
  } catch {
    // fallthrough
  }

  const binariesDirectory = path.resolve(process.cwd(), ".remotion-binaries");
  const localCandidate = path.join(binariesDirectory, command);
  if (await fileExists(localCandidate)) return localCandidate;

  return null;
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

function previewFrameCount(duration?: number) {
  const parsed = Number(process.env.AI_VIDEO_FRAME_COUNT || process.env.AI_VISION_FRAME_LIMIT);
  const defaultCount = duration && duration > 30 ? 12 : duration && duration > 8 ? 8 : 4;
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultCount;
  return Math.max(1, Math.min(Math.floor(parsed), 24));
}

function choosePreviewOffsets(duration?: number) {
  const safeDuration = Number.isFinite(duration) && duration && duration > 0 ? duration : 0;
  if (!safeDuration) return [1];

  const count = previewFrameCount(safeDuration);
  if (count === 1) return [Math.min(1, Math.max(0, safeDuration / 2))];

  const start = Math.min(0.8, safeDuration * 0.08);
  const end = Math.max(start, safeDuration - Math.min(0.8, safeDuration * 0.08));
  return Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0.5 : index / (count - 1);
    return start + (end - start) * ratio;
  });
}

function formatTimestamp(seconds?: number) {
  if (!Number.isFinite(seconds)) return null;
  const safeSeconds = Math.max(0, seconds ?? 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = Math.round(safeSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
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

export async function listUploadedVideos() {
  await mkdir(uploadDir, { recursive: true });
  const entries = await readdir(uploadDir, { withFileTypes: true });
  const videos = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(mp4|mov|m4v|webm)$/i.test(name))
    .sort((a, b) => a.localeCompare(b));

  const withStats = await Promise.all(
    videos.map(async (name) => {
      const filePath = path.join(uploadDir, name);
      const fileStat = await stat(filePath);
      return {
        name,
        sizeBytes: fileStat.size,
        modifiedAt: fileStat.mtime.toISOString(),
      };
    }),
  );

  return withStats;
}

export async function resolveUploadedVideoPath(uploadName: string) {
  const trimmed = uploadName.trim();
  const base = path.basename(trimmed);
  if (!base || base !== trimmed) {
    throw new Error("Invalid upload name.");
  }
  const fullPath = path.join(uploadDir, base);
  if (!(await fileExists(fullPath))) {
    throw new Error("Upload not found.");
  }
  return fullPath;
}

export async function inspectMedia(filePath: string): Promise<MediaMeta> {
  const ffprobe = await resolveBinary("ffprobe");
  if (!ffprobe) {
    return mediaMetaSchema.parse({ sourceKind: "upload", previewFrames: [] });
  }

  try {
    const { stdout } = await runCommand(ffprobe, [
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
      frameTimestamps: [],
      sourceKind: "upload",
    });
  } catch {
    return mediaMetaSchema.parse({ sourceKind: "upload", previewFrames: [] });
  }
}

export async function extractPreviewFrameSet(
  filePath: string,
  duration?: number,
): Promise<ExtractedPreviewFrames> {
  const ffmpeg = await resolveBinary("ffmpeg");
  if (!ffmpeg) {
    return { frameIds: [], timestamps: [] };
  }

  await mkdir(frameDir, { recursive: true });
  const offsets = choosePreviewOffsets(duration);
  const frameIds: string[] = [];
  const timestamps: number[] = [];

  for (const offset of offsets) {
    const frameId = `${randomUUID()}.jpg`;
    const framePath = path.join(frameDir, frameId);
    try {
      await runCommand(ffmpeg, [
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
      timestamps.push(Number(offset.toFixed(2)));
    } catch {
      // Frame extraction is best-effort; the scripted MVP can still proceed.
    }
  }

  return { frameIds, timestamps };
}

export async function extractPreviewFrames(filePath: string, duration?: number) {
  return (await extractPreviewFrameSet(filePath, duration)).frameIds;
}

export async function loadPreviewFrameImages(
  frameIds: string[],
  limit = 3,
  timestamps: number[] = [],
) {
  const images: PreviewFrameImage[] = [];
  const safeFrameIds = frameIds.filter(isSafeFrameId).slice(0, Math.max(0, limit));

  for (const frameId of safeFrameIds) {
    const originalIndex = frameIds.indexOf(frameId);
    const timestampSeconds = timestamps[originalIndex];
    const timestampLabel = formatTimestamp(timestampSeconds);
    try {
      const data = await readFile(path.join(frameDir, frameId));
      images.push({
        frameId,
        data,
        mediaType: "image/jpeg",
        label: timestampLabel
          ? `样例视频关键帧 ${images.length + 1}（约 ${timestampLabel}）`
          : `样例视频关键帧 ${images.length + 1}`,
        timestampSeconds,
      });
    } catch {
      // Missing preview frames should not block AI analysis; ffmpeg extraction is best-effort.
    }
  }

  return images;
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
    mediaMeta.frameTimestamps.length
      ? `预览帧时间点 ${mediaMeta.frameTimestamps
          .map((seconds) => formatTimestamp(seconds))
          .filter(Boolean)
          .join("、")}`
      : null,
  ].filter(Boolean);

  return parts.length ? parts.join("；") : "视频元数据有限。";
}

export function isLikelyDirectVideoUrl(url: string | undefined) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      ["http:", "https:"].includes(parsed.protocol) &&
      /\.(mp4|mov|m4v|webm|mpeg|mpg|avi|wmv|3gp)(?:$|\?)/i.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

function mimeTypeForVideo(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mov") return "video/mov";
  if (ext === ".webm") return "video/webm";
  if (ext === ".avi") return "video/avi";
  if (ext === ".mpeg" || ext === ".mpg") return "video/mpeg";
  if (ext === ".wmv") return "video/wmv";
  if (ext === ".3gp" || ext === ".3gpp") return "video/3gpp";
  return "video/mp4";
}

export async function loadVideoDataUrl(filePath: string, maxBytes: number) {
  const fileStat = await stat(filePath);
  if (fileStat.size > maxBytes) return null;
  const data = await readFile(filePath);
  return `data:${mimeTypeForVideo(filePath)};base64,${data.toString("base64")}`;
}
