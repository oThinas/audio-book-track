import type { DashboardWidgetKey } from "@/lib/domain/dashboard-widget";
import { createDashboardService } from "@/lib/factories/dashboard";

import { OverdueCard } from "./overdue-card";
import { StatusFunnel } from "./status-funnel";

interface OperationalSectionProps {
  readonly enabledWidgets: ReadonlyArray<DashboardWidgetKey>;
}

export async function OperationalSection({ enabledWidgets }: OperationalSectionProps) {
  const enabled = new Set(enabledWidgets);
  if (!enabled.has("funil-status") && !enabled.has("atrasados")) return null;

  const snapshot = await createDashboardService().getOperational(enabledWidgets);

  return (
    <section aria-label="Indicadores operacionais" className="flex flex-col gap-4">
      {enabled.has("funil-status") && <StatusFunnel funnel={snapshot.funnel} />}
      {enabled.has("atrasados") && (
        <OverdueCard
          count={snapshot.overdueCount}
          firstOverdueBookId={snapshot.firstOverdueBookId}
        />
      )}
    </section>
  );
}
