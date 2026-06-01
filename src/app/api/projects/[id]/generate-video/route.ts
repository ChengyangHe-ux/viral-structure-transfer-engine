import { mkdir, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { migratedVideoPlanSchema } from "@/lib/schemas";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

function getFfmpegPath() {
  const platformArch =
    process.platform === "darwin" && process.arch === "arm64"
      ? "darwin-arm64"
      : process.platform === "darwin"
        ? "darwin-x64"
        : process.platform === "linux"
          ? "linux-x64"
          : process.platform === "win32"
            ? "win32-x64"
            : null;

  if (!platformArch) return "ffmpeg";
  return path.join(
    process.cwd(),
    "node_modules",
    "@ffmpeg-installer",
    platformArch,
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  );
}

type VideoGenerateRequest = {
  planId?: string;
  versionIndex?: number;
  beatIndex?: number;
  mode?: "hook" | "full-video";
  audioMode?: "natural-sfx" | "model-voiceover";
};

type PlanBeatForPrompt = {
  timeRange: string;
  shotPurpose: string;
  visualSuggestion: string;
  voiceoverOrSubtitle: string;
  packagingStyle: string;
  transitionAndRhythm: string;
  sellingPointIntent: string;
  replaceableAssets: string;
};

type DirectorStoryboardShot = {
  order: number;
  role: string;
  visual: string;
  rhythm: string;
  audio: string;
  editPoint: string;
};

type GeneratedSegment = {
  order: number;
  role: string;
  taskId: string | null;
  videoUrl: string | null;
  downloaded: {
    filePath: string;
    bytes: number;
  } | null;
  request: {
    model: string;
    prompt: string;
    seconds: string;
    size: string;
  };
  submit: unknown;
  final: unknown;
};

function cleanTemplateResidue(value: string) {
  return value
    .split("样例观察仅作结构参考")[0]
    .replace(/男性主角|侧脸|喝啤酒|啤酒|酒馆|吧台|酒吧|人群|品牌标签|红印章|蓝字体|瓶身|瓶盖/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shotRole(beat: PlanBeatForPrompt, index: number, total: number) {
  const text = `${beat.shotPurpose} ${beat.sellingPointIntent}`.toLowerCase();
  if (index === 0 || /hook|开头|吸引|反差|悬念|痛点/.test(text)) return "开头吸引";
  if (index === total - 1 || /cta|结尾|转化|引导|收束|行动/.test(text)) return "结尾收束";
  if (/对比|证明|效果|前后|结果/.test(text)) return "效果证明";
  if (/场景|体验|使用|过程|演示/.test(text)) return "体验场景";
  return "卖点可视化";
}

function buildDirectorStoryboard(
  beats: PlanBeatForPrompt[],
  targetBrief: string,
): DirectorStoryboardShot[] {
  const targetTopic = targetBrief.replace(/\s+/g, " ").slice(0, 120);
  return beats.map((beat, index) => {
    const role = shotRole(beat, index, beats.length);
    const visual = cleanTemplateResidue(beat.visualSuggestion);
    const fallbackVisual =
      role === "开头吸引"
        ? `围绕「${targetTopic}」拍一个能立刻看懂产品质感或使用结果的近景 Hook，不复制样例画面。`
        : role === "结尾收束"
          ? `围绕「${targetTopic}」做产品 hero shot 或使用后的结果定格，形成自然 CTA。`
          : `围绕「${targetTopic}」把该段卖点动作化，用产品状态变化、使用过程或环境反馈表达。`;

    return {
      order: index + 1,
      role,
      visual: visual || fallbackVisual,
      rhythm: cleanTemplateResidue(beat.transitionAndRhythm) || "跟随样例节奏完成一次明确转场。",
      audio: beat.voiceoverOrSubtitle,
      editPoint: beat.packagingStyle,
    };
  });
}

function buildPrompt({
  projectTitle,
  versionName,
  beat,
  beatIndex,
  strategySummary,
}: {
  projectTitle: string;
  versionName: string;
  beat: {
    timeRange: string;
    shotPurpose: string;
    visualSuggestion: string;
    voiceoverOrSubtitle: string;
    packagingStyle: string;
    transitionAndRhythm: string;
    sellingPointIntent: string;
    replaceableAssets: string;
  };
  beatIndex: number;
  strategySummary: string;
}) {
  return [
    `竖屏 9:16 短视频镜头，项目：${projectTitle}`,
    `方案版本：${versionName}`,
    `镜头 ${beatIndex + 1}，时间段：${beat.timeRange}`,
    `镜头目的：${beat.shotPurpose}`,
    `画面：${beat.visualSuggestion}`,
    `中文口播/字幕内容仅作为语义参考，不要把这些文字画进视频：${beat.voiceoverOrSubtitle}`,
    `包装风格仅作为后期方向，不要在画面里生成中文标题、字幕、标签或卖点卡片：${beat.packagingStyle}`,
    `节奏与转场：${beat.transitionAndRhythm}`,
    `卖点意图：${beat.sellingPointIntent}`,
    `可替换素材：${beat.replaceableAssets}`,
    `整体结构：${strategySummary}`,
    "生成要求：只生成干净的真实画面和自然动作，不要出现任何可读文字、中文字幕、英文字幕、Logo、水印、二维码、UI乱码或海报字样。",
    "画面需要为后期字幕预留安全区：主体不要遮挡底部 20% 和顶部 12%，方便后续叠加中文标题条和字幕。",
    "真实商业短视频质感，主体清晰，光线干净，适合社媒种草。",
  ].join("\n");
}

function buildSegmentPrompt({
  projectTitle,
  versionName,
  strategySummary,
  targetBrief,
  shot,
  totalShots,
}: {
  projectTitle: string;
  versionName: string;
  strategySummary: string;
  targetBrief: string;
  shot: DirectorStoryboardShot;
  totalShots: number;
}) {
  return [
    "竖屏 9:16，真实商业短视频素材片段，用于后期按分镜拼接。",
    `项目：${projectTitle}`,
    `方案版本：${versionName}`,
    `目标 Brief：${targetBrief}`,
    `迁移结构：${strategySummary}`,
    `当前分镜：${shot.order}/${totalShots} - ${shot.role}`,
    `必拍画面：${shot.visual}`,
    `剪辑节奏：${shot.rhythm}`,
    `后期包装参考：${shot.editPoint}`,
    "生成方式：只生成这一段分镜对应的画面，不要把整条视频结构都塞进本片段。",
    "连续性：保持同一个产品主体、同一商业摄影风格、同一色彩和光线体系，方便后续无缝拼接。",
    "转场预留：片段开头和结尾保留自然运动或定格余量，方便剪辑时衔接上一段和下一段。",
    "画面禁止：不要出现中文、英文、字幕、标题、卖点卡片、任何可读文字、Logo、水印、二维码、UI、品牌名、乱码字形或伪文字。",
    "包装要求：如果出现产品包装，只能是无字纯色或抽象图案包装，不要出现任何文字标签。",
    "音频要求：不要生成任何人声、讲解或口播；只保留自然音效，例如冷气、冰块、液体、包装轻响、环境氛围声。",
    "人物限制：不要出现任何人物、脸、嘴巴、牙齿、吃东西动作或主播出镜；用产品、冰块、冷气、包装、环境变化表达。",
    "质感要求：真实商业短视频质感，主体清晰，光线干净，适合社媒种草，不要卡通、不要玩具感、不要夸张变形。",
  ].join("\n");
}

function endpoint(baseUrl: string, pathName: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${pathName.replace(/^\/+/, "")}`;
}

async function downloadVideo(url: string, fileName: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const outDir = path.join(process.cwd(), "renders", "api-videos");
  await mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, fileName);
  await writeFile(filePath, buffer);
  return { filePath, bytes: buffer.length };
}

async function writeVideoGenerationDebug(fileName: string, data: unknown) {
  const outDir = path.join(process.cwd(), "renders", "api-videos");
  await mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, fileName);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  return filePath;
}

function findVideoUrl(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const item = payload as {
    url?: string;
    video_url?: string;
    output?: { video_url?: string; url?: string };
    data?: { url?: string; video_url?: string };
  };
  return (
    item.video_url ||
    item.url ||
    item.output?.video_url ||
    item.output?.url ||
    item.data?.video_url ||
    item.data?.url ||
    null
  );
}

async function queryVideo(taskId: string) {
  const baseUrl = process.env.VIDEO_API_BASE_URL;
  const apiKey = process.env.VIDEO_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("VIDEO_API_BASE_URL or VIDEO_API_KEY is not configured.");

  const response = await fetch(endpoint(baseUrl, `/v1/videos/${taskId}`), {
    headers: {
      authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
    },
  });
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { status: response.status, text };
  }
}

async function submitVideoGeneration({
  baseUrl,
  apiKey,
  prompt,
  seconds,
  fileName,
}: {
  baseUrl: string;
  apiKey: string;
  prompt: string;
  seconds: string;
  fileName: string;
}) {
  const payload = {
    model: process.env.VIDEO_API_MODEL || "veo3.1-fast",
    prompt,
    seconds,
    size: "720x1280",
  };

  const submitResponse = await fetch(endpoint(baseUrl, process.env.VIDEO_API_ENDPOINT || "/v1/videos"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });
  const submitText = await submitResponse.text();
  let submitBody: unknown = submitText;
  try {
    submitBody = JSON.parse(submitText) as unknown;
  } catch {
    // Keep raw text inspectable.
  }

  if (!submitResponse.ok) {
    throw new Error(
      `Video API submit failed: ${submitResponse.status} ${JSON.stringify(submitBody).slice(0, 500)}`,
    );
  }

  const taskId =
    submitBody && typeof submitBody === "object"
      ? ((submitBody as { id?: string; task_id?: string }).id ??
          (submitBody as { id?: string; task_id?: string }).task_id)
      : null;

  let finalPayload = submitBody;
  let videoUrl = findVideoUrl(submitBody);
  if (taskId && !videoUrl) {
    for (let attempt = 0; attempt < 18; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 2000 : 10000));
      finalPayload = await queryVideo(taskId);
      videoUrl = findVideoUrl(finalPayload);
      const status =
        finalPayload && typeof finalPayload === "object"
          ? String((finalPayload as { status?: string }).status || "").toLowerCase()
          : "";
      if (
        videoUrl ||
        (status && !["queued", "running", "processing", "pending", "in_progress"].includes(status))
      ) {
        break;
      }
    }
  }

  const downloaded = videoUrl ? await downloadVideo(videoUrl, fileName) : null;

  return {
    taskId,
    videoUrl,
    downloaded,
    request: payload,
    submit: submitBody,
    final: finalPayload,
  };
}

function escapeConcatPath(filePath: string) {
  return filePath.replace(/'/g, "'\\''");
}

async function concatSegments(segmentPaths: string[], outputBaseName: string) {
  const outDir = path.join(process.cwd(), "renders", "api-videos");
  await mkdir(outDir, { recursive: true });
  const listPath = path.join(outDir, `${outputBaseName}-concat.txt`);
  const outputPath = path.join(outDir, `${outputBaseName}.mp4`);
  await writeFile(
    listPath,
    segmentPaths.map((segmentPath) => `file '${escapeConcatPath(segmentPath)}'`).join("\n"),
    "utf-8",
  );
  await execFileAsync(getFfmpegPath(), [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
  const outputStat = await stat(outputPath);
  return { filePath: outputPath, listPath, bytes: outputStat.size };
}

function localVideoUrl(filePath: string) {
  return `/api/renders/video?path=${encodeURIComponent(filePath)}`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as VideoGenerateRequest;
    const versionIndex = body.versionIndex ?? 0;
    const beatIndex = body.beatIndex ?? 0;
    const mode = body.mode ?? "hook";
    const audioMode = body.audioMode ?? "natural-sfx";

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        generatedPlans: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const planRecord = body.planId
      ? project.generatedPlans.find((record) => record.id === body.planId)
      : project.generatedPlans[0];
    if (!planRecord) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const plan = migratedVideoPlanSchema.parse(planRecord.data);
    const version = plan.versions[versionIndex] ?? plan.versions[0];
    const beat = version?.scriptBeats[beatIndex];
    if (!version || (mode === "hook" && !beat)) {
      return NextResponse.json({ error: "Version or beat not found" }, { status: 404 });
    }

    const baseUrl = process.env.VIDEO_API_BASE_URL;
    const apiKey = process.env.VIDEO_API_KEY;
    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: "VIDEO_API_BASE_URL or VIDEO_API_KEY is not configured" },
        { status: 400 },
      );
    }

    if (mode === "full-video") {
      const directorStoryboard = buildDirectorStoryboard(version.scriptBeats, plan.targetBrief);
      const segmentSeconds =
        process.env.VIDEO_API_SEGMENT_SECONDS || process.env.VIDEO_API_DURATION_SECONDS || "5";
      const outputBaseName = `${project.id}-${Date.now()}-${versionIndex}-segmented-full`;
      const progressFilePath = path.join(
        process.cwd(),
        "renders",
        "api-videos",
        `${outputBaseName}.progress.json`,
      );
      const segments: GeneratedSegment[] = [];

      for (const shot of directorStoryboard) {
        const segmentPrompt = buildSegmentPrompt({
          projectTitle: project.title,
          versionName: version.versionName,
          strategySummary: plan.strategySummary,
          targetBrief: plan.targetBrief,
          shot,
          totalShots: directorStoryboard.length,
        });
        const generated = await submitVideoGeneration({
          baseUrl,
          apiKey,
          prompt: segmentPrompt,
          seconds: segmentSeconds,
          fileName: `${outputBaseName}-segment-${String(shot.order).padStart(2, "0")}.mp4`,
        });

        segments.push({
          order: shot.order,
          role: shot.role,
          ...generated,
        });
        await writeVideoGenerationDebug(`${outputBaseName}.progress.json`, {
          projectId: project.id,
          planId: planRecord.id,
          mode,
          audioMode: "natural-sfx",
          versionIndex,
          beatIndex,
          directorStoryboard,
          segmentSeconds,
          completedSegments: segments.length,
          totalSegments: directorStoryboard.length,
          segments,
        });
      }

      const segmentPaths = segments
        .map((segment) => segment.downloaded?.filePath)
        .filter((filePath): filePath is string => Boolean(filePath));
      if (segmentPaths.length !== directorStoryboard.length) {
        const debugFilePath = await writeVideoGenerationDebug(`${outputBaseName}.json`, {
          projectId: project.id,
          planId: planRecord.id,
          mode,
          audioMode: "natural-sfx",
          versionIndex,
          beatIndex,
          directorStoryboard,
          segmentSeconds,
          segments,
          error: "Some segments did not return downloadable video URLs.",
        });

        return NextResponse.json(
          {
            error: "Some segments did not return downloadable video URLs.",
            projectId: project.id,
            planId: planRecord.id,
            mode,
            audioMode: "natural-sfx",
            versionIndex,
            beatIndex,
            directorStoryboard,
            segmentSeconds,
            segments,
            debugFilePath,
          },
          { status: 502 },
        );
      }

      let stitched: Awaited<ReturnType<typeof concatSegments>>;
      try {
        stitched = await concatSegments(segmentPaths, outputBaseName);
      } catch (error) {
        const debugFilePath = await writeVideoGenerationDebug(`${outputBaseName}.json`, {
          projectId: project.id,
          planId: planRecord.id,
          mode,
          audioMode: "natural-sfx",
          versionIndex,
          beatIndex,
          directorStoryboard,
          segmentSeconds,
          segments,
          progressFilePath,
          error: error instanceof Error ? error.message : "ffmpeg concat failed",
        });

        return NextResponse.json(
          {
            error: error instanceof Error ? error.message : "ffmpeg concat failed",
            projectId: project.id,
            planId: planRecord.id,
            mode,
            audioMode: "natural-sfx",
            versionIndex,
            beatIndex,
            directorStoryboard,
            segmentSeconds,
            segments,
            progressFilePath,
            debugFilePath,
          },
          { status: 502 },
        );
      }
      const downloaded = {
        filePath: stitched.filePath,
        bytes: stitched.bytes,
      };
      const debugFilePath = await writeVideoGenerationDebug(`${outputBaseName}.json`, {
        projectId: project.id,
        planId: planRecord.id,
        mode,
        audioMode: "natural-sfx",
        versionIndex,
        beatIndex,
        directorStoryboard,
        segmentSeconds,
        segments,
        stitched,
        downloaded,
        progressFilePath,
      });

      return NextResponse.json({
        projectId: project.id,
        planId: planRecord.id,
        mode,
        audioMode: "natural-sfx",
        versionIndex,
        beatIndex,
        directorStoryboard,
        segmentSeconds,
        segments,
        stitched,
        videoUrl: null,
        localVideoUrl: localVideoUrl(stitched.filePath),
        downloaded,
        progressFilePath,
        debugFilePath,
      });
    }

    const requestedSeconds =
      process.env.VIDEO_API_DURATION_SECONDS || "5";
    const prompt = buildPrompt({
      projectTitle: project.title,
      versionName: version.versionName,
      beat: beat!,
      beatIndex,
      strategySummary: plan.strategySummary,
    });
    const outputBaseName = `${project.id}-${Date.now()}-${versionIndex}-${beatIndex}`;
    const generated = await submitVideoGeneration({
      baseUrl,
      apiKey,
      prompt,
      seconds: requestedSeconds,
      fileName: `${outputBaseName}.mp4`,
    });
    const debugFilePath = await writeVideoGenerationDebug(`${outputBaseName}.json`, {
      projectId: project.id,
      planId: planRecord.id,
      mode,
      audioMode,
      versionIndex,
      beatIndex,
      directorStoryboard: null,
      prompt,
      request: generated.request,
      taskId: generated.taskId,
      submit: generated.submit,
      final: generated.final,
      videoUrl: generated.videoUrl,
      localVideoUrl: generated.downloaded ? localVideoUrl(generated.downloaded.filePath) : null,
      downloaded: generated.downloaded,
    });

    return NextResponse.json({
      projectId: project.id,
      planId: planRecord.id,
      mode,
      audioMode,
      versionIndex,
      beatIndex,
      directorStoryboard: null,
      prompt,
      request: generated.request,
      taskId: generated.taskId,
      submit: generated.submit,
      final: generated.final,
      videoUrl: generated.videoUrl,
      localVideoUrl: generated.downloaded ? localVideoUrl(generated.downloaded.filePath) : null,
      downloaded: generated.downloaded,
      debugFilePath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generate video failed" },
      { status: 400 },
    );
  }
}
