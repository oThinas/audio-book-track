import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { type AuthenticatedContext, withApiErrorHandler } from "@/lib/api/with-error-handler";
import {
  DASHBOARD_WIDGETS,
  type DashboardWidgetKey,
  dashboardWidgetSchema,
} from "@/lib/domain/dashboard-widget";
import { DashboardWidgetsInvalidKeyError } from "@/lib/errors/dashboard-errors";
import { createDashboardService } from "@/lib/factories/dashboard";
import type { DashboardService } from "@/lib/services/dashboard-service";

export interface DashboardOperationalRouteDeps {
  readonly createService: () => DashboardService;
}

const defaultDeps: DashboardOperationalRouteDeps = {
  createService: createDashboardService,
};

const VALID_KEYS = new Set<string>(DASHBOARD_WIDGETS);

function parseWidgetsCsv(raw: string | null): ReadonlyArray<DashboardWidgetKey> | undefined {
  if (raw === null) return undefined;
  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return undefined;
  const parsed: DashboardWidgetKey[] = [];
  for (const token of tokens) {
    if (!VALID_KEYS.has(token)) {
      throw new DashboardWidgetsInvalidKeyError(token);
    }
    parsed.push(dashboardWidgetSchema.parse(token));
  }
  return parsed;
}

export async function handleDashboardOperational(
  request: Request,
  _ctx: AuthenticatedContext<Record<string, never>>,
  routeDeps: DashboardOperationalRouteDeps = defaultDeps,
): Promise<NextResponse> {
  const url = new URL(request.url);
  const widgets = parseWidgetsCsv(url.searchParams.get("widgets"));
  const data = await routeDeps.createService().getOperational(widgets);
  return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
}

export const GET = withApiErrorHandler(handleDashboardOperational);
