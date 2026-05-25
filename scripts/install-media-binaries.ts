import { mkdir, rm, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import { path as ffprobePath } from "@ffprobe-installer/ffprobe";

function resolveCompositorBinary() {
  const require = createRequire(import.meta.url);
  if (process.platform === "win32") {
    // Only x64 is supported by Remotion compositor on Windows.
    const mod = require("@remotion/compositor-win32-x64-msvc") as { dir: string };
    return { source: path.join(mod.dir, "remotion.exe"), targetName: "remotion.exe" };
  }

  if (process.platform === "darwin") {
    if (process.arch === "arm64") {
      const mod = require("@remotion/compositor-darwin-arm64") as { dir: string };
      return { source: path.join(mod.dir, "remotion"), targetName: "remotion" };
    }
    const mod = require("@remotion/compositor-darwin-x64") as { dir: string };
    return { source: path.join(mod.dir, "remotion"), targetName: "remotion" };
  }

  // Linux
  if (process.arch === "arm64") {
    try {
      const mod = require("@remotion/compositor-linux-arm64-gnu") as { dir: string };
      return { source: path.join(mod.dir, "remotion"), targetName: "remotion" };
    } catch {
      const mod = require("@remotion/compositor-linux-arm64-musl") as { dir: string };
      return { source: path.join(mod.dir, "remotion"), targetName: "remotion" };
    }
  }

  try {
    const mod = require("@remotion/compositor-linux-x64-gnu") as { dir: string };
    return { source: path.join(mod.dir, "remotion"), targetName: "remotion" };
  } catch {
    const mod = require("@remotion/compositor-linux-x64-musl") as { dir: string };
    return { source: path.join(mod.dir, "remotion"), targetName: "remotion" };
  }
}

async function main() {
  const binariesDirectory = path.resolve(process.cwd(), ".remotion-binaries");
  await mkdir(binariesDirectory, { recursive: true });

  await rm(path.join(binariesDirectory, "ffmpeg"), { force: true });
  await rm(path.join(binariesDirectory, "ffprobe"), { force: true });
  await rm(path.join(binariesDirectory, "remotion"), { force: true });
  await rm(path.join(binariesDirectory, "remotion.exe"), { force: true });

  await symlink(ffmpegPath, path.join(binariesDirectory, "ffmpeg"));
  await symlink(ffprobePath, path.join(binariesDirectory, "ffprobe"));

  const compositor = resolveCompositorBinary();
  await symlink(compositor.source, path.join(binariesDirectory, compositor.targetName));

  console.log(`[media:binaries] OK: ${binariesDirectory}`);
}

await main();
