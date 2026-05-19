import type { DashboardWidgetKey } from "@/lib/domain/dashboard-widget";
import { createDashboardService } from "@/lib/factories/dashboard";

import { OverdueCard } from "./overdue-card";

interface OverdueSectionProps {
  readonly enabledWidgets: ReadonlyArray<DashboardWidgetKey>;
}

export async function OverdueSection({ enabledWidgets }: OverdueSectionProps) {
  const enabled = new Set(enabledWidgets);
  if (!enabled.has("atrasados")) return null;

  const snapshot = await createDashboardService().getOperational(["atrasados"]);

  return (
    <OverdueCard count={snapshot.overdueCount} firstOverdueBookId={snapshot.firstOverdueBookId} />
  );
}
