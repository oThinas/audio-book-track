import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { checkDatabaseConnection } from "@/lib/db/health-check";
import { createDatabasePing } from "@/lib/db/ping";

export async function GET(): Promise<NextResponse> {
  const ping = createDatabasePing(db);
  const result = await checkDatabaseConnection(ping);

  const status = result.healthy ? "healthy" : "unhealthy";

  return NextResponse.json(
    { status, checks: { database: status } },
    {
      status: result.healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
