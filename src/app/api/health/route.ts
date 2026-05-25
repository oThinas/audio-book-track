import { NextResponse } from "next/server";

import { withApiErrorHandler } from "@/lib/api/with-error-handler";
import { db } from "@/lib/db";
import {
  checkDatabaseConnection,
  type HealthCheckResult,
  type PingFn,
} from "@/lib/db/health-check";
import { createDatabasePing } from "@/lib/db/ping";
import { env } from "@/lib/env";

export interface HealthCheckDeps {
  createPing: () => PingFn;
  checkConnection: (ping: PingFn) => Promise<HealthCheckResult>;
  uptimeSeconds: () => number;
  appVersion: string | undefined;
}

const defaultDeps: HealthCheckDeps = {
  createPing: () => createDatabasePing(db),
  checkConnection: checkDatabaseConnection,
  uptimeSeconds: () => Math.floor(process.uptime()),
  appVersion: env.APP_VERSION,
};

interface DatabaseCheckOk {
  status: "ok";
  latency_ms: number;
}

interface DatabaseCheckDown {
  status: "down";
  message: string;
}

interface HealthPayload {
  status: "ok" | "degraded";
  uptime_seconds: number;
  app_version: string;
  checks: {
    database: DatabaseCheckOk | DatabaseCheckDown;
  };
}

export async function handleHealthCheck(
  deps: HealthCheckDeps = defaultDeps,
): Promise<NextResponse> {
  const ping = deps.createPing();
  const result = await deps.checkConnection(ping);

  const databaseCheck: DatabaseCheckOk | DatabaseCheckDown = result.healthy
    ? { status: "ok", latency_ms: result.latencyMs ?? 0 }
    : { status: "down", message: result.error };

  const payload: HealthPayload = {
    status: result.healthy ? "ok" : "degraded",
    uptime_seconds: deps.uptimeSeconds(),
    app_version: deps.appVersion ?? "unknown",
    checks: { database: databaseCheck },
  };

  return NextResponse.json(payload, {
    status: result.healthy ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export const GET = withApiErrorHandler(async () => handleHealthCheck(), { requireAuth: false });
