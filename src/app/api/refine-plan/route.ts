import { NextRequest, NextResponse } from "next/server";

import { refineMigratedPlan } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { renderPlanMarkdown } from "@/lib/markdown";
import {
  migratedVideoPlanSchema,
  refinePlanRequestSchema,
  videoStructureAnalysisSchema,
} from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const input = refinePlanRequestSchema.parse(await request.json());
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: {
        sampleAnalysis: true,
        generatedPlans: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!project || !project.sampleAnalysis || !project.generatedPlans[0]) {
      return NextResponse.json(
        { error: "Project, sample analysis, or generated plan not found" },
        { status: 404 },
      );
    }

    const analysis = videoStructureAnalysisSchema.parse(project.sampleAnalysis.data);
    const currentPlan = migratedVideoPlanSchema.parse(project.generatedPlans[0].data);
    const { plan, usedFallback, aiError } = await refineMigratedPlan({
      projectTitle: project.title,
      instruction: input.instruction,
      analysis,
      plan: currentPlan,
    });
    const markdown = renderPlanMarkdown(plan);

    await prisma.project.update({
      where: { id: project.id },
      data: { status: "refined" },
    });

    const savedPlan = await prisma.generatedPlan.create({
      data: {
        projectId: project.id,
        versionName: `自然语言修订：${input.instruction.slice(0, 24)}`,
        data: plan,
        markdown,
      },
    });

    return NextResponse.json({
      projectId: project.id,
      planId: savedPlan.id,
      plan,
      markdown,
      usedFallback,
      aiError,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Refine plan failed",
      },
      { status: 400 },
    );
  }
}
