import { attachPlanEvaluation } from "@/lib/evaluation";
import { insertBeatAfter, moveBeat, removeBeat } from "@/lib/plan-edit";
import type { MigratedVideoPlan, VideoStructureAnalysis } from "@/lib/schemas";

export type NaturalLanguageEditResult = {
  plan: MigratedVideoPlan;
  applied: string[];
  warnings: string[];
};

type EditScope = "best" | "all" | { versionName: string };

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function splitInstructions(text: string) {
  return text
    .split(/\n|；|;/g)
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function parseBeatIndex(text: string) {
  const match = text.match(/第\s*(\d+)\s*(段|镜头|拍|beat)/i);
  if (!match) return null;
  const index = Number(match[1]);
  if (!Number.isFinite(index) || index <= 0) return null;
  return index - 1;
}

function parseBeatIndexPair(text: string) {
  const match = text.match(/第\s*(\d+)\s*(?:段|镜头|拍|beat).*第\s*(\d+)\s*(?:段|镜头|拍|beat)/i);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
  return { a: a - 1, b: b - 1 };
}

function parseScope(line: string): { scope: EditScope; remaining: string } {
  if (line.includes("所有版本")) {
    return { scope: "all", remaining: line.replace("所有版本", "").trim() };
  }
  const versionMatch = line.match(/版本\s*[:：]?\s*([^\s]+)\s*/);
  if (versionMatch) {
    return {
      scope: { versionName: versionMatch[1] },
      remaining: line.replace(versionMatch[0], "").trim(),
    };
  }
  return { scope: "best", remaining: line };
}

function pickVersionIndexes(plan: MigratedVideoPlan, scope: EditScope) {
  if (scope === "all") return plan.versions.map((_, index) => index);
  if (scope === "best") {
    const bestName = plan.evaluation?.bestVersion;
    const bestIndex = bestName
      ? plan.versions.findIndex((v) => v.versionName === bestName)
      : -1;
    return [bestIndex >= 0 ? bestIndex : 0];
  }
  const matchIndex = plan.versions.findIndex((v) => v.versionName === scope.versionName);
  return [matchIndex >= 0 ? matchIndex : 0];
}

function parseAssignment(line: string) {
  const match = line.match(/^(.*?)(?:改为|设为|=|：|:)\s*(.+)$/);
  if (!match) return null;
  return { left: normalizeText(match[1]), right: normalizeText(match[2]) };
}

function parseHashtags(text: string) {
  const tags = text
    .split(/[\s，,]+/g)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
  return Array.from(new Set(tags));
}

function parseTimeRange(text: string) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*[-~～]\s*(\d+(?:\.\d+)?)(?:\s*s|秒)?/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

function formatTimeRange(start: number, end: number) {
  const toStr = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
  return `${toStr(start)}-${toStr(end)}s`;
}

function beatFieldFromText(text: string) {
  const normalized = text.replace(/\s+/g, "");
  if (normalized.includes("时间") || normalized.includes("时长")) return "timeRange" as const;
  if (normalized.includes("目的") || normalized.includes("镜头目的")) return "shotPurpose" as const;
  if (normalized.includes("画面")) return "visualSuggestion" as const;
  if (normalized.includes("口播") || normalized.includes("字幕")) return "voiceoverOrSubtitle" as const;
  if (normalized.includes("包装")) return "packagingStyle" as const;
  if (normalized.includes("卖点")) return "sellingPointIntent" as const;
  if (normalized.includes("节奏") || normalized.includes("转场")) return "transitionAndRhythm" as const;
  if (normalized.includes("素材")) return "replaceableAssets" as const;
  if (normalized.includes("风险")) return "riskNotes" as const;
  return null;
}

export function applyNaturalLanguageEdits(
  plan: MigratedVideoPlan,
  instruction: string,
  analysis?: VideoStructureAnalysis,
): NaturalLanguageEditResult {
  const nextPlan: MigratedVideoPlan = structuredClone(plan);
  const applied: string[] = [];
  const warnings: string[] = [];

  const lines = splitInstructions(instruction);
  if (lines.length === 0) {
    return { plan: attachPlanEvaluation(nextPlan, analysis), applied, warnings: ["未检测到可执行的指令。"] };
  }

  for (const rawLine of lines) {
    const { scope, remaining } = parseScope(rawLine);
    const assignment = parseAssignment(remaining);

    const moveMatch = remaining.match(/第\s*(\d+)\s*(段|镜头|拍|beat)\s*(上移|下移)/i);
    if (moveMatch) {
      const beatIndex = Number(moveMatch[1]) - 1;
      const direction = moveMatch[3] === "上移" ? "up" : "down";
      for (const versionIndex of pickVersionIndexes(nextPlan, scope)) {
        const version = nextPlan.versions[versionIndex];
        if (beatIndex < 0 || beatIndex >= version.scriptBeats.length) {
          warnings.push(`第${beatIndex + 1}段超出范围（${version.versionName}）。`);
          continue;
        }
        nextPlan.versions[versionIndex] = moveBeat(version, beatIndex, direction);
      }
      applied.push(`第${beatIndex + 1}段${direction === "up" ? "上移" : "下移"}`);
      continue;
    }

    const deleteMatch = remaining.match(/删除\s*第\s*(\d+)\s*(段|镜头|拍|beat)/i);
    if (deleteMatch) {
      const beatIndex = Number(deleteMatch[1]) - 1;
      for (const versionIndex of pickVersionIndexes(nextPlan, scope)) {
        const version = nextPlan.versions[versionIndex];
        if (beatIndex < 0 || beatIndex >= version.scriptBeats.length) {
          warnings.push(`第${beatIndex + 1}段超出范围（${version.versionName}）。`);
          continue;
        }
        if (version.scriptBeats.length <= 3) {
          warnings.push(`无法删除：${version.versionName} 仅剩 ${version.scriptBeats.length} 段（至少保留 3 段）。`);
          continue;
        }
        nextPlan.versions[versionIndex] = removeBeat(version, beatIndex);
      }
      applied.push(`删除第${beatIndex + 1}段`);
      continue;
    }

    const insertMatch = remaining.match(/在\s*第\s*(\d+)\s*(段|镜头|拍|beat)\s*(后|之后)\s*(新增|插入)/i);
    if (insertMatch) {
      const beatIndex = Number(insertMatch[1]) - 1;
      for (const versionIndex of pickVersionIndexes(nextPlan, scope)) {
        const version = nextPlan.versions[versionIndex];
        if (beatIndex < 0 || beatIndex >= version.scriptBeats.length) {
          warnings.push(`第${beatIndex + 1}段超出范围（${version.versionName}）。`);
          continue;
        }
        nextPlan.versions[versionIndex] = insertBeatAfter(version, beatIndex);
      }
      applied.push(`在第${beatIndex + 1}段后新增一段`);
      continue;
    }

    if (remaining.includes("交换") || remaining.includes("对调")) {
      const pair = parseBeatIndexPair(remaining);
      if (pair) {
        for (const versionIndex of pickVersionIndexes(nextPlan, scope)) {
          const version = nextPlan.versions[versionIndex];
          if (
            pair.a < 0 ||
            pair.b < 0 ||
            pair.a >= version.scriptBeats.length ||
            pair.b >= version.scriptBeats.length
          ) {
            warnings.push(`交换失败：段落序号超出范围（${version.versionName}）。`);
            continue;
          }
          const nextBeats = version.scriptBeats.slice();
          const temp = nextBeats[pair.a];
          nextBeats[pair.a] = nextBeats[pair.b];
          nextBeats[pair.b] = temp;
          nextPlan.versions[versionIndex] = { ...version, scriptBeats: nextBeats };
        }
        applied.push(`交换第${pair.a + 1}段与第${pair.b + 1}段`);
        continue;
      }
    }

    if (assignment) {
      const { left, right } = assignment;

      if (/(封面|cover)/i.test(left) && left.includes("标题")) {
        for (const index of pickVersionIndexes(nextPlan, scope)) {
          nextPlan.versions[index] = { ...nextPlan.versions[index], coverTitle: right };
        }
        applied.push(`封面标题 → ${right}`);
        continue;
      }

      if (/(文案|caption)/i.test(left) && left.includes("标题")) {
        for (const index of pickVersionIndexes(nextPlan, scope)) {
          nextPlan.versions[index] = { ...nextPlan.versions[index], captionTitle: right };
        }
        applied.push(`文案标题 → ${right}`);
        continue;
      }

      if (left.includes("话题") || left.includes("标签") || left.toLowerCase().includes("hashtag")) {
        const tags = parseHashtags(right);
        for (const index of pickVersionIndexes(nextPlan, scope)) {
          nextPlan.versions[index] = { ...nextPlan.versions[index], hashtags: tags };
        }
        applied.push(`话题标签 → ${tags.join(" ")}`);
        continue;
      }

      const beatIndex = parseBeatIndex(left);
      if (beatIndex !== null) {
        const field = beatFieldFromText(left);
        if (!field) {
          warnings.push(`无法识别字段：${rawLine}`);
          continue;
        }

        for (const versionIndex of pickVersionIndexes(nextPlan, scope)) {
          const version = nextPlan.versions[versionIndex];
          if (beatIndex >= version.scriptBeats.length) {
            warnings.push(`第${beatIndex + 1}段超出范围（${version.versionName} 仅有 ${version.scriptBeats.length} 段）。`);
            continue;
          }
          const nextBeats = version.scriptBeats.map((beat, idx) =>
            idx === beatIndex ? { ...beat, [field]: right } : beat,
          );
          nextPlan.versions[versionIndex] = { ...version, scriptBeats: nextBeats };
        }
        applied.push(`第${beatIndex + 1}段.${field} → ${right}`);
        continue;
      }
    }

    const extendMatch = remaining.match(/第\s*(\d+)\s*(段|镜头).*?(延长|缩短)\s*(\d+(?:\.\d+)?)\s*(s|秒)/);
    if (extendMatch) {
      const beatIndex = Number(extendMatch[1]) - 1;
      const direction = extendMatch[3];
      const delta = Number(extendMatch[4]) * (direction === "缩短" ? -1 : 1);
      for (const versionIndex of pickVersionIndexes(nextPlan, scope)) {
        const version = nextPlan.versions[versionIndex];
        if (beatIndex < 0 || beatIndex >= version.scriptBeats.length) {
          warnings.push(`第${beatIndex + 1}段超出范围（${version.versionName}）。`);
          continue;
        }
        const currentRange = parseTimeRange(version.scriptBeats[beatIndex].timeRange);
        if (!currentRange) {
          warnings.push(`无法解析时间段：${version.scriptBeats[beatIndex].timeRange}`);
          continue;
        }
        const nextEnd = currentRange.end + delta;
        if (nextEnd <= currentRange.start) {
          warnings.push(`缩短后时间段无效：${version.scriptBeats[beatIndex].timeRange}`);
          continue;
        }
        const nextBeats = version.scriptBeats.map((beat, idx) =>
          idx === beatIndex ? { ...beat, timeRange: formatTimeRange(currentRange.start, nextEnd) } : beat,
        );
        nextPlan.versions[versionIndex] = { ...version, scriptBeats: nextBeats };
      }
      applied.push(`第${beatIndex + 1}段时间段 ${direction}${Math.abs(delta)}s`);
      continue;
    }

    warnings.push(`未匹配的指令：${rawLine}`);
  }

  return {
    plan: attachPlanEvaluation(nextPlan, analysis),
    applied,
    warnings,
  };
}
