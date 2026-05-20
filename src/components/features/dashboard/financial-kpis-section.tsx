import type { DateRangeIso } from "@/lib/domain/dashboard-period";
import type { DashboardWidgetKey } from "@/lib/domain/dashboard-widget";
import { createDashboardService } from "@/lib/factories/dashboard";
import { formatCentsBRL } from "@/lib/utils/format-currency";

import { FinancialKpiCard } from "./financial-kpi-card";

const KPI_WIDGETS = ["a-receber-agora", "receita-periodo", "ticket-medio"] as const;

interface FinancialKpisSectionProps {
  readonly period: DateRangeIso;
  readonly enabledWidgets: ReadonlyArray<DashboardWidgetKey>;
}

export async function FinancialKpisSection({ period, enabledWidgets }: FinancialKpisSectionProps) {
  const enabled = new Set(enabledWidgets);
  const kpiKeys = KPI_WIDGETS.filter((key) => enabled.has(key));
  if (kpiKeys.length === 0) return null;

  const snapshot = await createDashboardService().getFinancial(period, kpiKeys);

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
  ].filter((card) => enabled.has(card.key));

  return (
    <section
      aria-label="Indicadores financeiros"
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
    >
      {cards.map((card) => (
        <FinancialKpiCard key={card.key}>
          <FinancialKpiCard.Label>{card.label}</FinancialKpiCard.Label>
          <FinancialKpiCard.Value>{card.value}</FinancialKpiCard.Value>
          <FinancialKpiCard.Hint>{card.hint}</FinancialKpiCard.Hint>
        </FinancialKpiCard>
      ))}
    </section>
  );
}
