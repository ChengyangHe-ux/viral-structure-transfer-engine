import path from "node:path";
import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const idPattern = /^[0-9a-fA-F-]{36}$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!idPattern.test(id)) {
    return NextResponse.json({ error: "Invalid render id" }, { status: 400 });
  }

  const filePath = path.resolve(process.cwd(), "data", "renders", `${id}.mp4`);
  const buffer = await readFile(filePath);

  return new NextResponse(buffer, {
    headers: {
      "content-type": "video/mp4",
      "content-disposition": `attachment; filename=\"render-${id}.mp4\"`,
    },
  });
}

