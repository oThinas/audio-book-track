import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DateRangeIso } from "@/lib/domain/dashboard-period";
import type { DashboardWidgetKey } from "@/lib/domain/dashboard-widget";
import { createDashboardService } from "@/lib/factories/dashboard";

import { RevenueChart } from "./revenue-chart-lazy";

interface RetrospectiveSectionProps {
  readonly period: DateRangeIso;
  readonly enabledWidgets: ReadonlyArray<DashboardWidgetKey>;
}

export async function RetrospectiveSection({ period, enabledWidgets }: RetrospectiveSectionProps) {
  const enabled = new Set(enabledWidgets);
  if (!enabled.has("grafico-receita")) return null;

  const snapshot = await createDashboardService().getRetrospective(period, enabledWidgets);
  const totalCents = snapshot.buckets.reduce((sum, bucket) => sum + bucket.cents, 0);
  const empty = totalCents === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Receita ao longo do período
        </CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-muted-foreground">
            Sem receita registrada para o período selecionado.
          </p>
        ) : (
          <RevenueChart buckets={snapshot.buckets} />
        )}
      </CardContent>
    </Card>
  );
}
