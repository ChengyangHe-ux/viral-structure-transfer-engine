"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileJson,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Trophy,
  Upload,
  Video,
  WandSparkles,
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
import type {
  MediaMeta,
  MigratedVideoPlan,
  PlanEvaluation,
  PlanVersion,
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
  plan: MigratedVideoPlan;
  markdown: string;
  usedFallback: boolean;
  aiError: string | null;
  error?: string;
};

type StatusState =
  | { type: "idle"; message: string }
  | { type: "loading"; message: string }
  | { type: "success"; message: string }
  | { type: "warning"; message: string }
  | { type: "error"; message: string };

const samplePlaceholder =
  "粘贴样例视频观察、口播转写或人工拆解。例如：开头 2 秒先给对比结果，中段连续展示 3 个使用场景，结尾引导收藏领取清单。";

const briefPlaceholder =
  "描述你要迁移到的新主题/商品/素材。例如：面向大学生的 AI 简历优化工具，主打 10 分钟生成岗位匹配版简历。";

function statusIcon(type: StatusState["type"]) {
  if (type === "loading") return <Loader2 className="animate-spin" />;
  if (type === "success") return <CheckCircle2 />;
  if (type === "warning") return <AlertCircle />;
  if (type === "error") return <AlertCircle />;
  return <Sparkles />;
}

function downloadExport(projectId: string, format: "md" | "json") {
  window.open(`/api/projects/${projectId}/export?format=${format}`, "_blank");
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
    </div>
  );
}

export default function Home() {
  const [projectTitle, setProjectTitle] = useState("爆款结构迁移演示项目");
  const [sampleTitle, setSampleTitle] = useState("优质短视频样例");
  const [sampleUrl, setSampleUrl] = useState("");
  const [sampleNotes, setSampleNotes] = useState("");
  const [targetBrief, setTargetBrief] = useState("");
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VideoStructureAnalysis | null>(null);
  const [plan, setPlan] = useState<MigratedVideoPlan | null>(null);
  const [analysisMarkdown, setAnalysisMarkdown] = useState("");
  const [planMarkdown, setPlanMarkdown] = useState("");
  const [activeVersion, setActiveVersion] = useState(0);
  const [status, setStatus] = useState<StatusState>({
    type: "idle",
    message: "上传样例或填入观察文本后即可开始拆解。",
  });

  const activePlanVersion = useMemo(
    () => plan?.versions[Math.min(activeVersion, plan.versions.length - 1)],
    [activeVersion, plan],
  );

  async function handleAnalyze() {
    if (!sampleNotes.trim() && !sampleFile && !sampleUrl.trim()) {
      setStatus({
        type: "error",
        message: "请至少提供样例视频文件、链接或人工观察文本。",
      });
      return;
    }

    setStatus({ type: "loading", message: "正在拆解样例结构..." });
    setPlan(null);
    setPlanMarkdown("");
    setActiveVersion(0);

    const formData = new FormData();
    formData.append("projectTitle", projectTitle);
    formData.append("sampleTitle", sampleTitle);
    formData.append("sampleUrl", sampleUrl);
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
    setStatus({
      type: payload.usedFallback ? "warning" : "success",
      message: payload.usedFallback
        ? "未检测到可用 AI 密钥，已使用本地演示策略完成拆解。"
        : "样例结构拆解完成。",
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
        direction: "比赛 MVP：生成可编辑方案脚本，保留二期视频时间线扩展空间",
      }),
    });
    const payload = (await response.json()) as PlanResponse;

    if (!response.ok) {
      setStatus({ type: "error", message: payload.error || "迁移方案生成失败" });
      return;
    }

    setPlan(payload.plan);
    setPlanMarkdown(payload.markdown);
    setActiveVersion(0);
    setStatus({
      type: payload.usedFallback ? "warning" : "success",
      message: payload.usedFallback
        ? "未检测到可用 AI 密钥，已使用本地演示策略生成脚本。"
        : "迁移方案生成完成。",
    });
  }

  return (
    <main className="min-h-screen">
      <section className="border-b bg-white/78">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">AIGC 系统</Badge>
                <Badge variant="secondary">比赛 MVP</Badge>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
                爆款结构迁移引擎
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                从优质样例中抽象创作结构，再迁移到新主题或商品，生成可编辑的视频方案脚本。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!projectId}
                onClick={() => projectId && downloadExport(projectId, "md")}
                variant="outline"
                title="导出 Markdown"
              >
                <Download />
                Markdown
              </Button>
              <Button
                disabled={!projectId}
                onClick={() => projectId && downloadExport(projectId, "json")}
                variant="outline"
                title="导出 JSON"
              >
                <FileJson />
                JSON
              </Button>
            </div>
          </div>

          <div
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
              status.type === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : status.type === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : status.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-border bg-background text-muted-foreground"
            }`}
          >
            <span className="[&_svg]:size-4">{statusIcon(status.type)}</span>
            <span>{status.message}</span>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[390px_minmax(0,1fr)] lg:px-8">
        <div className="space-y-5">
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
                <Label htmlFor="sampleFile">样例视频文件</Label>
                <Input
                  id="sampleFile"
                  type="file"
                  accept="video/*"
                  onChange={(event) => setSampleFile(event.target.files?.[0] || null)}
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
                {status.type === "loading" ? <Loader2 className="animate-spin" /> : <WandSparkles />}
                拆解样例结构
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
        </div>

        <div className="space-y-5">
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

                  {plan.evaluation ? <EvaluationPanel evaluation={plan.evaluation} /> : null}

                  <VersionTimeline version={activePlanVersion} />
                </div>
              ) : (
                <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed bg-background px-6 text-center">
                  <Sparkles className="size-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">等待迁移方案</p>
                  <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                    完成样例拆解并填写 Brief 后，系统会生成稳妥转化、强 Hook、内容种草等版本。
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {(analysisMarkdown || planMarkdown) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Markdown 预览
                </CardTitle>
                <CardDescription>导出内容可直接放入 Obsidian 继续编辑。</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[420px] overflow-auto rounded-lg border bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {`${analysisMarkdown}\n${planMarkdown}`}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </main>
  );
}
