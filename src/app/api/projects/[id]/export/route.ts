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
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      sampleAnalysis: true,
      generatedPlans: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const analysis = project.sampleAnalysis
    ? videoStructureAnalysisSchema.parse(project.sampleAnalysis.data)
    : undefined;
  const plan = project.generatedPlans[0]
    ? migratedVideoPlanSchema.parse(project.generatedPlans[0].data)
    : undefined;

  if (format === "json") {
    return NextResponse.json({ project, analysis, plan });
  }

  const markdown = renderProjectMarkdown({
    title: project.title,
    analysis,
    plan,
    source: "项目要求",
  });
  const safeName = encodeURIComponent(`${project.title || "video-plan"}.md`);

  return new NextResponse(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${safeName}`,
    },
  });
}
