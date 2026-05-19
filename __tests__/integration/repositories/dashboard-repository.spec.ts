import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter } from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";

import { DrizzleDashboardRepository } from "@/lib/repositories/drizzle/drizzle-dashboard-repository";

function createRepo() {
  return new DrizzleDashboardRepository(getTestDb());
}

describe("DrizzleDashboardRepository.getAReceberAgoraCents", () => {
  it("sums earnings of completed chapters and ignores paid", async () => {
    const repo = createRepo();
    const db = getTestDb();

    const { book } = await createTestBook(db, { pricePerHourCents: 7500 });
    // 3 completed chapters: 1h, 30min, 15min @ R$ 75/h
    await createTestChapter(db, {
      bookId: book.id,
      position: 0,
      status: "completed",
      editedSeconds: 3600,
    });
    await createTestChapter(db, {
      bookId: book.id,
      position: 1,
      status: "completed",
      editedSeconds: 1800,
    });
    await createTestChapter(db, {
      bookId: book.id,
      position: 2,
      status: "completed",
      editedSeconds: 900,
    });
    // 2 paid chapters (should be ignored)
    await createTestChapter(db, {
      bookId: book.id,
      position: 3,
      status: "paid",
      editedSeconds: 3600,
    });
    await createTestChapter(db, {
      bookId: book.id,
      position: 4,
      status: "paid",
      editedSeconds: 7200,
    });

    const result = await repo.getAReceberAgoraCents();
    // 7500 + 3750 + 1875 = 13125 cents
    expect(result).toBe(13125);
  });

  it("returns 0 when there are no completed chapters", async () => {
    const repo = createRepo();
    expect(await repo.getAReceberAgoraCents()).toBe(0);
  });
});

describe("DrizzleDashboardRepository.getReceitaPeriodoCents", () => {
  it("sums earnings of chapters paid within the period", async () => {
    const repo = createRepo();
    const db = getTestDb();
    const { book } = await createTestBook(db, { pricePerHourCents: 7500 });

    // 2 paid in period (mid-May 2026), summing 1h + 30min @ 75/h = 11250 cents
    const { chapter: c1 } = await createTestChapter(db, {
      bookId: book.id,
      position: 0,
      status: "paid",
      editedSeconds: 3600,
    });
    const { chapter: c2 } = await createTestChapter(db, {
      bookId: book.id,
      position: 1,
      status: "paid",
      editedSeconds: 1800,
    });
    // 1 paid outside period
    const { chapter: c3 } = await createTestChapter(db, {
      bookId: book.id,
      position: 2,
      status: "paid",
      editedSeconds: 7200,
    });
    // Force paid_at in period for c1/c2, outside for c3.
    const { chapter } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await db
      .update(chapter)
      .set({ paidAt: new Date("2026-05-10T12:00:00Z") })
      .where(eq(chapter.id, c1.id));
    await db
      .update(chapter)
      .set({ paidAt: new Date("2026-05-15T12:00:00Z") })
      .where(eq(chapter.id, c2.id));
    await db
      .update(chapter)
      .set({ paidAt: new Date("2026-04-15T12:00:00Z") })
      .where(eq(chapter.id, c3.id));

    const total = await repo.getReceitaPeriodoCents({
      fromIso: "2026-05-01",
      toIso: "2026-05-31",
      preset: "this-month",
    });
    expect(total).toBe(11250);
  });

  it("counts paid chapters within the period", async () => {
    const repo = createRepo();
    const db = getTestDb();
    const { book } = await createTestBook(db);

    const { chapter: c1 } = await createTestChapter(db, {
      bookId: book.id,
      position: 0,
      status: "paid",
      editedSeconds: 3600,
    });
    const { chapter: c2 } = await createTestChapter(db, {
      bookId: book.id,
      position: 1,
      status: "paid",
      editedSeconds: 3600,
    });

    const { chapter } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await db
      .update(chapter)
      .set({ paidAt: new Date("2026-05-10T12:00:00Z") })
      .where(eq(chapter.id, c1.id));
    await db
      .update(chapter)
      .set({ paidAt: new Date("2026-05-20T12:00:00Z") })
      .where(eq(chapter.id, c2.id));

    const count = await repo.getChaptersPagosCount({
      fromIso: "2026-05-01",
      toIso: "2026-05-31",
      preset: "this-month",
    });
    expect(count).toBe(2);
  });
});

describe("DrizzleDashboardRepository.getStatusFunnel", () => {
  it("returns count per status with zeros for empty buckets", async () => {
    const repo = createRepo();
    const db = getTestDb();
    const { book } = await createTestBook(db);

    await createTestChapter(db, { bookId: book.id, position: 0, status: "pending" });
    await createTestChapter(db, { bookId: book.id, position: 1, status: "pending" });
    await createTestChapter(db, { bookId: book.id, position: 2, status: "editing" });
    await createTestChapter(db, {
      bookId: book.id,
      position: 3,
      status: "completed",
      editedSeconds: 3600,
    });

    const funnel = await repo.getStatusFunnel();
    expect(funnel.pending).toBe(2);
    expect(funnel.editing).toBe(1);
    expect(funnel.reviewing).toBe(0);
    expect(funnel.retake).toBe(0);
    expect(funnel.completed).toBe(1);
    expect(funnel.paid).toBe(0);
  });
});

describe("DrizzleDashboardRepository.getOverdueSummary", () => {
  it("returns count and bookId of oldest overdue (with title tiebreaker)", async () => {
    const repo = createRepo();
    const db = getTestDb();

    const { book: bookA } = await createTestBook(db, { title: "Aaaa" });
    const { book: bookB } = await createTestBook(db, { title: "Bbbb" });

    // bookA: 2 overdue (one with older deadline)
    await createTestChapter(db, {
      bookId: bookA.id,
      position: 0,
      status: "editing",
      deadline: "2026-05-10",
    });
    await createTestChapter(db, {
      bookId: bookA.id,
      position: 1,
      status: "editing",
      deadline: "2026-05-12",
    });
    // bookB: 1 overdue, same oldest deadline as bookA
    await createTestChapter(db, {
      bookId: bookB.id,
      position: 0,
      status: "editing",
      deadline: "2026-05-10",
    });

    const result = await repo.getOverdueSummary("2026-05-19");
    expect(result.overdueCount).toBe(3);
    // Tie on deadline 2026-05-10 → title ASC → "Aaaa" wins
    expect(result.firstOverdueBookId).toBe(bookA.id);
  });

  it("returns null bookId when there are no overdue chapters", async () => {
    const repo = createRepo();
    const result = await repo.getOverdueSummary("2026-05-19");
    expect(result.overdueCount).toBe(0);
    expect(result.firstOverdueBookId).toBeNull();
  });
});
