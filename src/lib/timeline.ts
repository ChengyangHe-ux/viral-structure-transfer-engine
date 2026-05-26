import type { MigrationMapRow } from "@/lib/mapping";

export type TimelineSegment = {
  index: number;
  label: string;
  timeRange: string;
  startSecond: number;
  endSecond: number;
  durationSeconds: number;
  leftPercent: number;
  widthPercent: number;
  focus: string;
  materialFit: MigrationMapRow["materialFit"];
  materialSlotName: string;
  completionPlan: string;
};

function parseTimeRange(timeRange: string, index: number) {
  const match = timeRange.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (!match) {
    const startSecond = index * 5;
    return {
      startSecond,
      endSecond: startSecond + 5,
    };
  }

  const startSecond = Number(match[1]);
  const endSecond = Number(match[2]);

  if (!Number.isFinite(startSecond) || !Number.isFinite(endSecond)) {
    const fallbackStart = index * 5;
    return {
      startSecond: fallbackStart,
      endSecond: fallbackStart + 5,
    };
  }

  return {
    startSecond,
    endSecond: Math.max(endSecond, startSecond + 1),
  };
}

function classifyFocus(row: MigrationMapRow) {
  const text = `${row.samplePurpose} ${row.outputPurpose} ${row.mappingLogic}`;
  if (/hook|开头|停留|吸引|反差|抢/.test(text)) return "Hook";
  if (/证据|背书|可信|反馈|数据|评价/.test(text)) return "证据";
  if (/结尾|行动|转化|CTA|入口|收藏|领取/i.test(text)) return "CTA";
  if (/收益|场景|适用|放大/.test(text)) return "收益";
  if (/包装|字幕|转场|节奏/.test(text)) return "包装";
  return "推进";
}

export function buildTimelineSegments(rows: MigrationMapRow[]): TimelineSegment[] {
  if (rows.length === 0) return [];

  const parsedRows = rows.map((row, index) => {
    const parsed = parseTimeRange(row.outputTimeRange, index);
    return {
      row,
      ...parsed,
      durationSeconds: parsed.endSecond - parsed.startSecond,
    };
  });
  const totalDuration = Math.max(...parsedRows.map((item) => item.endSecond), 1);

  return parsedRows.map((item) => ({
    index: item.row.index,
    label: item.row.outputPurpose,
    timeRange: item.row.outputTimeRange,
    startSecond: item.startSecond,
    endSecond: item.endSecond,
    durationSeconds: item.durationSeconds,
    leftPercent: (item.startSecond / totalDuration) * 100,
    widthPercent: Math.max(8, (item.durationSeconds / totalDuration) * 100),
    focus: classifyFocus(item.row),
    materialFit: item.row.materialFit,
    materialSlotName: item.row.materialSlotName,
    completionPlan: item.row.completionPlan,
  }));
}
