import { NextResponse } from "next/server";

import { listUploadedVideos } from "@/lib/media";

export const runtime = "nodejs";

export async function GET() {
  try {
    const files = await listUploadedVideos();
    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list uploads" },
      { status: 400 },
    );
  }
}

