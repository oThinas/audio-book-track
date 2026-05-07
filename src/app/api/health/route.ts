import { NextResponse } from "next/server";

import { withApiErrorHandler } from "@/lib/api/with-error-handler";
import { db } from "@/lib/db";
import {
  checkDatabaseConnection,
  type HealthCheckResult,
  type PingFn,
} from "@/lib/db/health-check";
import { createDatabasePing } from "@/lib/db/ping";

export interface HealthCheckDeps {
  createPing: () => PingFn;
  checkConnection: (ping: PingFn) => Promise<HealthCheckResult>;
}

const defaultDeps: HealthCheckDeps = {
  createPing: () => createDatabasePing(db),
  checkConnection: checkDatabaseConnection,
};

export async function handleHealthCheck(
  deps: HealthCheckDeps = defaultDeps,
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

export const GET = withApiErrorHandler(async () => handleHealthCheck(), { requireAuth: false });
