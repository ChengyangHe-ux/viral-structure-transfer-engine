import { NextRequest, NextResponse } from "next/server";

import { generateMigratedPlan } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { renderPlanMarkdown } from "@/lib/markdown";
import {
  generatePlanRequestSchema,
  videoStructureAnalysisSchema,
} from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const input = generatePlanRequestSchema.parse(await request.json());
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: { sampleAnalysis: true },
    });

    if (!project || !project.sampleAnalysis) {
      return NextResponse.json(
        { error: "Project or sample analysis not found" },
        { status: 404 },
      );
    }

    const analysis = videoStructureAnalysisSchema.parse(project.sampleAnalysis.data);
    const { plan, usedFallback, aiError } = await generateMigratedPlan({
      projectTitle: project.title,
      targetBrief: input.targetBrief,
      direction: input.direction,
      analysis,
    });
    const markdown = renderPlanMarkdown(plan);

    await prisma.project.update({
      where: { id: project.id },
      data: {
        targetBrief: input.targetBrief,
        status: "planned",
      },
    });

    await prisma.generatedPlan.create({
      data: {
        projectId: project.id,
        versionName: plan.versions.map((version) => version.versionName).join(" / "),
        data: plan,
        markdown,
      },
    });

    return NextResponse.json({
      projectId: project.id,
      plan,
      markdown,
      usedFallback,
      aiError,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Generate plan failed",
      },
      { status: 400 },
    );
  }
}
