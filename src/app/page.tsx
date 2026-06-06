"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ClipboardList,
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
  Upload,
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
import {
  buildContestRequirementCoverage,
  type ContestRequirementCoverageReport,
} from "@/lib/requirement-coverage";
import { buildStoryboardFrames, type StoryboardFrame } from "@/lib/storyboard";
import {
  buildStructureFingerprint,
  type StructureFocus,
} from "@/lib/structure-fingerprint";
import {
  buildTechniqueTransferRecipe,
  type TechniqueTransferRecipe,
} from "@/lib/technique-transfer";
import { buildTimelineSegments } from "@/lib/timeline";
import { insertBeatAfter, moveBeat, removeBeat } from "@/lib/plan-edit";
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

type FullVideoPackagingMode = "smart" | "clean";

type GeneratedVideoPackaging = {
  mode?: FullVideoPackagingMode;
  label?: string;
  subtitles: boolean;
  audio: boolean;
};

type VideoGenerateResponse = {
  mode?: "hook" | "full-video";
  audioMode?: "natural-sfx" | "model-voiceover";
  packagingMode?: FullVideoPackagingMode;
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
    decisions?: Array<{
      order: number;
      role: string;
      source: "aigc-video" | "user-video" | "user-image";
      slotId?: string;
      materialLabel?: string | null;
      provider?: string;
      reason?: string;
      editSummary?: string | null;
    }>;
  };
  downloaded?: {
    filePath: string;
    bytes: number;
  } | null;
  debugFilePath?: string;
  packaging?: GeneratedVideoPackaging;
  error?: string;
};

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
};

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

const samplePlaceholder =
  "可选：补充样例口播、节奏、字幕风格。多个样例用 --- 分隔。";

const briefPlaceholder =
  "例：AI 简历工具｜大学生｜10分钟生成岗位匹配版简历｜已有录屏/截图，缺真人 CTA。";

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

function TechniqueTransferPanel({
  recipe,
}: {
  recipe: TechniqueTransferRecipe;
}) {
  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">手法迁移配方</Badge>
            <Badge variant="outline">{recipe.sceneTransfers.length} 个映射镜头</Badge>
            <Badge variant="outline">{recipe.sourceProfile.transitionStyle}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {recipe.summary}
          </p>
        </div>
        <GitBranch className="size-8 shrink-0 text-primary" />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Hook窗口", `${recipe.sourceProfile.hookWindowSeconds}s`],
          ["镜头密度", `${recipe.sourceProfile.shotDensityPer10s}/10s`],
          ["字幕密度", recipe.sourceProfile.captionDensity],
          ["运动手法", recipe.sourceProfile.motionStyle],
        ].map(([label, value]) => (
          <div className="rounded-md border bg-background p-3" key={label}>
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {recipe.sceneTransfers.map((scene) => (
          <div className="rounded-lg border bg-background p-3" key={scene.index}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_32px_minmax(0,1.1fr)_minmax(160px,0.55fr)] lg:items-stretch">
              <div className="rounded-md border bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{scene.sampleTimeRange}</Badge>
                  <span className="text-xs font-semibold text-foreground">
                    {scene.sourcePurpose}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {scene.transferableRule}
                </p>
              </div>
              <div className="hidden items-center justify-center text-primary lg:flex">
                <ArrowRight className="size-5" />
              </div>
              <div className="rounded-md border bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{scene.outputTimeRange}</Badge>
                  <span className="text-xs font-semibold text-foreground">
                    {scene.outputPurpose}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  {scene.outputLine}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {scene.mappedTechnique}
                </p>
              </div>
              <div className="rounded-md border bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={fitBadgeVariant(scene.materialFit)}>
                    {materialFitText(scene.materialFit)}
                  </Badge>
                  <Badge variant="outline">节奏继承</Badge>
                </div>
                <p className="mt-2 text-xs font-medium text-foreground">
                  {scene.materialSlotName}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {scene.captionPlacement}/{scene.captionDensity} · {scene.transitionStyle}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
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

function coverageStatusText(status: ContestRequirementCoverageReport["items"][number]["status"]) {
  if (status === "ready") return "已完成";
  if (status === "partial") return "部分";
  return "待补";
}

function coverageBadgeVariant(status: ContestRequirementCoverageReport["items"][number]["status"]) {
  if (status === "ready") return "success";
  if (status === "partial") return "warning";
  return "outline";
}

function RequirementCoveragePanel({
  report,
}: {
  report: ContestRequirementCoverageReport;
}) {
  const p0Total = report.items.filter((item) => item.priority === "P0").length;
  const p1Total = report.items.filter((item) => item.priority === "P1").length;
  const bonusTotal = report.items.filter((item) => item.priority === "加分").length;

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">工作台状态</Badge>
            <Badge variant={report.p0CompletedCount === p0Total ? "success" : "warning"}>
              基础流程 {report.p0CompletedCount}/{p0Total}
            </Badge>
            <Badge variant={report.p1CompletedCount === p1Total ? "success" : "warning"}>
              创作能力 {report.p1CompletedCount}/{p1Total}
            </Badge>
            <Badge variant={report.bonusReadyCount === bonusTotal ? "success" : "outline"}>
              智能增强 {report.bonusReadyCount}/{bonusTotal}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            自动检查当前创作链路是否完整，帮你快速确认从样例分析、素材诊断到预览导出的关键能力。
          </p>
        </div>
        <Badge variant={report.completedCount === report.totalCount ? "success" : "warning"}>
          {report.completedCount}/{report.totalCount}
        </Badge>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {report.items.map((item) => (
          <div className="rounded-md border bg-background p-3" key={item.taskId}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {item.priority === "P0" ? "基础" : item.priority === "P1" ? "进阶" : "增强"}
                </Badge>
              </div>
              <Badge variant={coverageBadgeVariant(item.status)}>
                {coverageStatusText(item.status)}
              </Badge>
            </div>
            <p className="mt-2 text-sm font-semibold leading-5 text-foreground">
              {item.title}
            </p>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {item.evidence}
            </p>
            <p className="mt-2 text-[11px] font-medium leading-4 text-foreground">
              模块：{item.judgePanel}
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
  onExportMd,
  onExportJson,
  onPackagingModeChange,
  onToggleMore,
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
  onExportMd: () => void;
  onExportJson: () => void;
  onPackagingModeChange: (mode: FullVideoPackagingMode) => void;
  onToggleMore: () => void;
}) {
  const isProcessing = generatedVideo?.status === "processing";
  const statusBadgeVariant = generatedVideo?.url ? "success" : isProcessing ? "warning" : "outline";
  const statusLabel = generatedVideo?.url ? "已生成" : isProcessing ? "生成中" : "待生成";
  const primaryActionLabel = isProcessing || generatedVideo?.retryable ? "继续生成" : "生成成片";
  const packagingLabel = videoPackagingLabel(generatedVideo?.packaging);
  const strategy = generatedVideo?.renderStrategy;
  const decisions = strategy?.decisions?.slice(0, 3) ?? [];

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
            <span>{renderStrategyTitle(strategy)}</span>
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
                    <p>
                      {decision.materialLabel || `第 ${decision.order} 段`}
                    </p>
                    <span>
                      {decision.editSummary || decision.reason || compactLine(decision.role, 52)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="studio-package-toggle" aria-label="成片包装方式">
          {[
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
          <Button onClick={onExportMd} size="sm" type="button" variant="outline">
            <Download />
            导出方案
          </Button>
          <Button onClick={onToggleMore} size="sm" type="button" variant="outline">
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
            <Button onClick={onExportJson} size="sm" type="button" variant="outline">
              <FileJson />
              导出数据
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RecentRenderPanel({ generatedVideo }: { generatedVideo: GeneratedVideoState }) {
  if (!generatedVideo.url) return null;
  const packagingLabel = videoPackagingLabel(generatedVideo.packaging);

  return (
    <div className="studio-output-panel">
      <div className="studio-output-preview">
        <video
          className="studio-output-video"
          controls
          playsInline
          preload="metadata"
          src={generatedVideo.url}
        />
      </div>
      <div className="studio-output-copy">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">最近成片</Badge>
          <Badge variant="success">可播放</Badge>
          {packagingLabel ? <Badge variant="info">{packagingLabel}</Badge> : null}
        </div>
        <h3>{generatedVideo.title}</h3>
        <p>{generatedVideo.note}</p>
        {generatedVideo.createdAt ? (
          <span className="studio-output-time">生成时间：{generatedVideo.createdAt}</span>
        ) : null}
        {generatedVideo.progressText ? (
          <span className="studio-output-time">{generatedVideo.progressText}</span>
        ) : null}
        <div className="studio-output-actions">
          <Button asChild size="sm" type="button">
            <a href={generatedVideo.url} target="_blank" rel="noreferrer">
              <Download />
              打开成片
            </a>
          </Button>
        </div>
      </div>
    </div>
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

export default function Home() {
  const [projectTitle] = useState("爆款结构迁移演示项目");
  const [sampleTitle] = useState("优质短视频样例");
  const [sampleUrl, setSampleUrl] = useState("");
  const [sampleNotes, setSampleNotes] = useState("");
  const [targetBrief, setTargetBrief] = useState("");
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
    useState<FullVideoPackagingMode>("smart");

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

  const activePlanVersion = useMemo(
    () => plan?.versions[Math.min(activeVersion, plan.versions.length - 1)],
    [activeVersion, plan],
  );
  const activeMigrationRows = useMemo(() => {
    if (!analysis || !plan || !activePlanVersion) return [];
    return buildMigrationMap({ analysis, plan, version: activePlanVersion });
  }, [analysis, plan, activePlanVersion]);
  const activeTechniqueRecipe = useMemo(() => {
    if (!analysis || !plan || !activePlanVersion) return null;
    return buildTechniqueTransferRecipe({
      analysis,
      plan,
      version: activePlanVersion,
    });
  }, [analysis, plan, activePlanVersion]);
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

  const requirementCoverage = useMemo(
    () =>
      buildContestRequirementCoverage({
        analysis,
        plan,
        techniqueTransfer: activeTechniqueRecipe,
      }),
    [analysis, plan, activeTechniqueRecipe],
  );
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
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("targetBrief", targetBrief);
    formData.append("userMaterials", extractInlineMaterialNotes(targetBrief));
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
          : "正在生成干净成片：复用真实素材，缺口用视频模型补齐...",
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
      setGeneratedVideo({
        title: reused ? "素材混合成片" : "AI生成成片",
        url: outputUrl,
        note: reused
          ? `已按手法槽位剪入真实素材 ${reused} 段，AI 补齐 ${aigc} 段并自动拼接${
              duration ? `，目标约 ${duration} 秒` : ""
            }${packagingNote}。`
          : `由生成视频模型按当前目标内容生成 ${aigc} 段并自动拼接${
              duration ? `，目标约 ${duration} 秒` : ""
            }${packagingNote}。`,
        createdAt: new Date().toLocaleTimeString(),
        status: "completed",
        retryable: false,
        outputBaseName: data.outputBaseName ?? null,
        progressText: data.totalSegments ? `完成 ${data.totalSegments}/${data.totalSegments} 段` : undefined,
        packaging: data.packaging,
        renderStrategy: data.renderStrategy,
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

      <section className="studio-statusbar">
        <div className="studio-steps">
          <span className={`studio-step ${analysis ? "is-done" : "is-active"}`}>样例洞察</span>
          <ArrowRight className="hidden size-4 md:block" />
          <span className={`studio-step ${analysis ? "is-done" : ""}`}>结构蓝图</span>
          <ArrowRight className="hidden size-4 md:block" />
          <span className={`studio-step ${plan?.materialAdaptation ? "is-done" : ""}`}>素材体检</span>
          <ArrowRight className="hidden size-4 md:block" />
          <span className={`studio-step ${plan ? "is-active" : ""}`}>成片方案</span>
        </div>

        <div className={`studio-status-message is-${status.type}`}>
          <span className="[&_svg]:size-4">{statusIcon(status.type)}</span>
          <span>{status.message}</span>
        </div>
      </section>

      <section className="workspace-grid studio-workspace">
        <div className="control-rail space-y-4">
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
                  onChange={(event) => setSampleNotes(event.target.value)}
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
                  onChange={(event) => setTargetBrief(event.target.value)}
                  className="min-h-[112px]"
                />
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
          <Card className={!analysis ? "studio-sample-card" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="size-4 text-primary" />
                样例洞察
              </CardTitle>
              <CardDescription>镜头 / 节奏 / 包装</CardDescription>
            </CardHeader>
            <CardContent>
              {analysis ? (
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
              ) : (
                  <div className="studio-empty-panel min-h-[260px]">
                  <div className="studio-empty-icon">
                    <Upload className="size-6" />
                  </div>
                  <p className="mt-3 text-sm font-semibold">等待样例</p>
                  <div className="studio-empty-chips">
                    <Badge variant="outline">时长</Badge>
                    <Badge variant="outline">镜头</Badge>
                    <Badge variant="outline">字幕</Badge>
                    <Badge variant="outline">节奏</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={!plan ? "studio-plan-card" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                新片方案
              </CardTitle>
              <CardDescription>脚本 / 分镜 / 时间线</CardDescription>
            </CardHeader>
            <CardContent>
              {plan && activePlanVersion ? (
                <div className="space-y-4">
                  <OutputPreviewPanel
                    generatedVideo={generatedVideo}
                    renderingVideo={renderingVideo}
                    showMore={showRenderOptions}
                    disabled={renderingVideo || status.type === "loading"}
                    fullVideoPackagingMode={fullVideoPackagingMode}
                    onQuickPreview={() => void handleRenderPreset("draft")}
                    onFullVideo={() => void handleGenerateFullVideo()}
                    onHighRender={() => void handleRenderPreset("high")}
                    onHighAudio={() => void handleRenderPreset("high-quality")}
                    onTechnique={() => void handleRenderPreset("technique")}
                    onExportMd={() => {
                      if (projectId) downloadExport(projectId, "md", activePlanId);
                    }}
                    onExportJson={() => {
                      if (projectId) downloadExport(projectId, "json", activePlanId);
                    }}
                    onPackagingModeChange={setFullVideoPackagingMode}
                    onToggleMore={() => setShowRenderOptions(!showRenderOptions)}
                  />

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
                      <RequirementCoveragePanel report={requirementCoverage} />
                      {activeTechniqueRecipe ? (
                        <TechniqueTransferPanel recipe={activeTechniqueRecipe} />
                      ) : null}
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
              ) : (
                <div className="space-y-4">
                  {generatedVideo?.url ? (
                    <RecentRenderPanel generatedVideo={generatedVideo} />
                  ) : (
                    <div className="studio-empty-panel min-h-[260px]">
                      <div className="studio-empty-icon">
                        <FileText className="size-6" />
                      </div>
                      <p className="mt-3 text-sm font-semibold">等待方案</p>
                      <div className="studio-empty-chips">
                        <Badge variant="outline">多版本</Badge>
                        <Badge variant="outline">分镜</Badge>
                        <Badge variant="outline">素材缺口</Badge>
                        <Badge variant="outline">导出</Badge>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
