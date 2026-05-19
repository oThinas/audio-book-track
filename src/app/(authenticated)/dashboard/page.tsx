import { headers } from "next/headers";

import { DashboardPageContent } from "@/components/features/dashboard/dashboard-page-content";
import { auth } from "@/lib/auth/server";
import { parsePeriodSearchParams } from "@/lib/domain/dashboard-period";
import { DEFAULT_DASHBOARD_WIDGETS } from "@/lib/domain/dashboard-widget";
import { todayInAppTimezone } from "@/lib/domain/timezone";
import { createUserPreferenceService } from "@/lib/factories/user-preference";

interface DashboardPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function toUrlSearchParams(raw: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      const first = value[0];
      if (first !== undefined) params.set(key, first);
    } else {
      params.set(key, value);
    }
  }
  return params;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const sp = await searchParams;
  const todayIso = todayInAppTimezone();
  const period = parsePeriodSearchParams(toUrlSearchParams(sp), todayIso);

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user.id;
  const enabledWidgets = userId
    ? (await createUserPreferenceService().getOrDefault(userId)).dashboardWidgets
    : DEFAULT_DASHBOARD_WIDGETS;

  return (
    <DashboardPageContent
      period={period}
      enabledWidgets={[...enabledWidgets]}
      todayIso={todayIso}
    />
  );
}
