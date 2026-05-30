export type BeatFocus = "Hook" | "证据" | "收益" | "包装" | "CTA" | "推进";

export type MaterialFitState = "matched" | "partial" | "missing" | "unknown";

export type FocusSceneStyle = {
  label: string;
  sceneGradient: string;
  heroGradient: string;
  accent: string;
  accentSoft: string;
  ink: string;
  captionBackground: string;
  texture: string;
};

const sceneStyles: Record<BeatFocus, FocusSceneStyle> = {
  Hook: {
    label: "抢停留",
    sceneGradient:
      "linear-gradient(180deg, #180E22 0%, #381029 46%, #F58A36 100%)",
    heroGradient:
      "linear-gradient(145deg, rgba(255,244,216,0.96), rgba(255,139,74,0.88) 46%, rgba(64,18,36,0.94))",
    accent: "#FFB84D",
    accentSoft: "rgba(255, 184, 77, 0.2)",
    ink: "#FFF8EB",
    captionBackground: "rgba(37, 14, 24, 0.76)",
    texture:
      "radial-gradient(circle at 18% 18%, rgba(255,255,255,0.34), transparent 32%), radial-gradient(circle at 82% 12%, rgba(255,209,113,0.28), transparent 28%)",
  },
  证据: {
    label: "可信证据",
    sceneGradient:
      "linear-gradient(180deg, #071628 0%, #0E3152 50%, #58B8FF 100%)",
    heroGradient:
      "linear-gradient(145deg, rgba(230,247,255,0.96), rgba(87,184,255,0.78) 48%, rgba(9,37,72,0.96))",
    accent: "#74D7FF",
    accentSoft: "rgba(116, 215, 255, 0.2)",
    ink: "#F3FBFF",
    captionBackground: "rgba(4, 22, 42, 0.76)",
    texture:
      "linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
  },
  收益: {
    label: "收益放大",
    sceneGradient:
      "linear-gradient(180deg, #071B16 0%, #0F493D 52%, #72E2B8 100%)",
    heroGradient:
      "linear-gradient(145deg, rgba(235,255,246,0.96), rgba(99,218,177,0.78) 48%, rgba(8,54,45,0.96))",
    accent: "#86F0BE",
    accentSoft: "rgba(134, 240, 190, 0.2)",
    ink: "#F3FFF8",
    captionBackground: "rgba(7, 35, 30, 0.76)",
    texture:
      "radial-gradient(circle at 50% 22%, rgba(255,255,255,0.2), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.16), transparent 42%)",
  },
  包装: {
    label: "画面包装",
    sceneGradient:
      "linear-gradient(180deg, #171426 0%, #33306C 48%, #B59CFF 100%)",
    heroGradient:
      "linear-gradient(145deg, rgba(245,242,255,0.96), rgba(181,156,255,0.82) 48%, rgba(34,31,82,0.96))",
    accent: "#C7B7FF",
    accentSoft: "rgba(199, 183, 255, 0.2)",
    ink: "#F7F3FF",
    captionBackground: "rgba(24, 21, 54, 0.76)",
    texture:
      "linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.2) 14%, transparent 28%), radial-gradient(circle at 76% 28%, rgba(255,255,255,0.2), transparent 26%)",
  },
  CTA: {
    label: "行动转化",
    sceneGradient:
      "linear-gradient(180deg, #1C1014 0%, #4B1C2B 50%, #FF6F8E 100%)",
    heroGradient:
      "linear-gradient(145deg, rgba(255,240,244,0.98), rgba(255,111,142,0.82) 48%, rgba(76,21,39,0.96))",
    accent: "#FF8DA5",
    accentSoft: "rgba(255, 141, 165, 0.2)",
    ink: "#FFF4F6",
    captionBackground: "rgba(44, 14, 25, 0.78)",
    texture:
      "radial-gradient(circle at 50% 16%, rgba(255,255,255,0.26), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.12), transparent 48%)",
  },
  推进: {
    label: "结构推进",
    sceneGradient:
      "linear-gradient(180deg, #10151C 0%, #243043 50%, #E3E9F0 100%)",
    heroGradient:
      "linear-gradient(145deg, rgba(247,250,252,0.96), rgba(161,178,199,0.76) 48%, rgba(27,39,56,0.96))",
    accent: "#D7E0EA",
    accentSoft: "rgba(215, 224, 234, 0.2)",
    ink: "#F8FAFC",
    captionBackground: "rgba(15, 21, 30, 0.76)",
    texture:
      "linear-gradient(135deg, rgba(255,255,255,0.14), transparent 42%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.18), transparent 24%)",
  },
};

export function classifyBeatFocus(text: string): BeatFocus {
  const haystack = text.toLowerCase();
  if (/cta|结尾|行动|转化|入口|收藏|领取|下单|私信|购买/.test(haystack)) return "CTA";
  if (/hook|开头|停留|吸引|反差|抢|冲突|痛点/.test(haystack)) return "Hook";
  if (/证据|背书|可信|反馈|评价|参数|数据|证明|对比/.test(haystack)) return "证据";
  if (/收益|场景|适用|利益|省|提升|结果|价值|效果/.test(haystack)) return "收益";
  if (/包装|字幕|转场|节奏|卡点|贴纸|标题条|封面/.test(haystack)) return "包装";
  return "推进";
}

export function getFocusSceneStyle(focus: BeatFocus, index = 0): FocusSceneStyle {
  if (focus !== "推进") return sceneStyles[focus];
  const fallbackOrder: BeatFocus[] = ["Hook", "证据", "收益", "包装", "CTA"];
  return sceneStyles[fallbackOrder[index % fallbackOrder.length] ?? "推进"];
}

export function compactText(text: string, maxLength: number) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function splitSubtitleLines(text: string, maxLineLength = 14, maxLines = 3) {
  const source = compactText(text || "（待补充口播字幕）", maxLineLength * maxLines + 4);
  const chunks = source
    .replace(/([，。！？；,.!?;])/g, "$1|")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  const lines: string[] = [];
  let current = "";
  for (const chunk of chunks.length ? chunks : [source]) {
    let remaining = chunk;
    while (remaining.length > maxLineLength) {
      if (current) {
        lines.push(current);
        current = "";
        if (lines.length >= maxLines) break;
      }
      lines.push(remaining.slice(0, maxLineLength));
      remaining = remaining.slice(maxLineLength);
      if (lines.length >= maxLines) break;
    }
    if (lines.length >= maxLines) break;
    if (!remaining) continue;
    if ((current + remaining).length <= maxLineLength) {
      current += remaining;
      continue;
    }
    if (current) lines.push(current);
    current = remaining;
    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);

  const visible = lines.slice(0, maxLines);
  const visibleTextLength = visible.join("").length;
  if (source.length > visibleTextLength && visible.length) {
    visible[visible.length - 1] = compactText(
      `${visible[visible.length - 1]}${source.slice(visibleTextLength)}`,
      maxLineLength,
    );
  }
  return visible.length ? visible : ["（待补充口播字幕）"];
}

export function normalizeMaterialFit(fit: string | undefined | null): MaterialFitState {
  if (fit === "matched" || fit === "partial" || fit === "missing") return fit;
  return "unknown";
}

export function getMaterialFitSummary(fit: string | undefined | null) {
  const normalized = normalizeMaterialFit(fit);
  if (normalized === "matched") {
    return {
      fit: normalized,
      label: "素材可用",
      tone: "#72E2B8",
      background: "rgba(114, 226, 184, 0.16)",
    };
  }
  if (normalized === "partial") {
    return {
      fit: normalized,
      label: "需要包装补全",
      tone: "#FFB84D",
      background: "rgba(255, 184, 77, 0.16)",
    };
  }
  if (normalized === "missing") {
    return {
      fit: normalized,
      label: "缺口待补",
      tone: "#FF8DA5",
      background: "rgba(255, 141, 165, 0.18)",
    };
  }
  return {
    fit: normalized,
    label: "素材待确认",
    tone: "#D7E0EA",
    background: "rgba(215, 224, 234, 0.14)",
  };
}

export function extractHighlightText(text: string, maxLength = 8) {
  const clean = compactText(text || "核心卖点", 48);
  const candidates = clean
    .replace(/[，。！？；,.!?;:：]/g, " ")
    .split(/\s+/)
    .filter((item) => item.length >= 2);
  const picked = candidates[0] || clean;
  return compactText(picked, maxLength);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function linearProgress(value: number, inputStart: number, inputEnd: number) {
  if (inputStart === inputEnd) return value >= inputEnd ? 1 : 0;
  return clampNumber((value - inputStart) / (inputEnd - inputStart), 0, 1);
}

export function calculateSceneOpacity({
  frame,
  start,
  end,
  fadeInFrames = 12,
  fadeOutFrames = 16,
  overlapInFrames = 12,
}: {
  frame: number;
  start: number;
  end: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  overlapInFrames?: number;
}) {
  if (frame < start - overlapInFrames || frame >= end) return 0;

  const fadeInStart = start <= 0 ? start : start - overlapInFrames;
  const fadeInEnd = start + fadeInFrames;
  const inOpacity =
    start <= 0 && frame >= start + fadeInFrames
      ? 1
      : linearProgress(frame, fadeInStart, fadeInEnd);
  const cutFloor = start > 0 && frame >= start && frame < start + fadeInFrames ? 0.86 : 0;
  const outOpacity = 1 - linearProgress(frame, end - fadeOutFrames, end);

  return clampNumber(Math.min(Math.max(inOpacity, cutFloor), outOpacity), 0, 1);
}
