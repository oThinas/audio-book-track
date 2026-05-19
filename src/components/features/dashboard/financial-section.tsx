import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DateRangeIso } from "@/lib/domain/dashboard-period";
import type { DashboardWidgetKey } from "@/lib/domain/dashboard-widget";
import { createDashboardService } from "@/lib/factories/dashboard";
import { formatCentsBRL } from "@/lib/utils/format-currency";

import { FinancialKpiCard } from "./financial-kpi-card";
import { FinancialRankingTabs } from "./financial-ranking-tabs";

interface FinancialSectionProps {
  readonly period: DateRangeIso;
  readonly enabledWidgets: ReadonlyArray<DashboardWidgetKey>;
}

export async function FinancialSection({ period, enabledWidgets }: FinancialSectionProps) {
  const enabled = new Set(enabledWidgets);
  const service = createDashboardService();
  const snapshot = await service.getFinancial(period, enabledWidgets);

  const cards = [
    {
      key: "a-receber-agora" as const,
      label: "A receber agora",
      value: formatCentsBRL(snapshot.aReceberAgoraCents),
      hint: "Capítulos concluídos ainda não pagos.",
    },
    {
      key: "receita-periodo" as const,
      label: "Receita realizada no período",
      value: formatCentsBRL(snapshot.receitaPeriodoCents),
      hint: `${snapshot.chaptersPagosCount} capítulo(s) pago(s) no período.`,
    },
    {
      key: "ticket-medio" as const,
      label: "Ticket médio por capítulo",
      value: formatCentsBRL(snapshot.ticketMedioCents),
      hint: "Receita do período ÷ capítulos pagos.",
    },
  ];

  const visibleCards = cards.filter((card) => enabled.has(card.key));
  const showRankings =
    enabled.has("ranking-estudio") ||
    enabled.has("ranking-narrador") ||
    enabled.has("ranking-editor");

  if (visibleCards.length === 0 && !showRankings) return null;

  return (
    <section aria-label="Resumo financeiro" className="flex flex-col gap-4">
      {visibleCards.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleCards.map((card) => (
            <FinancialKpiCard key={card.key}>
              <FinancialKpiCard.Label>{card.label}</FinancialKpiCard.Label>
              <FinancialKpiCard.Value>{card.value}</FinancialKpiCard.Value>
              <FinancialKpiCard.Hint>{card.hint}</FinancialKpiCard.Hint>
            </FinancialKpiCard>
          ))}
        </div>
      )}

      {showRankings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <FinancialRankingTabs
              studio={enabled.has("ranking-estudio") ? snapshot.rankingEstudio : []}
              narrator={enabled.has("ranking-narrador") ? snapshot.rankingNarrador : []}
              editor={enabled.has("ranking-editor") ? snapshot.rankingEditor : []}
            />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
