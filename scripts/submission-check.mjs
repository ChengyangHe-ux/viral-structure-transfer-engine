#!/usr/bin/env node
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }).trim();
}

function fail(message) {
  console.error(`\n[submission-check] ${message}\n`);
  process.exit(1);
}

function assertFile(path) {
  if (!existsSync(path)) fail(`Missing required file: ${path}`);
}

function assertNoTracked(pattern) {
  const out = run(`git ls-files -z -- ${pattern} || true`);
  if (out.length > 0) fail(`Forbidden tracked file(s) matched: ${pattern}`);
}

function assertNoTrackedExcept(pattern, allowed) {
  const out = execSync(`git ls-files -z -- ${pattern} || true`, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (!out || out.length === 0) return;
  const files = out
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((p) => !allowed.has(p));
  if (files.length > 0) fail(`Forbidden tracked file(s):\n- ${files.join("\n- ")}`);
}

try {
  const status = run("git status --porcelain=v1");
  if (status.length > 0) fail("Working tree is not clean. Commit or stash changes first.");

  assertFile("README.md");
  assertFile("package.json");
  assertFile("package-lock.json");
  assertFile("docs/ARCHITECTURE.md");
  assertFile("docs/DEMO_SCRIPT.md");
  assertFile("docs/SUBMISSION.md");
  assertFile("cases/ai-resume-demo-case.md");

  const forbidden = [
    ".env",
    ".env*.local",
    "dev.db",
    "dev.db-journal",
    "prisma/dev.db",
    "prisma/dev.db-journal",
    "node_modules",
    ".next",
    "out",
    "dist",
    "coverage",
    "data/uploads",
    "data/frames",
    "screenshots",
    ".DS_Store",
    ".playwright-mcp",
    "何承洋简历.pdf",
  ];
  for (const pattern of forbidden) assertNoTracked(pattern);
  assertNoTrackedExcept(".env.*", new Set([".env.example"]));

  console.log("[submission-check] OK");
} catch (err) {
  fail(err?.message ?? String(err));
}
