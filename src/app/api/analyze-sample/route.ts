import { NextRequest, NextResponse } from "next/server";

import { analyzeSample } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { extractPreviewFrames, inspectMedia, saveUploadedVideo } from "@/lib/media";
import {
  analyzeSampleRequestSchema,
  mediaMetaSchema,
  type MediaMeta,
} from "@/lib/schemas";
import { renderAnalysisMarkdown } from "@/lib/markdown";

export const runtime = "nodejs";

async function parseRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("sampleFile");
    const parsed = analyzeSampleRequestSchema.parse({
      projectTitle: formData.get("projectTitle")?.toString() || undefined,
      sampleTitle: formData.get("sampleTitle")?.toString() || undefined,
      sampleUrl: formData.get("sampleUrl")?.toString() || undefined,
      sampleNotes: formData.get("sampleNotes")?.toString() || undefined,
      targetBrief: formData.get("targetBrief")?.toString() || "",
    });

    if (file instanceof File && file.size > 0) {
      const mediaPath = await saveUploadedVideo(file);
      const inspected = await inspectMedia(mediaPath);
      const previewFrames = await extractPreviewFrames(mediaPath, inspected.durationSeconds);
      return {
        ...parsed,
        mediaPath,
        mediaMeta: mediaMetaSchema.parse({ ...inspected, previewFrames }),
      };
    }

    return {
      ...parsed,
      mediaPath: null,
      mediaMeta: mediaMetaSchema.parse({
        sourceKind: parsed.sampleUrl ? "url" : "manual",
        previewFrames: [],
      }),
    };
  }

  const body = await request.json();
  const parsed = analyzeSampleRequestSchema.parse(body);
  return {
    ...parsed,
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

    const { analysis, usedFallback, aiError } = await analyzeSample({
      sampleTitle: input.sampleTitle,
      sampleNotes: input.sampleNotes,
      sampleUrl: input.sampleUrl || undefined,
      mediaMeta: input.mediaMeta as MediaMeta,
    });

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
