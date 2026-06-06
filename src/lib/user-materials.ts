import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { extractPreviewFrameSet, inspectMedia } from "@/lib/media";

const materialRoot = path.join(process.cwd(), "data", "user-materials");

export const savedUserMaterialSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["image", "video", "text"]),
  label: z.string().min(1),
  originalName: z.string().min(1),
  filePath: z.string().min(1),
  mimeType: z.string().default("application/octet-stream"),
  sizeBytes: z.number().int().nonnegative(),
  durationSeconds: z.number().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  hasAudio: z.boolean().optional(),
  previewFrames: z.array(z.string().min(1)).default([]),
  textSnippet: z.string().default(""),
});

export const storedUserMaterialsSchema = z.object({
  version: z.literal(1),
  notes: z.string().default(""),
  materials: z.array(savedUserMaterialSchema).default([]),
});

export type SavedUserMaterial = z.infer<typeof savedUserMaterialSchema>;
export type StoredUserMaterials = z.infer<typeof storedUserMaterialsSchema>;

function safeFileName(name: string) {
  const ext = path.extname(name).slice(0, 12) || ".bin";
  const base = path
    .basename(name, ext)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  return `${base || "material"}-${randomUUID()}${ext}`;
}

function safeProjectId(projectId: string) {
  return projectId.replace(/[^a-zA-Z0-9_-]+/g, "");
}

function inferKind(file: File): SavedUserMaterial["kind"] {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(name)) {
    return "video";
  }
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|svg)$/i.test(name)) {
    return "image";
  }
  return "text";
}

function kindLabel(kind: SavedUserMaterial["kind"]) {
  if (kind === "video") return "视频素材";
  if (kind === "image") return "图片素材";
  return "文案素材";
}

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

async function readTextSnippet(filePath: string, kind: SavedUserMaterial["kind"]) {
  if (kind !== "text") return "";
  try {
    const buffer = await readFile(filePath);
    return buffer
      .toString("utf8")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 800);
  } catch {
    return "";
  }
}

export async function saveUserMaterialFiles(projectId: string, files: File[]) {
  const cleanProjectId = safeProjectId(projectId);
  if (!cleanProjectId) throw new Error("Invalid project id.");

  const projectDir = path.join(materialRoot, cleanProjectId);
  const fileDir = path.join(projectDir, "files");
  await mkdir(fileDir, { recursive: true });

  const saved: SavedUserMaterial[] = [];
  for (const file of files) {
    if (!file.size) continue;

    const kind = inferKind(file);
    const fileName = safeFileName(file.name || `${kind}-material`);
    const filePath = path.join(fileDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);
    const fileStat = await stat(filePath);

    const mediaMeta = kind === "video" ? await inspectMedia(filePath) : null;
    const preview =
      kind === "video"
        ? await extractPreviewFrameSet(filePath, mediaMeta?.durationSeconds)
        : { frameIds: [] as string[] };
    const textSnippet = await readTextSnippet(filePath, kind);

    saved.push(
      savedUserMaterialSchema.parse({
        id: `material-${saved.length + 1}-${randomUUID().slice(0, 8)}`,
        kind,
        label: file.name || fileName,
        originalName: file.name || fileName,
        filePath,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: fileStat.size,
        durationSeconds: mediaMeta?.durationSeconds,
        width: mediaMeta?.width,
        height: mediaMeta?.height,
        hasAudio: mediaMeta?.hasAudio,
        previewFrames: preview.frameIds,
        textSnippet,
      }),
    );
  }

  return saved;
}

export function serializeUserMaterials({
  notes,
  materials,
}: {
  notes?: string;
  materials: SavedUserMaterial[];
}) {
  if (!materials.length) return (notes || "").trim();
  return JSON.stringify(
    storedUserMaterialsSchema.parse({
      version: 1,
      notes: (notes || "").trim(),
      materials,
    }),
  );
}

export function parseStoredUserMaterials(value: string | null | undefined) {
  const clean = (value || "").trim();
  if (!clean) return null;
  try {
    const parsed = JSON.parse(clean) as unknown;
    const result = storedUserMaterialsSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function getSavedUserMaterials(value: string | null | undefined) {
  return parseStoredUserMaterials(value)?.materials ?? [];
}

export function describeSavedMaterial(material: SavedUserMaterial) {
  const meta = [
    formatSize(material.sizeBytes),
    material.durationSeconds ? `${material.durationSeconds.toFixed(1)}秒` : "",
    material.width && material.height ? `${material.width}x${material.height}` : "",
    material.hasAudio === true ? "含音频" : material.hasAudio === false ? "无音频" : "",
    material.textSnippet ? `内容摘录：${material.textSnippet}` : "",
  ].filter(Boolean);

  return `${kindLabel(material.kind)}：${material.label}${meta.length ? `（${meta.join("，")}）` : ""}`;
}

export function describeUserMaterialsForPrompt(value: string | null | undefined) {
  const stored = parseStoredUserMaterials(value);
  if (!stored) return (value || "").trim();

  const parts = [
    stored.notes.trim(),
    ...stored.materials.map(describeSavedMaterial),
  ].filter(Boolean);

  return parts.join("；");
}

export function hasSavedUserVisualMaterials(value: string | null | undefined) {
  return getSavedUserMaterials(value).some(
    (material) => material.kind === "video" || material.kind === "image",
  );
}
