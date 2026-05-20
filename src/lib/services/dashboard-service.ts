import type { ChapterStatus } from "@/lib/domain/chapter";
import {
  type BucketRange,
  bucketDates,
  formatBucketLabel,
  type Granularity,
  inferGranularity,
} from "@/lib/domain/dashboard-bucketing";
import type { DateRangeIso } from "@/lib/domain/dashboard-period";
import { DASHBOARD_WIDGETS, type DashboardWidgetKey } from "@/lib/domain/dashboard-widget";
import { densifyBuckets, ticketMedioCents } from "@/lib/domain/earnings-aggregations";
import { todayInAppTimezone } from "@/lib/domain/timezone";
import type {
  DashboardRepository,
  RankingEntry,
  StatusFunnel,
} from "@/lib/repositories/dashboard-repository";

const TOP_LIMIT = 10;

export interface FinancialSnapshot {
  readonly periodo: DateRangeIso;
  readonly aReceberAgoraCents: number;
  readonly receitaPeriodoCents: number;
  readonly ticketMedioCents: number;
  readonly chaptersPagosCount: number;
  readonly rankingEstudio: ReadonlyArray<RankingEntry>;
  readonly rankingNarrador: ReadonlyArray<RankingEntry>;
  readonly rankingEditor: ReadonlyArray<RankingEntry>;
  readonly computedWidgets: ReadonlyArray<DashboardWidgetKey>;
}

export interface OperationalSnapshot {
  readonly funnel: StatusFunnel;
  readonly overdueCount: number;
  readonly firstOverdueBookId: string | null;
  readonly computedWidgets: ReadonlyArray<DashboardWidgetKey>;
}

export interface RetrospectiveBucket extends BucketRange {
  readonly labelPtBr: string;
  readonly cents: number;
}

export interface RetrospectiveSnapshot {
  readonly periodo: DateRangeIso;
  readonly granularity: Granularity;
  readonly buckets: ReadonlyArray<RetrospectiveBucket>;
  readonly computedWidgets: ReadonlyArray<DashboardWidgetKey>;
}

const FINANCIAL_WIDGETS = [
  "a-receber-agora",
  "receita-periodo",
  "ticket-medio",
  "ranking-estudio",
  "ranking-narrador",
  "ranking-editor",
] as const satisfies ReadonlyArray<DashboardWidgetKey>;

const OPERATIONAL_WIDGETS = [
  "funil-status",
  "atrasados",
] as const satisfies ReadonlyArray<DashboardWidgetKey>;

const RETROSPECTIVE_WIDGETS = [
  "grafico-receita",
] as const satisfies ReadonlyArray<DashboardWidgetKey>;

const EMPTY_FUNNEL: StatusFunnel = {
  pending: 0,
  editing: 0,
  reviewing: 0,
  retake: 0,
  completed: 0,
  paid: 0,
};

function intersect(
  enabled: ReadonlyArray<DashboardWidgetKey> | undefined,
  scope: ReadonlyArray<DashboardWidgetKey>,
): DashboardWidgetKey[] {
  if (!enabled) return [...scope];
  const enabledSet = new Set(enabled);
  return scope.filter((key) => enabledSet.has(key));
}

export class DashboardService {
  constructor(private readonly repo: DashboardRepository) {}

  async getFinancial(
    period: DateRangeIso,
    enabledWidgets?: ReadonlyArray<DashboardWidgetKey>,
  ): Promise<FinancialSnapshot> {
    const computed = intersect(enabledWidgets, FINANCIAL_WIDGETS);
    const enabled = new Set(computed);

    const [
      aReceberAgoraCents,
      receitaPeriodoCents,
      chaptersPagosCount,
      rankingEstudio,
      rankingNarrador,
      rankingEditor,
    ] = await Promise.all([
      enabled.has("a-receber-agora") ? this.repo.getAReceberAgoraCents() : Promise.resolve(0),
      enabled.has("receita-periodo") || enabled.has("ticket-medio")
        ? this.repo.getReceitaPeriodoCents(period)
        : Promise.resolve(0),
      enabled.has("ticket-medio") || enabled.has("receita-periodo")
        ? this.repo.getChaptersPagosCount(period)
        : Promise.resolve(0),
      enabled.has("ranking-estudio")
        ? this.repo.getRankingByStudio(period, TOP_LIMIT)
        : Promise.resolve<RankingEntry[]>([]),
      enabled.has("ranking-narrador")
        ? this.repo.getRankingByNarrator(period, TOP_LIMIT)
        : Promise.resolve<RankingEntry[]>([]),
      enabled.has("ranking-editor")
        ? this.repo.getRankingByEditor(period, TOP_LIMIT)
        : Promise.resolve<RankingEntry[]>([]),
    ]);

    return {
      periodo: period,
      aReceberAgoraCents,
      receitaPeriodoCents,
      ticketMedioCents: enabled.has("ticket-medio")
        ? ticketMedioCents(receitaPeriodoCents, chaptersPagosCount)
        : 0,
      chaptersPagosCount,
      rankingEstudio,
      rankingNarrador,
      rankingEditor,
      computedWidgets: computed,
    };
  }

  async getOperational(
    enabledWidgets?: ReadonlyArray<DashboardWidgetKey>,
  ): Promise<OperationalSnapshot> {
    const computed = intersect(enabledWidgets, OPERATIONAL_WIDGETS);
    const enabled = new Set(computed);
    const todayIso = todayInAppTimezone();

    const [funnel, overdue] = await Promise.all([
      enabled.has("funil-status") ? this.repo.getStatusFunnel() : Promise.resolve(EMPTY_FUNNEL),
      enabled.has("atrasados")
        ? this.repo.getOverdueSummary(todayIso)
        : Promise.resolve({ overdueCount: 0, firstOverdueBookId: null }),
    ]);

    return {
      funnel,
      overdueCount: overdue.overdueCount,
      firstOverdueBookId: overdue.firstOverdueBookId,
      computedWidgets: computed,
    };
  }

  async getRetrospective(
    period: DateRangeIso,
    enabledWidgets?: ReadonlyArray<DashboardWidgetKey>,
  ): Promise<RetrospectiveSnapshot> {
    const computed = intersect(enabledWidgets, RETROSPECTIVE_WIDGETS);
    const granularity = inferGranularity(period);

    if (computed.length === 0) {
      return {
        periodo: period,
        granularity,
        buckets: [],
        computedWidgets: computed,
      };
    }

    const buckets = bucketDates(period, granularity);
    const sparse = await this.repo.getRevenueBuckets(period, granularity);
    const densified = densifyBuckets(buckets, sparse);
    return {
      periodo: period,
      granularity,
      buckets: densified.map((b) => ({
        startIso: b.startIso,
        endIso: b.endIso,
        cents: b.cents,
        labelPtBr: formatBucketLabel(b, granularity),
      })),
      computedWidgets: computed,
    };
  }
}

// Re-export for downstream consumers in tests.
export type { ChapterStatus, DashboardWidgetKey, DateRangeIso };
export { DASHBOARD_WIDGETS };
