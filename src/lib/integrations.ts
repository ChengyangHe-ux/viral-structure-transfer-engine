export type IntegrationCapabilityStatus = "ready" | "partial" | "missing";

export type IntegrationCapability = {
  key: string;
  label: string;
  status: IntegrationCapabilityStatus;
  detail: string;
  env: string[];
};

export type IntegrationStatus = {
  ai: {
    configured: boolean;
    baseUrl: string;
    textModel: string;
    visionModel: string;
    videoModel: string;
    videoInputMode: "hybrid" | "frames" | "direct" | "off";
    structuredOutputs: boolean;
    directVideo: boolean;
  };
  videoApi: {
    configured: boolean;
    baseUrl: string;
    model: string;
    endpoint: string;
    queryEndpoint: string;
    durationSeconds: string;
    segmentSeconds: string;
  };
  capabilities: IntegrationCapability[];
  safetyNotes: string[];
};

type Env = Record<string, string | undefined>;

function hasValue(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function sanitizedUrl(value: string | undefined, fallback: string) {
  if (!hasValue(value)) return fallback;
  try {
    const url = new URL(value!);
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return "custom endpoint";
  }
}

function videoInputMode(env: Env): IntegrationStatus["ai"]["videoInputMode"] {
  const mode = env.AI_VIDEO_INPUT_MODE;
  if (mode === "frames" || mode === "direct" || mode === "off") return mode;
  return "hybrid";
}

function capability(
  key: string,
  label: string,
  status: IntegrationCapabilityStatus,
  detail: string,
  env: string[],
): IntegrationCapability {
  return { key, label, status, detail, env };
}

export function buildIntegrationStatus(env: Env = process.env): IntegrationStatus {
  const aiConfigured = hasValue(env.AI_API_KEY);
  const textModel = env.AI_MODEL_TEXT || "gpt-4.1-mini";
  const visionModel = env.AI_MODEL_VISION || textModel;
  const videoModel = env.AI_MODEL_VIDEO || visionModel;
  const mode = videoInputMode(env);
  const videoApiConfigured = hasValue(env.VIDEO_API_BASE_URL) && hasValue(env.VIDEO_API_KEY);
  const videoApiModel = env.VIDEO_API_MODEL || "veo3.1-fast";
  const videoEndpoint = env.VIDEO_API_ENDPOINT || "/v1/videos";
  const queryEndpoint = env.VIDEO_API_QUERY_ENDPOINT || "/v1/videos/{id}";
  const durationSeconds = env.VIDEO_API_DURATION_SECONDS || "5";
  const segmentSeconds = env.VIDEO_API_SEGMENT_SECONDS || durationSeconds;

  const capabilities: IntegrationCapability[] = [
    capability(
      "text-model",
      "脚本与迁移方案",
      aiConfigured ? "ready" : "missing",
      aiConfigured
        ? `使用 ${textModel} 生成结构化脚本和多版本方案。`
        : "未配置 AI_API_KEY 时使用本地策略，演示仍可跑通。",
      ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL_TEXT"],
    ),
    capability(
      "vision-frames",
      "关键帧理解",
      aiConfigured ? "ready" : "missing",
      aiConfigured
        ? `使用 ${visionModel} 观察抽帧，辅助拆解字幕、构图和节奏。`
        : "未配置模型时只使用文本观察和本地规则。",
      ["AI_MODEL_VISION", "AI_VISION_FRAME_LIMIT"],
    ),
    capability(
      "direct-video",
      "整段视频理解",
      aiConfigured && mode !== "off"
        ? mode === "frames"
          ? "partial"
          : "ready"
        : "missing",
      mode === "off"
        ? "已关闭整段视频理解，只走关键帧。"
        : mode === "frames"
          ? "当前配置只走关键帧；可改为 hybrid 或 direct。"
          : aiConfigured
            ? `尝试用 ${videoModel} 直接理解整段视频；兼容服务不支持时自动退回关键帧。`
            : "需要 AI_API_KEY；不同兼容服务对 video_url 支持不同。",
      ["AI_MODEL_VIDEO", "AI_VIDEO_INPUT_MODE", "AI_DIRECT_VIDEO_MAX_MB", "AI_DIRECT_VIDEO_FPS"],
    ),
    capability(
      "video-generation",
      "外部视频生成",
      videoApiConfigured ? "ready" : "missing",
      videoApiConfigured
        ? `使用 ${videoApiModel} 生成缺口素材或分段视频，再由本项目拼接。`
        : "未配置视频生成 API 时仍可用 Remotion 本地出片。",
      [
        "VIDEO_API_BASE_URL",
        "VIDEO_API_KEY",
        "VIDEO_API_MODEL",
        "VIDEO_API_ENDPOINT",
        "VIDEO_API_QUERY_ENDPOINT",
      ],
    ),
  ];

  return {
    ai: {
      configured: aiConfigured,
      baseUrl: sanitizedUrl(env.AI_BASE_URL, "https://api.openai.com/v1"),
      textModel,
      visionModel,
      videoModel,
      videoInputMode: mode,
      structuredOutputs: env.AI_SUPPORTS_STRUCTURED_OUTPUTS === "true",
      directVideo: aiConfigured && mode !== "off" && mode !== "frames",
    },
    videoApi: {
      configured: videoApiConfigured,
      baseUrl: sanitizedUrl(env.VIDEO_API_BASE_URL, "not configured"),
      model: videoApiModel,
      endpoint: videoEndpoint,
      queryEndpoint,
      durationSeconds,
      segmentSeconds,
    },
    capabilities,
    safetyNotes: [
      "API Key 只从环境变量读取，不在页面、日志、数据库或导出稿中回显。",
      "外部视频生成只用于补充素材或分段生成，结构迁移逻辑仍由本项目负责。",
      "兼容服务不支持整段视频输入时，会自动回退到关键帧理解和本地演示策略。",
    ],
  };
}
