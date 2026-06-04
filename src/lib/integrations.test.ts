import { describe, expect, it } from "vitest";

import { buildIntegrationStatus } from "@/lib/integrations";

describe("integration status", () => {
  it("reports local fallback when API keys are missing", () => {
    const status = buildIntegrationStatus({});

    expect(status.ai.configured).toBe(false);
    expect(status.ai.baseUrl).toBe("https://api.openai.com/v1");
    expect(status.ai.videoInputMode).toBe("hybrid");
    expect(status.ai.directVideo).toBe(false);
    expect(status.videoApi.configured).toBe(false);
    expect(status.capabilities.find((item) => item.key === "text-model")?.status).toBe("missing");
    expect(JSON.stringify(status)).not.toContain("sk-");
  });

  it("reports configured OpenAI-compatible and video generation providers without leaking keys", () => {
    const status = buildIntegrationStatus({
      AI_BASE_URL: "https://api.example.com/v1",
      AI_API_KEY: "sk-test-secret",
      AI_MODEL_TEXT: "glm-4-flash",
      AI_MODEL_VISION: "glm-4v-flash",
      AI_MODEL_VIDEO: "glm-video",
      AI_SUPPORTS_STRUCTURED_OUTPUTS: "true",
      VIDEO_API_BASE_URL: "https://video.example.com",
      VIDEO_API_KEY: "video-secret",
      VIDEO_API_MODEL: "cogvideox-3",
      VIDEO_API_ENDPOINT: "/v1/videos/generations",
      VIDEO_API_QUERY_ENDPOINT: "/v1/async-result/{id}",
      VIDEO_API_DURATION_SECONDS: "10",
      VIDEO_API_SEGMENT_SECONDS: "5",
    });

    expect(status.ai.configured).toBe(true);
    expect(status.ai.baseUrl).toBe("https://api.example.com/v1");
    expect(status.ai.textModel).toBe("glm-4-flash");
    expect(status.ai.visionModel).toBe("glm-4v-flash");
    expect(status.ai.structuredOutputs).toBe(true);
    expect(status.ai.directVideo).toBe(true);
    expect(status.videoApi.configured).toBe(true);
    expect(status.videoApi.provider).toBe("generic");
    expect(status.videoApi.model).toBe("cogvideox-3");
    expect(status.videoApi.endpoint).toBe("/v1/videos/generations");
    expect(status.videoApi.queryEndpoint).toBe("/v1/async-result/{id}");
    expect(status.videoApi.segmentSeconds).toBe("5");
    expect(status.capabilities.find((item) => item.key === "video-generation")?.status).toBe(
      "ready",
    );
    expect(JSON.stringify(status)).not.toContain("sk-test-secret");
    expect(JSON.stringify(status)).not.toContain("video-secret");
  });

  it("reports Zhipu video generation when only ZHIPU_API_KEY is configured", () => {
    const status = buildIntegrationStatus({
      ZHIPU_API_KEY: "zhipu-secret",
      ZHIPU_VIDEO_MODEL: "cogvideox-2",
      VIDEO_API_DURATION_SECONDS: "5",
    });

    expect(status.videoApi.configured).toBe(true);
    expect(status.videoApi.provider).toBe("zhipu");
    expect(status.videoApi.baseUrl).toBe("https://open.bigmodel.cn/api/paas/v4");
    expect(status.videoApi.model).toBe("cogvideox-2");
    expect(status.videoApi.endpoint).toBe("/videos/generations");
    expect(status.videoApi.queryEndpoint).toBe("/async-result/{id}");
    expect(status.capabilities.find((item) => item.key === "video-generation")?.status).toBe(
      "ready",
    );
    expect(JSON.stringify(status)).not.toContain("zhipu-secret");
  });

  it("marks direct video as partial when frame-only mode is selected", () => {
    const status = buildIntegrationStatus({
      AI_API_KEY: "sk-test-secret",
      AI_VIDEO_INPUT_MODE: "frames",
    });

    expect(status.ai.videoInputMode).toBe("frames");
    expect(status.ai.directVideo).toBe(false);
    expect(status.capabilities.find((item) => item.key === "direct-video")?.status).toBe(
      "partial",
    );
  });
});
