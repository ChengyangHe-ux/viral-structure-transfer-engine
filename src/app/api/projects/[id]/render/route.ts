import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  migratedVideoPlanSchema,
  videoStructureAnalysisSchema,
} from "@/lib/schemas";

export const runtime = "nodejs";

type RenderQuality = "high" | "draft";
type RenderMode = "structure" | "commercial" | "high-quality" | "technique";

type RequestBody = {
  planId?: string | null;
  quality?: RenderQuality;
  mode?: RenderMode;
  title?: string;
};

function normalizeText(value: unknown) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

function runCommand(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as RequestBody;

    const project = await prisma.project.findUnique({
      where: { id },
      include: { sampleAnalysis: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const planId = normalizeText(body.planId ?? null);
    const record = await prisma.generatedPlan.findFirst({
      where: planId ? { id: planId, projectId: project.id } : { projectId: project.id },
      orderBy: planId ? undefined : { createdAt: "desc" },
    });
    if (!record) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const plan = migratedVideoPlanSchema.parse(record.data);
    const analysis = project.sampleAnalysis
      ? videoStructureAnalysisSchema.parse(project.sampleAnalysis.data)
      : null;
    const quality: RenderQuality = body.quality === "draft" ? "draft" : "high";
    const mode: RenderMode =
      body.mode === "commercial"
        ? "commercial"
        : body.mode === "high-quality"
          ? "high-quality"
          : body.mode === "technique"
            ? "technique"
          : "structure";
    const title = normalizeText(body.title) ?? project.title ?? "爆款结构迁移引擎（结构演示稿）";

    const renderId = randomUUID();
    const renderDir = path.resolve(process.cwd(), "data", "renders");
    await mkdir(renderDir, { recursive: true });
    const outputPath = path.join(renderDir, `${renderId}.mp4`);

    const inputPath = path.join(renderDir, `${renderId}.json`);
    await writeFile(inputPath, JSON.stringify({ plan, analysis }, null, 2), "utf8");

    const tsxBin = path.resolve(process.cwd(), "node_modules", ".bin", "tsx");
    await runCommand(tsxBin, [
      path.resolve(process.cwd(), "scripts", "render-video.ts"),
      "--input",
      inputPath,
      "--out",
      outputPath,
      "--title",
      title,
      "--quality",
      quality,
      ...(mode === "commercial"
        ? [
            "--composition",
            "ProductCommercial15",
            "--product-name",
            "天然矿泉水",
            ...(project.mediaPath ? ["--source-video", project.mediaPath] : []),
          ]
        : mode === "high-quality"
          ? [
              "--composition",
              /咖啡|冷萃|coffee/i.test(plan.projectTitle) ? "CoffeeLaunchShort" : "HighQualityShort",
              "--audio-mode",
              "auto",
              ...(project.mediaPath ? ["--source-video", project.mediaPath] : []),
            ]
          : mode === "technique"
            ? [
                "--composition",
                "VideoFromPlan",
                "--audio-mode",
                "auto",
                ...(project.mediaPath ? ["--source-video", project.mediaPath] : []),
              ]
        : []),
    ]);

    return NextResponse.json({
      projectId: project.id,
      planId: record.id,
      renderId,
      downloadUrl: `/api/renders/${renderId}`,
      quality,
      mode,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Render failed" },
      { status: 400 },
    );
  }
}
