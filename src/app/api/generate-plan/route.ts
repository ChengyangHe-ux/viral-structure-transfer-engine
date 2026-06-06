import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { generateMigratedPlan } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { renderProjectMarkdown } from "@/lib/markdown";
import {
  generatePlanRequestSchema,
  videoStructureAnalysisSchema,
} from "@/lib/schemas";
import {
  saveUserMaterialFiles,
  serializeUserMaterials,
} from "@/lib/user-materials";

export const runtime = "nodejs";

async function parseRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const files = formData
      .getAll("userMaterialFiles")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const parsed = generatePlanRequestSchema.parse({
      projectId: formData.get("projectId")?.toString() || "",
      targetBrief: formData.get("targetBrief")?.toString() || "",
      userMaterials: formData.get("userMaterials")?.toString() || "",
      direction: formData.get("direction")?.toString() || undefined,
    });

    return {
      ...parsed,
      userMaterialFiles: files,
    };
  }

  return {
    ...generatePlanRequestSchema.parse(await request.json()),
    userMaterialFiles: [] as File[],
  };
}

export async function POST(request: NextRequest) {
  try {
    const input = await parseRequest(request);
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

    const savedMaterials = await saveUserMaterialFiles(project.id, input.userMaterialFiles);
    const storedUserMaterials = serializeUserMaterials({
      notes: input.userMaterials,
      materials: savedMaterials,
    });
    const analysis = videoStructureAnalysisSchema.parse(project.sampleAnalysis.data);
    const { plan, usedFallback, aiError } = await generateMigratedPlan({
      projectTitle: project.title,
      targetBrief: input.targetBrief,
      userMaterials: storedUserMaterials,
      direction: input.direction,
      analysis,
    });
    const markdown = renderProjectMarkdown({
      title: project.title,
      analysis,
      plan,
      source: "项目要求",
    });

    await prisma.project.update({
      where: { id: project.id },
      data: {
        targetBrief: input.targetBrief,
        userMaterials: storedUserMaterials,
        status: "planned",
      },
    });

    const savedPlan = await prisma.generatedPlan.create({
      data: {
        projectId: project.id,
        versionName: plan.versions.map((version) => version.versionName).join(" / "),
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
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "请补充新片需求，至少写清主题或商品名称。",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Generate plan failed",
      },
      { status: 400 },
    );
  }
}
