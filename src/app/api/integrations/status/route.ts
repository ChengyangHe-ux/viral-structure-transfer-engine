import { NextResponse } from "next/server";

import { buildIntegrationStatus } from "@/lib/integrations";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(buildIntegrationStatus());
}
