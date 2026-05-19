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
