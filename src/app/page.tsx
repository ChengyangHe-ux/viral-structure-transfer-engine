"use client";

import { useMemo, useState } from "react";
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
  Loader2,
  PackageCheck,
  PencilLine,
  Plus,
  RefreshCw,
  Trophy,
  Trash2,
  Upload,
  Video,
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
import { demoPresets } from "@/lib/demo-presets";
import { renderMigrationMapMarkdown, renderPlanMarkdown } from "@/lib/markdown";
import {
  buildMigrationMap,
  materialFitText,
  type MigrationMapRow,
} from "@/lib/mapping";
import { diffPlans } from "@/lib/plan-diff";
import { buildTimelineSegments } from "@/lib/timeline";
import { insertBeatAfter, moveBeat, removeBeat } from "@/lib/plan-edit";
import type {
  MediaMeta,
  MaterialAdaptation,
  MigratedVideoPlan,
  PlanEvaluation,
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

type StatusState =
  | { type: "idle"; message: string }
  | { type: "loading"; message: string }
  | { type: "success"; message: string }
  | { type: "warning"; message: string }
  | { type: "error"; message: string };

const samplePlaceholder =
  "粘贴样例视频观察 / 口播转写 / 人工拆解。建议写成“时间段 + 发生了什么”。例如：0-2s 先抛结果对比；2-10s 连续 3 个使用场景；结尾引导收藏领取清单。";

const briefPlaceholder =
  "描述你要迁移到的新主题/商品 Brief（目标人群 + 场景 + 核心卖点 + 结尾动作）。例如：面向大学生的简历优化工具，主打 10 分钟生成岗位匹配版简历，结尾引导“收藏+私信关键词”。";

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

function MediaMetaPanel({ mediaMeta }: { mediaMeta: MediaMeta }) {
  const hasAnyMeta =
    mediaMeta.durationSeconds ||
    (mediaMeta.width && mediaMeta.height) ||
    mediaMeta.frameRate ||
    typeof mediaMeta.hasAudio === "boolean" ||
    mediaMeta.previewFrames.length;

  if (!hasAnyMeta) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">多模态线索</Badge>
        <Badge variant="outline">
          {mediaMeta.sourceKind === "upload"
            ? "上传视频"
            : mediaMeta.sourceKind === "url"
              ? "样例链接"
              : "人工观察"}
        </Badge>
        {mediaMeta.durationSeconds ? (
          <Badge variant="outline">时长 {formatSeconds(mediaMeta.durationSeconds)}</Badge>
        ) : null}
        {mediaMeta.width && mediaMeta.height ? (
          <Badge variant="outline">
            {mediaMeta.width}×{mediaMeta.height}
          </Badge>
        ) : null}
        {mediaMeta.frameRate ? (
          <Badge variant="outline">FPS {mediaMeta.frameRate}</Badge>
        ) : null}
        {typeof mediaMeta.hasAudio === "boolean" ? (
          <Badge variant="outline">{mediaMeta.hasAudio ? "有音频" : "无音频"}</Badge>
        ) : null}
      </div>

      {mediaMeta.previewFrames.length ? (
        <div className="grid grid-cols-3 gap-2">
          {mediaMeta.previewFrames.map((frameId) => (
            <div className="overflow-hidden rounded-md border bg-muted/20" key={frameId}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="样例预览帧"
                className="aspect-video w-full object-cover"
                loading="lazy"
                src={`/api/frames/${encodeURIComponent(frameId)}`}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs leading-6 text-muted-foreground">
          未抽取预览帧（可能缺少 ffmpeg），但仍可基于转写/观察继续拆解。
        </p>
      )}
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
            直接改时间线字段，导出稿会自动更新；适合比赛答辩时现场“改一两处就能落地”。
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

function readinessText(readiness: PlanEvaluation["readiness"]) {
  if (readiness === "ready") return "可直接演示";
  if (readiness === "minor-edits") return "小修后演示";
  return "需要补强";
}

function EvaluationPanel({ evaluation }: { evaluation: PlanEvaluation }) {
  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">{readinessText(evaluation.readiness)}</Badge>
            <Badge variant="outline">推荐：{evaluation.bestVersion}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {evaluation.judgePitch}
          </p>
        </div>
        <div className="min-w-[108px] rounded-lg border bg-background px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground">综合评分</p>
          <p className="mt-1 text-3xl font-semibold text-primary">
            {evaluation.overallScore}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {evaluation.dimensions.map((dimension) => (
          <div className="rounded-lg border bg-background p-3" key={dimension.key}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">{dimension.label}</p>
              <span className="text-xs font-semibold text-primary">{dimension.score}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-secondary">
              <div
                className="h-1.5 rounded-full bg-primary"
                style={{ width: `${dimension.score}%` }}
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {dimension.suggestion}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Trophy className="size-3.5 text-primary" />
            亮点
          </p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
            {evaluation.strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <BarChart3 className="size-3.5 text-primary" />
            优先修正
          </p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
            {evaluation.priorityFixes.map((fix) => (
              <li key={fix}>{fix}</li>
            ))}
          </ul>
        </div>
      </div>

      {evaluation.structureAlignment ? (
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs font-semibold text-foreground">结构对齐报告</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            覆盖 {evaluation.structureAlignment.matchedSampleBeatCount}/
            {evaluation.structureAlignment.sampleBeatCount}（
            {Math.round(evaluation.structureAlignment.coverageRatio * 100)}%），评分{" "}
            {evaluation.structureAlignment.coverageScore}/100
          </p>
          {evaluation.structureAlignment.missingSampleBeats.length ? (
            <div className="mt-2 space-y-1.5">
              <p className="text-xs font-medium text-foreground">优先补齐的样例段落</p>
              <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
                {evaluation.structureAlignment.missingSampleBeats.map((beat) => (
                  <li key={`${beat.timeRange}-${beat.shotPurpose}`}>
                    {beat.timeRange}：{beat.shotPurpose}（{beat.transferableRule}）
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {evaluation.structureAlignment.notes.length ? (
            <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
              {evaluation.structureAlignment.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
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
            <Badge variant="outline">素材充分度 {adaptation.sufficiencyScore}/100</Badge>
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
            <p className="mt-2 text-xs font-medium text-foreground">补全：{slot.completionPlan}</p>
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
            <Badge variant="secondary">RAG 技巧库</Badge>
            <Badge variant="outline">命中 {techniques.length} 条</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            生成前用 Brief、素材线索和样例结构检索剪辑技巧库，把“怎么剪”注入到脚本、转场、字幕和制作备注里。
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
                <span className="text-xs font-semibold text-primary">{Math.round(technique.score)}</span>
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
            把样例节拍、可迁移规则、新方案镜头和素材补全放在同一张链路图里，便于答辩时解释“学到了什么、迁移到哪里、缺口怎么处理”。
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
            按真实秒数把脚本拆成可生产的时间线，颜色标签对应每段结构任务，素材状态提示该段是否需要补拍或包装兜底。
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

export default function Home() {
  const [projectTitle, setProjectTitle] = useState("爆款结构迁移演示项目");
  const [sampleTitle, setSampleTitle] = useState("优质短视频样例");
  const [sampleUrl, setSampleUrl] = useState("");
  const [sampleNotes, setSampleNotes] = useState("");
  const [targetBrief, setTargetBrief] = useState("");
  const [userMaterials, setUserMaterials] = useState("");
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [localUploadName, setLocalUploadName] = useState("");
  const [availableUploads, setAvailableUploads] = useState<
    Array<{ name: string; sizeBytes: number; modifiedAt: string }>
  >([]);
  const [simpleMode, setSimpleMode] = useState(true);
  const [showAllSampleBeats, setShowAllSampleBeats] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VideoStructureAnalysis | null>(null);
  const [plan, setPlan] = useState<MigratedVideoPlan | null>(null);
  const [planHistory, setPlanHistory] = useState<PlanHistoryItem[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loadingPlanHistory, setLoadingPlanHistory] = useState(false);
  const [analysisMarkdown, setAnalysisMarkdown] = useState("");
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
    message: "先准备一个样例（链接/文件/观察文本），再把它的结构迁移到你的新主题。",
  });
  const [renderingVideo, setRenderingVideo] = useState(false);

  const hasTechniqueHits = Boolean(plan?.retrievedTechniques.length);

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

  const activePlanVersion = useMemo(
    () => plan?.versions[Math.min(activeVersion, plan.versions.length - 1)],
    [activeVersion, plan],
  );
  const activeMigrationRows = useMemo(() => {
    if (!analysis || !plan || !activePlanVersion) return [];
    return buildMigrationMap({ analysis, plan, version: activePlanVersion });
  }, [analysis, plan, activePlanVersion]);
  const previewMarkdown = useMemo(() => {
    if (analysis && plan) {
      return [
        analysisMarkdown,
        renderMigrationMapMarkdown({ analysis, plan }),
        renderPlanMarkdown(plan),
      ]
        .filter(Boolean)
        .join("\n");
    }

    return [analysisMarkdown, plan ? renderPlanMarkdown(plan) : ""]
      .filter(Boolean)
      .join("\n");
  }, [analysis, analysisMarkdown, plan]);

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
      !sampleFile &&
      !sampleUrl.trim() &&
      !localUploadName.trim()
    ) {
      setStatus({
        type: "error",
        message: "请至少提供样例视频文件、本地导入视频、链接或人工观察文本。",
      });
      return;
    }

    setStatus({ type: "loading", message: "正在拆解样例结构..." });
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

    const formData = new FormData();
    formData.append("projectTitle", projectTitle);
    formData.append("sampleTitle", sampleTitle);
    formData.append("sampleUrl", sampleUrl);
    formData.append("localUploadName", localUploadName);
    formData.append("sampleNotes", sampleNotes || "用户上传了样例视频，请结合视频元数据和常见短视频结构进行拆解。");
    formData.append("targetBrief", targetBrief);
    if (sampleFile) {
      formData.append("sampleFile", sampleFile);
    }

    const response = await fetch("/api/analyze-sample", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as AnalyzeResponse;

    if (!response.ok) {
      setStatus({ type: "error", message: payload.error || "样例拆解失败" });
      return;
    }

    setProjectId(payload.projectId);
    setAnalysis(payload.analysis);
    setAnalysisMarkdown(payload.markdown);
    setMediaMeta(payload.mediaMeta);
    await refreshPlanHistory(payload.projectId);
    setStatus({
      type: payload.usedFallback ? "warning" : "success",
      message: payload.usedFallback
        ? "未检测到可用 AI 密钥，已使用本地演示策略完成拆解。"
        : "样例结构拆解完成。",
    });
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

  function applyDemoPreset(preset: (typeof demoPresets)[number]) {
    setProjectTitle(preset.projectTitle);
    setSampleTitle(preset.sampleTitle);
    setSampleNotes(preset.sampleNotes);
    setTargetBrief(preset.targetBrief);
    setUserMaterials(preset.userMaterials);
    setSampleUrl("");
    setSampleFile(null);
    setAnalysis(null);
    setPlan(null);
    setPlanHistory([]);
    setActivePlanId(null);
    setAnalysisMarkdown("");
    setRefineInstruction("");
    setProjectId(null);
    setActiveVersion(0);
    setEditMode(false);
    setDraftVersion(null);
    setNlEditInstruction("");
    setNlEditFeedback(null);
    setNlEditPreview(null);
    setStatus({
      type: "idle",
      message: `已载入演示预设：${preset.label}。`,
    });
  }

  async function handleGeneratePlan() {
    if (!projectId || !analysis) {
      setStatus({ type: "error", message: "请先完成样例结构拆解。" });
      return;
    }
    if (!targetBrief.trim()) {
      setStatus({ type: "error", message: "请输入新主题或商品 Brief。" });
      return;
    }

    setStatus({ type: "loading", message: "正在迁移结构并生成多版本脚本..." });
    const response = await fetch("/api/generate-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        targetBrief,
        userMaterials,
        direction: "比赛 MVP：生成可编辑方案脚本，保留二期视频时间线扩展空间",
      }),
    });
    const payload = (await response.json()) as PlanResponse;

    if (!response.ok) {
      setStatus({ type: "error", message: payload.error || "迁移方案生成失败" });
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
      message: payload.usedFallback
        ? "当前为离线演示模式：已用本地策略生成脚本（比赛现场也能跑通）。"
        : "迁移脚本已生成，可直接编辑并导出。",
    });
  }

  async function handleRefinePlan() {
    if (!projectId || !plan) {
      setStatus({ type: "error", message: "请先生成迁移方案。" });
      return;
    }
    if (!refineInstruction.trim()) {
      setStatus({ type: "error", message: "请输入修改指令。" });
      return;
    }

    setStatus({ type: "loading", message: "正在按自然语言指令修订方案..." });
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
      message: payload.usedFallback
        ? "当前为离线演示模式：已用本地策略完成修订。"
        : "已按你的自然语言指令更新方案。",
    });
  }

  return (
    <main className="min-h-screen">
      <section className="border-b bg-white/78">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">比赛演示版</Badge>
                <Badge variant="outline">结构迁移</Badge>
                <Badge variant="outline">可编辑时间线</Badge>
                <Badge variant="outline">可出片视频</Badge>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
                爆款结构迁移引擎
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                把“样例为什么好用”拆成可复用结构，再迁移到你的新主题：生成能编辑、能导出、能一键渲染的视频方案稿。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={simpleMode}
                  onChange={(event) => setSimpleMode(event.target.checked)}
                />
                简洁模式
              </label>
              <Button
                disabled={!projectId}
                onClick={() => projectId && downloadExport(projectId, "md", activePlanId)}
                variant="outline"
                title="导出 Markdown"
              >
                <Download />
                Markdown
              </Button>
              <Button
                disabled={!projectId}
                onClick={() => projectId && downloadExport(projectId, "json", activePlanId)}
                variant="outline"
                title="导出 JSON"
              >
                <FileJson />
                JSON
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border bg-background/60 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={analysis ? "success" : "secondary"}>1. 样例拆解</Badge>
              <ArrowRight className="hidden size-4 text-muted-foreground md:block" />
              <Badge variant={hasTechniqueHits ? "success" : "outline"}>2. RAG 技巧检索</Badge>
              <ArrowRight className="hidden size-4 text-muted-foreground md:block" />
              <Badge variant={plan ? "success" : "outline"}>3. 迁移脚本</Badge>
              <ArrowRight className="hidden size-4 text-muted-foreground md:block" />
              <Badge variant={plan ? "success" : "outline"}>4. 编辑出片</Badge>
            </div>

            <div
              className={`flex items-start gap-3 text-sm ${
                status.type === "error"
                  ? "text-red-800"
                  : status.type === "warning"
                    ? "text-amber-900"
                    : status.type === "success"
                      ? "text-emerald-800"
                      : "text-muted-foreground"
              }`}
            >
              <span className="[&_svg]:size-4">{statusIcon(status.type)}</span>
              <span className="leading-6">{status.message}</span>
            </div>
          </div>
        </div>
      </section>

      <section
        className={`workspace-grid mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8 ${
          simpleMode ? "lg:grid-cols-1" : "lg:grid-cols-[390px_minmax(0,1fr)]"
        }`}
      >
        <div className="control-rail space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="size-4 text-primary" />
                输入素材
              </CardTitle>
              <CardDescription>样例视频、链接或人工观察文本至少填写一项。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>演示预设</Label>
                <div className="grid grid-cols-3 gap-2">
                  {demoPresets.map((preset) => (
                    <Button
                      key={preset.label}
                      onClick={() => applyDemoPreset(preset)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectTitle">项目名称</Label>
                <Input
                  id="projectTitle"
                  value={projectTitle}
                  onChange={(event) => setProjectTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sampleTitle">样例标题</Label>
                <Input
                  id="sampleTitle"
                  value={sampleTitle}
                  onChange={(event) => setSampleTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="localUploadName">本地已导入视频（data/uploads）</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      id="localUploadName"
                      className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={localUploadName}
                      onFocus={() => {
                        if (availableUploads.length === 0) void loadUploads();
                      }}
                      onChange={(event) => {
                        setLocalUploadName(event.target.value);
                        setSampleFile(null);
                      }}
                    >
                      <option value="">（不使用本地导入）</option>
                      {availableUploads.map((file) => (
                        <option key={file.name} value={file.name}>
                          {file.name} ({(file.sizeBytes / 1024 / 1024).toFixed(1)} MB)
                        </option>
                      ))}
                    </select>
                    <Button onClick={loadUploads} size="sm" type="button" variant="outline">
                      刷新
                    </Button>
                  </div>
                  {availableUploads.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      未检测到本地导入的视频文件。可把 mp4/mov 放到 data/uploads（已在 .gitignore 中）。
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      选择后将直接读取本地文件生成元数据与抽帧，无需重复上传。
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sampleFile">样例视频文件</Label>
                <Input
                  id="sampleFile"
                  type="file"
                  accept="video/*"
                  onChange={(event) => {
                    setSampleFile(event.target.files?.[0] || null);
                    setLocalUploadName("");
                  }}
                />
                {sampleFile ? (
                  <p className="text-xs text-muted-foreground">
                    已选择：{sampleFile.name}，{(sampleFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sampleUrl">样例链接</Label>
                <Input
                  id="sampleUrl"
                  placeholder="https://..."
                  value={sampleUrl}
                  onChange={(event) => setSampleUrl(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sampleNotes">样例观察/转写</Label>
                <Textarea
                  id="sampleNotes"
                  placeholder={samplePlaceholder}
                  value={sampleNotes}
                  onChange={(event) => setSampleNotes(event.target.value)}
                />
              </div>
              <Button className="w-full" onClick={handleAnalyze}>
                {status.type === "loading" ? <Loader2 className="animate-spin" /> : <ClipboardList />}
                拆解成结构卡片
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" />
                迁移 Brief
              </CardTitle>
              <CardDescription>描述新主题、商品、受众和想要强化的卖点。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder={briefPlaceholder}
                value={targetBrief}
                onChange={(event) => setTargetBrief(event.target.value)}
              />
              <div className="space-y-2">
                <Label htmlFor="userMaterials">用户素材</Label>
                <Textarea
                  id="userMaterials"
                  placeholder="描述已有素材，例如：产品图、操作录屏、使用场景、评价截图、CTA 入口；也可以说明缺少哪些素材。"
                  value={userMaterials}
                  onChange={(event) => setUserMaterials(event.target.value)}
                />
              </div>
              <div className="rounded-lg border bg-accent/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">剪辑技巧库 RAG</Badge>
                  <span className="text-xs font-semibold text-foreground">生成前检索</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  系统会用 Brief、用户素材和样例节拍命中剪辑技巧，例如前 3 秒 Hook、B-roll 场景阶梯、卡点字幕、动作匹配转场和 CTA 收束。
                </p>
              </div>
              <Button
                className="w-full"
                disabled={!analysis || status.type === "loading"}
                onClick={handleGeneratePlan}
                variant="secondary"
              >
                {status.type === "loading" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                生成迁移方案
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

          {projectId && plan ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="size-4 text-primary" />
                  一键出片
                </CardTitle>
                <CardDescription>
                  直接在页面渲染并下载 mp4（首次请先执行 npm run media:install-binaries）。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    type="button"
                    variant="default"
                    disabled={renderingVideo || status.type === "loading"}
                    onClick={async () => {
                      if (!projectId) return;
                      setRenderingVideo(true);
                      setStatus({ type: "loading", message: "正在渲染视频（draft）..." });
                      try {
                        const response = await fetch(`/api/projects/${projectId}/render`, {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            planId: activePlanId,
                            quality: "draft",
                            title: projectTitle,
                          }),
                        });
                        const data = (await response.json()) as {
                          downloadUrl?: string;
                          error?: string;
                        };
                        if (!response.ok || !data.downloadUrl) {
                          throw new Error(data.error || "渲染失败");
                        }
                        window.location.href = data.downloadUrl;
                        setStatus({ type: "success", message: "渲染完成，已开始下载。" });
                      } catch (error) {
                        setStatus({
                          type: "error",
                          message:
                            error instanceof Error ? error.message : "渲染失败（请检查 media:install-binaries）",
                        });
                      } finally {
                        setRenderingVideo(false);
                      }
                    }}
                  >
                    {renderingVideo ? <Loader2 className="animate-spin" /> : <Video />}
                    渲染并下载（draft）
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    disabled={renderingVideo || status.type === "loading"}
                    onClick={async () => {
                      if (!projectId) return;
                      setRenderingVideo(true);
                      setStatus({ type: "loading", message: "正在渲染视频（high）..." });
                      try {
                        const response = await fetch(`/api/projects/${projectId}/render`, {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            planId: activePlanId,
                            quality: "high",
                            title: projectTitle,
                          }),
                        });
                        const data = (await response.json()) as {
                          downloadUrl?: string;
                          error?: string;
                        };
                        if (!response.ok || !data.downloadUrl) {
                          throw new Error(data.error || "渲染失败");
                        }
                        window.location.href = data.downloadUrl;
                        setStatus({ type: "success", message: "渲染完成，已开始下载。" });
                      } catch (error) {
                        setStatus({
                          type: "error",
                          message:
                            error instanceof Error ? error.message : "渲染失败（请检查 media:install-binaries）",
                        });
                      } finally {
                        setRenderingVideo(false);
                      }
                    }}
                  >
                    {renderingVideo ? <Loader2 className="animate-spin" /> : <Trophy />}
                    渲染并下载（high）
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => downloadExport(projectId, "json", activePlanId)}
                  >
                    <FileJson />
                    导出 JSON
                  </Button>
                </div>
                <p className="text-xs leading-6 text-muted-foreground">
                  提示：首次渲染前先执行一次 <span className="font-mono">npm run media:install-binaries</span>；draft 更快，high 更清晰更慢。
                </p>
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

        <div className="result-rail space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="size-4 text-primary" />
                样例结构拆解
              </CardTitle>
              <CardDescription>系统会把样例拆成可迁移规则，而不是复刻内容。</CardDescription>
            </CardHeader>
            <CardContent>
              {analysis ? (
                <div className="space-y-5">
                  {mediaMeta ? <MediaMetaPanel mediaMeta={mediaMeta} /> : null}
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border bg-background p-3">
                      <p className="text-xs text-muted-foreground">内容承诺</p>
                      <p className="mt-1 text-sm font-medium">{analysis.contentPromise}</p>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <p className="text-xs text-muted-foreground">目标人群</p>
                      <p className="mt-1 text-sm font-medium">{analysis.targetAudience}</p>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <p className="text-xs text-muted-foreground">可复用模板</p>
                      <p className="mt-1 text-sm font-medium">
                        {analysis.reusableTemplate.slice(0, 3).join(" / ")}
                      </p>
                    </div>
                  </div>

                  {simpleMode ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">节拍拆解（精简）</p>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => setShowAllSampleBeats(!showAllSampleBeats)}
                        >
                          {showAllSampleBeats ? "收起" : "展开全部"}
                        </Button>
                      </div>
                      {(showAllSampleBeats ? analysis.beatMap : analysis.beatMap.slice(0, 4)).map((beat) => (
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
                  ) : (
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
                  )}
                </div>
              ) : (
                <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed bg-background px-6 text-center">
                  <Upload className="size-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">等待样例拆解</p>
                  <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                    上传样例或输入人工观察后，这里会展示 hook、节奏、字幕、包装和卖点推进结构。
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                多版本方案脚本
              </CardTitle>
              <CardDescription>每个版本都保留时间线字段，后续可扩展到视频合成。</CardDescription>
            </CardHeader>
            <CardContent>
              {plan && activePlanVersion ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    {plan.versions.map((version, index) => (
                      <Button
                        key={version.versionName}
                        size="sm"
                        variant={index === activeVersion ? "default" : "outline"}
                        onClick={() => setActiveVersion(index)}
                      >
                        {version.versionName}
                      </Button>
                    ))}
                  </div>

                  <div className="rounded-lg border bg-accent/40 p-4">
                    <p className="text-sm font-medium text-accent-foreground">
                      {plan.strategySummary}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      继承结构：{plan.inheritedStructure.join(" / ")}
                    </p>
                  </div>

                  <EditingTechniquePanel techniques={plan.retrievedTechniques} />

                  {plan.evaluation ? <EvaluationPanel evaluation={plan.evaluation} /> : null}

                  {!simpleMode && plan.materialAdaptation ? (
                    <MaterialAdaptationPanel adaptation={plan.materialAdaptation} />
                  ) : null}

                  {!simpleMode ? <TimelineOverview rows={activeMigrationRows} /> : null}

                  {!simpleMode && analysis ? (
                    <MigrationMappingPanel
                      analysis={analysis}
                      plan={plan}
                      version={activePlanVersion}
                    />
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">可编辑时间线</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        支持在页面里直接改 beat 字段并保存为新稿，导出 / 预览同步更新。
                      </p>
                    </div>
                    <Button
                      variant={editMode ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (!editMode) setDraftVersion(activePlanVersion);
                        if (editMode) setDraftVersion(null);
                        setEditMode(!editMode);
                      }}
                    >
                      <PencilLine className="size-4" />
                      {editMode ? "退出编辑" : "进入编辑"}
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

                  <div className="space-y-3 rounded-lg border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          自然语言微调（离线）
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          一句话改细节并保存为新版本：支持封面/文案标题、话题标签、按段落改字段、按秒延长/缩短时间段。
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
                          保存新稿
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      value={nlEditInstruction}
                      onChange={(event) => setNlEditInstruction(event.target.value)}
                      placeholder="第2段口播改为 给出更具体的步骤；封面标题：10分钟做出岗位匹配简历；话题=简历优化 AI求职 #大学生；第1段延长1秒"
                      className="min-h-[92px]"
                    />
                    {nlEditPreview ? (
                      <div className="rounded-lg border bg-accent/20 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground">预览结果（未保存）</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              评分：{plan?.evaluation?.overallScore ?? "--"} →{" "}
                              {nlEditPreview.plan.evaluation?.overallScore ?? "--"}
                            </span>
                            <Button type="button" size="sm" variant="outline" onClick={() => setNlEditPreview(null)}>
                              关闭预览
                            </Button>
                          </div>
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
                        <div className="mt-3 rounded-lg border bg-background/70 p-3">
                          <p className="text-xs font-semibold text-foreground">差异摘要</p>
                          <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                            {(() => {
                              const items = nlEditPreview.diff.length
                                ? nlEditPreview.diff
                                : plan
                                  ? diffPlans(plan, nlEditPreview.plan)
                                  : [];
                              if (items.length === 0) return ["（无）"];
                              return items.slice(0, 12).map((item) => {
                                if (item.kind === "beats-count") {
                                  return `${item.versionName}：段落数 ${item.before} → ${item.after}`;
                                }
                                if (item.kind === "hashtags") {
                                  return `${item.versionName}：话题 ${item.before.join(" ")} → ${item.after.join(" ")}`;
                                }
                                if (item.kind === "version") {
                                  return `${item.versionName}：${item.field} ${item.before} → ${item.after}`;
                                }
                                return `${item.versionName}：第${item.beatIndex + 1}段.${item.field} ${item.before} → ${item.after}`;
                              });
                            })().map((line, index) => (
                              <li key={`diff-${index}`}>{line}</li>
                            ))}
                          </ul>
                          {(nlEditPreview.diff.length ? nlEditPreview.diff : plan ? diffPlans(plan, nlEditPreview.plan) : []).length > 12 ? (
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              已省略部分差异（当前最多展示 12 条）。
                            </p>
                          ) : null}
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

                  <VersionTimeline version={activePlanVersion} />
                </div>
              ) : (
                <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed bg-background px-6 text-center">
                  <Trophy className="size-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">等待迁移方案</p>
                  <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                    完成样例拆解并填写 Brief 后，系统会生成稳妥转化、强 Hook、内容种草等版本。
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {previewMarkdown && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  完整项目稿预览
                </CardTitle>
                <CardDescription>
                  预览内容与导出稿保持一致，可直接进入 Obsidian 或剪辑协作流程。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[420px] overflow-auto rounded-lg border bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {previewMarkdown}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </main>
  );
}
