import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter } from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";

import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";

function createRepo() {
  return new DrizzleBookRepository(getTestDb());
}

const todayIso = "2026-05-14"; // Thursday
const mondayIso = "2026-05-11";
const sundayIso = "2026-05-17";

describe("DrizzleBookRepository.listSummaries — focusThisWeekCount", () => {
  it("counts chapters in the focus-of-the-week correctly", async () => {
    const { book } = await createTestBook(getTestDb());

    await Promise.all([
      // ✅ overdue pending
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 1,
        status: "pending",
        deadline: "2026-05-10",
      }),
      // ✅ Monday editing
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 2,
        status: "editing",
        deadline: "2026-05-11",
      }),
      // ✅ Saturday reviewing
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 3,
        status: "reviewing",
        deadline: "2026-05-16",
      }),
      // ✅ Sunday retake
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 4,
        status: "retake",
        deadline: "2026-05-17",
      }),
      // ✅ today editing
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 5,
        status: "editing",
        deadline: "2026-05-14",
      }),
      // ❌ Friday completed (does not count)
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 6,
        status: "completed",
        deadline: "2026-05-15",
      }),
      // ❌ Wednesday paid (does not count)
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 7,
        status: "paid",
        deadline: "2026-05-13",
        editedSeconds: 3600,
      }),
      // ❌ next Monday pending (outside the week)
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 8,
        status: "pending",
        deadline: "2026-05-18",
      }),
      // ❌ pending without a deadline
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 9,
        status: "pending",
        deadline: null,
      }),
    ]);

    const summaries = await createRepo().listSummaries({
      todayIso,
      mondayIso,
      sundayIso,
    });
    const target = summaries.find((s) => s.id === book.id);
    expect(target?.focusThisWeekCount).toBe(5);
  });

  it("returns 0 when every chapter is outside the focus", async () => {
    const { book } = await createTestBook(getTestDb());
    await createTestChapter(getTestDb(), {
      bookId: book.id,
      number: 1,
      status: "pending",
      deadline: null,
    });
    await createTestChapter(getTestDb(), {
      bookId: book.id,
      number: 2,
      status: "completed",
      deadline: "2026-05-14",
    });

    const summaries = await createRepo().listSummaries({
      todayIso,
      mondayIso,
      sundayIso,
    });
    const target = summaries.find((s) => s.id === book.id);
    expect(target?.focusThisWeekCount).toBe(0);
  });
});
