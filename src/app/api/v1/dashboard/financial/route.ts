import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { type AuthenticatedContext, withApiErrorHandler } from "@/lib/api/with-error-handler";
import { parsePeriodSearchParams } from "@/lib/domain/dashboard-period";
import {
  DASHBOARD_WIDGETS,
  type DashboardWidgetKey,
  dashboardWidgetSchema,
} from "@/lib/domain/dashboard-widget";
import { todayInAppTimezone } from "@/lib/domain/timezone";
import {
  DashboardInvalidPeriodError,
  DashboardWidgetsInvalidKeyError,
} from "@/lib/errors/dashboard-errors";
import { createDashboardService } from "@/lib/factories/dashboard";
import type { DashboardService } from "@/lib/services/dashboard-service";

export interface DashboardRouteDeps {
  readonly createService: () => DashboardService;
  readonly today: () => string;
}

const defaultDeps: DashboardRouteDeps = {
  createService: createDashboardService,
  today: () => todayInAppTimezone(),
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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertExplicitRangeValid(params: URLSearchParams): void {
  const from = params.get("from");
  const to = params.get("to");
  if (from === null && to === null) return;
  if (from === null || to === null) {
    throw new DashboardInvalidPeriodError(
      "period",
      "Informe ambos 'from' e 'to' para um período customizado.",
    );
  }
  if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) {
    throw new DashboardInvalidPeriodError("period", "Datas devem estar no formato YYYY-MM-DD.");
  }
  if (from > to) {
    throw new DashboardInvalidPeriodError("period", "from não pode ser maior que to.");
  }
}

export async function handleDashboardFinancial(
  request: Request,
  _ctx: AuthenticatedContext<Record<string, never>>,
  routeDeps: DashboardRouteDeps = defaultDeps,
): Promise<NextResponse> {
  const url = new URL(request.url);
  const todayIso = routeDeps.today();

  if (url.searchParams.get("preset") === null) {
    assertExplicitRangeValid(url.searchParams);
  }

  const period = parsePeriodSearchParams(url.searchParams, todayIso);
  const widgets = parseWidgetsCsv(url.searchParams.get("widgets"));

  const data = await routeDeps.createService().getFinancial(period, widgets);
  return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
}

export const GET = withApiErrorHandler(handleDashboardFinancial);
