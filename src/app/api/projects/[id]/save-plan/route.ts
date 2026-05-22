import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { renderPlanMarkdown } from "@/lib/markdown";
import { migratedVideoPlanSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type SavePlanRequestBody = {
  plan: unknown;
  note?: string;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as SavePlanRequestBody;
    const plan = migratedVideoPlanSchema.parse(body.plan);
    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const markdown = renderPlanMarkdown(plan);
    const versionName = plan.versions.map((version) => version.versionName).join(" / ");
    const note = body.note?.trim();

    await prisma.project.update({
      where: { id: project.id },
      data: { status: "edited" },
    });

    const savedPlan = await prisma.generatedPlan.create({
      data: {
        projectId: project.id,
        versionName: note ? `${versionName}（${note}）` : `${versionName}（edited）`,
        data: plan,
        markdown,
      },
    });

    return NextResponse.json({ projectId: project.id, planId: savedPlan.id, plan, markdown });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Save plan failed",
      },
      { status: 400 },
    );
  }
}
