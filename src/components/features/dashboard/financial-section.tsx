import type { DateRangeIso } from "@/lib/domain/dashboard-period";
import type { DashboardWidgetKey } from "@/lib/domain/dashboard-widget";
import { createDashboardService } from "@/lib/factories/dashboard";
import { formatCentsBRL } from "@/lib/utils/format-currency";

import { FinancialKpiCard } from "./financial-kpi-card";

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
  ];

  const visible = cards.filter((card) => enabled.has(card.key));

  if (visible.length === 0) return null;

  return (
    <section aria-label="Resumo financeiro" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {visible.map((card) => (
        <FinancialKpiCard key={card.key}>
          <FinancialKpiCard.Label>{card.label}</FinancialKpiCard.Label>
          <FinancialKpiCard.Value>{card.value}</FinancialKpiCard.Value>
          <FinancialKpiCard.Hint>{card.hint}</FinancialKpiCard.Hint>
        </FinancialKpiCard>
      ))}
    </section>
  );
}
