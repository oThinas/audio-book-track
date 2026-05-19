import { and, asc, eq, isNotNull, notInArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "@/lib/db/schema";
import { book, chapter, editor, narrator, studio } from "@/lib/db/schema";
import type { ChapterStatus } from "@/lib/domain/chapter";
import type { Granularity } from "@/lib/domain/dashboard-bucketing";
import type { DateRangeIso } from "@/lib/domain/dashboard-period";
import type { BucketAmount } from "@/lib/domain/earnings-aggregations";
import { APP_TIMEZONE } from "@/lib/domain/timezone";
import type {
  DashboardRepository,
  OverdueSummary,
  RankingEntry,
  StatusFunnel,
} from "@/lib/repositories/dashboard-repository";

type Executor = NodePgDatabase<typeof schema>;

const EMPTY_FUNNEL: StatusFunnel = {
  pending: 0,
  editing: 0,
  reviewing: 0,
  retake: 0,
  completed: 0,
  paid: 0,
};

export class DrizzleDashboardRepository implements DashboardRepository {
  constructor(private readonly db: Executor) {}

  async getAReceberAgoraCents(): Promise<number> {
    const rows = await this.db.execute<{ total: string | null }>(sql`
      SELECT COALESCE(SUM(ROUND(${chapter.editedSeconds} * ${book.pricePerHourCents} / 3600.0)), 0)::bigint AS total
      FROM ${chapter}
      JOIN ${book} ON ${book.id} = ${chapter.bookId}
      WHERE ${chapter.status} = 'completed'
    `);
    return parseRowCount(rows.rows[0]?.total);
  }

  async getReceitaPeriodoCents(range: DateRangeIso): Promise<number> {
    const rows = await this.db.execute<{ total: string | null }>(sql`
      SELECT COALESCE(SUM(ROUND(${chapter.editedSeconds} * ${book.pricePerHourCents} / 3600.0)), 0)::bigint AS total
      FROM ${chapter}
      JOIN ${book} ON ${book.id} = ${chapter.bookId}
      WHERE ${chapter.status} = 'paid'
        AND (${chapter.paidAt} AT TIME ZONE ${APP_TIMEZONE})::date BETWEEN ${range.fromIso}::date AND ${range.toIso}::date
    `);
    return parseRowCount(rows.rows[0]?.total);
  }

  async getChaptersPagosCount(range: DateRangeIso): Promise<number> {
    const rows = await this.db.execute<{ count: string }>(sql`
      SELECT COUNT(*)::bigint AS count
      FROM ${chapter}
      WHERE ${chapter.status} = 'paid'
        AND (${chapter.paidAt} AT TIME ZONE ${APP_TIMEZONE})::date BETWEEN ${range.fromIso}::date AND ${range.toIso}::date
    `);
    return parseRowCount(rows.rows[0]?.count);
  }

  async getRankingByStudio(range: DateRangeIso, limit: number): Promise<RankingEntry[]> {
    const rows = await this.db
      .select({
        entityId: studio.id,
        name: studio.name,
        deletedAt: studio.deletedAt,
        chaptersPaidCount: sql<string>`COUNT(${chapter.id})::bigint`,
        totalCents: sql<string>`COALESCE(SUM(ROUND(${chapter.editedSeconds} * ${book.pricePerHourCents} / 3600.0)), 0)::bigint`,
      })
      .from(chapter)
      .innerJoin(book, eq(book.id, chapter.bookId))
      .innerJoin(studio, eq(studio.id, book.studioId))
      .where(
        and(
          eq(chapter.status, "paid"),
          sql`(${chapter.paidAt} AT TIME ZONE ${APP_TIMEZONE})::date BETWEEN ${range.fromIso}::date AND ${range.toIso}::date`,
        ),
      )
      .groupBy(studio.id, studio.name, studio.deletedAt)
      .orderBy(sql`SUM(ROUND(${chapter.editedSeconds} * ${book.pricePerHourCents} / 3600.0)) DESC`)
      .limit(limit);
    return rows.map((row) => ({
      entityId: row.entityId,
      name: row.name,
      archived: row.deletedAt !== null,
      chaptersPaidCount: parseRowCount(row.chaptersPaidCount),
      totalCents: parseRowCount(row.totalCents),
    }));
  }

  async getRankingByNarrator(range: DateRangeIso, limit: number): Promise<RankingEntry[]> {
    const rows = await this.db
      .select({
        entityId: narrator.id,
        name: narrator.name,
        deletedAt: narrator.deletedAt,
        chaptersPaidCount: sql<string>`COUNT(${chapter.id})::bigint`,
        totalCents: sql<string>`COALESCE(SUM(ROUND(${chapter.editedSeconds} * ${book.pricePerHourCents} / 3600.0)), 0)::bigint`,
      })
      .from(chapter)
      .innerJoin(book, eq(book.id, chapter.bookId))
      .innerJoin(narrator, eq(narrator.id, chapter.narratorId))
      .where(
        and(
          eq(chapter.status, "paid"),
          isNotNull(chapter.narratorId),
          sql`(${chapter.paidAt} AT TIME ZONE ${APP_TIMEZONE})::date BETWEEN ${range.fromIso}::date AND ${range.toIso}::date`,
        ),
      )
      .groupBy(narrator.id, narrator.name, narrator.deletedAt)
      .orderBy(sql`SUM(ROUND(${chapter.editedSeconds} * ${book.pricePerHourCents} / 3600.0)) DESC`)
      .limit(limit);
    return rows.map((row) => ({
      entityId: row.entityId,
      name: row.name,
      archived: row.deletedAt !== null,
      chaptersPaidCount: parseRowCount(row.chaptersPaidCount),
      totalCents: parseRowCount(row.totalCents),
    }));
  }

  async getRankingByEditor(range: DateRangeIso, limit: number): Promise<RankingEntry[]> {
    const rows = await this.db
      .select({
        entityId: editor.id,
        name: editor.name,
        deletedAt: editor.deletedAt,
        chaptersPaidCount: sql<string>`COUNT(${chapter.id})::bigint`,
        totalCents: sql<string>`COALESCE(SUM(ROUND(${chapter.editedSeconds} * ${book.pricePerHourCents} / 3600.0)), 0)::bigint`,
      })
      .from(chapter)
      .innerJoin(book, eq(book.id, chapter.bookId))
      .innerJoin(editor, eq(editor.id, chapter.editorId))
      .where(
        and(
          eq(chapter.status, "paid"),
          isNotNull(chapter.editorId),
          sql`(${chapter.paidAt} AT TIME ZONE ${APP_TIMEZONE})::date BETWEEN ${range.fromIso}::date AND ${range.toIso}::date`,
        ),
      )
      .groupBy(editor.id, editor.name, editor.deletedAt)
      .orderBy(sql`SUM(ROUND(${chapter.editedSeconds} * ${book.pricePerHourCents} / 3600.0)) DESC`)
      .limit(limit);
    return rows.map((row) => ({
      entityId: row.entityId,
      name: row.name,
      archived: row.deletedAt !== null,
      chaptersPaidCount: parseRowCount(row.chaptersPaidCount),
      totalCents: parseRowCount(row.totalCents),
    }));
  }

  async getStatusFunnel(): Promise<StatusFunnel> {
    const rows = await this.db
      .select({
        status: chapter.status,
        count: sql<string>`COUNT(*)::bigint`,
      })
      .from(chapter)
      .groupBy(chapter.status);
    const funnel: StatusFunnel = { ...EMPTY_FUNNEL };
    for (const row of rows) {
      funnel[row.status as ChapterStatus] = parseRowCount(row.count);
    }
    return funnel;
  }

  async getOverdueSummary(todayIso: string): Promise<OverdueSummary> {
    const countRows = await this.db.execute<{ count: string }>(sql`
      SELECT COUNT(*)::bigint AS count
      FROM ${chapter}
      WHERE ${chapter.deadline} < ${todayIso}::date
        AND ${chapter.status} NOT IN ('completed', 'paid')
    `);
    const overdueCount = parseRowCount(countRows.rows[0]?.count);
    if (overdueCount === 0) {
      return { overdueCount: 0, firstOverdueBookId: null };
    }

    const firstRows = await this.db
      .select({ bookId: chapter.bookId })
      .from(chapter)
      .innerJoin(book, eq(book.id, chapter.bookId))
      .where(
        and(
          sql`${chapter.deadline} < ${todayIso}::date`,
          notInArray(chapter.status, ["completed", "paid"]),
        ),
      )
      .orderBy(asc(chapter.deadline), asc(book.title))
      .limit(1);
    return {
      overdueCount,
      firstOverdueBookId: firstRows[0]?.bookId ?? null,
    };
  }

  async getRevenueBuckets(range: DateRangeIso, granularity: Granularity): Promise<BucketAmount[]> {
    const truncUnit =
      granularity === "day" ? sql`'day'` : granularity === "week" ? sql`'week'` : sql`'month'`;
    const rows = await this.db.execute<{ start_iso: string; cents: string }>(sql`
      SELECT to_char(date_trunc(${truncUnit}, ${chapter.paidAt} AT TIME ZONE ${APP_TIMEZONE}), 'YYYY-MM-DD') AS start_iso,
             COALESCE(SUM(ROUND(${chapter.editedSeconds} * ${book.pricePerHourCents} / 3600.0)), 0)::bigint AS cents
      FROM ${chapter}
      JOIN ${book} ON ${book.id} = ${chapter.bookId}
      WHERE ${chapter.status} = 'paid'
        AND (${chapter.paidAt} AT TIME ZONE ${APP_TIMEZONE})::date BETWEEN ${range.fromIso}::date AND ${range.toIso}::date
      GROUP BY date_trunc(${truncUnit}, ${chapter.paidAt} AT TIME ZONE ${APP_TIMEZONE})
      ORDER BY date_trunc(${truncUnit}, ${chapter.paidAt} AT TIME ZONE ${APP_TIMEZONE}) ASC
    `);
    return rows.rows.map((row) => ({
      startIso: row.start_iso,
      cents: parseRowCount(row.cents),
    }));
  }
}

function parseRowCount(value: string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
