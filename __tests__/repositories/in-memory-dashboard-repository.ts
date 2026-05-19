import type { ChapterStatus } from "@/lib/domain/chapter";
import type { Granularity } from "@/lib/domain/dashboard-bucketing";
import type { DateRangeIso } from "@/lib/domain/dashboard-period";
import type { BucketAmount } from "@/lib/domain/earnings-aggregations";
import type {
  DashboardRepository,
  OverdueSummary,
  RankingEntry,
  StatusFunnel,
} from "@/lib/repositories/dashboard-repository";

export interface InMemoryDashboardOverrides {
  aReceberAgoraCents?: number;
  receitaPeriodoCents?: number;
  chaptersPagosCount?: number;
  rankingByStudio?: RankingEntry[];
  rankingByNarrator?: RankingEntry[];
  rankingByEditor?: RankingEntry[];
  funnel?: Partial<StatusFunnel>;
  overdue?: OverdueSummary;
  revenueBuckets?: BucketAmount[];
}

const DEFAULT_FUNNEL: StatusFunnel = {
  pending: 0,
  editing: 0,
  reviewing: 0,
  retake: 0,
  completed: 0,
  paid: 0,
};

export class InMemoryDashboardRepository implements DashboardRepository {
  public calls = {
    aReceberAgoraCents: 0,
    receitaPeriodoCents: 0,
    chaptersPagosCount: 0,
    rankingByStudio: 0,
    rankingByNarrator: 0,
    rankingByEditor: 0,
    statusFunnel: 0,
    overdueSummary: 0,
    revenueBuckets: 0,
  };

  constructor(private overrides: InMemoryDashboardOverrides = {}) {}

  setOverrides(overrides: InMemoryDashboardOverrides): void {
    this.overrides = overrides;
  }

  async getAReceberAgoraCents(): Promise<number> {
    this.calls.aReceberAgoraCents += 1;
    return this.overrides.aReceberAgoraCents ?? 0;
  }

  async getReceitaPeriodoCents(_range: DateRangeIso): Promise<number> {
    this.calls.receitaPeriodoCents += 1;
    return this.overrides.receitaPeriodoCents ?? 0;
  }

  async getChaptersPagosCount(_range: DateRangeIso): Promise<number> {
    this.calls.chaptersPagosCount += 1;
    return this.overrides.chaptersPagosCount ?? 0;
  }

  async getRankingByStudio(_range: DateRangeIso, _limit: number): Promise<RankingEntry[]> {
    this.calls.rankingByStudio += 1;
    return this.overrides.rankingByStudio ?? [];
  }

  async getRankingByNarrator(_range: DateRangeIso, _limit: number): Promise<RankingEntry[]> {
    this.calls.rankingByNarrator += 1;
    return this.overrides.rankingByNarrator ?? [];
  }

  async getRankingByEditor(_range: DateRangeIso, _limit: number): Promise<RankingEntry[]> {
    this.calls.rankingByEditor += 1;
    return this.overrides.rankingByEditor ?? [];
  }

  async getStatusFunnel(): Promise<StatusFunnel> {
    this.calls.statusFunnel += 1;
    return { ...DEFAULT_FUNNEL, ...(this.overrides.funnel ?? {}) };
  }

  async getOverdueSummary(_todayIso: string): Promise<OverdueSummary> {
    this.calls.overdueSummary += 1;
    return this.overrides.overdue ?? { overdueCount: 0, firstOverdueBookId: null };
  }

  async getRevenueBuckets(
    _range: DateRangeIso,
    _granularity: Granularity,
  ): Promise<BucketAmount[]> {
    this.calls.revenueBuckets += 1;
    return this.overrides.revenueBuckets ?? [];
  }
}

// Re-export ChapterStatus to keep imports consolidated in spec files.
export type { ChapterStatus };
