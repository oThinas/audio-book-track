import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter } from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";

import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";

function createRepo() {
  return new DrizzleChapterRepository(getTestDb());
}

describe("DrizzleChapterRepository — deadline", () => {
  it("persiste deadline em insertMany e retorna no findById", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());

    const [inserted] = await repo.insertMany([
      { bookId: book.id, number: 1, deadline: "2026-06-15" },
    ]);

    expect(inserted.deadline).toBe("2026-06-15");
    const fetched = await repo.findById(inserted.id);
    expect(fetched?.deadline).toBe("2026-06-15");
  });

  it("aceita deadline = null em insertMany (default)", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());

    const [inserted] = await repo.insertMany([{ bookId: book.id, number: 1 }]);
    expect(inserted.deadline).toBeNull();
  });

  it("atualiza deadline via update (set)", async () => {
    const repo = createRepo();
    const { chapter } = await createTestChapter(getTestDb(), { deadline: null });

    const updated = await repo.update(chapter.id, { deadline: "2026-06-20" });
    expect(updated.deadline).toBe("2026-06-20");
  });

  it("limpa deadline via update (null)", async () => {
    const repo = createRepo();
    const { chapter } = await createTestChapter(getTestDb(), { deadline: "2026-06-20" });

    const updated = await repo.update(chapter.id, { deadline: null });
    expect(updated.deadline).toBeNull();
  });

  it("listByBookId retorna deadline em todos os capítulos", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());

    await repo.insertMany([
      { bookId: book.id, number: 1, deadline: "2026-06-15" },
      { bookId: book.id, number: 2, deadline: null },
      { bookId: book.id, number: 3, deadline: "2026-07-01" },
    ]);

    const chapters = await repo.listByBookId(book.id);
    expect(chapters.map((c) => c.deadline)).toEqual(["2026-06-15", null, "2026-07-01"]);
  });
});
