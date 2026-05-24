import { readFile } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";

import { isSafeFrameId } from "@/lib/media";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!isSafeFrameId(id)) {
    return NextResponse.json({ error: "Invalid frame id" }, { status: 400 });
  }

  const frameDir = path.join(process.cwd(), "data", "frames");
  const framePath = path.join(frameDir, id);
  const resolved = path.resolve(framePath);
  const resolvedDir = path.resolve(frameDir);

  if (!resolved.startsWith(`${resolvedDir}${path.sep}`)) {
    return NextResponse.json({ error: "Invalid frame path" }, { status: 400 });
  }

  try {
    const bytes = await readFile(resolved);
    return new NextResponse(bytes, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Frame not found" }, { status: 404 });
  }
}

