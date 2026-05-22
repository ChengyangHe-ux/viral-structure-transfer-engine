import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { migratedVideoPlanSchema } from "@/lib/schemas";

export const runtime = "nodejs";

function normalizePlanId(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const planId = normalizePlanId(request.nextUrl.searchParams.get("planId"));

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (planId) {
    const record = await prisma.generatedPlan.findFirst({
      where: { id: planId, projectId: project.id },
    });

    if (!record) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({
      projectId: project.id,
      planId: record.id,
      versionName: record.versionName,
      createdAt: record.createdAt,
      markdown: record.markdown,
      plan: migratedVideoPlanSchema.parse(record.data),
    });
  }

  const plans = await prisma.generatedPlan.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, versionName: true, createdAt: true },
  });

  return NextResponse.json({
    projectId: project.id,
    plans,
  });
}

