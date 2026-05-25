import { mkdir, rm, symlink } from "node:fs/promises";
import path from "node:path";

import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import { path as ffprobePath } from "@ffprobe-installer/ffprobe";

async function main() {
  const binariesDirectory = path.resolve(process.cwd(), ".remotion-binaries");
  await mkdir(binariesDirectory, { recursive: true });

  await rm(path.join(binariesDirectory, "ffmpeg"), { force: true });
  await rm(path.join(binariesDirectory, "ffprobe"), { force: true });

  await symlink(ffmpegPath, path.join(binariesDirectory, "ffmpeg"));
  await symlink(ffprobePath, path.join(binariesDirectory, "ffprobe"));

  console.log(`[media:binaries] OK: ${binariesDirectory}`);
}

await main();

