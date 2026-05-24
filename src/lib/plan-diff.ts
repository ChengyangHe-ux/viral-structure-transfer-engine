import type { MigratedVideoPlan, PlanBeat, PlanVersion } from "@/lib/schemas";

export type PlanDiffItem =
  | { kind: "version"; versionName: string; field: string; before: string; after: string }
  | { kind: "hashtags"; versionName: string; before: string[]; after: string[] }
  | { kind: "beats-count"; versionName: string; before: number; after: number }
  | {
      kind: "beat-field";
      versionName: string;
      beatIndex: number;
      field: keyof PlanBeat;
      before: string;
      after: string;
    };

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function getComparableVersion(plan: MigratedVideoPlan, versionName: string) {
  return plan.versions.find((v) => v.versionName === versionName) ?? null;
}

function diffVersionFields(before: PlanVersion, after: PlanVersion): PlanDiffItem[] {
  const items: PlanDiffItem[] = [];
  const fields: Array<keyof PlanVersion> = [
    "positioning",
    "bestFor",
    "coverTitle",
    "captionTitle",
  ];
  for (const field of fields) {
    const a = safeString(before[field]);
    const b = safeString(after[field]);
    if (a !== b) {
      items.push({
        kind: "version",
        versionName: before.versionName,
        field,
        before: a,
        after: b,
      });
    }
  }

  const beforeTags = before.hashtags ?? [];
  const afterTags = after.hashtags ?? [];
  if (!arraysEqual(beforeTags, afterTags)) {
    items.push({
      kind: "hashtags",
      versionName: before.versionName,
      before: beforeTags,
      after: afterTags,
    });
  }

  if (before.scriptBeats.length !== after.scriptBeats.length) {
    items.push({
      kind: "beats-count",
      versionName: before.versionName,
      before: before.scriptBeats.length,
      after: after.scriptBeats.length,
    });
  }

  const beatFields: Array<keyof PlanBeat> = [
    "timeRange",
    "shotPurpose",
    "visualSuggestion",
    "voiceoverOrSubtitle",
    "packagingStyle",
    "sellingPointIntent",
    "transitionAndRhythm",
    "replaceableAssets",
    "riskNotes",
  ];
  const max = Math.min(before.scriptBeats.length, after.scriptBeats.length);
  for (let index = 0; index < max; index += 1) {
    const b0 = before.scriptBeats[index];
    const b1 = after.scriptBeats[index];
    for (const field of beatFields) {
      const a = safeString(b0[field]);
      const b = safeString(b1[field]);
      if (a !== b) {
        items.push({
          kind: "beat-field",
          versionName: before.versionName,
          beatIndex: index,
          field,
          before: a,
          after: b,
        });
      }
    }
  }

  return items;
}

export function diffPlans(before: MigratedVideoPlan, after: MigratedVideoPlan) {
  const items: PlanDiffItem[] = [];
  const versionNames = Array.from(
    new Set([...before.versions.map((v) => v.versionName), ...after.versions.map((v) => v.versionName)]),
  );
  for (const versionName of versionNames) {
    const a = getComparableVersion(before, versionName);
    const b = getComparableVersion(after, versionName);
    if (!a || !b) continue;
    items.push(...diffVersionFields(a, b));
  }
  return items;
}

