import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");
  if (!filePath) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const rendersRoot = path.resolve(process.cwd(), "renders", "api-videos");
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(`${rendersRoot}${path.sep}`)) {
    return NextResponse.json({ error: "Invalid render path" }, { status: 403 });
  }

  try {
    const file = await readFile(resolvedPath);
    return new NextResponse(file, {
      headers: {
        "content-type": "video/mp4",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }
}
