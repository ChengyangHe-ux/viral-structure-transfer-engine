"use client";

import { useEffect, useMemo, useState } from "react";
import { Player } from "@remotion/player";
import {
  AlertCircle,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Copy,
  Database,
  Download,
  FileJson,
  FileText,
  GitBranch,
  ImageIcon,
  Loader2,
  PackageCheck,
  PencilLine,
  Plus,
  RefreshCw,
  Trash2,
  Video,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildMigrationMap,
  materialFitText,
  type MigrationMapRow,
} from "@/lib/mapping";
import { diffPlans } from "@/lib/plan-diff";
import { buildStoryboardFrames, type StoryboardFrame } from "@/lib/storyboard";
import {
  buildStructureFingerprint,
  type StructureFocus,
} from "@/lib/structure-fingerprint";
import {
  buildDirectorTransferPlan,
  type EditDecision,
  type MaterialRequirement,
  type TechniqueProfile,
  type TransferSlot,
} from "@/lib/director-technique";
import { demoPresets, type DemoPreset } from "@/lib/demo-presets";
import { evaluateChampionRubric } from "@/lib/champion-rubric";
import { buildContestRequirementCoverage } from "@/lib/requirement-coverage";
import { buildTechniqueTransferRecipe } from "@/lib/technique-transfer";
import { buildTimelineSegments, type TimelineSegment } from "@/lib/timeline";
import { insertBeatAfter, moveBeat, removeBeat } from "@/lib/plan-edit";
import { VideoFromPlan } from "@/remotion/video-from-plan";
import { calculateVideoFramesFromPlan } from "@/remotion/video-metadata";
import type {
  MediaMeta,
  MaterialAdaptation,
  MigratedVideoPlan,
  PlanVersion,
  RetrievedEditingTechnique,
  VideoStructureAnalysis,
} from "@/lib/schemas";

type AnalyzeResponse = {
  projectId: string;
  analysis: VideoStructureAnalysis;
  markdown: string;
  mediaMeta: MediaMeta;
  usedFallback: boolean;
  aiError: string | null;
  visionFrameCount?: number;
  directVideoUsed?: boolean;
  sourceSampleCount?: number;
  sourceSamples?: string[];
  error?: string;
};

type PlanResponse = {
  projectId: string;
  planId?: string;
  plan: MigratedVideoPlan;
  markdown: string;
  usedFallback: boolean;
  aiError: string | null;
  error?: string;
};

type PlanHistoryItem = {
  id: string;
  versionName: string;
  createdAt: string;
};

type PlansListResponse = {
  projectId: string;
  plans: PlanHistoryItem[];
  error?: string;
};

type PlanLoadResponse = {
  projectId: string;
  planId: string;
  versionName: string;
  createdAt: string;
  markdown: string;
  plan: MigratedVideoPlan;
  error?: string;
};

type FullVideoPackagingMode = "cinematic" | "smart" | "clean";
type GeneratedVideoPackagingMode = FullVideoPackagingMode | "premium";

type CinematicEditPlan = {
  label?: string;
  summary?: string;
  globalStyle?: string;
  negativeRules?: string[];
  decisions?: Array<{
    order: number;
    role: string;
    cameraTreatment: string;
    motionPlan: string;
    transitionPlan: string;
    soundDesign: string;
    materialInstruction: string;
  }>;
};

type GeneratedVideoPackaging = {
  mode?: GeneratedVideoPackagingMode;
  label?: string;
  subtitles: boolean;
  audio: boolean;
};

type VideoGenerateResponse = {
  mode?: "hook" | "full-video";
  audioMode?: "natural-sfx" | "model-voiceover";
  packagingMode?: GeneratedVideoPackagingMode;
  generationStatus?: "completed" | "processing" | "blocked" | "failed";
  retryable?: boolean;
  outputBaseName?: string;
  completedSegments?: number;
  totalSegments?: number;
  localVideoUrl?: string | null;
  videoUrl?: string | null;
  segmentSeconds?: string;
  adaptiveTransfer?: {
    targetDurationSeconds: number;
    segmentSeconds: number;
    sourceBeatCount: number;
    targetBeatCount: number;
    strategy: string;
  };
  segments?: Array<{
    order: number;
    role: string;
    source?: "aigc-video" | "user-video" | "user-image";
    slotId?: string;
    materialLabel?: string | null;
    reason?: string;
    editSummary?: string | null;
    downloaded?: {
      filePath: string;
      bytes: number;
    } | null;
  }>;
  missingSegments?: Array<{
    order: number;
    role: string;
    status?: string | null;
  }>;
  renderStrategy?: {
    type: "all-aigc" | "hybrid-material-aigc" | "material-remix";
    targetDurationSeconds: number;
    sourceMaterialCount: number;
    reusedMaterialSegmentCount: number;
    aigcSegmentCount: number;
    materialSummary?: string;
    cinematicEditPlan?: CinematicEditPlan | null;
    editDecisionList?: EditDecision[];
    decisions?: Array<{
      order: number;
      role: string;
      source: EditDecision["source"];
      slotId?: string;
      materialLabel?: string | null;
      provider?: string;
      reason?: string;
      editSummary?: string | null;
    }>;
  };
  techniqueProfile?: TechniqueProfile | null;
  transferSlots?: TransferSlot[];
  materialRequirementMatrix?: MaterialRequirement[];
  cinematicEditPlan?: CinematicEditPlan | null;
  editDecisionList?: EditDecision[];
  downloaded?: {
    filePath: string;
    bytes: number;
  } | null;
  debugFilePath?: string;
  packaging?: GeneratedVideoPackaging;
  error?: string;
};

const DIRECTOR_PREVIEW_FPS = 30;
const DIRECTOR_PREVIEW_WIDTH = 1080;
const DIRECTOR_PREVIEW_HEIGHT = 1920;

type LatestRenderResponse = {
  video?: {
    title: string;
    note: string;
    localVideoUrl: string;
    outputBaseName?: string | null;
    createdAt?: string;
    durationSeconds?: number | null;
    packaging?: GeneratedVideoPackaging;
  } | null;
  error?: string;
};

type GeneratedVideoState = {
  title: string;
  url: string | null;
  note: string;
  createdAt: string;
  status?: "completed" | "processing" | "failed";
  retryable?: boolean;
  outputBaseName?: string | null;
  progressText?: string;
  packaging?: GeneratedVideoPackaging;
  renderStrategy?: VideoGenerateResponse["renderStrategy"];
  techniqueProfile?: TechniqueProfile | null;
  transferSlots?: TransferSlot[];
  materialRequirementMatrix?: MaterialRequirement[];
  cinematicEditPlan?: CinematicEditPlan | null;
  editDecisionList?: EditDecision[];
};

type RenderStrategyDecision = NonNullable<
  NonNullable<VideoGenerateResponse["renderStrategy"]>["decisions"]
>[number];
type PreviewDecision = EditDecision | RenderStrategyDecision;

type StatusState =
  | { type: "idle"; message: string }
  | { type: "loading"; message: string }
  | { type: "success"; message: string }
  | { type: "warning"; message: string }
  | { type: "error"; message: string };

type RunModeState = {
  sample:
    | {
        mode: "local" | "frames" | "direct-video";
        frameCount: number;
        sampleCount: number;
        note: string;
      }
    | null;
  plan:
    | {
        mode: "local" | "model";
        note: string;
      }
    | null;
};

type SampleSourceMode = "upload" | "url" | "library";
type DirectorTuningPreset = "click" | "conversion" | "premium";
type DirectorTuningState = {
  preset: DirectorTuningPreset;
  hookStrength: number;
  subtitleDensity: number;
  pacing: number;
  ctaStrength: number;
};

type TimelineExchangeClip = {
  id: string;
  order: number;
  timeRange: string;
  startSecond: number;
  endSecond: number;
  durationSeconds: number;
  name?: string;
  text?: string;
  style?: string;
  focus?: string;
  materialSlotName?: string;
  materialFit?: MigrationMapRow["materialFit"];
  completionStrategy?: string;
  completionPlan?: string;
  visualSuggestion?: string;
  transitionAndRhythm?: string;
  replaceableAssets?: string;
  overlayText?: string;
  assetCandidates?: Array<{
    assetId: string;
    label: string;
    fitScore: number;
    reason: string;
  }>;
};

type TimelineExchangeTrack = {
  id: string;
  kind: "video" | "subtitle" | "packaging";
  name: string;
  clips: TimelineExchangeClip[];
};

type TimelineExchangePayload = {
  schema: "viral-structure-transfer.timeline.v1";
  project: {
    title: string;
    targetBrief: string;
    strategySummary: string;
  };
  sourceSample: {
    title: string;
    contentPromise: string;
    targetAudience: string;
    durationSeconds?: number;
  };
  version: {
    name: string;
    positioning: string;
    bestFor: string;
    coverTitle: string;
    captionTitle: string;
    hashtags: string[];
  };
  timeline: {
    fps: number;
    canvas: {
      width: number;
      height: number;
      aspectRatio: "9:16";
    };
    totalSeconds: number;
    beatCount: number;
    segmentCount: number;
  };
  tracks: TimelineExchangeTrack[];
  sourceMap: Array<{
    order: number;
    source: {
      timeRange: string;
      shotPurpose: string;
      transferableRule: string;
    };
    target: {
      timeRange: string;
      shotPurpose: string;
      line: string;
    };
    mappingLogic: string;
    material: {
      slotName: string;
      fit: MigrationMapRow["materialFit"];
      completionStrategy: string;
      completionPlan: string;
    };
  }>;
  material: {
    sufficiencyScore?: number;
    missingSlotCount?: number;
    timelineAdjustment?: string;
    assets: Array<{
      id: string;
      kind: MaterialAdaptation["assets"][number]["kind"];
      label: string;
      qualityScore: number;
      suggestedSlots: string[];
    }>;
    slots: Array<{
      slotId: string;
      slotName: string;
      fit: MaterialAdaptation["slots"][number]["fit"];
      requiredMaterial: string;
      matchedMaterial: string;
      completionStrategy: MaterialAdaptation["slots"][number]["completionStrategy"];
      completionPlan: string;
    }>;
  };
  evaluation: {
    overallScore?: number;
    readiness?: string;
    versionScore?: number;
    bestVersion?: string;
  };
};

const samplePlaceholder =
  "可选：补充样例口播、节奏、字幕风格。多个样例用 --- 分隔。";

const briefPlaceholder =
  "例：AI 简历工具｜大学生｜10分钟生成岗位匹配版简历｜已有录屏/截图，缺真人 CTA。";

const directorTuningPresets: Array<{
  key: DirectorTuningPreset;
  label: string;
  caption: string;
  values: DirectorTuningState;
}> = [
  {
    key: "click",
    label: "高点击",
    caption: "结果前置 / 快节奏",
    values: {
      preset: "click",
      hookStrength: 88,
      subtitleDensity: 82,
      pacing: 86,
      ctaStrength: 70,
    },
  },
  {
    key: "conversion",
    label: "高转化",
    caption: "证据提前 / CTA 清晰",
    values: {
      preset: "conversion",
      hookStrength: 76,
      subtitleDensity: 74,
      pacing: 68,
      ctaStrength: 90,
    },
  },
  {
    key: "premium",
    label: "高质感",
    caption: "留白 / 干净包装",
    values: {
      preset: "premium",
      hookStrength: 70,
      subtitleDensity: 52,
      pacing: 46,
      ctaStrength: 62,
    },
  },
];

const defaultDirectorTuning = directorTuningPresets[1]!.values;

function statusIcon(type: StatusState["type"]) {
  if (type === "loading") return <Loader2 className="animate-spin" />;
  if (type === "success") return <CheckCircle2 />;
  if (type === "warning") return <AlertCircle />;
  if (type === "error") return <AlertCircle />;
  return <PackageCheck />;
}

function downloadExport(projectId: string, format: "md" | "json", planId?: string | null) {
  const planQuery = planId ? `&planId=${encodeURIComponent(planId)}` : "";
  window.open(`/api/projects/${projectId}/export?format=${format}${planQuery}`, "_blank");
}

function safeDownloadName(value: string, fallback: string) {
  const clean = value
    .replace(/\s+/g, "-")
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9._-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return clean || fallback;
}

function downloadTextFile({
  fileName,
  text,
  mimeType,
}: {
  fileName: string;
  text: string;
  mimeType: string;
}) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function formatSeconds(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return "--";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m${remaining.toFixed(0)}s`;
}

function videoPackagingLabel(packaging?: GeneratedVideoPackaging) {
  if (!packaging) return null;
  if (packaging.label) return packaging.label;
  if (packaging.mode === "clean" || (!packaging.subtitles && !packaging.audio)) {
    return "干净成片";
  }
  if (packaging.mode === "cinematic" || packaging.mode === "premium") {
    return "大片精剪";
  }
  return "智能包装";
}

function renderSourceLabel(source?: string) {
  if (source === "user-video") return "视频素材";
  if (source === "user-image") return "图片素材";
  if (source === "aigc-video") return "AI 补镜";
  return "待处理";
}

function renderSourceVariant(source?: string) {
  if (source === "aigc-video") return "info" as const;
  if (source === "user-video" || source === "user-image") return "success" as const;
  return "outline" as const;
}

function isEditDecision(decision: PreviewDecision): decision is EditDecision {
  return "outputTimeRange" in decision;
}

function previewDecisionTitle(decision: PreviewDecision) {
  if (isEditDecision(decision)) {
    return `${decision.outputTimeRange} · ${decision.role}`;
  }
  return decision.materialLabel || `第 ${decision.order} 段`;
}

function previewDecisionDescription(decision: PreviewDecision) {
  if (isEditDecision(decision)) {
    return decision.materialLabel
      ? `${decision.materialLabel}｜${decision.crop}｜${decision.gapResolution}`
      : decision.gapResolution || decision.transferReason;
  }
  return decision.editSummary || decision.reason || compactLine(decision.role, 52);
}

function renderStrategyTitle(strategy?: GeneratedVideoState["renderStrategy"]) {
  if (!strategy) return "素材优先剪辑";
  if (strategy.type === "material-remix") return "真实素材重组";
  if (strategy.type === "hybrid-material-aigc") return "素材 + AI 补镜";
  return "AI 分段生成";
}

function sourceKindLabel(mediaMeta?: MediaMeta | null) {
  if (mediaMeta?.sourceKind === "upload") return "上传视频";
  if (mediaMeta?.sourceKind === "url") return "样例链接";
  return "人工观察";
}

function compactLine(value: string, maxLength = 72) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}...` : clean;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function csvCell(value: unknown) {
  const text = String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function buildTimelineExchangeCsv(payload: TimelineExchangePayload) {
  const headers = [
    "track",
    "order",
    "time_range",
    "duration_seconds",
    "name_or_text",
    "material_slot",
    "material_fit",
    "completion_strategy",
    "completion_plan",
    "visual_suggestion",
    "transition_and_rhythm",
    "replaceable_assets",
  ];
  const rows = payload.tracks.flatMap((track) =>
    track.clips.map((clip) => [
      track.name,
      clip.order,
      clip.timeRange,
      clip.durationSeconds.toFixed(2),
      clip.name || clip.text || clip.overlayText || clip.id,
      clip.materialSlotName,
      clip.materialFit,
      clip.completionStrategy,
      clip.completionPlan,
      clip.visualSuggestion,
      clip.transitionAndRhythm,
      clip.replaceableAssets,
    ]),
  );

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "未知大小";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function materialFileKind(file: File) {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|svg)$/.test(name)) {
    return {
      label: "图片",
      icon: ImageIcon,
    };
  }
  if (file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v|avi|mkv)$/.test(name)) {
    return {
      label: "视频",
      icon: Video,
    };
  }
  return {
    label: "文案",
    icon: FileText,
  };
}

function extractInlineMaterialNotes(text: string) {
  return text
    .split(/[\n；;。]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) =>
      /素材|已有|缺少|没有|待补|需要补充|不足|未提供|图片|图|截图|视频|录屏|文案|脚本|评价|反馈|入口|CTA/i.test(
        item,
      ),
    )
    .join("；");
}

function parseDirectorTimeRange(timeRange: string) {
  const match = timeRange.match(/(\d+(?:\.\d+)?)\s*s?\s*-\s*(\d+(?:\.\d+)?)\s*s?/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end, duration: end - start };
}

function formatDirectorTimeRange(start: number, end: number) {
  const format = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  };

  return `${format(start)}-${format(end)}s`;
}

function appendDirectorCue(value: string, cue: string) {
  return value.includes(cue) ? value : `${value}；${cue}`;
}

function directorPresetLabel(preset: DirectorTuningPreset) {
  return directorTuningPresets.find((item) => item.key === preset)?.label ?? "导演参数";
}

function stripDirectorPresetSuffix(versionName: string) {
  return versionName.replace(/\s+·\s+(高点击|高转化|高质感)(?:\s+\d+)?$/u, "");
}

function buildDirectorTunedVersion(
  version: PlanVersion,
  tuning: DirectorTuningState,
): PlanVersion {
  const speedMultiplier = tuning.pacing >= 80 ? 0.86 : tuning.pacing <= 52 ? 1.16 : 1;
  let cursor = 0;
  const suffix = directorPresetLabel(tuning.preset);
  const maxSubtitleChars = tuning.subtitleDensity >= 78 ? 42 : tuning.subtitleDensity <= 58 ? 24 : 32;

  const scriptBeats = version.scriptBeats.map((beat, index) => {
    const parsed = parseDirectorTimeRange(beat.timeRange) ?? {
      start: cursor,
      end: cursor + 4,
      duration: 4,
    };
    const duration = Math.max(1.5, parsed.duration * speedMultiplier);
    const start = index === 0 ? 0 : cursor;
    const end = start + duration;
    cursor = end;

    const isFirst = index === 0;
    const isLast = index === version.scriptBeats.length - 1;
    const isEarlyProof = tuning.preset === "conversion" && index === 1;
    const shouldTightenSubtitle = beat.voiceoverOrSubtitle.length > maxSubtitleChars;
    const subtitleBase = shouldTightenSubtitle
      ? compactLine(beat.voiceoverOrSubtitle, maxSubtitleChars)
      : beat.voiceoverOrSubtitle;
    const hookCue =
      tuning.hookStrength >= 82
        ? "前三秒先给结果和反差"
        : tuning.hookStrength <= 62
          ? "降低惊叹语气，保留质感悬念"
          : "开头直给核心收益";
    const subtitleCue =
      tuning.subtitleDensity >= 78
        ? "字幕高密度分层，关键词加粗"
        : tuning.subtitleDensity <= 58
          ? "字幕留白，单屏不超过一行"
          : "字幕中密度，保留重点词";
    const pacingCue =
      tuning.pacing >= 80
        ? "快切推进，镜头间隔更短"
        : tuning.pacing <= 52
          ? "慢推镜与停顿留白"
          : "中速推进，按样片卡点";
    const ctaCue =
      tuning.ctaStrength >= 82
        ? "结尾明确行动入口和利益点"
        : tuning.ctaStrength <= 62
          ? "结尾轻 CTA，强调品牌感"
          : "结尾给出清晰下一步";

    return {
      ...beat,
      timeRange: formatDirectorTimeRange(start, end),
      shotPurpose: isFirst
        ? appendDirectorCue(beat.shotPurpose, hookCue)
        : isLast
          ? appendDirectorCue(beat.shotPurpose, ctaCue)
          : isEarlyProof
            ? appendDirectorCue(beat.shotPurpose, "把可信证据提前")
            : beat.shotPurpose,
      voiceoverOrSubtitle: isFirst
        ? appendDirectorCue(subtitleBase, hookCue)
        : isLast
          ? appendDirectorCue(subtitleBase, ctaCue)
          : subtitleBase,
      packagingStyle: appendDirectorCue(beat.packagingStyle, subtitleCue),
      transitionAndRhythm: appendDirectorCue(beat.transitionAndRhythm, pacingCue),
      sellingPointIntent: isEarlyProof
        ? appendDirectorCue(beat.sellingPointIntent, "先证明再展开卖点")
        : isLast
          ? appendDirectorCue(beat.sellingPointIntent, ctaCue)
          : beat.sellingPointIntent,
      riskNotes: appendDirectorCue(
        beat.riskNotes,
        `导演参数：${suffix} / Hook ${tuning.hookStrength} / 字幕 ${tuning.subtitleDensity} / 节奏 ${tuning.pacing} / CTA ${tuning.ctaStrength}`,
      ),
    };
  });

  return {
    ...version,
    versionName: `${stripDirectorPresetSuffix(version.versionName)} · ${suffix}`,
    positioning: appendDirectorCue(version.positioning, `${suffix}调参版`),
    bestFor: appendDirectorCue(version.bestFor, directorTuningPresets.find((item) => item.key === tuning.preset)?.caption ?? suffix),
    captionTitle:
      tuning.preset === "click"
        ? appendDirectorCue(version.captionTitle, "先看结果")
        : tuning.preset === "conversion"
          ? appendDirectorCue(version.captionTitle, "证据充分")
          : appendDirectorCue(version.captionTitle, "质感版"),
    scriptBeats,
  };
}

function uniqueVersionName(baseName: string, versions: PlanVersion[]) {
  const usedNames = new Set(versions.map((version) => version.versionName));
  if (!usedNames.has(baseName)) return baseName;

  for (let index = 2; index <= 99; index += 1) {
    const candidate = `${baseName} ${index}`;
    if (!usedNames.has(candidate)) return candidate;
  }

  return `${baseName} ${Date.now()}`;
}

function SampleBasicsPanel({
  analysis,
  mediaMeta,
  runMode,
}: {
  analysis: VideoStructureAnalysis;
  mediaMeta?: MediaMeta | null;
  runMode: RunModeState;
}) {
  const durationSeconds = mediaMeta?.durationSeconds ?? analysis.durationSeconds;
  const firstFrameId = mediaMeta?.previewFrames[0];
  const frameCount = mediaMeta?.previewFrames.length ?? 0;
  const resolution =
    mediaMeta?.width && mediaMeta?.height ? `${mediaMeta.width}×${mediaMeta.height}` : "待补充";
  const audioText =
    typeof mediaMeta?.hasAudio === "boolean"
      ? mediaMeta.hasAudio
        ? "检测到音频"
        : "未检测到音频"
      : "按文本/视觉推断";
  const captionOverview = compactLine(
    [
      analysis.subtitleLayout.density,
      analysis.subtitleLayout.placement,
      analysis.beatMap[0]?.captionObservation,
    ]
      .filter(Boolean)
      .join("；"),
    110,
  );
  const modelModeText = runMode.sample
    ? runMode.sample.mode === "direct-video"
      ? "整段视频理解"
      : runMode.sample.mode === "frames"
        ? "关键帧理解"
        : "本地兜底"
    : "等待理解";
  const modelModeDetail = runMode.sample
    ? runMode.sample.note
    : "上传视频后由模型理解画面、关键帧、字幕/语音线索。";

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 sm:grid-cols-[132px_minmax(0,1fr)]">
        <div className="w-full rounded-md border bg-muted/20 p-2">
          {firstFrameId ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              alt="样例封面帧"
              className="aspect-[9/16] w-full rounded-sm object-cover"
              loading="lazy"
              src={`/api/frames/${encodeURIComponent(firstFrameId)}`}
            />
          ) : (
            <div className="flex aspect-[9/16] flex-col items-center justify-center rounded-sm bg-background px-4 text-center">
              <Video className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold text-foreground">等待封面帧</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                上传视频并启用抽帧后，这里会展示样例封面。
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">样例洞察</Badge>
                <Badge variant="outline">{sourceKindLabel(mediaMeta)}</Badge>
                <Badge variant={runMode.sample?.mode === "local" ? "warning" : "success"}>
                  {modelModeText}
                </Badge>
              </div>
              <p className="mt-2 text-base font-semibold leading-6 text-foreground">
                {analysis.sampleTitle}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {compactLine(modelModeDetail, 96)}
              </p>
            </div>
            <Badge variant="outline">{analysis.beatMap.length} 个结构段</Badge>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["时长", formatSeconds(durationSeconds)],
              ["镜头/段落", `${analysis.beatMap.length} 段`],
              ["画幅", resolution],
              ["音频/语音", audioText],
            ].map(([label, value]) => (
              <div className="rounded-md border bg-background p-3" key={label}>
                <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-background p-3">
              <p className="text-xs font-semibold text-foreground">内容承诺</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {analysis.contentPromise}
              </p>
            </div>
            <div className="rounded-md border bg-background p-3">
              <p className="text-xs font-semibold text-foreground">字幕 / 语音概览</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {captionOverview || "等待样例字幕、口播或人工观察补充。"}
              </p>
            </div>
            <div className="rounded-md border bg-background p-3">
              <p className="text-xs font-semibold text-foreground">封面 / 关键帧</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {frameCount
                  ? `已抽取 ${frameCount} 张时间轴关键帧${
                      mediaMeta?.frameTimestamps.length
                        ? `：${mediaMeta.frameTimestamps
                            .slice(0, 4)
                            .map((seconds) => formatSeconds(seconds))
                            .join(" / ")}`
                        : ""
                    }。`
                  : "当前基于文本或链接观察拆解，未抽取本地关键帧。"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function focusLabel(focus: StructureFocus) {
  const labels: Record<StructureFocus, string> = {
    hook: "Hook",
    proof: "证据",
    benefit: "收益",
    cta: "CTA",
    packaging: "包装",
  };

  return labels[focus];
}

function focusBarClass(focus: StructureFocus) {
  const classes: Record<StructureFocus, string> = {
    hook: "bg-rose-500",
    proof: "bg-blue-500",
    benefit: "bg-emerald-500",
    cta: "bg-amber-500",
    packaging: "bg-violet-500",
  };

  return classes[focus];
}

function StructureFingerprintPanel({ analysis }: { analysis: VideoStructureAnalysis }) {
  const fingerprint = useMemo(() => buildStructureFingerprint(analysis), [analysis]);
  const primaryHook = analysis.hookPatterns[0];
  const primaryMusicCue = analysis.musicAndBeats[0];
  const primarySellingPoint = analysis.sellingPointProgression[0];
  const rhythmPreview = fingerprint.rhythmCurve.slice(0, 4);

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">结构蓝图</Badge>
            <Badge variant="outline">脚本/段落</Badge>
            <Badge variant="outline">节奏</Badge>
            <Badge variant="outline">包装</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground">
            {fingerprint.summary}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right">
          <div>
            <p className="text-[11px] text-muted-foreground">Hook</p>
            <p className="text-sm font-semibold text-foreground">{fingerprint.hookStrength}/100</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">镜头</p>
            <p className="text-sm font-semibold text-foreground">{fingerprint.shotDensityPer10s}/10s</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">字幕</p>
            <p className="text-sm font-semibold text-foreground">{fingerprint.subtitleDensityPer10s}/10s</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border bg-background p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">脚本结构</Badge>
            <span className="text-[11px] text-muted-foreground">Hook / 展开 / CTA</span>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-foreground">
            {primaryHook?.expression || analysis.contentPromise}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            迁移规则：{primaryHook?.transferableRule || analysis.reusableTemplate[0] || "保留开头吸引、中段解释、结尾行动的推进顺序。"}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            卖点推进：{primarySellingPoint ? `${primarySellingPoint.order}. ${primarySellingPoint.intent} - ${primarySellingPoint.message}` : analysis.reusableTemplate.slice(0, 2).join(" / ")}
          </p>
        </div>

        <div className="rounded-md border bg-background p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">节奏结构</Badge>
            <span className="text-[11px] text-muted-foreground">
              证据 {fingerprint.proofPositionPercent}% / CTA {fingerprint.ctaPositionPercent}%
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-foreground">
            {analysis.pacing.opening}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            中段：{analysis.pacing.middle}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            收束：{analysis.pacing.ending}；{analysis.pacing.rhythmNotes}
          </p>
        </div>

        <div className="rounded-md border bg-background p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">包装结构</Badge>
            <span className="text-[11px] text-muted-foreground">字幕 / 贴纸 / 转场 / 音乐</span>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-foreground">
            {analysis.subtitleLayout.placement}，{analysis.subtitleLayout.density}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            强调方式：{analysis.subtitleLayout.emphasisStyle}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            画面包装：{analysis.visualPackaging.motionGraphics}；{primaryMusicCue ? `${primaryMusicCue.moment} ${primaryMusicCue.audioCue}` : analysis.visualPackaging.editingNotes}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-foreground">结构段落预览</p>
          <p className="text-xs text-muted-foreground">{fingerprint.durationSeconds}s</p>
        </div>
        <div className="grid gap-2">
          {rhythmPreview.map((point) => (
            <div
              className="grid gap-2 rounded-md border bg-background p-3 sm:grid-cols-[86px_minmax(0,1fr)] sm:items-center"
              key={`${point.index}-${point.timeRange}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="outline">{point.timeRange}</Badge>
                <span className="text-[11px] font-medium text-muted-foreground sm:hidden">
                  {focusLabel(point.focus)}
                </span>
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="truncate text-xs font-medium text-foreground">
                    {point.label}
                  </p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {point.intensity}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className={`h-1.5 rounded-full ${focusBarClass(point.focus)}`}
                    style={{ width: `${point.intensity}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {fingerprint.packagingTags.map((tag) => (
          <Badge variant="outline" key={tag}>
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function VersionTimeline({ version }: { version: PlanVersion }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{version.bestFor}</Badge>
        <Badge variant="outline">{version.coverTitle}</Badge>
      </div>

      <p className="text-sm leading-6 text-muted-foreground">{version.positioning}</p>

      <div className="space-y-3">
        {version.scriptBeats.map((beat, index) => (
          <div
            className="timeline-row rounded-lg border bg-background/70 p-4"
            key={`${beat.timeRange}-${index}`}
          >
            <div>
              <Badge variant="outline">{beat.timeRange}</Badge>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {beat.shotPurpose}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-foreground">画面建议</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {beat.visualSuggestion}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">口播/字幕</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {beat.voiceoverOrSubtitle}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">包装与节奏</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {beat.packagingStyle}；{beat.transitionAndRhythm}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">卖点与素材</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {beat.sellingPointIntent}；{beat.replaceableAssets}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type EditableBeatField =
  | "timeRange"
  | "shotPurpose"
  | "visualSuggestion"
  | "voiceoverOrSubtitle"
  | "packagingStyle"
  | "sellingPointIntent"
  | "transitionAndRhythm"
  | "replaceableAssets"
  | "riskNotes";

function EditableVersionPanel({
  version,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  version: PlanVersion;
  onChange: (next: PlanVersion) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  function setField(field: keyof PlanVersion, value: string) {
    onChange({ ...version, [field]: value });
  }

  function setBeatField(index: number, field: EditableBeatField, value: string) {
    const nextBeats = version.scriptBeats.map((beat, beatIndex) =>
      beatIndex === index ? { ...beat, [field]: value } : beat,
    );
    onChange({ ...version, scriptBeats: nextBeats });
  }

  function setBeatFields(
    index: number,
    patch: Partial<PlanVersion["scriptBeats"][number]>,
  ) {
    const nextBeats = version.scriptBeats.map((beat, beatIndex) =>
      beatIndex === index ? { ...beat, ...patch } : beat,
    );
    onChange({ ...version, scriptBeats: nextBeats });
  }

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">编辑模式</Badge>
            <Badge variant="outline">{version.versionName}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            直接改时间线字段，导出稿会自动更新；适合现场快速微调镜头、口播和包装。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            取消
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <PencilLine className="size-4" />}
            保存为新稿
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-cover-title">封面标题</Label>
          <Input
            id="edit-cover-title"
            value={version.coverTitle}
            onChange={(event) => setField("coverTitle", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-caption-title">发布标题</Label>
          <Input
            id="edit-caption-title"
            value={version.captionTitle}
            onChange={(event) => setField("captionTitle", event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        {version.scriptBeats.map((beat, index) => (
          <div className="rounded-lg border bg-background p-3" key={`${beat.timeRange}-${index}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <Badge variant="outline">第 {index + 1} 段</Badge>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange(moveBeat(version, index, "up"))}
                  disabled={index === 0 || saving}
                  title="上移"
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange(moveBeat(version, index, "down"))}
                  disabled={index === version.scriptBeats.length - 1 || saving}
                  title="下移"
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange(insertBeatAfter(version, index))}
                  disabled={saving}
                  title="在下方新增一段"
                >
                  <Plus className="size-4" />
                  新增
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange(removeBeat(version, index))}
                  disabled={version.scriptBeats.length <= 3 || saving}
                  title="删除当前段（至少保留 3 段）"
                >
                  <Trash2 className="size-4" />
                  删除
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[140px_1fr] md:items-start">
              <div className="space-y-2">
                <Label>时间段</Label>
                <Input
                  value={beat.timeRange}
                  onChange={(event) => setBeatField(index, "timeRange", event.target.value)}
                />
                <Label>镜头目的</Label>
                <Input
                  value={beat.shotPurpose}
                  onChange={(event) => setBeatField(index, "shotPurpose", event.target.value)}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>画面建议</Label>
                  <Textarea
                    value={beat.visualSuggestion}
                    onChange={(event) =>
                      setBeatField(index, "visualSuggestion", event.target.value)
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>口播/字幕</Label>
                  <Textarea
                    value={beat.voiceoverOrSubtitle}
                    onChange={(event) =>
                      setBeatField(index, "voiceoverOrSubtitle", event.target.value)
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>包装与节奏</Label>
                  <Textarea
                    value={`${beat.packagingStyle}；${beat.transitionAndRhythm}`}
                    onChange={(event) => {
                      const value = event.target.value;
                      const parts = value.split("；");
                      const packagingStyle = parts[0]?.trim() || beat.packagingStyle;
                      const transitionAndRhythm = parts.slice(1).join("；").trim() || beat.transitionAndRhythm;
                      setBeatFields(index, { packagingStyle, transitionAndRhythm });
                    }}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>卖点与素材</Label>
                  <Textarea
                    value={`${beat.sellingPointIntent}；${beat.replaceableAssets}`}
                    onChange={(event) => {
                      const value = event.target.value;
                      const parts = value.split("；");
                      const sellingPointIntent = parts[0]?.trim() || beat.sellingPointIntent;
                      const replaceableAssets = parts.slice(1).join("；").trim() || beat.replaceableAssets;
                      setBeatFields(index, { sellingPointIntent, replaceableAssets });
                    }}
                    rows={2}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>风险提示</Label>
                  <Textarea
                    value={beat.riskNotes}
                    onChange={(event) => setBeatField(index, "riskNotes", event.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FunctionFlowPanel({
  analysis,
  plan,
}: {
  analysis: VideoStructureAnalysis | null;
  plan: MigratedVideoPlan | null;
}) {
  const steps = [
    {
      title: "样例洞察",
      description: analysis
        ? `已完成基础解析，并抽取 ${analysis.beatMap.length} 个结构段。`
        : "支持样例视频、链接、多文件和补充说明输入。",
      ready: Boolean(analysis),
    },
    {
      title: "结构蓝图",
      description: analysis
        ? "已抽取脚本/段落、节奏、字幕包装和可迁移规则。"
        : "等待样例后展示 hook、节奏、字幕包装和卖点推进。",
      ready: Boolean(analysis),
    },
    {
      title: "手法迁移",
      description: plan
        ? `已生成 ${plan.versions.length} 个版本，并保留可编辑时间线。`
        : "把样例结构映射到新主题、商品卖点或用户素材。",
      ready: Boolean(plan),
    },
    {
      title: "素材体检",
      description: plan?.materialAdaptation
        ? `识别 ${plan.materialAdaptation.missingSlotCount} 个素材缺口，并给出补全策略。`
        : "根据用户素材判断哪些镜头可用，哪些需要字幕、包装或重排补足。",
      ready: Boolean(plan?.materialAdaptation),
    },
    {
      title: "发布与导出",
      description: plan
        ? "可查看竖屏分镜、编辑脚本字段，并导出 Markdown / JSON 或渲染视频。"
        : "生成方案后可直接预览分镜、编辑脚本并导出。",
      ready: Boolean(plan),
    },
  ];

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">创作链路</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            从样例洞察到新片方案，展示手法如何迁移、素材如何补齐、结果如何落地。
          </p>
        </div>
        <Badge variant={plan ? "success" : analysis ? "secondary" : "outline"}>
          {plan ? "方案已生成" : analysis ? "样例已分析" : "待开始"}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {steps.map((step, index) => (
          <div className="rounded-lg border bg-background p-3" key={step.title}>
            <div className="flex items-center justify-between gap-2">
              <Badge variant={step.ready ? "success" : "outline"}>{index + 1}</Badge>
              {step.ready ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : (
                <span className="size-4 rounded-full border" />
              )}
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">{step.title}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RunModePanel({ runMode }: { runMode: RunModeState }) {
  const items = [
    {
      title: "样例理解",
      value: runMode.sample
        ? runMode.sample.mode === "direct-video"
          ? "整段视频 + 关键帧"
          : runMode.sample.mode === "frames"
            ? "关键帧 + 文本"
            : "本地结构整理"
        : "待运行",
      detail: runMode.sample
        ? `${runMode.sample.note}；样例数 ${runMode.sample.sampleCount}，关键帧 ${runMode.sample.frameCount}。`
        : "拆解样例后会显示本次使用的是云端视觉能力还是本地策略。",
      ready: Boolean(runMode.sample),
    },
    {
      title: "方案生成",
      value: runMode.plan
        ? runMode.plan.mode === "model"
          ? "云模型生成"
          : "本地方案策略"
        : "待运行",
      detail: runMode.plan
        ? runMode.plan.note
        : "生成新片方案后会显示脚本来自云模型还是本地兜底策略。",
      ready: Boolean(runMode.plan),
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div className="rounded-lg border bg-background p-3" key={item.title}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <Badge variant={item.ready ? "secondary" : "outline"}>{item.value}</Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

function fitText(fit: MaterialAdaptation["slots"][number]["fit"]) {
  if (fit === "matched") return "已匹配";
  if (fit === "partial") return "部分匹配";
  return "缺口";
}

function clampPercent(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreBadgeVariant(score?: number | null): "success" | "secondary" | "warning" | "outline" {
  if (typeof score !== "number" || !Number.isFinite(score)) return "outline";
  if (score >= 88) return "success";
  if (score >= 76) return "secondary";
  if (score >= 60) return "warning";
  return "outline";
}

function readinessLabel(readiness?: NonNullable<MigratedVideoPlan["evaluation"]>["readiness"]) {
  if (readiness === "ready") return "可直接演示";
  if (readiness === "minor-edits") return "轻微精修";
  if (readiness === "needs-work") return "需要打磨";
  return "等待评分";
}

function verdictText(verdict?: string) {
  if (verdict === "champion-ready") return "冠军级";
  if (verdict === "finalist-ready") return "决赛级";
  if (verdict === "prize-ready") return "冲奖就绪";
  if (verdict === "submission-ready") return "可提交";
  if (verdict === "needs-proof") return "待补证据";
  if (verdict === "needs-polish") return "待打磨";
  return "待生成";
}

function coverageStatusText(status: "ready" | "partial" | "todo") {
  if (status === "ready") return "已满足";
  if (status === "partial") return "部分满足";
  return "待补齐";
}

function coverageStatusVariant(status: "ready" | "partial" | "todo") {
  if (status === "ready") return "success" as const;
  if (status === "partial") return "warning" as const;
  return "outline" as const;
}

function MaterialAdaptationPanel({
  adaptation,
}: {
  adaptation: MaterialAdaptation;
}) {
  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={adaptation.missingSlotCount ? "warning" : "success"}>
              缺口 {adaptation.missingSlotCount}
            </Badge>
            <Badge variant="outline">已识别素材 {adaptation.assets.length} 个</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {adaptation.providedMaterialsSummary}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {adaptation.timelineAdjustment}
          </p>
        </div>
        <PackageCheck className="size-8 shrink-0 text-primary" />
      </div>

      {adaptation.assets.length ? (
        <div className="rounded-lg border bg-background p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">真实素材资产</Badge>
            <Badge variant="outline">{adaptation.assets.length} 个</Badge>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {adaptation.assets.map((asset) => (
              <div className="rounded-md border bg-white p-3" key={asset.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {asset.label}
                  </p>
                  <Badge variant="outline">{asset.kind}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {asset.highlightReason}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {asset.suggestedSlots.map((slot) => (
                    <Badge variant="outline" key={`${asset.id}-${slot}`}>
                      {slot}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2 text-xs font-medium text-foreground">
                  用法：{asset.recommendedUse}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {adaptation.slots.map((slot) => (
          <div className="rounded-lg border bg-background p-3" key={slot.slotId}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{slot.slotName}</p>
              <Badge
                variant={
                  slot.fit === "matched"
                    ? "success"
                    : slot.fit === "partial"
                      ? "warning"
                      : "outline"
                }
              >
                {fitText(slot.fit)}
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {slot.requiredFor}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {slot.matchedMaterial}
            </p>
            {slot.recommendedAssets.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {slot.recommendedAssets.map((asset) => (
                  <Badge variant="outline" key={`${slot.slotId}-${asset.assetId}`}>
                    {asset.label}
                  </Badge>
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-xs font-medium text-foreground">补全：{slot.completionPlan}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DirectorTransferPanel({
  techniqueProfile,
  transferSlots,
  materialRequirementMatrix,
  editDecisionList,
}: {
  techniqueProfile?: TechniqueProfile | null;
  transferSlots?: TransferSlot[];
  materialRequirementMatrix?: MaterialRequirement[];
  editDecisionList?: EditDecision[];
}) {
  const slots = transferSlots ?? [];
  const requirements = materialRequirementMatrix ?? [];
  const decisions = editDecisionList ?? [];
  if (!techniqueProfile && !slots.length && !decisions.length) return null;

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">导演手法</Badge>
            <Badge variant="outline">{slots.length || decisions.length} 个片段</Badge>
            {techniqueProfile ? <Badge variant="outline">{formatSeconds(techniqueProfile.durationSeconds)}</Badge> : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {techniqueProfile?.summary || "根据样片结构和当前方案推断手法槽位。"}
          </p>
        </div>
        <GitBranch className="size-8 shrink-0 text-primary" />
      </div>

      {techniqueProfile?.personaRequirements.length ? (
        <div className="grid gap-3 md:grid-cols-3">
          {techniqueProfile.personaRequirements.slice(0, 3).map((persona) => (
            <div className="rounded-md border bg-background p-3" key={`${persona.mode}-${persona.label}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{persona.label}</Badge>
                <Badge variant={persona.presence === "avoid" ? "warning" : "secondary"}>
                  {persona.presence === "avoid" ? "不强制出镜" : "可迁移"}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {compactLine(persona.transferInstruction, 96)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {slots.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {slots.slice(0, 4).map((slot) => {
            const requirement = requirements.find((item) => item.slotId === slot.slotId);
            return (
              <div className="rounded-lg border bg-background p-3" key={slot.slotId}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline">{slot.sampleTimeRange} → {slot.targetTimeRange}</Badge>
                  <Badge
                    variant={
                      requirement?.fit === "matched"
                        ? "success"
                        : requirement?.fit === "partial"
                          ? "warning"
                          : "outline"
                    }
                  >
                    {requirement
                      ? requirement.fit === "unknown"
                        ? "待判断"
                        : fitText(requirement.fit)
                      : "待匹配"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">{slot.role}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {compactLine(slot.transferableTechnique, 120)}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {slot.personaRequirement.label} · {slot.shotLanguage.framing} · {slot.shotLanguage.cameraMotion}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}

      {decisions.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">剪辑决策</p>
          {decisions.slice(0, 6).map((decision) => (
            <div className="rounded-md border bg-background p-3" key={`${decision.order}-${decision.slotId}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{decision.outputTimeRange}</Badge>
                <Badge variant={renderSourceVariant(decision.source)}>
                  {renderSourceLabel(decision.source)}
                </Badge>
                {decision.materialLabel ? <Badge variant="outline">{decision.materialLabel}</Badge> : null}
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {compactLine(`${decision.crop}；${decision.motion}；${decision.transferReason}`, 150)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EditingTechniquePanel({
  techniques,
}: {
  techniques: RetrievedEditingTechnique[];
}) {
  if (!techniques.length) return null;

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">剪辑手法参考</Badge>
            <Badge variant="outline">匹配 {techniques.length} 条</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            根据新内容、素材线索和样例结构匹配剪辑手法，把“怎么剪”落实到脚本、转场、字幕和制作备注里。
          </p>
        </div>
        <Database className="size-8 shrink-0 text-primary" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {techniques.map((technique) => (
          <div className="rounded-lg border bg-background p-3" key={technique.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{technique.title}</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{technique.category}</Badge>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {technique.whyMatched.join("；")}
            </p>
            <p className="mt-2 text-xs leading-5 text-foreground">
              应用：{technique.application}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              预期：{technique.expectedImpact}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function completionStrategyText(strategy: string) {
  if (strategy === "structure-reorder") return "结构重排";
  if (strategy === "copy-caption") return "文案/字幕补全";
  if (strategy === "visual-packaging") return "包装补全";
  if (strategy === "aigc-generation") return "AIGC 补全";
  if (strategy === "reuse-existing") return "素材复用";
  return "人工复核";
}

function fitBadgeVariant(fit: ReturnType<typeof buildMigrationMap>[number]["materialFit"]) {
  if (fit === "matched") return "success";
  if (fit === "partial") return "warning";
  return "outline";
}

function MigrationMappingPanel({
  analysis,
  plan,
  version,
}: {
  analysis: VideoStructureAnalysis;
  plan: MigratedVideoPlan;
  version: PlanVersion;
}) {
  const rows = useMemo(
    () => buildMigrationMap({ analysis, plan, version }),
    [analysis, plan, version],
  );

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">迁移映射</Badge>
            <Badge variant="outline">{version.versionName}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            把样例节拍、可迁移规则、新方案镜头和素材补全放在同一张链路图里，清楚说明“学到了什么、迁移到哪里、缺口怎么处理”。
          </p>
        </div>
        <GitBranch className="size-8 shrink-0 text-primary" />
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div className="rounded-lg border bg-background p-3" key={`${row.index}-${row.outputTimeRange}`}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_32px_minmax(0,1.15fr)_minmax(170px,0.65fr)] lg:items-stretch">
              <div className="rounded-md border bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{row.sampleTimeRange}</Badge>
                  <span className="text-xs font-semibold text-foreground">
                    {row.samplePurpose}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {row.sampleRule}
                </p>
              </div>

              <div className="hidden items-center justify-center text-primary lg:flex">
                <ArrowRight className="size-5" />
              </div>

              <div className="rounded-md border bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{row.outputTimeRange}</Badge>
                  <span className="text-xs font-semibold text-foreground">
                    {row.outputPurpose}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  {row.outputLine}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {row.mappingLogic}
                </p>
              </div>

              <div className="rounded-md border bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={fitBadgeVariant(row.materialFit)}>
                    {materialFitText(row.materialFit)}
                  </Badge>
                  <Badge variant="outline">
                    {completionStrategyText(row.completionStrategy)}
                  </Badge>
                </div>
                <p className="mt-2 text-xs font-medium text-foreground">
                  {row.materialSlotName}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {row.completionPlan}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineOverview({ rows }: { rows: MigrationMapRow[] }) {
  const segments = useMemo(() => buildTimelineSegments(rows), [rows]);

  if (segments.length === 0) return null;

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">时间线草案</Badge>
            <Badge variant="outline">
              {segments[segments.length - 1].endSecond}s
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            按真实秒数把脚本拆成可生产的时间线，颜色标签对应每段结构作用，素材状态提示该段是否需要补拍或包装兜底。
          </p>
        </div>
        <BarChart3 className="size-8 shrink-0 text-primary" />
      </div>

      <div className="relative h-20 rounded-lg border bg-background p-3">
        <div className="absolute left-3 right-3 top-1/2 h-1 -translate-y-1/2 rounded-full bg-secondary" />
        {segments.map((segment) => (
          <div
            className="absolute top-3 min-w-[72px] rounded-md border bg-white px-2 py-1.5 shadow-sm"
            key={`${segment.index}-${segment.timeRange}`}
            style={{
              left: `${segment.leftPercent}%`,
              width: `${segment.widthPercent}%`,
              maxWidth: "190px",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-foreground">
                {segment.focus}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {segment.timeRange}
              </span>
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {segment.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {segments.map((segment) => (
          <div className="rounded-md border bg-background p-3" key={segment.index}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{segment.timeRange}</Badge>
              <Badge variant={fitBadgeVariant(segment.materialFit)}>
                {materialFitText(segment.materialFit)}
              </Badge>
              <span className="text-xs font-semibold text-foreground">
                {segment.focus}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {segment.materialSlotName}：{segment.completionPlan}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function storyboardAccentClass(focus: string) {
  if (focus === "Hook") return "border-l-emerald-500";
  if (focus === "证据") return "border-l-sky-500";
  if (focus === "收益") return "border-l-amber-500";
  if (focus === "CTA") return "border-l-rose-500";
  if (focus === "包装") return "border-l-violet-500";
  return "border-l-primary";
}

function StoryboardPhone({ frame }: { frame: StoryboardFrame }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mx-auto flex aspect-[9/16] max-h-[420px] min-h-[320px] w-full max-w-[236px] flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className={`border-l-4 ${storyboardAccentClass(frame.focus)} bg-secondary/60 px-3 py-2`}>
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline">{frame.timeRange}</Badge>
            <span className="text-xs font-semibold text-foreground">{frame.focus}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-foreground">
            {frame.frameTitle}
          </p>
        </div>

        <div className="relative flex flex-1 flex-col justify-between bg-background p-3">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground">画面层</p>
            <p className="line-clamp-5 text-sm font-medium leading-6 text-foreground">
              {frame.visualLayer}
            </p>
          </div>

          <div className="space-y-2">
            <div className="rounded-md border bg-white/80 p-2">
              <p className="text-[11px] font-semibold text-muted-foreground">包装层</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {frame.packagingLayer}
              </p>
            </div>
            <div className="rounded-md bg-slate-950 p-2 text-slate-50">
              <p className="line-clamp-3 text-sm font-semibold leading-6">
                {frame.subtitleLayer}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t bg-white px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={fitBadgeVariant(frame.materialFit)}>
              {materialFitText(frame.materialFit)}
            </Badge>
            <span className="text-[11px] font-medium text-muted-foreground">
              {frame.materialSlotName}
            </span>
          </div>
          <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
            {frame.transitionCue}；{frame.completionPlan}
          </p>
        </div>
      </div>
    </div>
  );
}

function StoryboardPreview({
  version,
  rows,
}: {
  version: PlanVersion;
  rows: MigrationMapRow[];
}) {
  const frames = useMemo(
    () => buildStoryboardFrames({ version, rows }),
    [version, rows],
  );

  if (frames.length === 0) return null;

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">竖屏分镜预览</Badge>
            <Badge variant="outline">{version.versionName}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            把当前版本转成 9:16 画面草稿，直接检查画面层、字幕层、包装层和素材状态。
          </p>
        </div>
        <Video className="size-8 shrink-0 text-primary" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {frames.map((frame) => (
          <StoryboardPhone frame={frame} key={`${frame.index}-${frame.timeRange}`} />
        ))}
      </div>
    </div>
  );
}

function MiniSampleInsight({
  analysis,
  mediaMeta,
  showAll,
  onToggleAll,
}: {
  analysis: VideoStructureAnalysis;
  mediaMeta: MediaMeta | null;
  showAll: boolean;
  onToggleAll: () => void;
}) {
  const fingerprint = useMemo(() => buildStructureFingerprint(analysis), [analysis]);
  const firstFrameId = mediaMeta?.previewFrames[0];
  const topBeats = showAll ? analysis.beatMap : analysis.beatMap.slice(0, 3);
  const coreCards = [
    {
      label: "开头",
      title: analysis.hookPatterns[0]?.type || "先抓注意",
      body: analysis.hookPatterns[0]?.transferableRule || analysis.pacing.opening,
    },
    {
      label: "节奏",
      title: `${fingerprint.shotDensityPer10s} 镜/10s`,
      body: analysis.pacing.rhythmNotes,
    },
    {
      label: "包装",
      title: analysis.subtitleLayout.density,
      body: `${analysis.subtitleLayout.placement}；${analysis.visualPackaging.editingNotes}`,
    },
  ];

  return (
    <div className="studio-insight">
      <div className="studio-insight-main">
        <div className="studio-thumb">
          {firstFrameId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="样例封面帧"
              className="h-full w-full object-cover"
              src={`/api/frames/${encodeURIComponent(firstFrameId)}`}
            />
          ) : (
            <Video className="size-7 text-primary" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">核心手法</Badge>
            <Badge variant="outline">{analysis.beatMap.length} 段</Badge>
            <Badge variant="outline">{formatSeconds(mediaMeta?.durationSeconds ?? analysis.durationSeconds)}</Badge>
          </div>
          <h3 className="mt-3 text-xl font-bold leading-7 text-foreground">
            {analysis.contentPromise}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {analysis.summary}
          </p>
        </div>
      </div>

      <div className="studio-summary-grid">
        {coreCards.map((item) => (
          <div className="studio-summary-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{compactLine(item.title, 20)}</strong>
            <p>{compactLine(item.body, 54)}</p>
          </div>
        ))}
      </div>

      <div className="studio-mini-timeline">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">节拍路径</p>
          <Button size="sm" type="button" variant="outline" onClick={onToggleAll}>
            {showAll ? "收起" : "展开"}
          </Button>
        </div>
        <div className="mt-3 grid gap-2">
          {topBeats.map((beat, index) => (
            <div className="studio-mini-beat" key={`${beat.timeRange}-${index}`}>
              <Badge variant="outline">{beat.timeRange}</Badge>
              <div>
                <p>{beat.shotPurpose}</p>
                <span>{compactLine(beat.transferableRule, 64)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function versionIntent(version: PlanVersion, index: number) {
  const text = `${version.versionName} ${version.positioning} ${version.bestFor}`;
  if (/hook|点击|开头|吸引/i.test(text)) {
    return {
      label: "高点击",
      focus: "开头更强",
      tone: "rose",
      proof: "先放冲突和结果，优先拉停留。",
    };
  }
  if (/转化|成交|私信|cta|购买|引导/i.test(text)) {
    return {
      label: "高转化",
      focus: "信任更足",
      tone: "emerald",
      proof: "证据和行动更靠前，适合带转化目标。",
    };
  }
  if (/节奏|快|种草|内容|质感|氛围/i.test(text)) {
    return {
      label: "高节奏",
      focus: "观看更顺",
      tone: "blue",
      proof: "镜头推进更紧，适合内容种草和展示。",
    };
  }
  const fallback = [
    ["稳妥版", "结构完整", "emerald", "按样例结构稳定迁移，适合先出可用稿。"],
    ["冲击版", "开头抢眼", "rose", "强化前 3 秒，适合测试点击。"],
    ["节奏版", "推进更快", "blue", "压缩解释，适合短平快发布。"],
  ][index % 3]!;
  return {
    label: fallback[0],
    focus: fallback[1],
    tone: fallback[2],
    proof: fallback[3],
  };
}

function VersionChoiceCards({
  plan,
  activeVersion,
  onChange,
}: {
  plan: MigratedVideoPlan;
  activeVersion: number;
  onChange: (index: number) => void;
}) {
  return (
    <div className="studio-version-grid">
      {plan.versions.map((version, index) => {
        const intent = versionIntent(version, index);
        const score = plan.evaluation?.versionScores.find(
          (item) => item.versionName === version.versionName,
        )?.score;
        return (
          <button
            className={`studio-version-card is-${intent.tone} ${index === activeVersion ? "is-active" : ""}`}
            key={version.versionName}
            onClick={() => onChange(index)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span>{intent.label}</span>
                <strong>{version.versionName}</strong>
              </div>
              {score ? <Badge variant="outline">{score}</Badge> : null}
            </div>
            <p>{intent.proof}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{intent.focus}</Badge>
              <Badge variant="outline">{compactLine(version.bestFor, 16)}</Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ActiveVersionSummary({
  version,
  rows,
}: {
  version: PlanVersion;
  rows: MigrationMapRow[];
}) {
  const firstRows = rows.slice(0, 3);

  return (
    <div className="studio-active-version">
      <div className="studio-version-brief">
        <Badge variant="secondary">当前版本</Badge>
        <h3>{version.coverTitle}</h3>
        <p>{version.positioning}</p>
        <div className="flex flex-wrap gap-1.5">
          {version.hashtags.slice(0, 5).map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      <div className="studio-version-beats">
        {firstRows.map((row, index) => (
          <div className="studio-version-beat" key={`${row.outputTimeRange}-${index}`}>
            <Badge variant="outline">{row.outputTimeRange}</Badge>
            <div>
              <p>{row.outputPurpose}</p>
              <span>{compactLine(row.outputLine, 58)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MaterialGapSnapshot({
  adaptation,
}: {
  adaptation?: MaterialAdaptation;
}) {
  if (!adaptation) {
    return (
      <div className="studio-gap-snapshot">
        <div>
          <span>素材状态</span>
          <strong>等待输入</strong>
          <p>生成后会自动判断哪些镜头可用、哪些需要补。</p>
        </div>
        <PackageCheck className="size-7 text-primary" />
      </div>
    );
  }

  const visibleSlots = [
    ...adaptation.slots.filter((slot) => slot.fit === "missing"),
    ...adaptation.slots.filter((slot) => slot.fit === "partial"),
    ...adaptation.slots.filter((slot) => slot.fit === "matched"),
  ].slice(0, 3);

  return (
    <div className="studio-gap-snapshot">
      <div className="studio-gap-head">
        <div>
          <span>素材体检</span>
          <strong>{adaptation.sufficiencyScore}/100</strong>
          <p>{adaptation.timelineAdjustment}</p>
        </div>
        <Badge variant={adaptation.missingSlotCount ? "warning" : "success"}>
          缺口 {adaptation.missingSlotCount}
        </Badge>
      </div>
      <div className="studio-gap-slots">
        {visibleSlots.map((slot) => (
          <div className="studio-gap-slot" key={slot.slotId}>
            <Badge
              variant={
                slot.fit === "matched"
                  ? "success"
                  : slot.fit === "partial"
                    ? "warning"
                    : "outline"
              }
            >
              {fitText(slot.fit)}
            </Badge>
            <div>
              <p>{slot.slotName}</p>
              <span>{completionStrategyText(slot.completionStrategy)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildPreviewPlanForVersion(plan: MigratedVideoPlan, version: PlanVersion) {
  return {
    ...plan,
    versions: [
      version,
      ...plan.versions.filter((item) => item.versionName !== version.versionName),
    ],
    evaluation: plan.evaluation
      ? {
          ...plan.evaluation,
          bestVersion: version.versionName,
        }
      : plan.evaluation,
  };
}

function OutputPreviewPanel({
  generatedVideo,
  renderingVideo,
  showMore,
  disabled,
  fullVideoPackagingMode,
  onQuickPreview,
  onFullVideo,
  onHighRender,
  onHighAudio,
  onTechnique,
  onOpenWorkbench,
  onExportMd,
  onExportJson,
  onPackagingModeChange,
  onToggleMore,
  canOpenWorkbench,
}: {
  generatedVideo: GeneratedVideoState | null;
  renderingVideo: boolean;
  showMore: boolean;
  disabled: boolean;
  fullVideoPackagingMode: FullVideoPackagingMode;
  onQuickPreview: () => void;
  onFullVideo: () => void;
  onHighRender: () => void;
  onHighAudio: () => void;
  onTechnique: () => void;
  onOpenWorkbench: () => void;
  onExportMd: () => void;
  onExportJson: () => void;
  onPackagingModeChange: (mode: FullVideoPackagingMode) => void;
  onToggleMore: () => void;
  canOpenWorkbench: boolean;
}) {
  const isProcessing = generatedVideo?.status === "processing";
  const statusBadgeVariant = generatedVideo?.url ? "success" : isProcessing ? "warning" : "outline";
  const statusLabel = generatedVideo?.url ? "已生成" : isProcessing ? "生成中" : "待生成";
  const primaryActionLabel = isProcessing || generatedVideo?.retryable ? "继续生成" : "生成成片";
  const packagingLabel = videoPackagingLabel(generatedVideo?.packaging);
  const strategy = generatedVideo?.renderStrategy;
  const decisions: PreviewDecision[] =
    generatedVideo?.editDecisionList?.slice(0, 3) ?? strategy?.decisions?.slice(0, 3) ?? [];

  return (
    <div className="studio-output-panel">
      <div className="studio-output-preview">
        {generatedVideo?.url ? (
          <video
            className="studio-output-video"
            controls
            playsInline
            preload="metadata"
            src={generatedVideo.url}
          />
        ) : (
          <div className="studio-output-empty">
            <Video className="size-9" />
            <strong>成片预览</strong>
            <span>生成后会在这里直接播放</span>
          </div>
        )}
      </div>

      <div className="studio-output-copy">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">最终结果</Badge>
          <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
          {packagingLabel ? <Badge variant="info">{packagingLabel}</Badge> : null}
        </div>
        <h3>{generatedVideo?.title || "先看成片，再调细节"}</h3>
        <p>
          {generatedVideo?.note ||
            "主按钮会优先复用你上传的真实素材，缺口用生成视频模型补齐；没有指定时长时默认约 15 秒。"}
        </p>
        {generatedVideo?.createdAt ? (
          <span className="studio-output-time">最近生成：{generatedVideo.createdAt}</span>
        ) : null}
        {generatedVideo?.progressText ? (
          <span className="studio-output-time">{generatedVideo.progressText}</span>
        ) : null}

        <div className="studio-remix-strip">
          <div className="studio-remix-head">
            <span>{generatedVideo?.editDecisionList?.length ? "手法剪辑表" : renderStrategyTitle(strategy)}</span>
            {strategy ? (
              <small>
                素材 {strategy.reusedMaterialSegmentCount} / AI {strategy.aigcSegmentCount}
              </small>
            ) : (
              <small>上传素材后自动剪入</small>
            )}
          </div>
          {decisions.length ? (
            <div className="studio-remix-list">
              {decisions.map((decision) => (
                <div className="studio-remix-item" key={`${decision.order}-${decision.source}`}>
                  <Badge variant={renderSourceVariant(decision.source)}>
                    {renderSourceLabel(decision.source)}
                  </Badge>
                  <div>
                    <p>{previewDecisionTitle(decision)}</p>
                    <span>{previewDecisionDescription(decision)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="studio-package-toggle" aria-label="成片包装方式">
          {[
            { mode: "cinematic" as const, label: "大片精剪", caption: "导演剪辑 + 调色" },
            { mode: "smart" as const, label: "智能包装", caption: "字幕 + 轻音频" },
            { mode: "clean" as const, label: "干净成片", caption: "无烧录字幕" },
          ].map((option) => (
            <button
              className={fullVideoPackagingMode === option.mode ? "is-active" : ""}
              disabled={disabled}
              key={option.mode}
              onClick={() => onPackagingModeChange(option.mode)}
              type="button"
            >
              <span>{option.label}</span>
              <small>{option.caption}</small>
            </button>
          ))}
        </div>

        <div className="studio-output-actions">
          <Button
            disabled={disabled}
            onClick={onFullVideo}
            size="sm"
            type="button"
          >
            {renderingVideo ? <Loader2 className="animate-spin" /> : <Video />}
            {renderingVideo ? "生成中" : primaryActionLabel}
          </Button>
          {generatedVideo?.url ? (
            <Button
              asChild
              size="sm"
              variant="outline"
            >
              <a href={generatedVideo.url} target="_blank" rel="noreferrer">
                <Download />
                打开成片
              </a>
            </Button>
          ) : null}
          <Button disabled={disabled} onClick={onExportMd} size="sm" type="button" variant="outline">
            <Download />
            导出方案
          </Button>
          <Button
            disabled={!canOpenWorkbench}
            onClick={onOpenWorkbench}
            size="sm"
            type="button"
            variant="outline"
          >
            <ArrowDown />
            制作台
          </Button>
          <Button disabled={disabled} onClick={onToggleMore} size="sm" type="button" variant="outline">
            {showMore ? <ArrowUp /> : <ArrowDown />}
            {showMore ? "收起" : "更多"}
          </Button>
        </div>

        {showMore ? (
          <div className="studio-output-more">
            <Button
              disabled={disabled}
              onClick={onQuickPreview}
              size="sm"
              type="button"
              variant="outline"
            >
              {renderingVideo ? <Loader2 className="animate-spin" /> : <Video />}
              本地快速预览
            </Button>
            <Button
              disabled={disabled}
              onClick={onHighRender}
              size="sm"
              type="button"
              variant="outline"
            >
              {renderingVideo ? <Loader2 className="animate-spin" /> : <Video />}
              本地清晰预览
            </Button>
            <Button
              disabled={disabled}
              onClick={onHighAudio}
              size="sm"
              type="button"
              variant="outline"
            >
              {renderingVideo ? <Loader2 className="animate-spin" /> : <Video />}
              本地有声预览
            </Button>
            <Button
              disabled={disabled}
              onClick={onTechnique}
              size="sm"
              type="button"
              variant="outline"
            >
              {renderingVideo ? <Loader2 className="animate-spin" /> : <GitBranch />}
              本地说明片
            </Button>
            <Button disabled={disabled} onClick={onExportJson} size="sm" type="button" variant="outline">
              <FileJson />
              导出数据
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DirectorPreviewPanel({
  analysis,
  plan,
  activeVersion,
  rows,
  renderingVideo,
  generatedVideo,
  onOpenWorkbench,
  onRender,
}: {
  analysis: VideoStructureAnalysis;
  plan: MigratedVideoPlan;
  activeVersion: PlanVersion;
  rows: MigrationMapRow[];
  renderingVideo: boolean;
  generatedVideo: GeneratedVideoState | null;
  onOpenWorkbench: () => void;
  onRender: () => void;
}) {
  const previewPlan = useMemo(
    () => buildPreviewPlanForVersion(plan, activeVersion),
    [activeVersion, plan],
  );
  const previewDuration = useMemo(
    () =>
      calculateVideoFramesFromPlan({
        plan: previewPlan,
        fps: DIRECTOR_PREVIEW_FPS,
        minSeconds: 15,
        maxSeconds: 45,
      }),
    [previewPlan],
  );
  const versionScore = plan.evaluation?.versionScores.find(
    (item) => item.versionName === activeVersion.versionName,
  );
  const missingSlots = plan.materialAdaptation?.missingSlotCount ?? 0;
  const transferCount = Math.min(rows.length, analysis.beatMap.length);
  const firstBeat = activeVersion.scriptBeats[0];

  return (
    <Card className="studio-director-card">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Video className="size-4 text-primary" />
              导演预览
            </CardTitle>
            <CardDescription>
              在网页中直接播放当前版本的结构动画，先验收节奏再生成成片。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{activeVersion.versionName}</Badge>
            <Badge variant={scoreBadgeVariant(versionScore?.score)}>
              {versionScore ? `${versionScore.score}/100` : "待评分"}
            </Badge>
            <Badge variant={missingSlots ? "warning" : "success"}>
              缺口 {missingSlots}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="studio-director-grid">
          <div className="studio-director-frame">
            <Player
              acknowledgeRemotionLicense
              className="studio-director-player"
              component={VideoFromPlan}
              compositionHeight={DIRECTOR_PREVIEW_HEIGHT}
              compositionWidth={DIRECTOR_PREVIEW_WIDTH}
              controls
              durationInFrames={previewDuration.totalFrames}
              fps={DIRECTOR_PREVIEW_FPS}
              inputProps={{
                title: plan.projectTitle,
                plan: previewPlan,
                analysis,
              }}
              loop
              style={{ width: "100%" }}
            />
          </div>

          <div className="studio-director-copy">
            <div className="studio-director-stats">
              <div>
                <span>预览时长</span>
                <strong>{previewDuration.totalSeconds}s</strong>
              </div>
              <div>
                <span>映射节拍</span>
                <strong>{transferCount}</strong>
              </div>
              <div>
                <span>素材适配</span>
                <strong>{plan.materialAdaptation?.sufficiencyScore ?? "--"}</strong>
              </div>
            </div>

            <div className="studio-director-brief">
              <span>首段 Hook</span>
              <p>
                {firstBeat
                  ? compactLine(firstBeat.voiceoverOrSubtitle, 118)
                  : compactLine(analysis.contentPromise, 118)}
              </p>
            </div>

            <div className="studio-director-beats">
              {activeVersion.scriptBeats.slice(0, 4).map((beat, index) => (
                <div className="studio-director-beat" key={`${beat.timeRange}-${index}`}>
                  <Badge variant="outline">{beat.timeRange}</Badge>
                  <div>
                    <p>{compactLine(beat.shotPurpose, 54)}</p>
                    <span>{compactLine(beat.transitionAndRhythm, 86)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="studio-director-actions">
              <Button onClick={onOpenWorkbench} size="sm" type="button" variant="outline">
                <GitBranch />
                精修时间线
              </Button>
              <Button
                disabled={renderingVideo}
                onClick={onRender}
                size="sm"
                type="button"
              >
                {renderingVideo ? <Loader2 className="animate-spin" /> : <Video />}
                {generatedVideo?.url ? "重新生成成片" : "生成成片"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DirectorTuningPanel({
  tuning,
  activeVersion,
  disabled,
  applying,
  onChange,
  onApply,
}: {
  tuning: DirectorTuningState;
  activeVersion: PlanVersion;
  disabled: boolean;
  applying: boolean;
  onChange: (next: DirectorTuningState) => void;
  onApply: () => void;
}) {
  const tunedPreview = useMemo(
    () => buildDirectorTunedVersion(activeVersion, tuning),
    [activeVersion, tuning],
  );
  const firstBeat = tunedPreview.scriptBeats[0];
  const lastBeat = tunedPreview.scriptBeats[tunedPreview.scriptBeats.length - 1];
  const controls = [
    {
      key: "hookStrength" as const,
      label: "Hook 强度",
      caption: "越高越强调前三秒反差和结果前置",
    },
    {
      key: "subtitleDensity" as const,
      label: "字幕密度",
      caption: "控制单屏信息量、关键词强化和留白",
    },
    {
      key: "pacing" as const,
      label: "节奏速度",
      caption: "影响时间线压缩、快切或慢推镜",
    },
    {
      key: "ctaStrength" as const,
      label: "CTA 强度",
      caption: "控制结尾行动入口和转化表达",
    },
  ];

  return (
    <Card className="studio-director-tuning-card">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PencilLine className="size-4 text-primary" />
              导演控制条
            </CardTitle>
            <CardDescription>
              把高点击、高转化、高质感变成真实可保存版本，并同步到预览和导出。
            </CardDescription>
          </div>
          <Badge variant="secondary">{directorPresetLabel(tuning.preset)}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="studio-tuning-grid">
          <div className="studio-tuning-controls">
            <div className="studio-tuning-presets" aria-label="导演参数预设">
              {directorTuningPresets.map((preset) => (
                <button
                  className={tuning.preset === preset.key ? "is-active" : ""}
                  disabled={disabled}
                  key={preset.key}
                  onClick={() => onChange({ ...preset.values })}
                  type="button"
                >
                  <span>{preset.label}</span>
                  <small>{preset.caption}</small>
                </button>
              ))}
            </div>

            <div className="studio-tuning-slider-list">
              {controls.map((control) => (
                <label className="studio-tuning-control" key={control.key}>
                  <div className="studio-tuning-control-head">
                    <span>{control.label}</span>
                    <strong>{tuning[control.key]}</strong>
                  </div>
                  <input
                    disabled={disabled}
                    max={100}
                    min={35}
                    onChange={(event) =>
                      onChange({
                        ...tuning,
                        [control.key]: Number(event.target.value),
                      })
                    }
                    type="range"
                    value={tuning[control.key]}
                  />
                  <small>{control.caption}</small>
                </label>
              ))}
            </div>
          </div>

          <div className="studio-tuning-preview">
            <div className="studio-tuning-preview-head">
              <Badge variant="outline">将生成</Badge>
              <strong>{tunedPreview.versionName}</strong>
            </div>
            <div className="studio-tuning-delta">
              <div>
                <span>首段</span>
                <p>{firstBeat ? compactLine(firstBeat.voiceoverOrSubtitle, 92) : "等待脚本"}</p>
              </div>
              <div>
                <span>结尾</span>
                <p>{lastBeat ? compactLine(lastBeat.sellingPointIntent, 92) : "等待脚本"}</p>
              </div>
              <div>
                <span>时间线</span>
                <p>
                  {tunedPreview.scriptBeats
                    .slice(0, 3)
                    .map((beat) => beat.timeRange)
                    .join(" / ")}
                </p>
              </div>
            </div>
            <div className="studio-director-actions">
              <Button
                disabled={disabled || applying}
                onClick={onApply}
                size="sm"
                type="button"
              >
                {applying ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                应用为新版本
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TransferProofPanel({
  analysis,
  plan,
  activeVersion,
  rows,
  directorTransfer,
  onOpenWorkbench,
}: {
  analysis: VideoStructureAnalysis;
  plan: MigratedVideoPlan;
  activeVersion: PlanVersion;
  rows: MigrationMapRow[];
  directorTransfer: ReturnType<typeof buildDirectorTransferPlan> | null;
  onOpenWorkbench: () => void;
}) {
  const fingerprint = useMemo(() => buildStructureFingerprint(analysis), [analysis]);
  const visibleRows = rows.slice(0, 5);
  const missingRows = rows.filter((row) => row.materialFit === "missing");
  const partialRows = rows.filter((row) => row.materialFit === "partial");
  const matchedRows = rows.filter((row) => row.materialFit === "matched");
  const materialGaps = [
    ...(plan.materialAdaptation?.slots.filter((slot) => slot.fit === "missing") ?? []),
    ...(plan.materialAdaptation?.slots.filter((slot) => slot.fit === "partial") ?? []),
  ].slice(0, 4);
  const transferSlots = directorTransfer?.transferSlots ?? [];
  const topTechnique = plan.retrievedTechniques[0];

  return (
    <Card className="studio-transfer-card">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="size-4 text-primary" />
              迁移证据链
            </CardTitle>
            <CardDescription>
              一屏展示样例结构、当前版本映射和素材缺口，回答“学到了什么、迁移到哪里、还差什么”。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{activeVersion.versionName}</Badge>
            <Badge variant={missingRows.length ? "warning" : "success"}>
              缺口 {missingRows.length}
            </Badge>
            <Badge variant="outline">Hook {fingerprint.hookStrength}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="studio-transfer-grid">
          <div className="studio-transfer-summary">
            <div>
              <span>样例结构</span>
              <strong>{analysis.beatMap.length} 段</strong>
              <p>{compactLine(analysis.contentPromise, 84)}</p>
            </div>
            <div>
              <span>当前映射</span>
              <strong>{rows.length} 段</strong>
              <p>{compactLine(activeVersion.positioning, 84)}</p>
            </div>
            <div>
              <span>素材槽位</span>
              <strong>{matchedRows.length}/{rows.length}</strong>
              <p>
                部分 {partialRows.length}，缺口 {missingRows.length}
              </p>
            </div>
          </div>

          <div className="studio-transfer-main">
            <div className="studio-transfer-lanes" aria-label="样例到新方案迁移链路">
              {visibleRows.map((row) => {
                const transferSlot = transferSlots.find(
                  (slot) =>
                    slot.sampleTimeRange === row.sampleTimeRange ||
                    slot.targetTimeRange === row.outputTimeRange,
                );
                return (
                  <div className="studio-transfer-row" key={`${row.index}-${row.outputTimeRange}`}>
                    <div className="studio-transfer-node is-sample">
                      <Badge variant="outline">{row.sampleTimeRange}</Badge>
                      <strong>{compactLine(row.samplePurpose, 48)}</strong>
                      <p>{compactLine(row.sampleRule, 82)}</p>
                    </div>
                    <div className="studio-transfer-arrow">
                      <ArrowRight className="size-4" />
                    </div>
                    <div className="studio-transfer-node is-output">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{row.outputTimeRange}</Badge>
                        <Badge variant={fitBadgeVariant(row.materialFit)}>
                          {materialFitText(row.materialFit)}
                        </Badge>
                      </div>
                      <strong>{compactLine(row.outputPurpose, 54)}</strong>
                      <p>
                        {compactLine(
                          transferSlot?.transferableTechnique || row.mappingLogic,
                          92,
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="studio-gap-queue">
              <div className="studio-gap-queue-head">
                <div>
                  <span>缺口任务队列</span>
                  <strong>{materialGaps.length ? `${materialGaps.length} 项优先处理` : "素材链路已覆盖"}</strong>
                </div>
                <Button onClick={onOpenWorkbench} size="sm" type="button" variant="outline">
                  <ArrowDown />
                  制作台
                </Button>
              </div>
              <div className="studio-gap-queue-list">
                {materialGaps.length ? (
                  materialGaps.map((slot) => (
                    <div className="studio-gap-task" key={slot.slotId}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={slot.fit === "missing" ? "warning" : "secondary"}>
                          {fitText(slot.fit)}
                        </Badge>
                        <span>{slot.slotName}</span>
                      </div>
                      <p>{compactLine(slot.impact, 92)}</p>
                      <small>{completionStrategyText(slot.completionStrategy)}：{compactLine(slot.completionPlan, 104)}</small>
                    </div>
                  ))
                ) : (
                  <div className="studio-gap-task is-clear">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="success">已覆盖</Badge>
                      <span>{plan.materialAdaptation?.providedMaterialsSummary ?? "等待素材体检"}</span>
                    </div>
                    <p>
                      {topTechnique
                        ? `可继续按「${topTechnique.title}」强化剪辑手法。`
                        : "可以直接进入预览、精修或成片生成。"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SubmissionBundlePanel({
  analysis,
  plan,
  activeVersion,
  rows,
  generatedVideo,
  renderingVideo,
  onExportMd,
  onExportJson,
  onRender,
}: {
  analysis: VideoStructureAnalysis;
  plan: MigratedVideoPlan;
  activeVersion: PlanVersion;
  rows: MigrationMapRow[];
  generatedVideo: GeneratedVideoState | null;
  renderingVideo: boolean;
  onExportMd: () => void;
  onExportJson: () => void;
  onRender: () => void;
}) {
  const transferReady = rows.length > 0;
  const materialReady = Boolean(plan.materialAdaptation);
  const finalVideoReady = Boolean(generatedVideo?.url);
  const qualityReady = finalVideoReady;
  const readinessItems = [
    {
      label: "样例结构",
      ready: Boolean(analysis.beatMap.length),
      detail: `${analysis.beatMap.length} 个节拍，Hook ${analysis.hookPatterns[0]?.type || "已提炼"}`,
    },
    {
      label: "迁移方案",
      ready: Boolean(activeVersion.scriptBeats.length),
      detail: `${activeVersion.versionName} · ${activeVersion.scriptBeats.length} 段脚本`,
    },
    {
      label: "迁移证据",
      ready: transferReady,
      detail: transferReady ? `${rows.length} 条样例到新片映射` : "等待映射生成",
    },
    {
      label: "素材诊断",
      ready: materialReady,
      detail: materialReady
        ? `缺口 ${plan.materialAdaptation?.missingSlotCount ?? 0}，分数 ${plan.materialAdaptation?.sufficiencyScore ?? "--"}`
        : "等待素材槽位诊断",
    },
    {
      label: "成片证据",
      ready: finalVideoReady,
      detail: finalVideoReady ? generatedVideo?.title ?? "已生成成片" : "可先生成网页成片或最终演示包",
    },
    {
      label: "质量门禁",
      ready: qualityReady,
      detail: qualityReady ? "可进入 video:check / demo:final 质量报告" : "最终演示包会生成 quality-report.json",
    },
  ];
  const artifactItems = [
    {
      label: "方案 Markdown",
      detail: "样例拆解、迁移映射、评分证据矩阵",
      ready: true,
    },
    {
      label: "方案 JSON",
      detail: "结构化 plan / analysis / timeline 数据",
      ready: true,
    },
    {
      label: "final-video.mp4",
      detail: "Remotion 9:16 有声成片",
      ready: finalVideoReady,
    },
    {
      label: "quality-report.json",
      detail: "分辨率、帧率、音频、码率、音量门禁",
      ready: qualityReady,
    },
    {
      label: "keyframes/*.png",
      detail: "1s / 8s / 13s 关键帧",
      ready: qualityReady,
    },
    {
      label: "final-flow/case.*",
      detail: "全流程 case.md / case.json",
      ready: qualityReady,
    },
  ];
  const readyCount = readinessItems.filter((item) => item.ready).length;
  const commands = [
    "npm run submission:check",
    "npm run demo:final -- --out-dir submissions/final-coconut-latte --quality high",
    "npm run submission:pack -- --include-final-demo-dir submissions/final-coconut-latte",
  ];

  return (
    <Card className="studio-submission-card">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PackageCheck className="size-4 text-primary" />
              交付证据包
            </CardTitle>
            <CardDescription>
              把页面证据、导出稿、最终演示包和提交压缩包串成可执行清单。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={readyCount >= readinessItems.length - 1 ? "success" : "secondary"}>
              {readyCount}/{readinessItems.length}
            </Badge>
            <Badge variant={finalVideoReady ? "success" : "warning"}>
              {finalVideoReady ? "成片就绪" : "待成片"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="studio-submission-grid">
          <div className="studio-submission-checks">
            {readinessItems.map((item) => (
              <div className="studio-submission-check" key={item.label}>
                <Badge variant={item.ready ? "success" : "outline"}>
                  {item.ready ? "ready" : "todo"}
                </Badge>
                <div>
                  <strong>{item.label}</strong>
                  <p>{compactLine(item.detail, 96)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="studio-submission-side">
            <div className="studio-submission-actions">
              <Button onClick={onExportMd} size="sm" type="button" variant="outline">
                <Download />
                导出 Markdown
              </Button>
              <Button onClick={onExportJson} size="sm" type="button" variant="outline">
                <FileJson />
                导出 JSON
              </Button>
              <Button disabled={renderingVideo} onClick={onRender} size="sm" type="button">
                {renderingVideo ? <Loader2 className="animate-spin" /> : <Video />}
                {finalVideoReady ? "重新生成成片" : "生成成片"}
              </Button>
            </div>

            <div className="studio-artifact-grid">
              {artifactItems.map((item) => (
                <div className="studio-artifact-item" key={item.label}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{item.label}</span>
                    <Badge variant={item.ready ? "success" : "outline"}>
                      {item.ready ? "ready" : "run"}
                    </Badge>
                  </div>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="studio-command-snippets" aria-label="提交命令">
              {commands.map((command) => (
                <code key={command}>{command}</code>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function materialAssetKindLabel(kind: MaterialAdaptation["assets"][number]["kind"]) {
  if (kind === "image") return "图片";
  if (kind === "video") return "视频";
  if (kind === "text") return "文案";
  return "链接";
}

function materialAssetIcon(kind: MaterialAdaptation["assets"][number]["kind"]) {
  if (kind === "image") return ImageIcon;
  if (kind === "video") return Video;
  if (kind === "text") return FileText;
  return Database;
}

function MaterialIntelligencePanel({
  adaptation,
  rows,
  onOpenWorkbench,
}: {
  adaptation?: MaterialAdaptation;
  rows: MigrationMapRow[];
  onOpenWorkbench: () => void;
}) {
  const assets = adaptation?.assets ?? [];
  const slots = adaptation?.slots ?? [];
  const topAssets = assets
    .slice()
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, 4);
  const coveredSlotIds = new Set(
    slots
      .filter((slot) => slot.fit === "matched" || slot.fit === "partial")
      .map((slot) => slot.slotId),
  );
  const supportedRows = rows.filter((row) => row.materialFit === "matched" || row.materialFit === "partial");
  const fitCounts = {
    matched: slots.filter((slot) => slot.fit === "matched").length,
    partial: slots.filter((slot) => slot.fit === "partial").length,
    missing: slots.filter((slot) => slot.fit === "missing").length,
  };

  return (
    <Card className="studio-material-card">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PackageCheck className="size-4 text-primary" />
              素材智能盘点
            </CardTitle>
            <CardDescription>
              将用户素材识别为可复用资产，并映射到 Hook、主体、过程、证据和 CTA 槽位。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={adaptation?.missingSlotCount ? "warning" : "success"}>
              {adaptation ? `${adaptation.sufficiencyScore}/100` : "待体检"}
            </Badge>
            <Badge variant="outline">资产 {assets.length}</Badge>
            <Badge variant="outline">支撑 {supportedRows.length}/{rows.length}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="studio-material-grid">
          <div className="studio-material-summary">
            <div>
              <span>槽位覆盖</span>
              <strong>{coveredSlotIds.size}/{slots.length || 6}</strong>
              <p>
                匹配 {fitCounts.matched}，部分 {fitCounts.partial}，缺口 {fitCounts.missing}
              </p>
            </div>
            <div>
              <span>素材概览</span>
              <strong>{assets.length ? `${assets.length} 个资产` : "等待素材"}</strong>
              <p>{adaptation?.providedMaterialsSummary ?? "上传图片、视频或文案后会自动生成素材资产盘点。"}</p>
            </div>
          </div>

          {topAssets.length ? (
            <div className="studio-material-assets">
              {topAssets.map((asset) => {
                const Icon = materialAssetIcon(asset.kind);
                return (
                  <div className="studio-material-asset" key={asset.id}>
                    <div className="studio-material-asset-head">
                      <div className="studio-material-asset-icon">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <strong>{asset.label}</strong>
                        <span>{materialAssetKindLabel(asset.kind)} · {asset.qualityScore}/100</span>
                      </div>
                    </div>
                    <p>{compactLine(asset.highlightReason, 92)}</p>
                    <div className="studio-material-tags">
                      {asset.suggestedSlots.slice(0, 4).map((slot) => (
                        <Badge variant="outline" key={`${asset.id}-${slot}`}>
                          {slot}
                        </Badge>
                      ))}
                    </div>
                    <small>{compactLine(asset.recommendedUse, 104)}</small>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="studio-material-empty">
              <PackageCheck className="size-8 text-primary" />
              <strong>等待真实素材资产</strong>
              <p>上传素材文件或填写素材说明后，系统会把资产推荐到结构槽位。</p>
            </div>
          )}

          {slots.length ? (
            <div className="studio-material-slot-grid">
              {slots.slice(0, 6).map((slot) => (
                <div className="studio-material-slot" key={slot.slotId}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{slot.slotName}</span>
                    <Badge
                      variant={
                        slot.fit === "matched"
                          ? "success"
                          : slot.fit === "partial"
                            ? "warning"
                            : "outline"
                      }
                    >
                      {fitText(slot.fit)}
                    </Badge>
                  </div>
                  <p>{compactLine(slot.matchedMaterial, 96)}</p>
                  {slot.recommendedAssets.length ? (
                    <div className="studio-material-tags">
                      {slot.recommendedAssets.slice(0, 3).map((asset) => (
                        <Badge variant="secondary" key={`${slot.slotId}-${asset.assetId}`}>
                          {asset.label}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <small>{completionStrategyText(slot.completionStrategy)}：{compactLine(slot.completionPlan, 92)}</small>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <div className="studio-material-actions">
            <p>{adaptation?.timelineAdjustment ?? "素材体检会同步影响时间线和补镜策略。"}</p>
            <Button onClick={onOpenWorkbench} size="sm" type="button" variant="outline">
              <ArrowDown />
              查看完整素材诊断
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type AigcGapFillTask = {
  id: string;
  slotName: string;
  fit: MaterialAdaptation["slots"][number]["fit"];
  timeRange: string;
  scenePurpose: string;
  strategy: string;
  prompt: string;
  negativePrompt: string;
  usage: string;
};

function buildAigcPromptForSlot({
  slot,
  row,
  plan,
  activeVersion,
}: {
  slot: MaterialAdaptation["slots"][number];
  row?: MigrationMapRow;
  plan: MigratedVideoPlan;
  activeVersion: PlanVersion;
}) {
  const timeRange = row?.outputTimeRange ?? activeVersion.scriptBeats[0]?.timeRange ?? "0-3s";
  const scenePurpose = row?.outputPurpose ?? slot.requiredFor;
  const targetLine =
    row?.outputLine ??
    activeVersion.scriptBeats.find((beat) =>
      `${beat.shotPurpose} ${beat.replaceableAssets}`.includes(slot.slotName),
    )?.voiceoverOrSubtitle ??
    activeVersion.captionTitle;
  const prompt = [
    `生成一段适合 9:16 竖屏短视频的商业补素材，目标内容：${plan.targetBrief}`,
    `补齐槽位：${slot.slotName}；用途：${slot.requiredFor}`,
    `时间线：${timeRange}；镜头目的：${scenePurpose}`,
    `画面要求：${slot.requiredMaterial}`,
    `字幕/口播承接：${targetLine}`,
    `风格：真实商业摄影、主体清晰、浅景深适度、干净背景、可叠加字幕和卖点卡片`,
    "只生成新主题相关画面，不复制样例人物、品牌、商品、包装、场景或原台词",
  ].join("\n");
  const negativePrompt =
    "不要生成可读文字、水印、错误品牌标识、样例原人物、样例原商品、低清晰度手部、畸变脸、过度磨皮、黑边、横屏构图。";
  const usage = `${completionStrategyText(slot.completionStrategy)}：${slot.completionPlan}`;

  return {
    prompt,
    negativePrompt,
    usage,
    timeRange,
    scenePurpose,
  };
}

function buildAigcGapFillTasks({
  adaptation,
  rows,
  plan,
  activeVersion,
}: {
  adaptation?: MaterialAdaptation;
  rows: MigrationMapRow[];
  plan: MigratedVideoPlan;
  activeVersion: PlanVersion;
}): AigcGapFillTask[] {
  if (!adaptation) return [];

  return [
    ...adaptation.slots.filter((slot) => slot.fit === "missing"),
    ...adaptation.slots.filter((slot) => slot.fit === "partial"),
  ].map((slot) => {
    const row =
      rows.find((item) => item.materialSlotName === slot.slotName) ??
      rows.find((item) =>
        `${item.outputPurpose} ${item.mappingLogic} ${item.completionPlan}`.includes(slot.slotName),
      );
    const promptBlock = buildAigcPromptForSlot({ slot, row, plan, activeVersion });
    return {
      id: slot.slotId,
      slotName: slot.slotName,
      fit: slot.fit,
      strategy: completionStrategyText(slot.completionStrategy),
      ...promptBlock,
    };
  });
}

function formatAigcPromptForCopy(task: AigcGapFillTask) {
  return [
    `# ${task.slotName} · ${task.timeRange}`,
    "",
    "## Prompt",
    task.prompt,
    "",
    "## Negative Prompt",
    task.negativePrompt,
    "",
    "## Timeline Usage",
    task.usage,
  ].join("\n");
}

function segmentTiming(
  segments: TimelineSegment[],
  index: number,
): Pick<
  TimelineExchangeClip,
  "timeRange" | "startSecond" | "endSecond" | "durationSeconds"
> {
  const segment = segments[index];
  if (segment) {
    return {
      timeRange: segment.timeRange,
      startSecond: segment.startSecond,
      endSecond: segment.endSecond,
      durationSeconds: segment.durationSeconds,
    };
  }

  const startSecond = index * 5;
  const endSecond = startSecond + 5;
  return {
    timeRange: `${startSecond}-${endSecond}s`,
    startSecond,
    endSecond,
    durationSeconds: endSecond - startSecond,
  };
}

function buildTimelineExchangePayload({
  analysis,
  plan,
  activeVersion,
  rows,
}: {
  analysis: VideoStructureAnalysis;
  plan: MigratedVideoPlan;
  activeVersion: PlanVersion;
  rows: MigrationMapRow[];
}): TimelineExchangePayload {
  const segments = buildTimelineSegments(rows);
  const adaptation = plan.materialAdaptation;
  const totalSeconds = segments.length
    ? Math.max(...segments.map((segment) => segment.endSecond))
    : activeVersion.scriptBeats.length * 5;

  const videoClips: TimelineExchangeClip[] = segments.map((segment, index) => {
    const beat = activeVersion.scriptBeats[index];
    const row = rows[index];
    const slot = adaptation?.slots.find(
      (item) => item.slotName === segment.materialSlotName,
    );

    return {
      id: `video-${segment.index}`,
      order: segment.index,
      timeRange: segment.timeRange,
      startSecond: segment.startSecond,
      endSecond: segment.endSecond,
      durationSeconds: segment.durationSeconds,
      name: segment.label,
      focus: segment.focus,
      materialSlotName: segment.materialSlotName,
      materialFit: segment.materialFit,
      completionStrategy: row?.completionStrategy,
      completionPlan: segment.completionPlan,
      visualSuggestion: beat?.visualSuggestion,
      transitionAndRhythm: beat?.transitionAndRhythm,
      replaceableAssets: beat?.replaceableAssets,
      assetCandidates: slot?.recommendedAssets.map((asset) => ({
        assetId: asset.assetId,
        label: asset.label,
        fitScore: asset.fitScore,
        reason: asset.reason,
      })),
    };
  });

  const subtitleClips: TimelineExchangeClip[] = activeVersion.scriptBeats.map(
    (beat, index) => {
      const timing = segmentTiming(segments, index);
      return {
        id: `subtitle-${index + 1}`,
        order: index + 1,
        ...timing,
        text: beat.voiceoverOrSubtitle,
        style: analysis.subtitleLayout.emphasisStyle,
        overlayText: beat.sellingPointIntent,
      };
    },
  );

  const packagingClips: TimelineExchangeClip[] = activeVersion.scriptBeats.map(
    (beat, index) => {
      const timing = segmentTiming(segments, index);
      return {
        id: `packaging-${index + 1}`,
        order: index + 1,
        ...timing,
        name: beat.shotPurpose,
        text: beat.packagingStyle,
        style: beat.transitionAndRhythm,
        overlayText: index === 0 ? activeVersion.coverTitle : activeVersion.captionTitle,
      };
    },
  );

  const versionScore = plan.evaluation?.versionScores.find(
    (item) => item.versionName === activeVersion.versionName,
  );

  return {
    schema: "viral-structure-transfer.timeline.v1",
    project: {
      title: plan.projectTitle,
      targetBrief: plan.targetBrief,
      strategySummary: plan.strategySummary,
    },
    sourceSample: {
      title: analysis.sampleTitle,
      contentPromise: analysis.contentPromise,
      targetAudience: analysis.targetAudience,
      durationSeconds: analysis.durationSeconds,
    },
    version: {
      name: activeVersion.versionName,
      positioning: activeVersion.positioning,
      bestFor: activeVersion.bestFor,
      coverTitle: activeVersion.coverTitle,
      captionTitle: activeVersion.captionTitle,
      hashtags: activeVersion.hashtags,
    },
    timeline: {
      fps: DIRECTOR_PREVIEW_FPS,
      canvas: {
        width: DIRECTOR_PREVIEW_WIDTH,
        height: DIRECTOR_PREVIEW_HEIGHT,
        aspectRatio: "9:16",
      },
      totalSeconds,
      beatCount: activeVersion.scriptBeats.length,
      segmentCount: segments.length,
    },
    tracks: [
      {
        id: "track-video",
        kind: "video",
        name: "画面剪辑轨",
        clips: videoClips,
      },
      {
        id: "track-subtitle",
        kind: "subtitle",
        name: "口播字幕轨",
        clips: subtitleClips,
      },
      {
        id: "track-packaging",
        kind: "packaging",
        name: "包装与转场轨",
        clips: packagingClips,
      },
    ],
    sourceMap: rows.map((row) => ({
      order: row.index,
      source: {
        timeRange: row.sampleTimeRange,
        shotPurpose: row.samplePurpose,
        transferableRule: row.sampleRule,
      },
      target: {
        timeRange: row.outputTimeRange,
        shotPurpose: row.outputPurpose,
        line: row.outputLine,
      },
      mappingLogic: row.mappingLogic,
      material: {
        slotName: row.materialSlotName,
        fit: row.materialFit,
        completionStrategy: row.completionStrategy,
        completionPlan: row.completionPlan,
      },
    })),
    material: {
      sufficiencyScore: adaptation?.sufficiencyScore,
      missingSlotCount: adaptation?.missingSlotCount,
      timelineAdjustment: adaptation?.timelineAdjustment,
      assets:
        adaptation?.assets.map((asset) => ({
          id: asset.id,
          kind: asset.kind,
          label: asset.label,
          qualityScore: asset.qualityScore,
          suggestedSlots: asset.suggestedSlots,
        })) ?? [],
      slots:
        adaptation?.slots.map((slot) => ({
          slotId: slot.slotId,
          slotName: slot.slotName,
          fit: slot.fit,
          requiredMaterial: slot.requiredMaterial,
          matchedMaterial: slot.matchedMaterial,
          completionStrategy: slot.completionStrategy,
          completionPlan: slot.completionPlan,
        })) ?? [],
    },
    evaluation: {
      overallScore: plan.evaluation?.overallScore ?? plan.awardReadiness?.overallScore,
      readiness: plan.evaluation?.readiness ?? plan.awardReadiness?.verdict,
      versionScore: versionScore?.score,
      bestVersion: plan.evaluation?.bestVersion,
    },
  };
}

function TimelineExchangePanel({
  analysis,
  plan,
  activeVersion,
  rows,
  onOpenWorkbench,
}: {
  analysis: VideoStructureAnalysis;
  plan: MigratedVideoPlan;
  activeVersion: PlanVersion;
  rows: MigrationMapRow[];
  onOpenWorkbench: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const payload = useMemo(
    () => buildTimelineExchangePayload({ analysis, plan, activeVersion, rows }),
    [analysis, activeVersion, plan, rows],
  );
  const payloadText = useMemo(() => JSON.stringify(payload, null, 2), [payload]);
  const csvText = useMemo(() => buildTimelineExchangeCsv(payload), [payload]);
  const fileBaseName = useMemo(
    () => safeDownloadName(`${plan.projectTitle}-${activeVersion.versionName}-timeline`, "timeline-exchange"),
    [activeVersion.versionName, plan.projectTitle],
  );
  const previewLines = payloadText.split("\n").slice(0, 18).join("\n");
  const fitCounts = {
    matched: rows.filter((row) => row.materialFit === "matched").length,
    partial: rows.filter((row) => row.materialFit === "partial").length,
    missing: rows.filter((row) => row.materialFit === "missing").length,
  };

  async function copyPayload() {
    await copyTextToClipboard(payloadText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadJsonPayload() {
    downloadTextFile({
      fileName: `${fileBaseName}.json`,
      text: payloadText,
      mimeType: "application/json;charset=utf-8",
    });
  }

  function downloadCsvPayload() {
    downloadTextFile({
      fileName: `${fileBaseName}.csv`,
      text: `\uFEFF${csvText}`,
      mimeType: "text/csv;charset=utf-8",
    });
  }

  return (
    <Card className="studio-timeline-exchange-card">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="size-4 text-primary" />
              时间线交换 JSON
            </CardTitle>
            <CardDescription>
              将当前版本整理成 OTIO-like 轨道数据，包含画面、字幕、包装、素材和样例映射证据。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{payload.timeline.totalSeconds}s</Badge>
            <Badge variant="outline">{payload.tracks.length} 轨</Badge>
            <Badge variant={fitCounts.missing ? "warning" : "success"}>
              缺口 {fitCounts.missing}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="studio-timeline-exchange-grid">
          <div className="studio-timeline-exchange-main">
            <div className="studio-timeline-exchange-summary">
              <div>
                <span>镜头段</span>
                <strong>{payload.timeline.segmentCount}</strong>
                <p>总时长 {formatSeconds(payload.timeline.totalSeconds)}</p>
              </div>
              <div>
                <span>素材覆盖</span>
                <strong>{fitCounts.matched}/{rows.length}</strong>
                <p>部分 {fitCounts.partial}，缺口 {fitCounts.missing}</p>
              </div>
              <div>
                <span>版本评分</span>
                <strong>{payload.evaluation.versionScore ?? payload.evaluation.overallScore ?? "--"}</strong>
                <p>{activeVersion.versionName}</p>
              </div>
            </div>

            <div className="studio-timeline-track-list">
              {payload.tracks.map((track) => (
                <div className="studio-timeline-track" key={track.id}>
                  <div className="studio-timeline-track-head">
                    <span>{track.name}</span>
                    <Badge variant="outline">{track.clips.length} clips</Badge>
                  </div>
                  <div className="studio-timeline-clip-row">
                    {track.clips.slice(0, 6).map((clip) => {
                      const width = Math.max(
                        14,
                        (clip.durationSeconds / Math.max(payload.timeline.totalSeconds, 1)) * 100,
                      );
                      return (
                        <div
                          className={`studio-timeline-clip is-${track.kind}`}
                          key={clip.id}
                          style={{ width: `${width}%` }}
                        >
                          <span>{clip.timeRange}</span>
                          <strong>{compactLine(clip.name || clip.text || `clip ${clip.order}`, 28)}</strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="studio-timeline-json-panel">
            <div className="studio-timeline-json-head">
              <div>
                <span>可复制载荷</span>
                <strong>{payload.schema}</strong>
              </div>
              <div className="studio-timeline-json-actions">
                <Button onClick={() => void copyPayload()} size="sm" type="button" variant="outline">
                  <Copy />
                  {copied ? "已复制" : "复制 JSON"}
                </Button>
                <Button onClick={downloadJsonPayload} size="sm" type="button" variant="outline">
                  <Download />
                  下载 JSON
                </Button>
                <Button onClick={downloadCsvPayload} size="sm" type="button" variant="outline">
                  <Download />
                  剪辑表 CSV
                </Button>
              </div>
            </div>
            <pre className="studio-timeline-json-preview">
              {previewLines}
              {"\n..."}
            </pre>
            <div className="studio-timeline-export-actions">
              <p>
                JSON 可交给剪辑脚本、Remotion 渲染管线或外部 NLE 适配器继续处理。
              </p>
              <Button onClick={onOpenWorkbench} size="sm" type="button" variant="outline">
                <ArrowDown />
                制作台核对
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AigcGapFillPanel({
  adaptation,
  rows,
  plan,
  activeVersion,
  onOpenWorkbench,
}: {
  adaptation?: MaterialAdaptation;
  rows: MigrationMapRow[];
  plan: MigratedVideoPlan;
  activeVersion: PlanVersion;
  onOpenWorkbench: () => void;
}) {
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const tasks = useMemo(
    () => buildAigcGapFillTasks({ adaptation, rows, plan, activeVersion }),
    [adaptation, activeVersion, plan, rows],
  );

  async function copyPrompt(task: AigcGapFillTask) {
    const text = formatAigcPromptForCopy(task);
    await copyTextToClipboard(text);
    setCopiedTaskId(task.id);
    window.setTimeout(() => setCopiedTaskId(null), 1600);
  }

  return (
    <Card className="studio-aigc-card">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="size-4 text-primary" />
              AIGC 补素材任务台
            </CardTitle>
            <CardDescription>
              将素材缺口转成可复制的图像/视频生成提示词，并保留时间线用途和不可复制边界。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={tasks.length ? "warning" : "success"}>
              任务 {tasks.length}
            </Badge>
            <Badge variant="outline">9:16</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="studio-aigc-grid">
          {tasks.length ? (
            tasks.slice(0, 4).map((task) => (
              <div className="studio-aigc-task" key={task.id}>
                <div className="studio-aigc-task-head">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={task.fit === "missing" ? "warning" : "secondary"}>
                        {fitText(task.fit)}
                      </Badge>
                      <Badge variant="outline">{task.timeRange}</Badge>
                    </div>
                    <strong>{task.slotName}</strong>
                    <p>{compactLine(task.scenePurpose, 92)}</p>
                  </div>
                  <Button
                    onClick={() => void copyPrompt(task)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Copy />
                    {copiedTaskId === task.id ? "已复制" : "复制"}
                  </Button>
                </div>
                <div className="studio-aigc-prompt">
                  <span>Prompt</span>
                  <p>{compactLine(task.prompt, 170)}</p>
                </div>
                <div className="studio-aigc-negative">
                  <span>Negative</span>
                  <p>{compactLine(task.negativePrompt, 130)}</p>
                </div>
                <small>{task.strategy}：{compactLine(task.usage, 120)}</small>
              </div>
            ))
          ) : (
            <div className="studio-aigc-empty">
              <CheckCircle2 className="size-8 text-primary" />
              <strong>暂无必须补的 AIGC 素材</strong>
              <p>当前素材槽位已覆盖，可继续进入预览、精修或最终成片生成。</p>
            </div>
          )}

          <div className="studio-aigc-actions">
            <p>
              生成素材后建议回填到素材库或在制作台中替换对应槽位，最终仍由 Remotion 时间线统一编排。
            </p>
            <Button onClick={onOpenWorkbench} size="sm" type="button" variant="outline">
              <ArrowDown />
              打开制作台
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SampleCompactRecap({
  analysis,
  mediaMeta,
  onDetails,
}: {
  analysis: VideoStructureAnalysis;
  mediaMeta: MediaMeta | null;
  onDetails: () => void;
}) {
  const fingerprint = useMemo(() => buildStructureFingerprint(analysis), [analysis]);

  return (
    <div className="studio-sample-recap">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">样片手法</Badge>
          <Badge variant="outline">{analysis.beatMap.length} 段</Badge>
          <Badge variant="outline">
            {formatSeconds(mediaMeta?.durationSeconds ?? analysis.durationSeconds)}
          </Badge>
        </div>
        <h3>{analysis.contentPromise}</h3>
        <p>{compactLine(analysis.summary, 130)}</p>
      </div>
      <div className="studio-sample-recap-stats">
        <span>Hook {fingerprint.hookStrength}</span>
        <span>{fingerprint.shotDensityPer10s} 镜/10s</span>
        <Button size="sm" type="button" variant="outline" onClick={onDetails}>
          查看
        </Button>
      </div>
    </div>
  );
}

function StudioOverviewPanel({
  analysis,
  plan,
  activeVersion,
  rows,
  generatedVideo,
  renderingVideo,
  mediaMeta,
  sampleInputReady,
  targetBriefReady,
  materialFileCount,
  status,
  onAnalyze,
  onGeneratePlan,
  onRender,
  onOpenWorkbench,
}: {
  analysis: VideoStructureAnalysis | null;
  plan: MigratedVideoPlan | null;
  activeVersion?: PlanVersion;
  rows: MigrationMapRow[];
  generatedVideo: GeneratedVideoState | null;
  renderingVideo: boolean;
  mediaMeta: MediaMeta | null;
  sampleInputReady: boolean;
  targetBriefReady: boolean;
  materialFileCount: number;
  status: StatusState;
  onAnalyze: () => void;
  onGeneratePlan: () => void;
  onRender: () => void;
  onOpenWorkbench: () => void;
}) {
  const fingerprint = useMemo(
    () => (analysis ? buildStructureFingerprint(analysis) : null),
    [analysis],
  );
  const overallScore = plan?.evaluation?.overallScore ?? plan?.awardReadiness?.overallScore;
  const structureScore = plan?.evaluation?.structureAlignment?.coverageScore;
  const materialScore = plan?.materialAdaptation?.sufficiencyScore;
  const completedStageCount = [
    sampleInputReady || Boolean(analysis),
    Boolean(analysis),
    Boolean(plan),
    Boolean(activeVersion),
    Boolean(generatedVideo?.url),
  ].filter(Boolean).length;
  const isLoading = status.type === "loading";
  const primaryAction =
    !analysis
      ? {
          label: "理解样片",
          icon: ClipboardList,
          onClick: onAnalyze,
          disabled: !sampleInputReady || isLoading,
          variant: "default" as const,
        }
      : !plan
        ? {
            label: "生成方案",
            icon: RefreshCw,
            onClick: onGeneratePlan,
            disabled: !targetBriefReady || isLoading,
            variant: "secondary" as const,
          }
        : {
            label: renderingVideo ? "生成中" : "生成成片",
            icon: renderingVideo ? Loader2 : Video,
            onClick: onRender,
            disabled: renderingVideo || isLoading,
            variant: "default" as const,
          };
  const PrimaryIcon = primaryAction.icon;
  const workflow = [
    {
      title: "样片输入",
      detail: analysis
        ? sourceKindLabel(mediaMeta)
        : sampleInputReady
          ? "已就绪"
          : "待补充",
      ready: sampleInputReady || Boolean(analysis),
      current: !analysis,
    },
    {
      title: "结构拆解",
      detail: analysis ? `${analysis.beatMap.length} 个节拍` : "待分析",
      ready: Boolean(analysis),
      current: Boolean(sampleInputReady && !analysis),
    },
    {
      title: "方案迁移",
      detail: plan ? `${plan.versions.length} 个版本` : "待生成",
      ready: Boolean(plan),
      current: Boolean(analysis && !plan),
    },
    {
      title: "制作证据",
      detail: activeVersion ? `${rows.length} 段时间线` : "待展开",
      ready: Boolean(activeVersion),
      current: Boolean(plan && !generatedVideo?.url),
    },
    {
      title: "成片输出",
      detail: generatedVideo?.url ? "已生成" : renderingVideo ? "生成中" : "待生成",
      ready: Boolean(generatedVideo?.url),
      current: Boolean(plan && !generatedVideo?.url),
    },
  ];
  const scoreCards = [
    {
      label: "综合质量",
      value: typeof overallScore === "number" ? `${overallScore}` : "--",
      caption: readinessLabel(plan?.evaluation?.readiness),
      percent: clampPercent(overallScore),
      variant: scoreBadgeVariant(overallScore),
    },
    {
      label: "结构覆盖",
      value: typeof structureScore === "number" ? `${structureScore}` : fingerprint ? `${fingerprint.hookStrength}` : "--",
      caption: structureScore ? "样例节拍匹配" : fingerprint ? "Hook 强度" : "等待拆解",
      percent: clampPercent(structureScore ?? fingerprint?.hookStrength),
      variant: scoreBadgeVariant(structureScore ?? fingerprint?.hookStrength),
    },
    {
      label: "素材适配",
      value: typeof materialScore === "number" ? `${materialScore}` : materialFileCount ? `${materialFileCount} 件` : "--",
      caption: plan?.materialAdaptation
        ? `缺口 ${plan.materialAdaptation.missingSlotCount}`
        : materialFileCount
          ? "已选择素材"
          : "等待素材",
      percent: typeof materialScore === "number" ? clampPercent(materialScore) : materialFileCount ? 54 : 0,
      variant: scoreBadgeVariant(materialScore),
    },
  ];
  const topVersionScore = activeVersion
    ? plan?.evaluation?.versionScores.find(
        (item) => item.versionName === activeVersion.versionName,
      )
    : null;
  const proofItems = [
    {
      label: "样片规律",
      value: analysis
        ? analysis.hookPatterns[0]?.type || analysis.contentPromise
        : "等待样片",
    },
    {
      label: "RAG 手法",
      value: plan?.retrievedTechniques.length
        ? `${plan.retrievedTechniques.length} 条命中`
        : "待检索",
    },
    {
      label: "当前版本",
      value: activeVersion
        ? `${activeVersion.versionName}${topVersionScore ? ` · ${topVersionScore.score}` : ""}`
        : "待选择",
    },
    {
      label: "成片状态",
      value: generatedVideo?.url
        ? generatedVideo.title
        : generatedVideo?.progressText || (renderingVideo ? "生成中" : "待生成"),
    },
  ];

  return (
    <section className="studio-command-center" aria-label="项目总控">
      <div className="studio-command-main">
        <div className="studio-command-heading">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="gradient">Director Console</Badge>
            <Badge variant={plan ? "success" : analysis ? "secondary" : "outline"}>
              {completedStageCount}/5
            </Badge>
          </div>
          <h2>{plan?.projectTitle || "从爆款样片到可执行成片"}</h2>
          <p>
            {plan?.strategySummary ||
              analysis?.summary ||
              "导入参考样片后，系统会抽取结构规律并迁移到新的主题、素材和成片时间线。"}
          </p>
        </div>

        <div className="studio-command-actions">
          <Button
            disabled={primaryAction.disabled}
            onClick={primaryAction.onClick}
            type="button"
            variant={primaryAction.variant}
          >
            <PrimaryIcon className={renderingVideo || isLoading ? "animate-spin" : ""} />
            {primaryAction.label}
          </Button>
          <Button
            disabled={!plan || !activeVersion}
            onClick={onOpenWorkbench}
            type="button"
            variant="outline"
          >
            <GitBranch />
            制作台
          </Button>
        </div>

        <div className="studio-command-flow">
          {workflow.map((step, index) => (
            <div
              className={`studio-command-step ${step.ready ? "is-ready" : ""} ${
                step.current ? "is-current" : ""
              }`}
              key={step.title}
            >
              <span>{index + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="studio-command-side">
        <div className="studio-score-grid">
          {scoreCards.map((card) => (
            <div className="studio-score-card" key={card.label}>
              <div className="flex items-start justify-between gap-2">
                <span>{card.label}</span>
                <Badge variant={card.variant}>{card.value}</Badge>
              </div>
              <div className="studio-score-track">
                <i style={{ width: `${card.percent}%` }} />
              </div>
              <p>{card.caption}</p>
            </div>
          ))}
        </div>

        <div className="studio-proof-grid">
          {proofItems.map((item) => (
            <div className="studio-proof-item" key={item.label}>
              <span>{item.label}</span>
              <strong>{compactLine(item.value, 42)}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoPresetPanel({
  activeLabel,
  onApply,
}: {
  activeLabel: string | null;
  onApply: (preset: DemoPreset) => void;
}) {
  return (
    <Card className="studio-preset-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageCheck className="size-4 text-primary" />
          演示预设
        </CardTitle>
        <CardDescription>一键填入样片观察、商品 Brief 和素材缺口说明。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="studio-preset-grid">
          {demoPresets.map((preset) => {
            const active = activeLabel === preset.label;
            return (
              <button
                className={`studio-preset-option ${active ? "is-active" : ""}`}
                key={preset.label}
                onClick={() => onApply(preset)}
                type="button"
              >
                <div className="flex items-start justify-between gap-2">
                  <strong>{preset.label}</strong>
                  <Badge variant={active ? "success" : "outline"}>
                    {active ? "已填入" : "套用"}
                  </Badge>
                </div>
                <p>{compactLine(preset.targetBrief, 74)}</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function JudgeReadinessPanel({
  analysis,
  plan,
  activeVersion,
  generatedVideo,
}: {
  analysis: VideoStructureAnalysis;
  plan: MigratedVideoPlan;
  activeVersion: PlanVersion;
  generatedVideo: GeneratedVideoState | null;
}) {
  const reports = useMemo(() => {
    const techniqueTransfer = buildTechniqueTransferRecipe({
      analysis,
      plan,
      version: activeVersion,
    });
    const championRubric = evaluateChampionRubric({
      analysis,
      plan,
      techniqueTransfer,
      finalVideoReady: Boolean(generatedVideo?.url),
    });
    const coverage = buildContestRequirementCoverage({
      analysis,
      plan,
      techniqueTransfer,
      championRubric,
    });

    return { techniqueTransfer, championRubric, coverage };
  }, [analysis, activeVersion, generatedVideo?.url, plan]);

  const award = plan.awardReadiness;
  const readyP0 = reports.coverage.items.filter(
    (item) => item.priority === "P0" && item.status === "ready",
  );
  const visibleCoverage = [
    ...reports.coverage.items.filter((item) => item.priority === "P0"),
    ...reports.coverage.items.filter((item) => item.priority !== "P0"),
  ].slice(0, 8);
  const topFixes =
    plan.evaluation?.priorityFixes.length
      ? plan.evaluation.priorityFixes.slice(0, 3)
      : award?.nextActions.slice(0, 3) ?? [];

  return (
    <Card className="studio-judge-card">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              评审验收看板
            </CardTitle>
            <CardDescription>
              把题目要求、冲奖标准和当前证据放到同一屏，便于现场快速验收。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={scoreBadgeVariant(reports.championRubric.baseScore)}>
              基础 {reports.championRubric.baseScore}/100
            </Badge>
            <Badge variant={reports.championRubric.bonusScore >= 8 ? "success" : "secondary"}>
              加分 {reports.championRubric.bonusScore}/10
            </Badge>
            <Badge variant={scoreBadgeVariant(award?.overallScore)}>
              {verdictText(reports.championRubric.verdict)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="studio-judge-summary">
          <div>
            <span>总评分</span>
            <strong>{reports.championRubric.totalScoreWithBonus}/110</strong>
            <p>{reports.championRubric.pitch}</p>
          </div>
          <div>
            <span>任务覆盖</span>
            <strong>
              {reports.coverage.completedCount}/{reports.coverage.totalCount}
            </strong>
            <p>
              P0 已满足 {readyP0.length}/8；当前版本 {activeVersion.versionName} 已生成{" "}
              {reports.techniqueTransfer.sceneTransfers.length} 条手法映射。
            </p>
          </div>
          <div>
            <span>奖项准备度</span>
            <strong>{award ? `${award.overallScore}/100` : "--"}</strong>
            <p>{award ? verdictText(award.verdict) : "等待方案生成后自动评估。"} </p>
          </div>
        </div>

        {award?.criteria.length ? (
          <div className="studio-award-grid">
            {award.criteria.map((criterion) => (
              <div className="studio-award-item" key={criterion.key}>
                <div className="flex items-start justify-between gap-2">
                  <span>{criterion.label}</span>
                  <Badge variant={criterion.passed ? "success" : "warning"}>
                    {criterion.score}
                  </Badge>
                </div>
                <div className="studio-score-track">
                  <i style={{ width: `${clampPercent(criterion.score)}%` }} />
                </div>
                <p>{compactLine(criterion.evidence, 96)}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="studio-coverage-list">
          {visibleCoverage.map((item) => (
            <div className="studio-coverage-row" key={item.taskId}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={item.priority === "P0" ? "secondary" : "outline"}>
                    {item.taskId}
                  </Badge>
                  <Badge variant={coverageStatusVariant(item.status)}>
                    {coverageStatusText(item.status)}
                  </Badge>
                  <span>{item.title}</span>
                </div>
                <p>{compactLine(item.evidence, 130)}</p>
              </div>
              <small>{item.judgePanel}</small>
            </div>
          ))}
        </div>

        {topFixes.length ? (
          <div className="studio-next-actions">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning">优先补强</Badge>
              <span>{topFixes.length} 项</span>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {topFixes.map((fix, index) => (
                <p key={`${index}-${fix}`}>{fix}</p>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [projectTitle, setProjectTitle] = useState("爆款结构迁移演示项目");
  const [sampleTitle, setSampleTitle] = useState("优质短视频样例");
  const [sampleUrl, setSampleUrl] = useState("");
  const [sampleNotes, setSampleNotes] = useState("");
  const [targetBrief, setTargetBrief] = useState("");
  const [userMaterialNotes, setUserMaterialNotes] = useState("");
  const [activePresetLabel, setActivePresetLabel] = useState<string | null>(null);
  const [userMaterialFiles, setUserMaterialFiles] = useState<File[]>([]);
  const [sampleFiles, setSampleFiles] = useState<File[]>([]);
  const [sampleFileInputKey, setSampleFileInputKey] = useState(0);
  const [sampleSourceMode, setSampleSourceMode] = useState<SampleSourceMode>("upload");
  const [localUploadName, setLocalUploadName] = useState("");
  const [availableUploads, setAvailableUploads] = useState<
    Array<{ name: string; sizeBytes: number; modifiedAt: string }>
  >([]);
  const simpleMode = true;
  const [showAllSampleBeats, setShowAllSampleBeats] = useState(false);
  const [showSampleDetails, setShowSampleDetails] = useState(false);
  const [showProductionDetails, setShowProductionDetails] = useState(false);
  const [showRenderOptions, setShowRenderOptions] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VideoStructureAnalysis | null>(null);
  const [plan, setPlan] = useState<MigratedVideoPlan | null>(null);
  const [planHistory, setPlanHistory] = useState<PlanHistoryItem[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loadingPlanHistory, setLoadingPlanHistory] = useState(false);
  const [mediaMeta, setMediaMeta] = useState<MediaMeta | null>(null);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [activeVersion, setActiveVersion] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [draftVersion, setDraftVersion] = useState<PlanVersion | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [nlEditInstruction, setNlEditInstruction] = useState("");
  const [nlEditApplying, setNlEditApplying] = useState(false);
  const [nlEditFeedback, setNlEditFeedback] = useState<{
    applied: string[];
    warnings: string[];
  } | null>(null);
  const [nlEditPreview, setNlEditPreview] = useState<{
    plan: MigratedVideoPlan;
    applied: string[];
    warnings: string[];
    diff: ReturnType<typeof diffPlans>;
    sourcePlanId: string | null;
  } | null>(null);
  const [status, setStatus] = useState<StatusState>({
    type: "idle",
    message: "导入样例，生成新片。",
  });
  const [runMode, setRunMode] = useState<RunModeState>({ sample: null, plan: null });
  const [renderingVideo, setRenderingVideo] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideoState | null>(null);
  const [fullVideoPackagingMode, setFullVideoPackagingMode] =
    useState<FullVideoPackagingMode>("cinematic");
  const [directorTuning, setDirectorTuning] = useState<DirectorTuningState>({
    ...defaultDirectorTuning,
  });
  const [applyingDirectorTuning, setApplyingDirectorTuning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLatestRender() {
      try {
        const response = await fetch("/api/renders/latest");
        const payload = (await response.json()) as LatestRenderResponse;
        if (!response.ok || !payload.video || cancelled) return;

        setGeneratedVideo((current) => {
          if (current) return current;
          const createdAt = payload.video?.createdAt
            ? new Date(payload.video.createdAt).toLocaleTimeString()
            : new Date().toLocaleTimeString();
          return {
            title: payload.video?.title || "最近成片",
            url: payload.video?.localVideoUrl || null,
            note: payload.video?.note || "已完成拼接，可直接播放验证。",
            createdAt,
          status: "completed",
          retryable: false,
          outputBaseName: payload.video?.outputBaseName ?? null,
          packaging: payload.video?.packaging,
          progressText: payload.video?.durationSeconds
            ? `${payload.video.durationSeconds.toFixed(1)} 秒`
            : undefined,
          };
        });
      } catch {
        // No recent render is a normal empty state.
      }
    }

    void loadLatestRender();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadUploads() {
    try {
      const response = await fetch("/api/uploads");
      const payload = (await response.json()) as {
        files?: Array<{ name: string; sizeBytes: number; modifiedAt: string }>;
      };
      if (!response.ok) {
        setAvailableUploads([]);
        return;
      }
      setAvailableUploads(payload.files || []);
    } catch {
      setAvailableUploads([]);
    }
  }

  function handleSampleSourceModeChange(mode: SampleSourceMode) {
    setSampleSourceMode(mode);
    if (mode !== "upload") {
      setSampleFiles([]);
      setSampleFileInputKey((current) => current + 1);
    }
    if (mode !== "url") setSampleUrl("");
    if (mode !== "library") setLocalUploadName("");
    if (mode === "library" && availableUploads.length === 0) void loadUploads();
  }

  function resetGeneratedStateForNewInput() {
    setProjectId(null);
    setAnalysis(null);
    setPlan(null);
    setPlanHistory([]);
    setActivePlanId(null);
    setMediaMeta(null);
    setRefineInstruction("");
    setActiveVersion(0);
    setEditMode(false);
    setDraftVersion(null);
    setNlEditInstruction("");
    setNlEditFeedback(null);
    setNlEditPreview(null);
    setShowAllSampleBeats(false);
    setShowSampleDetails(false);
    setShowProductionDetails(false);
    setShowRenderOptions(false);
    setGeneratedVideo(null);
    setDirectorTuning({ ...defaultDirectorTuning });
    setRunMode({ sample: null, plan: null });
  }

  function applyDemoPreset(preset: DemoPreset) {
    setProjectTitle(preset.projectTitle);
    setSampleTitle(preset.sampleTitle);
    setSampleNotes(preset.sampleNotes);
    setTargetBrief(preset.targetBrief);
    setUserMaterialNotes(preset.userMaterials);
    setActivePresetLabel(preset.label);
    setSampleSourceMode("upload");
    setSampleUrl("");
    setLocalUploadName("");
    setSampleFiles([]);
    setSampleFileInputKey((current) => current + 1);
    resetGeneratedStateForNewInput();
    setStatus({
      type: "success",
      message: `已填入「${preset.label}」演示预设，可直接点击“理解样片”。`,
    });
  }

  const activePlanVersion = useMemo(
    () => plan?.versions[Math.min(activeVersion, plan.versions.length - 1)],
    [activeVersion, plan],
  );
  const activeMigrationRows = useMemo(() => {
    if (!analysis || !plan || !activePlanVersion) return [];
    return buildMigrationMap({ analysis, plan, version: activePlanVersion });
  }, [analysis, plan, activePlanVersion]);
  const activeDirectorTransfer = useMemo(() => {
    if (!analysis || !plan || !activePlanVersion) return null;
    return buildDirectorTransferPlan({
      analysis,
      plan,
      version: activePlanVersion,
    });
  }, [analysis, plan, activePlanVersion]);
  const visibleTechniqueProfile =
    generatedVideo?.techniqueProfile ?? activeDirectorTransfer?.techniqueProfile ?? null;
  const visibleTransferSlots =
    generatedVideo?.transferSlots ?? activeDirectorTransfer?.transferSlots ?? [];
  const visibleMaterialRequirementMatrix =
    generatedVideo?.materialRequirementMatrix ??
    activeDirectorTransfer?.materialRequirementMatrix ??
    [];
  const visibleEditDecisionList = generatedVideo?.editDecisionList ?? [];
  const sampleInputReady = Boolean(
    sampleNotes.trim() ||
      sampleFiles.length ||
      sampleUrl.trim() ||
      localUploadName.trim(),
  );
  const targetBriefReady = targetBrief.trim().length >= 2;
  useEffect(() => {
    if (!showProductionDetails) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setShowProductionDetails(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showProductionDetails]);

  async function refreshPlanHistory(nextProjectId: string) {
    setLoadingPlanHistory(true);
    try {
      const response = await fetch(`/api/projects/${nextProjectId}/plans`);
      const payload = (await response.json()) as PlansListResponse;

      if (!response.ok) {
        setPlanHistory([]);
        return;
      }

      setPlanHistory(payload.plans || []);
    } finally {
      setLoadingPlanHistory(false);
    }
  }

  async function handleLoadPlan(nextProjectId: string, planId: string) {
    setStatus({ type: "loading", message: "正在加载历史版本..." });
    const response = await fetch(
      `/api/projects/${nextProjectId}/plans?planId=${encodeURIComponent(planId)}`,
    );
    const payload = (await response.json()) as PlanLoadResponse;

    if (!response.ok) {
      setStatus({ type: "error", message: payload.error || "加载失败" });
      return;
    }

    setPlan(payload.plan);
    setActivePlanId(payload.planId);
    setActiveVersion(0);
    setEditMode(false);
    setDraftVersion(null);
    setNlEditFeedback(null);
    setNlEditPreview(null);
    setDirectorTuning({ ...defaultDirectorTuning });
    setStatus({
      type: "success",
      message: `已加载：${payload.versionName}`,
    });
  }

  async function handleAnalyze() {
    if (
      !sampleNotes.trim() &&
      !sampleFiles.length &&
      !sampleUrl.trim() &&
      !localUploadName.trim()
    ) {
      setStatus({
        type: "error",
        message: "请至少提供样例视频文件、本地导入视频、样例链接或补充说明。",
      });
      return;
    }

    setStatus({ type: "loading", message: "正在理解样例视频并整理创作手法..." });
    setPlan(null);
    setPlanHistory([]);
    setActivePlanId(null);
    setRefineInstruction("");
    setActiveVersion(0);
    setEditMode(false);
    setDraftVersion(null);
    setNlEditInstruction("");
    setNlEditFeedback(null);
    setNlEditPreview(null);
    setMediaMeta(null);
    setRunMode({ sample: null, plan: null });
    setShowSampleDetails(false);
    setShowProductionDetails(false);
    setShowRenderOptions(false);
    setGeneratedVideo(null);
    setDirectorTuning({ ...defaultDirectorTuning });

    const formData = new FormData();
    formData.append("projectTitle", projectTitle);
    formData.append("sampleTitle", sampleTitle);
    formData.append("sampleUrl", sampleUrl);
    formData.append("localUploadName", localUploadName);
    const sampleNoteBlocks = sampleNotes
      .split(/\n\s*---+\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean);
    const primarySampleNote = sampleNoteBlocks[0] || sampleNotes.trim();
    const extraSampleNotes = sampleNoteBlocks.slice(1).join("\n---\n");
    formData.append(
      "sampleNotes",
      primarySampleNote || "用户上传了样例视频，请结合视频元数据和常见短视频结构进行拆解。",
    );
    formData.append("additionalSampleNotes", extraSampleNotes);
    formData.append("targetBrief", targetBrief);
    for (const file of sampleFiles) {
      formData.append("sampleFiles", file);
    }

    const response = await fetch("/api/analyze-sample", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as AnalyzeResponse;

    if (!response.ok) {
      setStatus({ type: "error", message: payload.error || "样例分析失败" });
      return;
    }

    setProjectId(payload.projectId);
    setAnalysis(payload.analysis);
    setMediaMeta(payload.mediaMeta);
    setRunMode({
      sample: {
        mode: payload.usedFallback
          ? "local"
          : payload.directVideoUsed
            ? "direct-video"
            : "frames",
        frameCount: payload.visionFrameCount ?? 0,
        sampleCount: payload.sourceSampleCount ?? 1,
        note: payload.usedFallback
          ? "已用本地结构规则整理 hook、节奏、字幕和包装线索"
          : payload.directVideoUsed
            ? "已调用兼容模型理解整段视频，并结合时间轴关键帧"
            : "已调用兼容模型理解关键帧，并结合文本观察",
      },
      plan: null,
    });
    setStatus({
      type: payload.usedFallback ? "warning" : "success",
      message: payload.usedFallback
        ? `样例分析完成：已整理 ${payload.sourceSampleCount ?? 1} 条样例的 hook、节奏和包装线索。`
        : payload.directVideoUsed
          ? `样例分析完成：已结合整段视频与 ${payload.visionFrameCount ?? 0} 个时间轴关键帧；样例数 ${payload.sourceSampleCount ?? 1}。`
          : `样例分析完成：已结合 ${payload.visionFrameCount ?? 0} 个时间轴关键帧；样例数 ${payload.sourceSampleCount ?? 1}。`,
    });
    void refreshPlanHistory(payload.projectId);
  }

  async function handleSaveEditedPlan() {
    if (!projectId || !plan || !draftVersion) return;

    const nextPlan: MigratedVideoPlan = {
      ...plan,
      versions: plan.versions.map((version, index) =>
        index === activeVersion ? draftVersion : version,
      ),
    };

    setSavingPlan(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/save-plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: nextPlan,
          note: `edit-${draftVersion.versionName}`,
        }),
      });
      const data = (await response.json()) as {
        projectId: string;
        planId?: string;
        plan?: MigratedVideoPlan;
        markdown?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "保存失败");
      }

      if (data.plan) setPlan(data.plan);
      if (data.planId) setActivePlanId(data.planId);
      setEditMode(false);
      setDraftVersion(null);
      await refreshPlanHistory(data.projectId);
      setStatus({ type: "success", message: "已保存编辑稿，可直接导出。" });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "保存失败",
      });
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleApplyDirectorTuning() {
    if (!plan || !activePlanVersion) {
      setStatus({ type: "error", message: "请先生成方案后再应用导演参数。" });
      return;
    }

    const tunedBase = buildDirectorTunedVersion(activePlanVersion, directorTuning);
    const tunedVersion: PlanVersion = {
      ...tunedBase,
      versionName: uniqueVersionName(tunedBase.versionName, plan.versions),
    };
    const activeScore =
      plan.evaluation?.versionScores.find(
        (item) => item.versionName === activePlanVersion.versionName,
      )?.score ??
      plan.evaluation?.overallScore ??
      plan.awardReadiness?.overallScore ??
      78;
    const tunedScore = clampPercent(activeScore + (directorTuning.preset === "premium" ? 1 : 2));
    const nextPlan: MigratedVideoPlan = {
      ...plan,
      versions: [tunedVersion, ...plan.versions],
      evaluation: plan.evaluation
        ? {
            ...plan.evaluation,
            bestVersion: tunedVersion.versionName,
            versionScores: [
              {
                versionName: tunedVersion.versionName,
                score: tunedScore,
                rationale: `${directorPresetLabel(directorTuning.preset)}导演参数已应用：Hook ${directorTuning.hookStrength}，字幕 ${directorTuning.subtitleDensity}，节奏 ${directorTuning.pacing}，CTA ${directorTuning.ctaStrength}。`,
              },
              ...plan.evaluation.versionScores,
            ],
          }
        : plan.evaluation,
    };

    setApplyingDirectorTuning(true);
    setStatus({
      type: "loading",
      message: `正在生成「${tunedVersion.versionName}」导演参数版...`,
    });

    try {
      if (!projectId) {
        setPlan(nextPlan);
        setActiveVersion(0);
        setGeneratedVideo(null);
        setEditMode(false);
        setDraftVersion(null);
        setStatus({
          type: "success",
          message: `已应用导演参数：${tunedVersion.versionName}。`,
        });
        return;
      }

      const response = await fetch(`/api/projects/${projectId}/save-plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: nextPlan,
          note: `director-${directorPresetLabel(directorTuning.preset)}`,
        }),
      });
      const data = (await response.json()) as {
        projectId: string;
        planId?: string;
        plan?: MigratedVideoPlan;
        markdown?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "导演参数保存失败");
      }

      setPlan(data.plan ?? nextPlan);
      if (data.planId) setActivePlanId(data.planId);
      setActiveVersion(0);
      setGeneratedVideo(null);
      setEditMode(false);
      setDraftVersion(null);
      setNlEditFeedback(null);
      setNlEditPreview(null);
      await refreshPlanHistory(data.projectId);
      setStatus({
        type: "success",
        message: `已保存导演参数版：${tunedVersion.versionName}，预览和导出已同步。`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "导演参数保存失败",
      });
    } finally {
      setApplyingDirectorTuning(false);
    }
  }

  async function handleNlEditAction(mode: "preview" | "apply") {
    if (!projectId || !plan) {
      setStatus({ type: "error", message: "请先生成方案后再编辑。" });
      return;
    }
    if (!nlEditInstruction.trim()) {
      setStatus({ type: "error", message: "请输入自然语言编辑指令。" });
      return;
    }

    setNlEditApplying(true);
    setStatus({
      type: "loading",
      message: mode === "preview" ? "正在预览自然语言编辑效果..." : "正在应用自然语言编辑到当前方案...",
    });
    try {
      const response = await fetch(`/api/projects/${projectId}/nl-edit-plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instruction: nlEditInstruction,
          planId: mode === "apply" && nlEditPreview?.sourcePlanId ? nlEditPreview.sourcePlanId : activePlanId,
          note: `nl-${activePlanVersion?.versionName ?? "plan"}`,
          dryRun: mode === "preview",
          basePlanId: mode === "apply" && nlEditPreview?.sourcePlanId ? nlEditPreview.sourcePlanId : null,
        }),
      });
      const data = (await response.json()) as {
        projectId: string;
        planId?: string;
        sourcePlanId?: string;
        plan?: MigratedVideoPlan;
        markdown?: string;
        applied?: string[];
        warnings?: string[];
        diff?: ReturnType<typeof diffPlans>;
        dryRun?: boolean;
        expectedBasePlanId?: string;
        actualBasePlanId?: string;
        error?: string;
      };

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error("基线版本已变化，请先重新点一次“预览”。");
        }
        throw new Error(data.error || "自然语言编辑失败");
      }

      if (mode === "preview") {
        if (data.plan) {
          setNlEditPreview({
            plan: data.plan,
            applied: data.applied ?? [],
            warnings: data.warnings ?? [],
            diff: data.diff ?? [],
            sourcePlanId: data.sourcePlanId ?? null,
          });
        }
        setStatus({
          type: (data.warnings?.length ?? 0) ? "warning" : "success",
          message: `预览完成：应用 ${data.applied?.length ?? 0} 条，提示 ${data.warnings?.length ?? 0} 条。`,
        });
        return;
      }

      if (data.plan) setPlan(data.plan);
      if (data.planId) setActivePlanId(data.planId);
      setEditMode(false);
      setDraftVersion(null);
      setNlEditFeedback({
        applied: data.applied ?? [],
        warnings: data.warnings ?? [],
      });
      setNlEditPreview(null);
      await refreshPlanHistory(data.projectId);
      setStatus({
        type: (data.warnings?.length ?? 0) ? "warning" : "success",
        message: `已保存自然语言编辑稿：应用 ${data.applied?.length ?? 0} 条，提示 ${data.warnings?.length ?? 0} 条。`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "自然语言编辑失败",
      });
    } finally {
      setNlEditApplying(false);
    }
  }

  async function handleGeneratePlan() {
    if (!projectId || !analysis) {
      setStatus({ type: "error", message: "请先完成样例分析。" });
      return;
    }
    if (!targetBrief.trim()) {
      setStatus({ type: "error", message: "请输入要创作的新主题或商品信息。" });
      return;
    }
    if (targetBrief.trim().length < 2) {
      setStatus({ type: "error", message: "请至少写清主题或商品名称，比如“卖咖啡”。" });
      return;
    }

    setStatus({
      type: "loading",
      message: "正在生成多版本新片方案...",
    });
    const materialNotes = [
      userMaterialNotes.trim(),
      extractInlineMaterialNotes(targetBrief),
    ]
      .filter(Boolean)
      .join("\n");
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("targetBrief", targetBrief);
    formData.append("userMaterials", materialNotes);
    formData.append("direction", "生成可编辑方案脚本，并保留视频时间线扩展空间");
    for (const file of userMaterialFiles) {
      formData.append("userMaterialFiles", file);
    }

    const response = await fetch("/api/generate-plan", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as PlanResponse;

    if (!response.ok) {
      setStatus({ type: "error", message: payload.error || "新片方案生成失败" });
      return;
    }

    setPlan(payload.plan);
    setActivePlanId(payload.planId || null);
    setActiveVersion(0);
    setEditMode(false);
    setDraftVersion(null);
    setNlEditFeedback(null);
    setNlEditPreview(null);
    setDirectorTuning({ ...defaultDirectorTuning });
    setShowProductionDetails(false);
    setShowRenderOptions(false);
    setGeneratedVideo(null);
    setRunMode((current) => ({
      ...current,
      plan: {
        mode: payload.usedFallback ? "local" : "model",
        note: payload.usedFallback
          ? "模型不可用或超时，已用本地创作策略生成可编辑脚本。"
          : "已调用兼容文本模型，把样例手法转化为多版本脚本。",
      },
    }));
    setStatus({
      type: payload.usedFallback ? "warning" : "success",
      message: "新片方案已生成，可编辑、预览并导出。",
    });
    void refreshPlanHistory(payload.projectId);
  }

  async function handleRefinePlan() {
    if (!projectId || !plan) {
      setStatus({ type: "error", message: "请先生成新片方案。" });
      return;
    }
    if (!refineInstruction.trim()) {
      setStatus({ type: "error", message: "请输入修改指令。" });
      return;
    }

    setStatus({
      type: "loading",
      message: "正在按你的指令修订方案...",
    });
    const response = await fetch("/api/refine-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        instruction: refineInstruction,
      }),
    });
    const payload = (await response.json()) as PlanResponse;

    if (!response.ok) {
      setStatus({ type: "error", message: payload.error || "方案修订失败" });
      return;
    }

    setPlan(payload.plan);
    setActivePlanId(payload.planId || null);
    setActiveVersion(0);
    setEditMode(false);
    setDraftVersion(null);
    setNlEditFeedback(null);
    setNlEditPreview(null);
    setDirectorTuning({ ...defaultDirectorTuning });
    await refreshPlanHistory(payload.projectId);
    setStatus({
      type: payload.usedFallback ? "warning" : "success",
      message: "已按你的自然语言指令更新方案。",
    });
  }

  async function handleRenderPreset(
    preset: "draft" | "high" | "high-quality" | "technique",
  ) {
    if (!projectId) return;

    const meta = {
      draft: {
        loading: "正在生成快速预览...",
        title: "快速预览",
        note: "用于快速检查节奏、字幕和画面层级。",
        body: { quality: "draft" },
      },
      high: {
        loading: "正在生成清晰成片...",
        title: "清晰成片",
        note: "适合用于演示、汇报和提交素材。",
        body: { quality: "high" },
      },
      "high-quality": {
        loading: "正在渲染高质量有声视频...",
        title: "高质量有声成片",
        note: "带自动音频策略，适合最终展示。",
        body: { quality: "high", mode: "high-quality" },
      },
      technique: {
        loading: "正在渲染说明片...",
        title: "结构说明片",
        note: "用于解释样例手法如何迁移到新内容。",
        body: { quality: "high", mode: "technique" },
      },
    }[preset];

    setRenderingVideo(true);
    setStatus({ type: "loading", message: meta.loading });
    try {
      const response = await fetch(`/api/projects/${projectId}/render`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId: activePlanId,
          title: projectTitle,
          ...meta.body,
        }),
      });
      const data = (await response.json()) as {
        downloadUrl?: string;
        previewUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.downloadUrl) {
        throw new Error(data.error || "渲染失败");
      }
      setGeneratedVideo({
        title: meta.title,
        url: data.previewUrl || data.downloadUrl,
        note: meta.note,
        createdAt: new Date().toLocaleTimeString(),
      });
      setStatus({ type: "success", message: `${meta.title}已生成，可在成片预览中查看。` });
    } catch {
      setStatus({
        type: "error",
        message: "视频生成失败，请稍后重试或先导出方案。",
      });
    } finally {
      setRenderingVideo(false);
    }
  }

  async function handleGenerateFullVideo() {
    if (!projectId) return;

    const resumeOutputBaseName =
      generatedVideo?.retryable && generatedVideo.outputBaseName
        ? generatedVideo.outputBaseName
        : null;

    setRenderingVideo(true);
    setStatus({
      type: "loading",
      message: resumeOutputBaseName
        ? "正在继续生成剩余分段..."
        : fullVideoPackagingMode === "smart"
          ? "正在生成成片：复用真实素材，缺口用视频模型补齐，并加入智能包装..."
          : fullVideoPackagingMode === "clean"
            ? "正在生成干净成片：复用真实素材，缺口用视频模型补齐..."
            : "正在生成大片精剪：按样片镜头语言剪素材，缺口用视频模型补齐...",
    });
    try {
      const response = await fetch(`/api/projects/${projectId}/generate-video`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId: activePlanId,
          versionIndex: activeVersion,
          beatIndex: 0,
          mode: "full-video",
          audioMode: "natural-sfx",
          packagingMode: fullVideoPackagingMode,
          resumeOutputBaseName,
        }),
      });
      const data = (await response.json()) as VideoGenerateResponse;
      if (!data.downloaded && (data.generationStatus === "processing" || data.retryable)) {
        const completed = data.completedSegments ?? data.segments?.filter((segment) => segment.downloaded).length ?? 0;
        const total = data.totalSegments ?? data.adaptiveTransfer?.targetBeatCount ?? data.segments?.length ?? 0;
        const progressText = total > 0 ? `进度 ${completed}/${total} 段` : "进度已保存";
        const missing = data.missingSegments?.length
          ? `剩余：${data.missingSegments.map((segment) => `第${segment.order}段`).join("、")}`
          : "剩余分段等待生成";

        setGeneratedVideo({
          title: "成片生成中",
          url: null,
          note: `${progressText}，${missing}。再次点击会从这里继续。`,
          createdAt: new Date().toLocaleTimeString(),
          status: "processing",
          retryable: true,
          outputBaseName: data.outputBaseName ?? resumeOutputBaseName,
          progressText,
          renderStrategy: data.renderStrategy,
          techniqueProfile: data.techniqueProfile,
          transferSlots: data.transferSlots,
          materialRequirementMatrix: data.materialRequirementMatrix,
          cinematicEditPlan: data.cinematicEditPlan ?? data.renderStrategy?.cinematicEditPlan ?? null,
          editDecisionList: data.editDecisionList,
        });
        setStatus({
          type: "warning",
          message: data.error || "生成视频模型仍在处理，已保存进度，可继续生成。",
        });
        return;
      }

      if (!response.ok || !data.downloaded) {
        const missing = data.missingSegments?.length
          ? ` 未完成分段：${data.missingSegments
              .map((segment) => `${segment.order}-${segment.role}${segment.status ? `(${segment.status})` : ""}`)
              .join("、")}`
          : "";
        throw new Error(`${data.error || "完整视频生成失败"}${missing}`);
      }
      const outputUrl = data.localVideoUrl || data.videoUrl || null;
      const duration =
        data.renderStrategy?.targetDurationSeconds ?? data.adaptiveTransfer?.targetDurationSeconds;
      const reused = data.renderStrategy?.reusedMaterialSegmentCount ?? 0;
      const aigc = data.renderStrategy?.aigcSegmentCount ?? data.segments?.length ?? 0;
      const packagingLabel = videoPackagingLabel(data.packaging);
      const isCleanPackaging =
        data.packaging?.mode === "clean" ||
        (data.packaging ? !data.packaging.subtitles && !data.packaging.audio : false);
      const packagingNote = isCleanPackaging
        ? "，干净成片无烧录字幕"
        : packagingLabel
          ? `，${packagingLabel}已完成`
          : "";
      const resultTitle =
        data.packaging?.mode === "cinematic"
          ? "大片精剪成片"
          : reused
            ? "素材混合成片"
            : "AI生成成片";
      setGeneratedVideo({
        title: resultTitle,
        url: outputUrl,
        note: reused
          ? `已按样片导演手法剪入真实素材 ${reused} 段，AI 补齐 ${aigc} 段并自动拼接${
              duration ? `，目标约 ${duration} 秒` : ""
            }${packagingNote}。`
          : `由生成视频模型按当前目标内容和样片导演手法生成 ${aigc} 段并自动拼接${
              duration ? `，目标约 ${duration} 秒` : ""
            }${packagingNote}。`,
        createdAt: new Date().toLocaleTimeString(),
        status: "completed",
        retryable: false,
        outputBaseName: data.outputBaseName ?? null,
        progressText: data.totalSegments ? `完成 ${data.totalSegments}/${data.totalSegments} 段` : undefined,
        packaging: data.packaging,
        renderStrategy: data.renderStrategy,
        techniqueProfile: data.techniqueProfile,
        transferSlots: data.transferSlots,
        materialRequirementMatrix: data.materialRequirementMatrix,
        cinematicEditPlan: data.cinematicEditPlan ?? data.renderStrategy?.cinematicEditPlan ?? null,
        editDecisionList: data.editDecisionList,
      });
      setStatus({
        type: "success",
        message: reused
          ? "素材混合成片已完成，可在成片预览中查看。"
          : "AI生成视频已完成，可在成片预览中查看。",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "完整视频生成失败。",
      });
    } finally {
      setRenderingVideo(false);
    }
  }

  return (
    <main className="studio-shell min-h-screen">
      <header className="studio-topbar">
        <div className="studio-topbar-inner">
          <div className="studio-brand">
            <div className="studio-logo">
              <Video className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="studio-kicker">Viral Director Studio</p>
              <h1>爆款结构迁移引擎</h1>
            </div>
          </div>

          <div className="studio-actions">
            <Badge variant={plan ? "success" : analysis ? "secondary" : "outline"}>
              {plan ? "可预览" : analysis ? "已分析" : "准备输入"}
            </Badge>
          </div>
        </div>
      </header>

      <section className="studio-statusbar is-compact">
        <div className={`studio-status-message is-${status.type}`}>
          <span className="[&_svg]:size-4">{statusIcon(status.type)}</span>
          <span>{status.message}</span>
        </div>
      </section>

      <StudioOverviewPanel
        analysis={analysis}
        plan={plan}
        activeVersion={activePlanVersion}
        rows={activeMigrationRows}
        generatedVideo={generatedVideo}
        renderingVideo={renderingVideo}
        mediaMeta={mediaMeta}
        sampleInputReady={sampleInputReady}
        targetBriefReady={targetBriefReady}
        materialFileCount={userMaterialFiles.length}
        status={status}
        onAnalyze={() => void handleAnalyze()}
        onGeneratePlan={() => void handleGeneratePlan()}
        onRender={() => void handleGenerateFullVideo()}
        onOpenWorkbench={() => setShowProductionDetails(true)}
      />

      <section className="workspace-grid studio-workspace">
        <div className="control-rail space-y-4">
          <DemoPresetPanel
            activeLabel={activePresetLabel}
            onApply={applyDemoPreset}
          />

          <Card className="studio-reference-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="size-4 text-primary" />
                参考样片
              </CardTitle>
              <CardDescription>视频 / 链接 / 多样例</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 rounded-lg border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>参考来源</Label>
                  <Badge variant="outline">可多选</Badge>
                </div>

                <div className="studio-source-switch" role="tablist" aria-label="参考来源">
                  {[
                    ["upload", "上传视频"],
                    ["url", "粘贴链接"],
                    ["library", "素材库"],
                  ].map(([mode, label]) => (
                    <button
                      aria-selected={sampleSourceMode === mode}
                      className={sampleSourceMode === mode ? "is-active" : ""}
                      key={mode}
                      onClick={() => handleSampleSourceModeChange(mode as SampleSourceMode)}
                      role="tab"
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {sampleSourceMode === "upload" ? (
                  <div className="space-y-2">
                    <Input
                      aria-label="样例视频文件"
                      id="sampleFile"
                      key={`sample-file-${sampleFileInputKey}`}
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={(event) => {
                        setSampleFiles(Array.from(event.target.files || []));
                        setLocalUploadName("");
                        setSampleUrl("");
                        setActivePresetLabel(null);
                      }}
                    />
                    {sampleFiles.length ? (
                      <div className="studio-selected-file">
                        <Video className="size-4 text-primary" />
                        <span>
                          {sampleFiles.length} 个视频
                          {sampleFiles[0] ? `：${sampleFiles[0].name}` : ""}
                          {sampleFiles.length > 1 ? " 等" : ""}
                        </span>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setSampleFiles([]);
                            setSampleFileInputKey((current) => current + 1);
                          }}
                        >
                          清除
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">首个视频作为主样例</p>
                    )}
                  </div>
                ) : null}

                {sampleSourceMode === "url" ? (
                  <Input
                    aria-label="样例链接"
                    id="sampleUrl"
                    placeholder="https://..."
                    value={sampleUrl}
                    onChange={(event) => {
                      setSampleUrl(event.target.value);
                      setSampleFiles([]);
                      setLocalUploadName("");
                      setActivePresetLabel(null);
                    }}
                  />
                ) : null}

                {sampleSourceMode === "library" ? (
                  <div className="studio-library-row">
                    <select
                      aria-label="从素材库选择样例"
                      id="localUploadName"
                      className="studio-library-select"
                      value={localUploadName}
                      onFocus={() => {
                        if (availableUploads.length === 0) void loadUploads();
                      }}
                      onChange={(event) => {
                        setLocalUploadName(event.target.value);
                        setSampleFiles([]);
                        setSampleFileInputKey((current) => current + 1);
                        setSampleUrl("");
                        setActivePresetLabel(null);
                      }}
                    >
                      <option value="">选择已导入的视频</option>
                      {availableUploads.map((file) => (
                        <option key={file.name} value={file.name}>
                          {file.name} ({(file.sizeBytes / 1024 / 1024).toFixed(1)} MB)
                        </option>
                      ))}
                    </select>
                    <Button onClick={loadUploads} size="sm" type="button" variant="outline">
                      刷新
                    </Button>
                    {localUploadName ? (
                      <div className="studio-selected-file is-library">
                        <Database className="size-4 text-primary" />
                        <span>{localUploadName}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sampleNotes">补充观察（可选）</Label>
                <Textarea
                  id="sampleNotes"
                  placeholder={samplePlaceholder}
                  value={sampleNotes}
                  onChange={(event) => {
                    setSampleNotes(event.target.value);
                    setActivePresetLabel(null);
                  }}
                  rows={3}
                />
              </div>
              <Button className="w-full" onClick={handleAnalyze}>
                {status.type === "loading" ? <Loader2 className="animate-spin" /> : <ClipboardList />}
                理解样片
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" />
                新片需求与素材
              </CardTitle>
              <CardDescription>主题 / 卖点 / 素材</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  id="targetBrief"
                  placeholder={briefPlaceholder}
                  value={targetBrief}
                  onChange={(event) => {
                    setTargetBrief(event.target.value);
                    setActivePresetLabel(null);
                  }}
                  className="min-h-[112px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="userMaterialNotes">素材说明</Label>
                <Textarea
                  id="userMaterialNotes"
                  placeholder="例：已有产品图、操作录屏、用户评价截图；缺少真人出镜和 CTA 入口。"
                  value={userMaterialNotes}
                  onChange={(event) => {
                    setUserMaterialNotes(event.target.value);
                    setActivePresetLabel(null);
                  }}
                  rows={3}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  这里会进入素材体检、槽位匹配和 AIGC 补镜策略；比只写在 Brief 里更稳定。
                </p>
              </div>

              <div className="space-y-3 rounded-lg border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="userMaterialFiles">素材文件</Label>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">图片</Badge>
                    <Badge variant="outline">视频</Badge>
                    <Badge variant="outline">文案</Badge>
                  </div>
                </div>
                <Input
                  aria-label="用户素材文件"
                  id="userMaterialFiles"
                  type="file"
                  multiple
                  accept="image/*,video/*,.txt,.md,.pdf,.doc,.docx"
                  onChange={(event) => setUserMaterialFiles(Array.from(event.target.files || []))}
                />
                {userMaterialFiles.length ? (
                  <div className="grid gap-2">
                    {userMaterialFiles.slice(0, 6).map((file, index) => {
                      const kind = materialFileKind(file);
                      const Icon = kind.icon;
                      return (
                        <div
                          className="flex min-w-0 items-center justify-between gap-3 rounded-md border bg-white px-3 py-2"
                          key={`${file.name}-${file.size}-${index}`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Icon className="size-4 shrink-0 text-primary" />
                            <span className="truncate text-xs font-medium text-foreground">
                              {file.name}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant="secondary">{kind.label}</Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {formatFileSize(file.size)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {userMaterialFiles.length > 6 ? (
                      <p className="text-xs text-muted-foreground">
                        另有 {userMaterialFiles.length - 6} 个素材文件会一起参与剪辑。
                      </p>
                    ) : null}
                    <p className="text-xs leading-5 text-muted-foreground">
                      图片组会做轻运动与裁切，视频组会按开头、过程、证明等槽位截取成 9:16 时间线。
                    </p>
                  </div>
                ) : (
                  <p className="text-xs leading-5 text-muted-foreground">
                    可选：图片组、视频组或文案文件；上传后会优先用真实素材剪辑，缺口再用生成模型补齐。
                  </p>
                )}
              </div>
              <Button
                className="w-full"
                disabled={!analysis || status.type === "loading"}
                onClick={handleGeneratePlan}
                variant="secondary"
              >
                {status.type === "loading" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                生成新片方案
              </Button>
            </CardContent>
          </Card>

          {projectId && !simpleMode ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="size-4 text-primary" />
                  历史版本
                </CardTitle>
                <CardDescription>
                  选择一个历史稿即可回滚到当时的方案；导出按钮会导出当前选中的版本。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    disabled={loadingPlanHistory}
                    onClick={() => refreshPlanHistory(projectId)}
                    size="sm"
                    variant="outline"
                    type="button"
                  >
                    <RefreshCw />
                    刷新
                  </Button>
                  <Badge variant={activePlanId ? "secondary" : "outline"}>
                    {activePlanId ? "已选历史稿" : "默认最新稿"}
                  </Badge>
                </div>

                {planHistory.length === 0 ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    暂无历史版本；生成方案 / 修订 / 保存编辑稿后会自动入库。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {planHistory.slice(0, 8).map((item) => (
                      <Button
                        key={item.id}
                        onClick={() => handleLoadPlan(projectId, item.id)}
                        size="sm"
                        type="button"
                        variant={item.id === activePlanId ? "default" : "outline"}
                        className="h-auto w-full justify-start gap-2 whitespace-normal px-3 py-2 text-left"
                        title={item.versionName}
                      >
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {item.versionName}
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {!simpleMode ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PencilLine className="size-4 text-primary" />
                  自然语言编辑
                </CardTitle>
                <CardDescription>用一句话提需求，生成一个“改动后的新版本”并自动入库。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  disabled={!plan}
                  placeholder="例如：把开头改成“先给结果再解释”，并把证据写得更可信（数据/对比/用户反馈）。"
                  value={refineInstruction}
                  onChange={(event) => setRefineInstruction(event.target.value)}
                />
                <Button
                  className="w-full"
                  disabled={!plan || status.type === "loading"}
                  onClick={handleRefinePlan}
                  type="button"
                  variant="outline"
                >
                  {status.type === "loading" ? <Loader2 className="animate-spin" /> : <PencilLine />}
                  应用修改
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="result-rail space-y-4">
          <section className="studio-preview-stage" aria-label="成片预览">
            <OutputPreviewPanel
              generatedVideo={generatedVideo}
              renderingVideo={renderingVideo}
              showMore={showRenderOptions}
              disabled={!plan || renderingVideo || status.type === "loading"}
              fullVideoPackagingMode={fullVideoPackagingMode}
              onQuickPreview={() => void handleRenderPreset("draft")}
              onFullVideo={() => void handleGenerateFullVideo()}
              onHighRender={() => void handleRenderPreset("high")}
              onHighAudio={() => void handleRenderPreset("high-quality")}
              onTechnique={() => void handleRenderPreset("technique")}
              onOpenWorkbench={() => setShowProductionDetails(true)}
              onExportMd={() => {
                if (projectId) downloadExport(projectId, "md", activePlanId);
              }}
              onExportJson={() => {
                if (projectId) downloadExport(projectId, "json", activePlanId);
              }}
              onPackagingModeChange={setFullVideoPackagingMode}
              onToggleMore={() => setShowRenderOptions(!showRenderOptions)}
              canOpenWorkbench={Boolean(plan && activePlanVersion)}
            />
          </section>

          {analysis && plan && activePlanVersion ? (
            <DirectorTuningPanel
              tuning={directorTuning}
              activeVersion={activePlanVersion}
              disabled={applyingDirectorTuning || status.type === "loading"}
              applying={applyingDirectorTuning}
              onChange={setDirectorTuning}
              onApply={() => void handleApplyDirectorTuning()}
            />
          ) : null}

          {analysis && plan && activePlanVersion ? (
            <DirectorPreviewPanel
              analysis={analysis}
              plan={plan}
              activeVersion={activePlanVersion}
              rows={activeMigrationRows}
              renderingVideo={renderingVideo}
              generatedVideo={generatedVideo}
              onOpenWorkbench={() => setShowProductionDetails(true)}
              onRender={() => void handleGenerateFullVideo()}
            />
          ) : null}

          {analysis && plan && activePlanVersion ? (
            <TransferProofPanel
              analysis={analysis}
              plan={plan}
              activeVersion={activePlanVersion}
              rows={activeMigrationRows}
              directorTransfer={activeDirectorTransfer}
              onOpenWorkbench={() => setShowProductionDetails(true)}
            />
          ) : null}

          {analysis && plan && activePlanVersion ? (
            <MaterialIntelligencePanel
              adaptation={plan.materialAdaptation}
              rows={activeMigrationRows}
              onOpenWorkbench={() => setShowProductionDetails(true)}
            />
          ) : null}

          {analysis && plan && activePlanVersion ? (
            <AigcGapFillPanel
              adaptation={plan.materialAdaptation}
              rows={activeMigrationRows}
              plan={plan}
              activeVersion={activePlanVersion}
              onOpenWorkbench={() => setShowProductionDetails(true)}
            />
          ) : null}

          {analysis && plan && activePlanVersion ? (
            <TimelineExchangePanel
              analysis={analysis}
              plan={plan}
              activeVersion={activePlanVersion}
              rows={activeMigrationRows}
              onOpenWorkbench={() => setShowProductionDetails(true)}
            />
          ) : null}

          {analysis && plan && activePlanVersion ? (
            <JudgeReadinessPanel
              analysis={analysis}
              plan={plan}
              activeVersion={activePlanVersion}
              generatedVideo={generatedVideo}
            />
          ) : null}

          {analysis && plan && activePlanVersion ? (
            <SubmissionBundlePanel
              analysis={analysis}
              plan={plan}
              activeVersion={activePlanVersion}
              rows={activeMigrationRows}
              generatedVideo={generatedVideo}
              renderingVideo={renderingVideo}
              onExportMd={() => {
                if (projectId) downloadExport(projectId, "md", activePlanId);
              }}
              onExportJson={() => {
                if (projectId) downloadExport(projectId, "json", activePlanId);
              }}
              onRender={() => void handleGenerateFullVideo()}
            />
          ) : null}

          {analysis ? (
          <Card className="studio-compact-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="size-4 text-primary" />
                样片手法
              </CardTitle>
              <CardDescription>镜头、节奏和包装已提炼</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                  {plan ? (
                    <SampleCompactRecap
                      analysis={analysis}
                      mediaMeta={mediaMeta}
                      onDetails={() => setShowSampleDetails(!showSampleDetails)}
                    />
                  ) : (
                    <MiniSampleInsight
                      analysis={analysis}
                      mediaMeta={mediaMeta}
                      showAll={showAllSampleBeats}
                      onToggleAll={() => setShowAllSampleBeats(!showAllSampleBeats)}
                    />
                  )}

                  <div className="studio-fold">
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => setShowSampleDetails(!showSampleDetails)}
                    >
                      {showSampleDetails ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
                      {showSampleDetails ? "收起细节" : "查看细节"}
                    </Button>

                    {showSampleDetails ? (
                      <div className="studio-fold-panel mt-3 space-y-4">
                        <SampleBasicsPanel analysis={analysis} mediaMeta={mediaMeta} runMode={runMode} />
                        <StructureFingerprintPanel analysis={analysis} />
                        {!simpleMode ? <RunModePanel runMode={runMode} /> : null}
                        <div className="space-y-3">
                          {analysis.beatMap.map((beat) => (
                            <div className="timeline-row rounded-lg border bg-background/70 p-4" key={beat.timeRange}>
                              <div>
                                <Badge variant="outline">{beat.timeRange}</Badge>
                                <p className="mt-2 text-xs font-medium text-muted-foreground">
                                  {beat.shotPurpose}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium">{beat.transferableRule}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  {beat.visualObservation}；{beat.captionObservation}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
            </CardContent>
          </Card>
          ) : null}

          {plan && activePlanVersion ? (
          <Card className="studio-compact-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                剪辑方案
              </CardTitle>
              <CardDescription>版本、素材和时间线</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                  <VersionChoiceCards
                    plan={plan}
                    activeVersion={activeVersion}
                    onChange={setActiveVersion}
                  />

                  <ActiveVersionSummary
                    version={activePlanVersion}
                    rows={activeMigrationRows}
                  />

                  <MaterialGapSnapshot adaptation={plan.materialAdaptation} />

                  <div className="studio-plan-actions">
                    <Button
                      variant={editMode ? "secondary" : "outline"}
                      size="sm"
                      type="button"
                      onClick={() => {
                        if (!editMode) setDraftVersion(activePlanVersion);
                        if (editMode) setDraftVersion(null);
                        setEditMode(!editMode);
                      }}
                    >
                      <PencilLine className="size-4" />
                      {editMode ? "退出精修" : "精修时间线"}
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => setShowProductionDetails(true)}
                    >
                      <ArrowDown className="size-4" />
                      打开制作台
                    </Button>
                  </div>

                  {editMode && draftVersion ? (
                    <EditableVersionPanel
                      version={draftVersion}
                      onChange={setDraftVersion}
                      onCancel={() => {
                        setEditMode(false);
                        setDraftVersion(null);
                      }}
                      onSave={handleSaveEditedPlan}
                      saving={savingPlan}
                    />
                  ) : null}

                  {showProductionDetails ? (
                    <div
                      className="studio-workbench-overlay"
                      role="presentation"
                      onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                          setShowProductionDetails(false);
                        }
                      }}
                    >
                      <section
                        aria-labelledby="studio-workbench-title"
                        aria-modal="true"
                        className="studio-workbench-dialog"
                        role="dialog"
                        tabIndex={-1}
                      >
                        <div className="studio-workbench-header">
                          <div className="min-w-0">
                            <Badge variant="secondary">制作台</Badge>
                            <h2 id="studio-workbench-title">高级制作台</h2>
                            <p>分镜、时间线、素材诊断和微调都在这里完成，主页面保持干净。</p>
                          </div>
                          <Button
                            aria-label="关闭制作台"
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => setShowProductionDetails(false)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>

                        <div className="studio-workbench-scroll space-y-4">
                          <div className="rounded-lg border bg-accent/40 p-4">
                        <p className="text-sm font-medium text-accent-foreground">
                          {plan.strategySummary}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          保留：{plan.inheritedStructure.join(" / ")}
                        </p>
                      </div>

                      <div className="space-y-3 rounded-lg border bg-background p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">一句话调整</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              例如：开头更抓人、减少字幕、把商品信息提前。
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleNlEditAction("preview")}
                              disabled={nlEditApplying || !nlEditInstruction.trim()}
                            >
                              {nlEditApplying ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <BarChart3 className="size-4" />
                              )}
                              预览
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleNlEditAction("apply")}
                              disabled={nlEditApplying || !nlEditInstruction.trim()}
                            >
                              {nlEditApplying ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <PencilLine className="size-4" />
                              )}
                              保存
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          value={nlEditInstruction}
                          onChange={(event) => setNlEditInstruction(event.target.value)}
                          placeholder="开头更抓人一些；减少字幕；把商品信息提前"
                          className="min-h-[84px]"
                        />
                        {nlEditPreview ? (
                          <div className="rounded-lg border bg-accent/20 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-foreground">预览结果</p>
                              <Button type="button" size="sm" variant="outline" onClick={() => setNlEditPreview(null)}>
                                关闭
                              </Button>
                            </div>
                            <div className="mt-2 grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-xs font-semibold text-foreground">将应用</p>
                                <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                                  {(nlEditPreview.applied.length ? nlEditPreview.applied : ["（无）"]).map(
                                    (item, index) => (
                                      <li key={`preview-applied-${index}`}>{item}</li>
                                    ),
                                  )}
                                </ul>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-foreground">提示</p>
                                <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                                  {(nlEditPreview.warnings.length ? nlEditPreview.warnings : ["（无）"]).map(
                                    (item, index) => (
                                      <li key={`preview-warning-${index}`}>{item}</li>
                                    ),
                                  )}
                                </ul>
                              </div>
                            </div>
                          </div>
                        ) : null}
                        {nlEditFeedback ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg border bg-accent/30 p-3">
                              <p className="text-xs font-semibold text-foreground">已应用</p>
                              <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                                {(nlEditFeedback.applied.length
                                  ? nlEditFeedback.applied
                                  : ["（无）"]
                                ).map((item, index) => (
                                  <li key={`applied-${index}`}>{item}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="rounded-lg border bg-accent/30 p-3">
                              <p className="text-xs font-semibold text-foreground">提示</p>
                              <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                                {(nlEditFeedback.warnings.length
                                  ? nlEditFeedback.warnings
                                  : ["（无）"]
                                ).map((item, index) => (
                                  <li key={`warning-${index}`}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <EditingTechniquePanel techniques={plan.retrievedTechniques} />
                      <FunctionFlowPanel analysis={analysis} plan={plan} />
                      <DirectorTransferPanel
                        techniqueProfile={visibleTechniqueProfile}
                        transferSlots={visibleTransferSlots}
                        materialRequirementMatrix={visibleMaterialRequirementMatrix}
                        editDecisionList={visibleEditDecisionList}
                      />
                      {plan.materialAdaptation ? (
                        <MaterialAdaptationPanel adaptation={plan.materialAdaptation} />
                      ) : null}
                      <StoryboardPreview
                        version={activePlanVersion}
                        rows={activeMigrationRows}
                      />
                      <TimelineOverview rows={activeMigrationRows} />
                      {!simpleMode && analysis ? (
                        <MigrationMappingPanel
                          analysis={analysis}
                          plan={plan}
                          version={activePlanVersion}
                        />
                      ) : null}
                      <VersionTimeline version={activePlanVersion} />
                        </div>
                      </section>
                    </div>
                  ) : null}
                </div>
            </CardContent>
          </Card>
          ) : null}
        </div>
      </section>
    </main>
  );
}
