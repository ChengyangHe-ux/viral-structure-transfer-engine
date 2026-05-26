import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { RenderAudioCue } from "../src/lib/render-timeline";

type AudioCueInput = Pick<RenderAudioCue, "atFrame" | "type" | "intensity" | "label">;

type WriteSyntheticVideoAudioInput = {
  outputPath: string;
  durationSeconds: number;
  fps: number;
  audioCues: AudioCueInput[];
};

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function envelope(distanceSeconds: number, decaySeconds: number) {
  if (distanceSeconds < 0) return 0;
  return Math.exp(-distanceSeconds / decaySeconds);
}

function cueTone(type: AudioCueInput["type"], t: number, intensity: number) {
  const base =
    type === "cta" ? 420 : type === "hit" ? 260 : type === "rise" ? 330 : 180;
  const sparkle = Math.sin(2 * Math.PI * (base * 2.02) * t) * 0.22;
  return (Math.sin(2 * Math.PI * base * t) + sparkle) * intensity;
}

function writeWavHeader(buffer: Buffer, dataSize: number) {
  const byteRate = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;
  const blockAlign = CHANNELS * BYTES_PER_SAMPLE;

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
}

export async function writeSyntheticVideoAudio({
  outputPath,
  durationSeconds,
  fps,
  audioCues,
}: WriteSyntheticVideoAudioInput) {
  const safeDuration = clamp(durationSeconds, 1, 120);
  const sampleCount = Math.ceil(safeDuration * SAMPLE_RATE);
  const dataSize = sampleCount * CHANNELS * BYTES_PER_SAMPLE;
  const buffer = Buffer.alloc(44 + dataSize);
  const cues = audioCues.map((cue) => ({
    ...cue,
    atSecond: cue.atFrame / fps,
    decay: cue.type === "cta" ? 0.42 : cue.type === "hit" ? 0.28 : 0.22,
  }));

  writeWavHeader(buffer, dataSize);

  let peak = 0;
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / SAMPLE_RATE;
    const fadeIn = clamp(t / 0.75, 0, 1);
    const fadeOut = clamp((safeDuration - t) / 1.2, 0, 1);
    const beatPhase = t % 0.5;
    const kick = Math.exp(-beatPhase * 16) * Math.sin(2 * Math.PI * 62 * t) * 0.46;
    const bass = Math.sin(2 * Math.PI * 96 * t) * 0.11;
    const pad =
      Math.sin(2 * Math.PI * 146.8 * t) * 0.08 +
      Math.sin(2 * Math.PI * 220 * t) * 0.045;
    const tick =
      Math.exp(-((t % 0.25) * 32)) * Math.sin(2 * Math.PI * 880 * t) * 0.05;
    const cueLayer = cues.reduce((sum, cue) => {
      const distance = t - cue.atSecond;
      return sum + cueTone(cue.type, t, cue.intensity) * envelope(distance, cue.decay) * 0.36;
    }, 0);
    const value = (kick + bass + pad + tick + cueLayer) * fadeIn * fadeOut;
    samples[index] = value;
    peak = Math.max(peak, Math.abs(value));
  }

  const normalizer = peak > 0 ? Math.min(0.88 / peak, 1) : 1;
  for (let index = 0; index < sampleCount; index += 1) {
    const value = clamp(samples[index]! * normalizer, -0.92, 0.92);
    const intValue = Math.round(value * 32767);
    const offset = 44 + index * CHANNELS * BYTES_PER_SAMPLE;
    buffer.writeInt16LE(intValue, offset);
    buffer.writeInt16LE(intValue, offset + BYTES_PER_SAMPLE);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
}

function parseCliArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item?.startsWith("--")) args[item.slice(2)] = argv[index + 1] ?? "";
  }
  return args;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = parseCliArgs(process.argv.slice(2));
  const outputPath = args.out;
  if (!outputPath) throw new Error("Missing --out <audio.wav>");
  await writeSyntheticVideoAudio({
    outputPath: path.resolve(process.cwd(), outputPath),
    durationSeconds: Number(args.durationSeconds || 15),
    fps: Number(args.fps || 30),
    audioCues: [],
  });
  console.log(`[synthesize-video-audio] OK: ${outputPath}`);
}
