import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { applyNaturalLanguageEdits } from "@/lib/nl-edit";
import { renderProjectMarkdown } from "@/lib/markdown";
import { diffPlans } from "@/lib/plan-diff";
import { migratedVideoPlanSchema, videoStructureAnalysisSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type RequestBody = {
  instruction: string;
  planId?: string | null;
  note?: string;
  dryRun?: boolean;
  basePlanId?: string | null;
};

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as RequestBody;
    const instruction = normalizeText(body.instruction);
    if (!instruction) {
      return NextResponse.json({ error: "instruction is required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: { sampleAnalysis: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const planId = normalizeText(body.planId ?? null);
    const basePlanId = normalizeText(body.basePlanId ?? null);
    const record = await prisma.generatedPlan.findFirst({
      where: planId ? { id: planId, projectId: project.id } : { projectId: project.id },
      orderBy: planId ? undefined : { createdAt: "desc" },
    });

    if (!record) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (basePlanId && basePlanId !== record.id) {
      return NextResponse.json(
        {
          error: "Base plan changed, please preview again.",
          expectedBasePlanId: basePlanId,
          actualBasePlanId: record.id,
        },
        { status: 409 },
      );
    }

    const analysis = project.sampleAnalysis?.data
      ? videoStructureAnalysisSchema.safeParse(project.sampleAnalysis.data)
      : null;
    const parsedPlan = migratedVideoPlanSchema.parse(record.data);
    const result = applyNaturalLanguageEdits(parsedPlan, instruction, analysis?.success ? analysis.data : undefined);

    const markdown = renderProjectMarkdown({
      title: project.title,
      analysis: analysis?.success ? analysis.data : undefined,
      plan: result.plan,
      source: "项目要求",
    });
    const dryRun = Boolean(body.dryRun);
    const diff = diffPlans(parsedPlan, result.plan);

    if (dryRun) {
      return NextResponse.json({
        projectId: project.id,
        sourcePlanId: record.id,
        plan: result.plan,
        markdown,
        applied: result.applied,
        warnings: result.warnings,
        diff,
        dryRun: true,
      });
    }

    const note = normalizeText(body.note);
    const versionNameBase = result.plan.versions.map((v) => v.versionName).join(" / ");

    await prisma.project.update({
      where: { id: project.id },
      data: { status: "edited" },
    });

    const savedPlan = await prisma.generatedPlan.create({
      data: {
        projectId: project.id,
        versionName: note ? `${versionNameBase}（${note}）` : `${versionNameBase}（nl-edit）`,
        data: result.plan,
        markdown,
      },
    });

    return NextResponse.json({
      projectId: project.id,
      planId: savedPlan.id,
      sourcePlanId: record.id,
      plan: result.plan,
      markdown,
      applied: result.applied,
      warnings: result.warnings,
      diff,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "NL edit failed" },
      { status: 400 },
    );
  }
}
