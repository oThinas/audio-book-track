import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter } from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";

import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";

function createRepo() {
  return new DrizzleBookRepository(getTestDb());
}

const todayIso = "2026-05-14"; // quinta-feira
const mondayIso = "2026-05-11";
const sundayIso = "2026-05-17";

describe("DrizzleBookRepository.listSummaries — focusThisWeekCount", () => {
  it("conta capítulos no foco da semana corretamente", async () => {
    const { book } = await createTestBook(getTestDb());

    await Promise.all([
      // ✅ atrasado pending
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 1,
        status: "pending",
        deadline: "2026-05-10",
      }),
      // ✅ segunda editing
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 2,
        status: "editing",
        deadline: "2026-05-11",
      }),
      // ✅ sábado reviewing
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 3,
        status: "reviewing",
        deadline: "2026-05-16",
      }),
      // ✅ domingo retake
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 4,
        status: "retake",
        deadline: "2026-05-17",
      }),
      // ✅ hoje editing
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 5,
        status: "editing",
        deadline: "2026-05-14",
      }),
      // ❌ sexta completed (não conta)
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 6,
        status: "completed",
        deadline: "2026-05-15",
      }),
      // ❌ quarta paid (não conta)
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 7,
        status: "paid",
        deadline: "2026-05-13",
        editedSeconds: 3600,
      }),
      // ❌ próxima segunda pending (fora da semana)
      createTestChapter(getTestDb(), {
        bookId: book.id,
        number: 8,
        status: "pending",
        deadline: "2026-05-18",
      }),
      // ❌ pending sem prazo
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

  it("retorna 0 quando todos os capítulos estão fora do foco", async () => {
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
