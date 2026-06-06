import { execFile } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { AdaptiveTransferStoryboardShot } from "@/lib/adaptive-video-storyboard";

const execFileAsync = promisify(execFile);
export type VideoPackagingPreset = "smart" | "premium" | "cinematic";

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

function escapeAssText(value: string) {
  return value
    .replace(/[{}]/g, "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeFilterPath(filePath: string) {
  return filePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function assTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const wholeSeconds = Math.floor(safeSeconds % 60);
  const centiseconds = Math.floor((safeSeconds - Math.floor(safeSeconds)) * 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function compactSubtitle(value: string, maxLength = 30) {
  const clean = escapeAssText(value)
    .split("字幕手法参考")[0]
    .replace(/^(口播|字幕|旁白|文案)[:：]\s*/i, "")
    .replace(/样例观察仅作结构参考.*/g, "")
    .replace(/([，。！？；、])+/g, "$1")
    .replace(/做做/g, "做")
    .replace(/用用/g, "用")
    .replace(/看看/g, "看")
    .replace(/^第[一二三四五六七八九十0-9]+[，、：:\s]*/g, "")
    .replace(/^真正值得注意的是[，,]*/g, "")
    .replace(/^关键其实是这一点[，,。]*/g, "")
    .replace(/，?用户不需要重新学习流程/g, "")
    .replace(/它把/g, "")
    .replace(/放在了一起解决/g, "一次解决")
    .trim();
  if (!clean) return "";
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
}

function extractTargetTopic(shot: AdaptiveTransferStoryboardShot) {
  const source = `${shot.visual} ${shot.audio}`;
  const topic =
    source.match(/目标内容唯一锚点[:：]\s*([^。；\n]+)/)?.[1] ||
    source.match(/围绕「([^」]+)」/)?.[1] ||
    "";

  return escapeAssText(topic)
    .replace(/^生成一个?/g, "")
    .replace(/^做一个?/g, "")
    .replace(/^(关于|针对|面向)/g, "")
    .replace(/(?:的)?(?:短)?视频$/g, "")
    .replace(/^[，。；、\s]+|[，。；、\s]+$/g, "")
    .trim();
}

function topicDomain(topic: string) {
  if (/雪糕|冰淇淋|冰棍|冰棒/i.test(topic)) return "iceCream";
  if (/咖啡|拿铁|美式|冷萃|奶茶|饮品|果汁/i.test(topic)) return "drink";
  if (/西瓜|水果|草莓|蓝莓|芒果|橙|苹果|桃/i.test(topic)) return "fruit";
  if (/菜|饭|面|甜品|蛋糕|烘焙|食谱|料理|小吃|美食/i.test(topic)) return "food";
  if (/工具|软件|平台|系统|插件|应用|APP|ai|AI|模型|自动化/i.test(topic)) return "tool";
  if (/课程|训练营|咨询|服务|方案/i.test(topic)) return "service";
  if (/卖|商品|产品|新品|好物|护肤|香水|服装|家电/i.test(topic)) return "product";
  return topic ? "generic" : "";
}

function stageForShot(shot: AdaptiveTransferStoryboardShot, index: number) {
  const role = `${shot.role} ${shot.transferredTechnique}`;
  const hasHook = /强钩子|hook|开头|吸引|入口|预告/i.test(role);
  const hasProcess = /卖点|展开|推进|过程|步骤|主体|识别/i.test(role);
  const hasProof = /效果|证明|证据|场景|落地|信任/i.test(role);
  const hasCta = /结尾|收束|CTA|转化|引导|行动/i.test(role);
  if (hasHook || index === 0) return "hook";
  if (hasProcess && index <= 1) return "process";
  if (hasProof) return "proof";
  if (hasCta) return "cta";
  if (hasProcess) return "process";
  return index >= 2 ? "proof" : "process";
}

function visualAwareCaption(shot: AdaptiveTransferStoryboardShot, index: number) {
  const topic = extractTargetTopic(shot);
  const domain = topicDomain(topic);
  if (!domain) return "";

  const stage = stageForShot(shot, index);

  if (domain === "iceCream") {
    if (stage === "hook") return "奶香倒下去\\N先出成品质感";
    if (stage === "process") return "搅到顺滑\\N口感才细腻";
    if (stage === "proof") return "入模冷冻\\N最后看成品";
    return "成型之后\\N就能直接开吃";
  }

  if (domain === "drink") {
    if (stage === "hook") return "先看杯感\\N香气要出来";
    if (stage === "process") return "关键步骤放近\\N风味更好懂";
    if (stage === "proof") return "颜色和层次\\N一眼能看见";
    return "最后给出\\N下单理由";
  }

  if (domain === "fruit") {
    if (stage === "hook") return "先看新鲜切面";
    if (stage === "process") return "甜度和水分\\N用特写证明";
    if (stage === "proof") return "好不好吃\\N画面直接说";
    return "想吃就马上行动";
  }

  if (domain === "food") {
    if (stage === "hook") return "先把成品质感给到";
    if (stage === "process") return "关键步骤放清楚";
    if (stage === "proof") return "出品状态一眼看懂";
    return "最后落到可操作";
  }

  if (domain === "tool") {
    if (stage === "hook") return "先给结果\\N再讲怎么做";
    if (stage === "process") return "把关键操作\\N直接标出来";
    if (stage === "proof") return "效率提升\\N用结果证明";
    return "下一步动作要明确";
  }

  if (domain === "service") {
    if (stage === "hook") return "先把核心收益讲清";
    if (stage === "process") return "流程越短\\N理解越快";
    if (stage === "proof") return "用案例补足信任";
    return "最后给出行动入口";
  }

  if (domain === "product") {
    if (stage === "hook") return "先让产品一眼被记住";
    if (stage === "process") return "把使用场景\\N贴近一点";
    if (stage === "proof") return "卖点要接上结果";
    return "最后收束到购买理由";
  }

  if (stage === "hook") return `${topic}\\N先给最想看的结果`;
  if (stage === "process") return `${topic}\\N把关键过程讲清`;
  if (stage === "proof") return `${topic}\\N用结果完成证明`;
  return `${topic}\\N最后给出下一步`;
}

function shortRoleTag(role: string, index: number) {
  const cleanRole = escapeAssText(role);
  if (/强钩子|hook|开头|吸引/i.test(cleanRole)) return "强钩子";
  if (/卖点|展开|推进/.test(cleanRole)) return "卖点推进";
  if (/效果|证明|证据|场景/.test(cleanRole)) return "效果证明";
  if (/结尾|收束|CTA|转化|引导/i.test(cleanRole)) return "行动引导";
  if (/主体|识别|内容转向/.test(cleanRole)) return "主体识别";
  return `第${index + 1}段`;
}

function polishCaption(value: string) {
  return value
    .replace(/最麻烦的一步提前处理掉/g, "最麻烦的一步\\N提前处理掉")
    .replace(/效果、成本和上手门槛一次解决/g, "效果、成本、门槛\\N一次解决")
    .replace(/效果、成本和上手门槛/g, "效果、成本、门槛")
    .replace(/，关键其实是这一点/g, "")
    .replace(/[。；]+$/g, "")
    .trim();
}

function wrapCaption(value: string, maxCharsPerLine = 15, maxLines = 2) {
  const polished = polishCaption(value);
  if (polished.includes("\\N")) return polished;
  if (polished.length <= maxCharsPerLine) return polished;

  const breakPoints = ["，", "；", "、", "。"];
  for (const point of breakPoints) {
    const index = polished.lastIndexOf(point, maxCharsPerLine + 2);
    if (index >= 5) {
      const first = polished.slice(0, index).replace(/[，；、。]+$/g, "");
      const second = polished.slice(index + 1).replace(/^[，；、。]+/g, "");
      if (second && second.length <= maxCharsPerLine + 4) return `${first}\\N${second}`;
    }
  }

  const lines: string[] = [];
  let rest = polished;
  while (rest && lines.length < maxLines) {
    lines.push(rest.slice(0, maxCharsPerLine));
    rest = rest.slice(maxCharsPerLine);
  }
  const joined = lines.join("\\N");
  return rest ? `${joined.slice(0, -1)}…` : joined;
}

export function subtitleForShot(shot: AdaptiveTransferStoryboardShot, index: number) {
  const subtitle =
    visualAwareCaption(shot, index) ||
    compactSubtitle(shot.audio, 34) ||
    compactSubtitle(shot.role, 26) ||
    `第${index + 1}段，完成关键信息推进`;
  return wrapCaption(subtitle);
}

export function buildAssSubtitle({
  storyboard,
  segmentSeconds,
}: {
  storyboard: AdaptiveTransferStoryboardShot[];
  segmentSeconds: number;
}) {
  const events = storyboard
    .map((shot, index) => {
      const start = index * segmentSeconds;
      const end = start + (shot.durationSeconds || segmentSeconds);
      const text = subtitleForShot(shot, index);
      const tag = shortRoleTag(shot.role, index);
      return [
        `Dialogue: 0,${assTime(start)},${assTime(end)},Tag,,0,0,0,,{\\fad(100,100)}${escapeAssText(tag)}`,
        `Dialogue: 0,${assTime(start)},${assTime(end)},Default,,0,0,0,,{\\fad(120,120)}${escapeAssText(text)}`,
      ].join("\n");
    })
    .join("\n");

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1080",
    "PlayResY: 1920",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Default,PingFang SC,56,&H00FFFFFF,&H000000FF,&HAA000000,&H66000000,1,0,0,0,100,100,0,0,1,5,2,2,92,92,250,1",
    "Style: Tag,PingFang SC,32,&H00F9E9C6,&H000000FF,&HAA000000,&H55000000,1,0,0,0,100,100,0,0,1,3,1,7,64,64,92,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    events,
  ].join("\n");
}

export function buildVideoPolishFilter({
  subtitlePath,
  preset = "smart",
  durationSeconds,
}: {
  subtitlePath: string;
  preset?: VideoPackagingPreset;
  durationSeconds: number;
}) {
  const subtitleFilter = `ass=${escapeFilterPath(subtitlePath)}`;
  if (preset === "smart") return subtitleFilter;

  const fadeOutStart = Math.max(0, durationSeconds - 0.22);
  if (preset === "cinematic") {
    return [
      "eq=contrast=1.075:saturation=1.05:brightness=0.01:gamma=1.015",
      "unsharp=5:5:0.62:3:3:0.2",
      "vignette=PI/8",
      "noise=alls=2:allf=t+u",
      "fade=t=in:st=0:d=0.16",
      `fade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.22`,
      subtitleFilter,
    ].join(",");
  }

  return [
    "eq=contrast=1.055:saturation=1.08:brightness=0.012",
    "unsharp=5:5:0.55:3:3:0.18",
    "vignette=PI/7",
    "fade=t=in:st=0:d=0.12",
    `fade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.22`,
    subtitleFilter,
  ].join(",");
}

export function polishStepsForPreset(preset: VideoPackagingPreset) {
  if (preset === "cinematic") {
    return [
      "电影级竖屏调色",
      "高光保护与主体清晰度增强",
      "轻胶片颗粒，不加黑边",
      "少字强字幕与角色标签",
      "低频氛围声与淡入淡出",
    ];
  }
  if (preset === "premium") {
    return [
      "统一竖屏调色",
      "轻锐化提升主体清晰度",
      "边缘暗角增强中心注意力",
      "段落字幕与角色标签",
      "轻量音频节奏与淡入淡出",
    ];
  }
  return ["段落字幕与角色标签", "轻量音频节奏与淡入淡出"];
}

export async function packageVideoWithSubtitlesAndAudio({
  inputPath,
  outputBaseName,
  outputDir,
  storyboard,
  segmentSeconds,
  preset = "smart",
}: {
  inputPath: string;
  outputBaseName: string;
  outputDir: string;
  storyboard: AdaptiveTransferStoryboardShot[];
  segmentSeconds: number;
  preset?: VideoPackagingPreset;
}) {
  await mkdir(outputDir, { recursive: true });
  const subtitlePath = path.join(outputDir, `${outputBaseName}-subtitles.ass`);
  const suffix =
    preset === "cinematic" ? "cinematic" : preset === "premium" ? "premium" : "packaged";
  const outputPath = path.join(outputDir, `${outputBaseName}-${suffix}.mp4`);
  const inputStat = await stat(inputPath);
  const durationSeconds = Math.max(
    segmentSeconds,
    storyboard.reduce((total, shot) => total + (shot.durationSeconds || segmentSeconds), 0),
  );
  await writeFile(
    subtitlePath,
    buildAssSubtitle({ storyboard, segmentSeconds }),
    "utf-8",
  );

  await execFileAsync(getFfmpegPath(), [
    "-y",
    "-i",
    inputPath,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=132:sample_rate=44100:duration=${durationSeconds}`,
    "-vf",
    buildVideoPolishFilter({ subtitlePath, preset, durationSeconds }),
    "-filter:a",
    `volume=0.035,afade=t=in:st=0:d=0.4,afade=t=out:st=${Math.max(0, durationSeconds - 0.6)}:d=0.6`,
    "-shortest",
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
  const outputStat = await stat(outputPath);
  return {
    filePath: outputPath,
    subtitlePath,
    preset,
    polishSteps: polishStepsForPreset(preset),
    bytes: outputStat.size,
    sourceBytes: inputStat.size,
  };
}
