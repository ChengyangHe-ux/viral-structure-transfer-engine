import path from "node:path";
import { readFile, stat } from "node:fs/promises";

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const allowedRoots = [
  path.resolve(process.cwd(), "renders", "api-videos"),
  path.resolve(process.cwd(), "data", "renders"),
];

function isInsideAllowedRoot(filePath: string) {
  return allowedRoots.some((root) => {
    const relative = path.relative(root, filePath);
    return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
  });
}

export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get("path");
  if (!rawPath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const filePath = path.resolve(rawPath);
  if (!isInsideAllowedRoot(filePath) || path.extname(filePath).toLowerCase() !== ".mp4") {
    return NextResponse.json({ error: "Invalid render path" }, { status: 400 });
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return NextResponse.json({ error: "Render not found" }, { status: 404 });
  }

  if (!fileStat.isFile()) {
    return NextResponse.json({ error: "Render is not a file" }, { status: 404 });
  }

  const buffer = await readFile(filePath);

  return new NextResponse(buffer, {
    headers: {
      "content-type": "video/mp4",
      "content-length": String(buffer.byteLength),
      "content-disposition": `inline; filename="${path.basename(filePath)}"`,
    },
  });
}
