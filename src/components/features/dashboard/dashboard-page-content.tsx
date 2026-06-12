import { Suspense } from "react";

// Design reference: /design.pen "Dashboard / Operator Overview" frame —
// editorial calm direction, data-dense but airy spacing (gap-6 between sections),
// muted tokens for hierarchy, primary tone only on critical alerts. Consult via
// Pencil MCP `open_document` before adjusting typography/spacing.

import {
  PageContainer,
  PageDescription,
  PageHeader,
  PageTitle,
} from "@/components/layout/page-container";
import type { DateRangeIso } from "@/lib/domain/dashboard-period";
import type { DashboardWidgetKey } from "@/lib/domain/dashboard-widget";

import { FinancialKpisSection } from "./financial-kpis-section";
import { FinancialRankingsSection } from "./financial-rankings-section";
import { OverdueBadge } from "./overdue-badge";
import { PeriodFilter } from "./period-filter";
import { RetrospectiveSection } from "./retrospective-section";
import { SectionSkeleton } from "./section-skeleton";
import { StatusFunnelSection } from "./status-funnel-section";
import { WidgetsEmptyState } from "./widgets-empty-state";

interface DashboardPageContentProps {
  readonly period: DateRangeIso;
  readonly enabledWidgets: ReadonlyArray<DashboardWidgetKey>;
  readonly todayIso: string;
}

export function DashboardPageContent({
  period,
  enabledWidgets,
  todayIso,
}: DashboardPageContentProps) {
  return (
    <PageContainer>
      <PageHeader>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <PageTitle>Dashboard</PageTitle>
            <PageDescription>Visão geral da operação</PageDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <Suspense fallback={null}>
              <OverdueBadge enabledWidgets={enabledWidgets} />
            </Suspense>
            <PeriodFilter todayIso={todayIso} />
          </div>
        </div>
      </PageHeader>

      <div className="flex flex-col gap-8">
        {enabledWidgets.length === 0 ? (
          <WidgetsEmptyState />
        ) : (
          <>
            {/* Linha 1: KPIs */}
            <Suspense fallback={<SectionSkeleton lines={3} />}>
              <FinancialKpisSection period={period} enabledWidgets={enabledWidgets} />
            </Suspense>

            {/* Linha 2: Rankings (2 colunas) + Funil de status (1 coluna) */}
            <div className="grid items-stretch gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Suspense fallback={<SectionSkeleton lines={6} />}>
                  <FinancialRankingsSection period={period} enabledWidgets={enabledWidgets} />
                </Suspense>
              </div>
              <Suspense fallback={<SectionSkeleton lines={4} />}>
                <StatusFunnelSection enabledWidgets={enabledWidgets} />
              </Suspense>
            </div>

            {/* Linha 3: Receita ao longo do período */}
            <Suspense fallback={<SectionSkeleton lines={6} />}>
              <RetrospectiveSection period={period} enabledWidgets={enabledWidgets} />
            </Suspense>
          </>
        )}
      </div>
    </PageContainer>
  );
}
