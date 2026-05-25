#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";

function run(cmd, options = {}) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", ...options }).trim();
}

function runInherit(cmd, options = {}) {
  execSync(cmd, { stdio: "inherit", ...options });
}

function fail(message) {
  console.error(`\n[submission-pack] ${message}\n`);
  process.exit(1);
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  const v = process.argv[idx + 1];
  if (!v || v.startsWith("--")) return null;
  return v;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

try {
  const repoRoot = run("git rev-parse --show-toplevel");
  process.chdir(repoRoot);

  runInherit("npm run submission:check");

  const shortSha = run("git rev-parse --short HEAD");
  const iso = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  const outDir = path.join(repoRoot, "submissions");
  mkdirSync(outDir, { recursive: true });

  const outZip = path.join(outDir, `viral-structure-transfer-${iso}-${shortSha}.zip`);
  runInherit(`git archive --format=zip --output "${outZip}" HEAD`);

  const includeDemo = getArg("--include-demo-video");
  if (includeDemo) {
    if (!existsSync(includeDemo)) fail(`Demo video not found: ${includeDemo}`);
    const base = path.basename(includeDemo);
    runInherit(
      `zip -q -j "${outZip}" "${includeDemo}"`,
      { cwd: repoRoot },
    );
    console.log(`[submission-pack] Included demo video: ${base}`);
  } else if (hasFlag("--include-demo-video")) {
    fail("Missing value for --include-demo-video <path>");
  }

  console.log(`[submission-pack] OK: ${outZip}`);
} catch (err) {
  fail(err?.message ?? String(err));
}

