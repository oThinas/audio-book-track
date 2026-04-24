import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter, createTestStudio } from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";

import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";

function createRepo() {
  return new DrizzleBookRepository(getTestDb());
}

describe("DrizzleBookRepository.listSummariesByUser (SQL aggregation)", () => {
  it("returns an empty array when there are no books", async () => {
    const repo = createRepo();

    expect(await repo.listSummariesByUser("any-user-id")).toEqual([]);
  });

  it("computes totalChapters, completedChapters and totalEarningsCents per book", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db, {
      name: "Sonora",
      defaultHourlyRateCents: 7500,
    });
    const { book } = await createTestBook(db, {
      title: "Dom Casmurro",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    // 1h completed → 7500 cents
    await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "completed",
      editedSeconds: 3600,
    });
    // 2h paid → 15000 cents
    await createTestChapter(db, {
      bookId: book.id,
      number: 2,
      status: "paid",
      editedSeconds: 7200,
    });
    // 0h pending → 0
    await createTestChapter(db, {
      bookId: book.id,
      number: 3,
      status: "pending",
      editedSeconds: 0,
    });

    const repo = createRepo();
    const summaries = await repo.listSummariesByUser("any-user-id");

    expect(summaries).toHaveLength(1);
    const [summary] = summaries;
    expect(summary.id).toBe(book.id);
    expect(summary.title).toBe("Dom Casmurro");
    expect(summary.studio).toEqual({ id: studio.id, name: "Sonora" });
    expect(summary.pricePerHourCents).toBe(7500);
    expect(summary.totalChapters).toBe(3);
    expect(summary.completedChapters).toBe(2);
    expect(summary.totalEarningsCents).toBe(22_500);
  });

  it("returns totalChapters=0 and totalEarningsCents=0 for a book with no chapters (LEFT JOIN edge case)", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db, { pricePerHourCents: 7500 });

    const repo = createRepo();
    const [summary] = await repo.listSummariesByUser("any-user-id");

    expect(summary.id).toBe(book.id);
    expect(summary.totalChapters).toBe(0);
    expect(summary.completedChapters).toBe(0);
    expect(summary.totalEarningsCents).toBe(0);
  });

  it("resolves studio name even when the studio has been soft-deleted", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db, {
      name: "Legacy Studio",
      defaultHourlyRateCents: 7500,
    });
    const { book } = await createTestBook(db, { studioId: studio.id, pricePerHourCents: 7500 });
    await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });

    await new DrizzleStudioRepository(db).softDelete(studio.id);

    const [summary] = await createRepo().listSummariesByUser("any-user-id");

    expect(summary.studio).toEqual({ id: studio.id, name: "Legacy Studio" });
  });

  it("orders results by createdAt DESC", async () => {
    const db = getTestDb();
    const { book: older } = await createTestBook(db, { title: "Older" });
    await new Promise((r) => setTimeout(r, 5));
    const { book: newer } = await createTestBook(db, { title: "Newer" });

    const summaries = await createRepo().listSummariesByUser("any-user-id");

    expect(summaries.map((s) => s.id)).toEqual([newer.id, older.id]);
  });

  it("rounds earnings per-row before summing (matches JS formula in data-model §8)", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db, { pricePerHourCents: 7500 });
    // 3601s × 7500 / 3600 = 7502.08… → 7502
    await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "paid",
      editedSeconds: 3601,
    });
    // 3599s × 7500 / 3600 = 7497.91… → 7498
    await createTestChapter(db, {
      bookId: book.id,
      number: 2,
      status: "paid",
      editedSeconds: 3599,
    });

    const [summary] = await createRepo().listSummariesByUser("any-user-id");

    // Per-row rounding: 7502 + 7498 = 15000 (matches data-model §8 choice)
    expect(summary.totalEarningsCents).toBe(15_000);
  });
});
