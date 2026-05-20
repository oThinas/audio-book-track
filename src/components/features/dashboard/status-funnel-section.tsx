import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardWidgetKey } from "@/lib/domain/dashboard-widget";
import { createDashboardService } from "@/lib/factories/dashboard";

import { StatusFunnel } from "./status-funnel";

interface StatusFunnelSectionProps {
  readonly enabledWidgets: ReadonlyArray<DashboardWidgetKey>;
}

export async function StatusFunnelSection({ enabledWidgets }: StatusFunnelSectionProps) {
  const enabled = new Set(enabledWidgets);
  if (!enabled.has("funil-status")) return null;

  const snapshot = await createDashboardService().getOperational(["funil-status"]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Funil de status</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <StatusFunnel funnel={snapshot.funnel} />
      </CardContent>
    </Card>
  );
}
