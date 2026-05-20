import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DateRangeIso } from "@/lib/domain/dashboard-period";
import type { DashboardWidgetKey } from "@/lib/domain/dashboard-widget";
import { createDashboardService } from "@/lib/factories/dashboard";

import { FinancialRankingTabs } from "./financial-ranking-tabs";

const RANKING_WIDGETS = ["ranking-estudio", "ranking-narrador", "ranking-editor"] as const;

interface FinancialRankingsSectionProps {
  readonly period: DateRangeIso;
  readonly enabledWidgets: ReadonlyArray<DashboardWidgetKey>;
}

export async function FinancialRankingsSection({
  period,
  enabledWidgets,
}: FinancialRankingsSectionProps) {
  const enabled = new Set(enabledWidgets);
  const enabledRankings = RANKING_WIDGETS.filter((key) => enabled.has(key));
  if (enabledRankings.length === 0) return null;

  const snapshot = await createDashboardService().getFinancial(period, enabledRankings);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Rankings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <FinancialRankingTabs
          studio={enabled.has("ranking-estudio") ? snapshot.rankingEstudio : []}
          narrator={enabled.has("ranking-narrador") ? snapshot.rankingNarrador : []}
          editor={enabled.has("ranking-editor") ? snapshot.rankingEditor : []}
        />
      </CardContent>
    </Card>
  );
}
