import { Database, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildIntegrationStatus,
  type IntegrationCapabilityStatus,
} from "@/lib/integrations";

function badgeVariant(status: IntegrationCapabilityStatus) {
  if (status === "ready") return "success";
  if (status === "partial") return "warning";
  return "outline";
}

function statusText(status: IntegrationCapabilityStatus) {
  if (status === "ready") return "已接入";
  if (status === "partial") return "部分接入";
  return "未配置";
}

export default function IntegrationsPage() {
  const status = buildIntegrationStatus();

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-col gap-3 rounded-lg border bg-white p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Database className="size-5 text-primary" />
              <h1 className="text-xl font-semibold tracking-normal text-foreground">
                API 接入诊断
              </h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              这个页面只用于开发自检，不放在主创作流程里。所有密钥只从环境变量读取，页面不会回显任何 Key。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={status.ai.configured ? "success" : "outline"}>
              {status.ai.configured ? "云模型已配置" : "本地策略可用"}
            </Badge>
            <Badge variant={status.videoApi.configured ? "success" : "outline"}>
              {status.videoApi.configured ? "视频 API 已配置" : "本地出片可用"}
            </Badge>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {status.capabilities.map((capability) => (
            <Card key={capability.key}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">{capability.label}</CardTitle>
                  <Badge variant={badgeVariant(capability.status)}>
                    {statusText(capability.status)}
                  </Badge>
                </div>
                <CardDescription>{capability.detail}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {capability.env.map((envName) => (
                    <Badge variant="outline" key={`${capability.key}-${envName}`}>
                      {envName}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">大模型配置</CardTitle>
              <CardDescription>OpenAI-compatible Provider，用于文本、视觉和可选整段视频理解。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p>Base URL：{status.ai.baseUrl}</p>
              <p>Text：{status.ai.textModel}</p>
              <p>Vision：{status.ai.visionModel}</p>
              <p>Video input：{status.ai.videoInputMode}</p>
              <p>Structured output：{status.ai.structuredOutputs ? "on" : "off"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">视频生成配置</CardTitle>
              <CardDescription>只用于素材缺口补全或分段生成，结构迁移仍由本项目控制。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p>Base URL：{status.videoApi.baseUrl}</p>
              <p>Model：{status.videoApi.model}</p>
              <p>Submit endpoint：{status.videoApi.endpoint}</p>
              <p>Query endpoint：{status.videoApi.queryEndpoint}</p>
              <p>Segment seconds：{status.videoApi.segmentSeconds}</p>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-primary" />
              安全边界
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
            {status.safetyNotes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
