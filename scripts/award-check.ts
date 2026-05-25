import { demoPresets } from "../src/lib/demo-presets";
import { buildOfflineDemoCase } from "../src/lib/offline-demo-case";

const minimumScore = 90;

const rows = demoPresets.map((preset) => {
  const { plan } = buildOfflineDemoCase(preset);
  return {
    label: preset.label,
    score: plan.awardReadiness?.overallScore ?? 0,
    verdict: plan.awardReadiness?.verdict ?? "needs-polish",
    topTechniques: plan.retrievedTechniques
      .slice(0, 3)
      .map((technique) => technique.title)
      .join(" / "),
    nextAction: plan.awardReadiness?.nextActions[0] ?? "补充冲奖动作",
  };
});

console.log("[award-check] Offline demo award readiness");
for (const row of rows) {
  console.log(
    `- ${row.label}: ${row.score}/100 (${row.verdict}) · ${row.topTechniques}`,
  );
}

const failed = rows.filter((row) => row.score < minimumScore);
if (failed.length > 0) {
  console.error(
    `\n[award-check] Expected every demo case to score >= ${minimumScore}; failed:\n${failed
      .map((row) => `- ${row.label}: ${row.score}/100，${row.nextAction}`)
      .join("\n")}`,
  );
  process.exit(1);
}

console.log(`[award-check] OK: all demo cases score >= ${minimumScore}`);
