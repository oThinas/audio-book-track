import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter } from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";

import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";

function createRepo() {
  return new DrizzleChapterRepository(getTestDb());
}

describe("DrizzleChapterRepository — deadline", () => {
  it("persists deadline via insertMany and returns it on findById", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());

    const [inserted] = await repo.insertMany([
      { bookId: book.id, title: "Capítulo 1", position: 0, deadline: "2026-06-15" },
    ]);

    expect(inserted.deadline).toBe("2026-06-15");
    const fetched = await repo.findById(inserted.id);
    expect(fetched?.deadline).toBe("2026-06-15");
  });

  it("accepts deadline = null on insertMany (default)", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());

    const [inserted] = await repo.insertMany([
      { bookId: book.id, title: "Capítulo 1", position: 0 },
    ]);
    expect(inserted.deadline).toBeNull();
  });

  it("updates deadline via update (set)", async () => {
    const repo = createRepo();
    const { chapter } = await createTestChapter(getTestDb(), { deadline: null });

    const updated = await repo.update(chapter.id, { deadline: "2026-06-20" });
    expect(updated.deadline).toBe("2026-06-20");
  });

  it("clears deadline via update (null)", async () => {
    const repo = createRepo();
    const { chapter } = await createTestChapter(getTestDb(), { deadline: "2026-06-20" });

    const updated = await repo.update(chapter.id, { deadline: null });
    expect(updated.deadline).toBeNull();
  });

  it("listByBookId returns deadline for every chapter", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());

    await repo.insertMany([
      { bookId: book.id, title: "Capítulo 1", position: 0, deadline: "2026-06-15" },
      { bookId: book.id, title: "Capítulo 2", position: 1, deadline: null },
      { bookId: book.id, title: "Capítulo 3", position: 2, deadline: "2026-07-01" },
    ]);

    const chapters = await repo.listByBookId(book.id);
    expect(chapters.map((c) => c.deadline)).toEqual(["2026-06-15", null, "2026-07-01"]);
  });
});
