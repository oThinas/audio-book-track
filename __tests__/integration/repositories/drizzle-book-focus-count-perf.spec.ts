import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter, createTestStudio } from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";

import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";

/**
 * Benchmark SC-008: listSummaries must keep server-side latency below 200ms
 * for up to 100 books × 50 chapters each (5000 synthetic chapters).
 */
describe("DrizzleBookRepository.listSummaries — perf (SC-008)", () => {
  it("processes 100 books × 50 chapters in under 200ms", async () => {
    const db = getTestDb();
    const repo = new DrizzleBookRepository(db);

    const NUM_BOOKS = 100;
    const CHAPTERS_PER_BOOK = 50;

    const { studio } = await createTestStudio(db);
    const books = await Promise.all(
      Array.from({ length: NUM_BOOKS }, (_, i) =>
        createTestBook(db, { title: `Perf Book ${i}`, studioId: studio.id }),
      ),
    );

    const statuses = ["pending", "editing", "reviewing", "retake", "completed", "paid"] as const;
    const sampleDeadlines = [
      "2026-05-10",
      "2026-05-11",
      "2026-05-14",
      "2026-05-17",
      "2026-05-20",
      null,
    ];

    for (let i = 0; i < books.length; i += 10) {
      const slice = books.slice(i, i + 10);
      await Promise.all(
        slice.flatMap(({ book }) =>
          Array.from({ length: CHAPTERS_PER_BOOK }, (_, n) => {
            const status = statuses[(n + i) % statuses.length];
            return createTestChapter(db, {
              bookId: book.id,
              number: n + 1,
              status,
              deadline: sampleDeadlines[(n + i) % sampleDeadlines.length],
              editedSeconds: status === "paid" || status === "completed" ? 3600 : 0,
            });
          }),
        ),
      );
    }

    const start = performance.now();
    const summaries = await repo.listSummaries({
      todayIso: "2026-05-14",
      mondayIso: "2026-05-11",
      sundayIso: "2026-05-17",
    });
    const duration = performance.now() - start;

    expect(summaries.length).toBeGreaterThanOrEqual(NUM_BOOKS);
    console.log(
      `[perf] listSummaries(${NUM_BOOKS} books × ${CHAPTERS_PER_BOOK} chapters): ${duration.toFixed(1)}ms`,
    );
    expect(duration).toBeLessThan(200);
  }, 60_000);
});
