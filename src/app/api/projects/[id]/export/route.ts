import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { renderProjectMarkdown } from "@/lib/markdown";
import {
  migratedVideoPlanSchema,
  videoStructureAnalysisSchema,
} from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const format = request.nextUrl.searchParams.get("format") || "md";
  const planId = request.nextUrl.searchParams.get("planId")?.trim() || null;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      sampleAnalysis: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const planRecord = planId
    ? await prisma.generatedPlan.findFirst({
        where: { id: planId, projectId: project.id },
      })
    : await prisma.generatedPlan.findFirst({
        where: { projectId: project.id },
        orderBy: { createdAt: "desc" },
      });

  if (planId && !planRecord) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const analysis = project.sampleAnalysis
    ? videoStructureAnalysisSchema.parse(project.sampleAnalysis.data)
    : undefined;
  const plan = planRecord
    ? migratedVideoPlanSchema.parse(planRecord.data)
    : undefined;

  if (format === "json") {
    return NextResponse.json({
      project,
      analysis,
      plan,
      planMeta: planRecord
        ? {
            id: planRecord.id,
            versionName: planRecord.versionName,
            createdAt: planRecord.createdAt,
          }
        : null,
    });
  }

  const markdown = renderProjectMarkdown({
    title: project.title,
    analysis,
    plan,
    source: "项目要求",
  });
  const suffix = planRecord
    ? `-${planRecord.versionName}-${planRecord.createdAt.toISOString().slice(0, 10)}`
    : "";
  const safeName = encodeURIComponent(`${project.title || "video-plan"}${suffix}.md`);

  return new NextResponse(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${safeName}`,
    },
  });
}
