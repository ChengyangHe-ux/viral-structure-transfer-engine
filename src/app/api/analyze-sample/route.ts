import { NextRequest, NextResponse } from "next/server";

import { analyzeSample } from "@/lib/ai";
import { prisma } from "@/lib/db";
import {
  extractPreviewFrameSet,
  inspectMedia,
  resolveUploadedVideoPath,
  saveUploadedVideo,
} from "@/lib/media";
import {
  analyzeSampleRequestSchema,
  mediaMetaSchema,
  type MediaMeta,
  type VideoStructureAnalysis,
} from "@/lib/schemas";
import { renderAnalysisMarkdown } from "@/lib/markdown";
import { combineSampleAnalyses } from "@/lib/multi-sample";

export const runtime = "nodejs";

function normalizeText(value: unknown) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

function parseAdditionalSampleNotes(value: string | undefined) {
  const clean = value?.trim();
  if (!clean) return [];

  return clean
    .split(/\n\s*---+\s*\n|\n\s*#{2,}\s*/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const firstLine = lines[0] || `补充样例 ${index + 1}`;
      const titleMatch = /^标题[:：]\s*(.+)$/.exec(firstLine);
      const sampleTitle = titleMatch?.[1]?.trim() || firstLine.slice(0, 28);
      const sampleNotes = titleMatch ? lines.slice(1).join("\n") : block;

      return {
        sampleTitle: sampleTitle || `补充样例 ${index + 1}`,
        sampleNotes: sampleNotes || block,
        sampleUrl: "",
      };
    });
}

async function parseRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("sampleFile");
    const parsed = analyzeSampleRequestSchema.parse({
      projectTitle: formData.get("projectTitle")?.toString() || undefined,
      sampleTitle: formData.get("sampleTitle")?.toString() || undefined,
      sampleUrl: formData.get("sampleUrl")?.toString() || undefined,
      localUploadName: formData.get("localUploadName")?.toString() || undefined,
      sampleNotes: formData.get("sampleNotes")?.toString() || undefined,
      additionalSampleNotes: formData.get("additionalSampleNotes")?.toString() || "",
      targetBrief: formData.get("targetBrief")?.toString() || "",
    });
    const additionalSamples = [
      ...parsed.additionalSamples,
      ...parseAdditionalSampleNotes(parsed.additionalSampleNotes),
    ];

    if (file instanceof File && file.size > 0) {
      const mediaPath = await saveUploadedVideo(file);
      const inspected = await inspectMedia(mediaPath);
      const { frameIds, timestamps } = await extractPreviewFrameSet(
        mediaPath,
        inspected.durationSeconds,
      );
      return {
        ...parsed,
        additionalSamples,
        mediaPath,
        mediaMeta: mediaMetaSchema.parse({
          ...inspected,
          previewFrames: frameIds,
          frameTimestamps: timestamps,
        }),
      };
    }

    const localUploadName = normalizeText(parsed.localUploadName);
    if (localUploadName) {
      const mediaPath = await resolveUploadedVideoPath(localUploadName);
      const inspected = await inspectMedia(mediaPath);
      const { frameIds, timestamps } = await extractPreviewFrameSet(
        mediaPath,
        inspected.durationSeconds,
      );
      return {
        ...parsed,
        additionalSamples,
        mediaPath,
        mediaMeta: mediaMetaSchema.parse({
          ...inspected,
          previewFrames: frameIds,
          frameTimestamps: timestamps,
          sourceKind: "upload",
        }),
      };
    }

    return {
      ...parsed,
      additionalSamples,
      mediaPath: null,
      mediaMeta: mediaMetaSchema.parse({
        sourceKind: parsed.sampleUrl ? "url" : "manual",
        previewFrames: [],
      }),
    };
  }

  const body = await request.json();
  const parsed = analyzeSampleRequestSchema.parse(body);
  const additionalSamples = [
    ...parsed.additionalSamples,
    ...parseAdditionalSampleNotes(parsed.additionalSampleNotes),
  ];
  const localUploadName = normalizeText(parsed.localUploadName);
  if (localUploadName) {
    const mediaPath = await resolveUploadedVideoPath(localUploadName);
    const inspected = await inspectMedia(mediaPath);
    const { frameIds, timestamps } = await extractPreviewFrameSet(
      mediaPath,
      inspected.durationSeconds,
    );
    return {
      ...parsed,
      additionalSamples,
      mediaPath,
      mediaMeta: mediaMetaSchema.parse({
        ...inspected,
        previewFrames: frameIds,
        frameTimestamps: timestamps,
        sourceKind: "upload",
      }),
    };
  }
  return {
    ...parsed,
    additionalSamples,
    mediaPath: null,
    mediaMeta: mediaMetaSchema.parse({
      sourceKind: parsed.sampleUrl ? "url" : "manual",
      previewFrames: [],
    }),
  };
}

export async function POST(request: NextRequest) {
  try {
    const input = await parseRequest(request);
    const project = await prisma.project.create({
      data: {
        title: input.projectTitle,
        sampleTitle: input.sampleTitle,
        sampleUrl: input.sampleUrl || null,
        sampleNotes: input.sampleNotes,
        targetBrief: input.targetBrief,
        mediaPath: input.mediaPath,
        mediaMeta: input.mediaMeta,
        status: "analyzed",
      },
    });

    const primaryResult = await analyzeSample({
      sampleTitle: input.sampleTitle,
      sampleNotes: input.sampleNotes,
      sampleUrl: input.sampleUrl || undefined,
      mediaMeta: input.mediaMeta as MediaMeta,
      mediaPath: input.mediaPath || undefined,
    });
    const additionalResults = await Promise.all(
      input.additionalSamples.map((sample) =>
        analyzeSample({
          sampleTitle: sample.sampleTitle,
          sampleNotes: sample.sampleNotes,
          sampleUrl: sample.sampleUrl || undefined,
        }),
      ),
    );
    const sourceAnalyses: VideoStructureAnalysis[] = [
      primaryResult.analysis,
      ...additionalResults.map((result) => result.analysis),
    ];
    const analysis =
      sourceAnalyses.length > 1
        ? combineSampleAnalyses({
            projectTitle: input.projectTitle,
            analyses: sourceAnalyses,
          })
        : primaryResult.analysis;
    const usedFallback =
      primaryResult.usedFallback || additionalResults.some((result) => result.usedFallback);
    const aiError = [
      primaryResult.aiError,
      ...additionalResults.map((result) => result.aiError),
    ]
      .filter(Boolean)
      .join("\n") || null;

    await prisma.sampleAnalysis.create({
      data: {
        projectId: project.id,
        summary: analysis.summary,
        data: analysis,
      },
    });

    return NextResponse.json({
      projectId: project.id,
      analysis,
      markdown: renderAnalysisMarkdown(analysis),
      mediaMeta: input.mediaMeta,
      usedFallback,
      aiError,
      visionFrameCount: primaryResult.visionFrameCount,
      directVideoUsed: primaryResult.directVideoUsed,
      sourceSampleCount: sourceAnalyses.length,
      sourceSamples: sourceAnalyses.map((item) => item.sampleTitle),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analyze sample failed",
      },
      { status: 400 },
    );
  }
}
