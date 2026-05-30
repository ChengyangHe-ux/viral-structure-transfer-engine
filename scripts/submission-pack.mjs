#!/usr/bin/env node
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
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

function requiredFinalDemoFiles(dir) {
  return [
    "final-video.mp4",
    "final-demo-report.md",
    "quality-report.json",
    "final-flow/case.md",
    "final-flow/case.json",
  ].map((file) => path.join(dir, file));
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

  const finalDemoDirArg = getArg("--include-final-demo-dir");
  if (finalDemoDirArg) {
    const finalDemoDir = path.resolve(finalDemoDirArg);
    if (!existsSync(finalDemoDir) || !statSync(finalDemoDir).isDirectory()) {
      fail(`Final demo dir not found: ${finalDemoDirArg}`);
    }

    for (const requiredFile of requiredFinalDemoFiles(finalDemoDir)) {
      if (!existsSync(requiredFile)) {
        fail(`Final demo dir is missing required file: ${path.relative(finalDemoDir, requiredFile)}`);
      }
    }

    const packTempDir = path.join(outDir, `.pack-final-demo-${shortSha}`);
    rmSync(packTempDir, { recursive: true, force: true });
    mkdirSync(packTempDir, { recursive: true });
    cpSync(finalDemoDir, path.join(packTempDir, "final-demo"), { recursive: true });
    runInherit(`zip -q -r "${outZip}" final-demo`, { cwd: packTempDir });
    rmSync(packTempDir, { recursive: true, force: true });
    console.log(`[submission-pack] Included final demo dir: ${finalDemoDir}`);
  } else if (hasFlag("--include-final-demo-dir")) {
    fail("Missing value for --include-final-demo-dir <dir>");
  }

  console.log(`[submission-pack] OK: ${outZip}`);
} catch (err) {
  fail(err?.message ?? String(err));
}
