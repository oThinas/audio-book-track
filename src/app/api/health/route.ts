import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  checkDatabaseConnection,
  type HealthCheckResult,
  type PingFn,
} from "@/lib/db/health-check";
import { createDatabasePing } from "@/lib/db/ping";

interface HealthCheckDeps {
  createPing: () => PingFn;
  checkConnection: (ping: PingFn) => Promise<HealthCheckResult>;
}

export async function handleHealthCheck(
  deps: HealthCheckDeps = {
    createPing: () => createDatabasePing(db),
    checkConnection: checkDatabaseConnection,
  },
): Promise<NextResponse> {
  const ping = deps.createPing();
  const result = await deps.checkConnection(ping);

  const status = result.healthy ? "healthy" : "unhealthy";

  return NextResponse.json(
    { status, checks: { database: status } },
    {
      status: result.healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function GET(): Promise<NextResponse> {
  return handleHealthCheck();
}
