import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Args = {
  image?: string;
  prompt: string;
  out: string;
  metadataOut?: string;
  slotId?: string;
  slotKind?: string;
  model: string;
  baseUrl: string;
  duration: 5 | 10;
  size: "720x480" | "1024x1024" | "1280x960" | "960x1280" | "1920x1080" | "1080x1920";
  fps: 30 | 60;
  quality: "speed" | "quality";
  withAudio: boolean;
  pollIntervalMs: number;
  timeoutMs: number;
};

type EnvMap = Record<string, string>;

type ZhipuGenerationResponse = {
  id?: string;
  task_id?: string;
  request_id?: string;
  task_status?: string;
  code?: string | number;
  message?: string;
};

type ZhipuAsyncResult = {
  id?: string;
  task_status?: string;
  request_id?: string;
  video_result?: Array<{
    url?: string;
    cover_image_url?: string;
  }>;
  code?: string | number;
  message?: string;
};

type SubmitImagePayload =
  | {
      image_url?: string;
      rawBase64?: string;
      mimeType?: string;
    }
  | undefined;

const DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

function parseArgs(argv: string[]): Args {
  const parsed: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item?.startsWith("--")) continue;
    parsed[item.slice(2)] = argv[index + 1] ?? "";
  }

  if (!parsed.prompt) throw new Error("Missing --prompt <text>");
  if (!parsed.out) throw new Error("Missing --out <video.mp4>");

  const duration = Number(parsed.duration || 5);
  const fps = Number(parsed.fps || 30);

  return {
    image: parsed.image,
    prompt: parsed.prompt,
    out: parsed.out,
    metadataOut: parsed["metadata-out"],
    slotId: parsed["slot-id"],
    slotKind: parsed["slot-kind"],
    model: parsed.model || process.env.ZHIPU_VIDEO_MODEL || "cogvideox-2",
    baseUrl: parsed["base-url"] || process.env.AI_BASE_URL || DEFAULT_BASE_URL,
    duration: duration === 10 ? 10 : 5,
    size: parseSize(parsed.size),
    fps: fps === 60 ? 60 : 30,
    quality: parsed.quality === "speed" ? "speed" : "quality",
    withAudio: parsed["with-audio"] === "true",
    pollIntervalMs: Math.max(Number(parsed["poll-interval-ms"] || 5000), 1000),
    timeoutMs: Math.max(Number(parsed["timeout-ms"] || 600000), 60000),
  };
}

function parseSize(value: string | undefined): Args["size"] {
  const allowed = new Set([
    "720x480",
    "1024x1024",
    "1280x960",
    "960x1280",
    "1920x1080",
    "1080x1920",
  ]);
  return allowed.has(value ?? "") ? (value as Args["size"]) : "1080x1920";
}

function parseEnvFile(content: string): EnvMap {
  const env: EnvMap = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!key) continue;
    env[key] = rawValue?.trim().replace(/^['"]|['"]$/g, "") ?? "";
  }
  return env;
}

async function loadLocalEnv() {
  const files = [".env", ".env.local"];
  const env: EnvMap = {};

  for (const file of files) {
    try {
      const fileEnv = parseEnvFile(await readFile(path.resolve(process.cwd(), file), "utf8"));
      for (const [key, value] of Object.entries(fileEnv)) {
        if (value) env[key] = value;
      }
    } catch {
      // Optional local env files are ignored in CI and shared environments.
    }
  }

  return env;
}

function apiKeyFrom(env: EnvMap) {
  return process.env.ZHIPU_API_KEY || process.env.AI_API_KEY || env.ZHIPU_API_KEY || env.AI_API_KEY;
}

function joinUrl(baseUrl: string, suffix: string) {
  return `${baseUrl.replace(/\/$/, "")}/${suffix.replace(/^\//, "")}`;
}

function mimeTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

async function loadImagePayload(imagePath: string | undefined): Promise<SubmitImagePayload> {
  if (!imagePath) return undefined;

  const resolved = path.resolve(process.cwd(), imagePath);
  const image = await readFile(resolved);
  if (image.byteLength > 5 * 1024 * 1024) {
    throw new Error(`Image is larger than 5MB: ${imagePath}`);
  }

  const rawBase64 = image.toString("base64");
  const mimeType = mimeTypeFor(resolved);
  return {
    image_url: `data:${mimeType};base64,${rawBase64}`,
    rawBase64,
    mimeType,
  };
}

async function requestJson<T>({
  url,
  apiKey,
  method,
  body,
}: {
  url: string;
  apiKey: string;
  method: "GET" | "POST";
  body?: unknown;
}) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T & { error?: unknown }) : ({} as T);

  if (!response.ok) {
    throw new Error(`Zhipu API ${response.status}: ${text.slice(0, 1200)}`);
  }

  return payload;
}

async function submitGeneration(args: Args, apiKey: string, imagePayload: SubmitImagePayload) {
  const body = {
    model: args.model,
    prompt: args.prompt.slice(0, 512),
    image_url: imagePayload?.image_url,
    quality: args.quality,
    with_audio: args.withAudio,
    size: args.size,
    fps: args.fps,
    duration: args.duration,
  };

  try {
    return await requestJson<ZhipuGenerationResponse>({
      url: joinUrl(args.baseUrl, "/videos/generations"),
      apiKey,
      method: "POST",
      body,
    });
  } catch (error) {
    if (!imagePayload?.rawBase64) throw error;
    return requestJson<ZhipuGenerationResponse>({
      url: joinUrl(args.baseUrl, "/videos/generations"),
      apiKey,
      method: "POST",
      body: {
        ...body,
        image_url: imagePayload.rawBase64,
      },
    });
  }
}

function taskIdFrom(payload: ZhipuGenerationResponse) {
  return payload.id || payload.task_id || payload.request_id;
}

function isFailureStatus(status: string | undefined) {
  const normalized = status?.toUpperCase();
  return normalized === "FAIL" || normalized === "FAILED" || normalized === "ERROR";
}

function isSuccessStatus(status: string | undefined) {
  const normalized = status?.toUpperCase();
  return normalized === "SUCCESS" || normalized === "SUCCEEDED";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollResult(args: Args, apiKey: string, taskId: string) {
  const deadline = Date.now() + args.timeoutMs;
  let lastPayload: ZhipuAsyncResult | null = null;

  while (Date.now() < deadline) {
    const payload = await requestJson<ZhipuAsyncResult>({
      url: joinUrl(args.baseUrl, `/async-result/${taskId}`),
      apiKey,
      method: "GET",
    });
    lastPayload = payload;

    if (isSuccessStatus(payload.task_status) && payload.video_result?.[0]?.url) {
      return payload;
    }
    if (isFailureStatus(payload.task_status)) {
      throw new Error(`Zhipu task failed: ${JSON.stringify(payload)}`);
    }

    console.log(`[video:zhipu] task ${taskId} status=${payload.task_status ?? "UNKNOWN"}`);
    await sleep(args.pollIntervalMs);
  }

  throw new Error(`Timed out waiting for Zhipu task ${taskId}: ${JSON.stringify(lastPayload)}`);
}

async function downloadFile(url: string, outputPath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed ${response.status}: ${await response.text()}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = await loadLocalEnv();
  const apiKey = apiKeyFrom(env);
  if (!apiKey) throw new Error("Missing AI_API_KEY or ZHIPU_API_KEY");

  const imagePayload = await loadImagePayload(args.image);
  const submitted = await submitGeneration(args, apiKey, imagePayload);
  const taskId = taskIdFrom(submitted);
  if (!taskId) throw new Error(`Zhipu did not return task id: ${JSON.stringify(submitted)}`);

  console.log(`[video:zhipu] submitted task ${taskId}`);
  const result = await pollResult(args, apiKey, taskId);
  const videoUrl = result.video_result?.[0]?.url;
  if (!videoUrl) throw new Error(`Missing video url: ${JSON.stringify(result)}`);

  const resolvedOut = path.resolve(process.cwd(), args.out);
  await downloadFile(videoUrl, resolvedOut);

  const metadataPath = args.metadataOut
    ? path.resolve(process.cwd(), args.metadataOut)
    : `${resolvedOut}.json`;
  await writeFile(
    metadataPath,
    JSON.stringify(
      {
        taskId,
        slotId: args.slotId ?? null,
        slotKind: args.slotKind ?? null,
        model: args.model,
        prompt: args.prompt,
        quality: args.quality,
        duration: args.duration,
        withAudio: args.withAudio,
        out: resolvedOut,
        result,
      },
      null,
      2,
    ),
  );

  console.log(`[video:zhipu] OK: ${resolvedOut}`);
}

await main();
