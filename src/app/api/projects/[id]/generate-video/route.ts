import { mkdir, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  buildAdaptiveTransferStoryboard,
  type AdaptiveTransferStoryboardShot,
} from "@/lib/adaptive-video-storyboard";
import { migratedVideoPlanSchema, videoStructureAnalysisSchema } from "@/lib/schemas";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const ZHIPU_VIDEO_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

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

type GeneratedSegment = {
  order: number;
  role: string;
  taskId: string | null;
  videoUrl: string | null;
  downloaded: {
    filePath: string;
    bytes: number;
  } | null;
  provider: "zhipu" | "generic";
  request: Record<string, unknown>;
  submit: unknown;
  final: unknown;
};

type VideoProviderConfig = {
  provider: "zhipu" | "generic";
  baseUrl: string;
  apiKey: string;
  model: string;
  submitEndpoint: string;
  queryEndpoint: string;
};

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
  shot: AdaptiveTransferStoryboardShot;
  totalShots: number;
}) {
  return [
    "竖屏 9:16，真实商业短视频素材片段，用于后期拼成手法迁移成片。",
    `项目：${projectTitle}`,
    `方案版本：${versionName}`,
    `目标 Brief：${targetBrief}`,
    `迁移结构：${strategySummary}`,
    `当前分镜：${shot.order}/${totalShots} - ${shot.role}`,
    `源样片时间段：${shot.sourceTimeRange || "按当前脚本推断"}`,
    `目标成片时间段：${shot.targetTimeRange}`,
    `迁移手法：${shot.transferredTechnique}`,
    `必拍画面：${shot.visual}`,
    `剪辑节奏：${shot.rhythm}`,
    `后期包装参考：${shot.editPoint}`,
    "生成方式：只生成这一段分镜对应的画面，不要把整条视频结构都塞进本片段。",
    "连续性：保持同一个新主题主体和统一商业摄影风格；如果样片手法需要场景切换，可以按源样片节奏切场景，但不要跳出目标 Brief。",
    "转场预留：片段开头和结尾保留自然运动或定格余量，方便剪辑时衔接上一段和下一段。",
    "画面禁止：不要出现中文、英文、字幕、标题、卖点卡片、任何可读文字、Logo、水印、二维码、UI、品牌名、乱码字形或伪文字。",
    "包装要求：如果出现产品包装，只能是无字纯色或抽象图案包装，不要出现任何文字标签。",
    "音频要求：不要生成任何人声、讲解或口播；只保留自然音效，例如冷气、冰块、液体、包装轻响、环境氛围声。",
    "人物要求：除非目标 Brief 明确需要真人出镜，否则优先用产品、手部动作、环境变化、界面录屏或非可识别人物表达。",
    "质感要求：真实商业短视频质感，主体清晰，光线干净，适合社媒种草，不要卡通、不要玩具感、不要夸张变形。",
  ].join("\n");
}

function endpoint(baseUrl: string, pathName: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${pathName.replace(/^\/+/, "")}`;
}

function videoProviderConfig(): VideoProviderConfig | null {
  const zhipuApiKey = process.env.ZHIPU_API_KEY;
  const genericApiKey = process.env.VIDEO_API_KEY;
  const provider =
    process.env.VIDEO_API_PROVIDER === "zhipu" || (zhipuApiKey && !genericApiKey)
      ? "zhipu"
      : "generic";

  if (provider === "zhipu") {
    const apiKey = zhipuApiKey || genericApiKey;
    if (!apiKey) return null;
    return {
      provider,
      apiKey,
      baseUrl: process.env.VIDEO_API_BASE_URL || ZHIPU_VIDEO_BASE_URL,
      model: process.env.VIDEO_API_MODEL || process.env.ZHIPU_VIDEO_MODEL || "cogvideox-2",
      submitEndpoint: process.env.VIDEO_API_ENDPOINT || "/videos/generations",
      queryEndpoint: process.env.VIDEO_API_QUERY_ENDPOINT || "/async-result/{id}",
    };
  }

  if (!process.env.VIDEO_API_BASE_URL || !genericApiKey) return null;
  return {
    provider,
    apiKey: genericApiKey,
    baseUrl: process.env.VIDEO_API_BASE_URL,
    model: process.env.VIDEO_API_MODEL || "veo3.1-fast",
    submitEndpoint: process.env.VIDEO_API_ENDPOINT || "/v1/videos",
    queryEndpoint: process.env.VIDEO_API_QUERY_ENDPOINT || "/v1/videos/{id}",
  };
}

function buildSubmitPayload(config: VideoProviderConfig, prompt: string, seconds: string) {
  if (config.provider === "zhipu") {
    const duration = Number(seconds) === 10 ? 10 : 5;
    return {
      model: config.model,
      prompt: prompt.slice(0, 512),
      quality: process.env.ZHIPU_VIDEO_QUALITY || "quality",
      with_audio: process.env.ZHIPU_VIDEO_WITH_AUDIO === "true",
      size: process.env.ZHIPU_VIDEO_SIZE || "1080x1920",
      fps: Number(process.env.ZHIPU_VIDEO_FPS) === 60 ? 60 : 30,
      duration,
    };
  }

  return {
    model: config.model,
    prompt,
    seconds,
    size: process.env.VIDEO_API_SIZE || "720x1280",
  };
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

function findVideoUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const nested = findVideoUrl(entry);
      if (nested) return nested;
    }
    return null;
  }
  const item = payload as {
    url?: string;
    video?: string;
    video_url?: string;
    result_url?: string;
    file_url?: string;
    download_url?: string;
    output_url?: string;
    output?: { video_url?: string; url?: string };
    data?: unknown;
    result?: unknown;
    video_result?: unknown;
  };
  return (
    item.video_url ||
    item.url ||
    item.video ||
    item.result_url ||
    item.file_url ||
    item.download_url ||
    item.output_url ||
    item.output?.video_url ||
    item.output?.url ||
    findVideoUrl(item.data) ||
    findVideoUrl(item.result) ||
    findVideoUrl(item.video_result) ||
    null
  );
}

async function queryVideo(config: VideoProviderConfig, taskId: string) {
  const queryPath = config.queryEndpoint.replace("{id}", encodeURIComponent(taskId));

  const response = await fetch(endpoint(config.baseUrl, queryPath), {
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "x-api-key": config.apiKey,
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
  config,
  prompt,
  seconds,
  fileName,
}: {
  config: VideoProviderConfig;
  prompt: string;
  seconds: string;
  fileName: string;
}) {
  const payload = buildSubmitPayload(config, prompt, seconds);

  const submitResponse = await fetch(endpoint(config.baseUrl, config.submitEndpoint), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
      "x-api-key": config.apiKey,
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
          (submitBody as { id?: string; task_id?: string }).task_id ??
          null)
      : null;

  let finalPayload = submitBody;
  let videoUrl = findVideoUrl(submitBody);
  if (taskId && !videoUrl) {
    for (let attempt = 0; attempt < 18; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 2000 : 10000));
      finalPayload = await queryVideo(config, taskId);
      videoUrl = findVideoUrl(finalPayload);
      const status =
        finalPayload && typeof finalPayload === "object"
          ? String(
              (finalPayload as { status?: string; task_status?: string }).status ||
                (finalPayload as { status?: string; task_status?: string }).task_status ||
                "",
            ).toLowerCase()
          : "";
      if (
        videoUrl ||
        (status &&
          !["queued", "running", "processing", "pending", "in_progress", "submitted"].includes(
            status,
          ))
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
    provider: config.provider,
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
        sampleAnalysis: true,
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
    const analysis = project.sampleAnalysis
      ? videoStructureAnalysisSchema.parse(project.sampleAnalysis.data)
      : null;
    const version = plan.versions[versionIndex] ?? plan.versions[0];
    const beat = version?.scriptBeats[beatIndex];
    if (!version || (mode === "hook" && !beat)) {
      return NextResponse.json({ error: "Version or beat not found" }, { status: 404 });
    }

    const videoConfig = videoProviderConfig();
    if (!videoConfig) {
      return NextResponse.json(
        { error: "VIDEO_API_* or ZHIPU_API_KEY is not configured" },
        { status: 400 },
      );
    }

    if (mode === "full-video") {
      const requestedSegmentSeconds =
        process.env.VIDEO_API_SEGMENT_SECONDS || process.env.VIDEO_API_DURATION_SECONDS || "5";
      const adaptiveTransfer = buildAdaptiveTransferStoryboard({
        analysis,
        beats: version.scriptBeats,
        targetBrief: plan.targetBrief,
        userMaterials: project.userMaterials,
        segmentSeconds: Number(requestedSegmentSeconds),
      });
      const directorStoryboard = adaptiveTransfer.shots;
      const segmentSeconds = String(adaptiveTransfer.segmentSeconds);
      const outputBaseName = `${project.id}-${Date.now()}-${versionIndex}-adaptive-transfer`;
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
          config: videoConfig,
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
          adaptiveTransfer,
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
        const missingSegments = segments
          .filter((segment) => !segment.downloaded)
          .map((segment) => ({
            order: segment.order,
            role: segment.role,
            taskId: segment.taskId,
            status:
              segment.final && typeof segment.final === "object"
                ? (segment.final as { task_status?: string; status?: string }).task_status ||
                  (segment.final as { task_status?: string; status?: string }).status ||
                  null
                : null,
          }));
        const debugFilePath = await writeVideoGenerationDebug(`${outputBaseName}.json`, {
          projectId: project.id,
          planId: planRecord.id,
          mode,
          audioMode: "natural-sfx",
          versionIndex,
          beatIndex,
          adaptiveTransfer,
          directorStoryboard,
          segmentSeconds,
          segments,
          missingSegments,
          error: "Some adaptive transfer video segments did not return downloadable video URLs.",
        });

        return NextResponse.json(
          {
            error: "手法迁移成片有分段还未返回可下载视频，请稍后重试或改用单段生成。",
            projectId: project.id,
            planId: planRecord.id,
            mode,
            audioMode: "natural-sfx",
            versionIndex,
            beatIndex,
            adaptiveTransfer,
            directorStoryboard,
            segmentSeconds,
            segments,
            missingSegments,
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
          adaptiveTransfer,
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
            adaptiveTransfer,
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
        adaptiveTransfer,
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
        adaptiveTransfer,
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
      config: videoConfig,
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
