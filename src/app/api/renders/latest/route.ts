import path from "node:path";
import { readdir, readFile, stat } from "node:fs/promises";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const apiVideoDir = path.resolve(process.cwd(), "renders", "api-videos");

function isInsideApiVideoDir(filePath: string) {
  const relative = path.relative(apiVideoDir, filePath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function localVideoUrl(filePath: string) {
  return `/api/renders/video?path=${encodeURIComponent(filePath)}`;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function stringField(record: Record<string, unknown> | null, field: string) {
  const value = record?.[field];
  return typeof value === "string" ? value : null;
}

function numberField(record: Record<string, unknown> | null, field: string) {
  const value = record?.[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function findDownloadedPath(payload: unknown) {
  const record = asRecord(payload);
  const downloaded = asRecord(record?.downloaded);
  const stitched = asRecord(record?.stitched);
  return stringField(downloaded, "filePath") || stringField(stitched, "filePath");
}

export async function GET() {
  let entries: Array<{ name: string; mtimeMs: number }> = [];
  try {
    const dirEntries = await readdir(apiVideoDir, { withFileTypes: true });
    entries = await Promise.all(
      dirEntries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && !entry.name.endsWith(".progress.json"))
        .map(async (entry) => {
          const filePath = path.join(apiVideoDir, entry.name);
          const fileStat = await stat(filePath);
          return { name: entry.name, mtimeMs: fileStat.mtimeMs };
        }),
    );
  } catch {
    return NextResponse.json({ video: null });
  }

  for (const entry of entries.sort((left, right) => right.mtimeMs - left.mtimeMs)) {
    const debugPath = path.join(apiVideoDir, entry.name);
    try {
      const payload = JSON.parse(await readFile(debugPath, "utf-8")) as unknown;
      const record = asRecord(payload);
      const filePath = path.resolve(findDownloadedPath(payload) || "");
      if (!filePath || !isInsideApiVideoDir(filePath) || path.extname(filePath).toLowerCase() !== ".mp4") {
        continue;
      }
      const videoStat = await stat(filePath);
      if (!videoStat.isFile()) continue;

      const adaptiveTransfer = asRecord(record?.adaptiveTransfer);
      const renderStrategy = asRecord(record?.renderStrategy);
      const packaging = asRecord(record?.packaging);
      const outputBaseName = stringField(record, "outputBaseName") || path.basename(filePath, ".mp4");
      const durationSeconds =
        numberField(renderStrategy, "targetDurationSeconds") ||
        numberField(adaptiveTransfer, "targetDurationSeconds");
      const hasPackagedFile = path.basename(filePath).includes("-packaged");
      const packagingMode =
        stringField(packaging, "mode") === "clean" || (!hasPackagedFile && packaging?.subtitles === false)
          ? "clean"
          : "smart";

      return NextResponse.json({
        video: {
          title: "最近成片",
          note: [
            durationSeconds ? `已完成拼接，目标约 ${durationSeconds} 秒` : "已完成拼接",
            packagingMode === "smart" ? "已加智能包装" : "干净成片",
            "可直接播放验证。",
          ]
            .filter(Boolean)
            .join("，"),
          localVideoUrl: localVideoUrl(filePath),
          filePath,
          outputBaseName,
          sizeBytes: videoStat.size,
          createdAt: new Date(videoStat.mtimeMs).toISOString(),
          durationSeconds,
          packaging: {
            mode: packagingMode,
            label: packagingMode === "smart" ? "智能包装" : "干净成片",
            subtitles: packaging?.subtitles === true || hasPackagedFile,
            audio: packaging?.audio === true || hasPackagedFile,
          },
        },
      });
    } catch {
      // Ignore stale or partial debug files and continue looking for a valid render.
    }
  }

  return NextResponse.json({ video: null });
}
