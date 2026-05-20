import type { ChapterStatus } from "@/lib/domain/chapter";
import type { Granularity } from "@/lib/domain/dashboard-bucketing";

import type { DateRangeIso } from "@/lib/domain/dashboard-period";
import type { BucketAmount } from "@/lib/domain/earnings-aggregations";

export interface RankingEntry {
  readonly entityId: string;
  readonly name: string;
  readonly archived: boolean;
  readonly chaptersPaidCount: number;
  readonly totalCents: number;
}

export interface OverdueSummary {
  readonly overdueCount: number;
  readonly firstOverdueBookId: string | null;
}

export type StatusFunnel = Record<ChapterStatus, number>;

export interface DashboardRepository {
  getAReceberAgoraCents(): Promise<number>;
  getReceitaPeriodoCents(range: DateRangeIso): Promise<number>;
  getChaptersPagosCount(range: DateRangeIso): Promise<number>;
  getRankingByStudio(range: DateRangeIso, limit: number): Promise<RankingEntry[]>;
  getRankingByNarrator(range: DateRangeIso, limit: number): Promise<RankingEntry[]>;
  getRankingByEditor(range: DateRangeIso, limit: number): Promise<RankingEntry[]>;
  getStatusFunnel(): Promise<StatusFunnel>;
  getOverdueSummary(todayIso: string): Promise<OverdueSummary>;
  getRevenueBuckets(range: DateRangeIso, granularity: Granularity): Promise<BucketAmount[]>;
}
