import { getTestDb } from "@tests/helpers/db";
import { createTestBook } from "@tests/helpers/factories";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";

function createRepo() {
  return new DrizzleChapterRepository(getTestDb());
}

describe("DrizzleChapterRepository — title + position", () => {
  it("persiste title e position via insertMany", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());

    const inserted = await repo.insertMany([
      { bookId: book.id, title: "Prólogo", position: 0 },
      { bookId: book.id, title: "Capítulo 1", position: 1 },
    ]);

    expect(inserted).toHaveLength(2);
    expect(inserted[0].title).toBe("Prólogo");
    expect(inserted[0].position).toBe(0);
    expect(inserted[1].title).toBe("Capítulo 1");
    expect(inserted[1].position).toBe(1);
  });

  it("listByBookId retorna capítulos ordenados por position ASC", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());

    await repo.insertMany([
      { bookId: book.id, title: "Capítulo 1", position: 2 },
      { bookId: book.id, title: "Prólogo", position: 0 },
      { bookId: book.id, title: "Apresentação", position: 1 },
    ]);

    const chapters = await repo.listByBookId(book.id);
    expect(chapters.map((c) => ({ title: c.title, position: c.position }))).toEqual([
      { title: "Prólogo", position: 0 },
      { title: "Apresentação", position: 1 },
      { title: "Capítulo 1", position: 2 },
    ]);
  });

  it("CHECK rejeita título com mais de 100 caracteres", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());
    const tooLong = "a".repeat(101);

    await expect(
      repo.insertMany([{ bookId: book.id, title: tooLong, position: 0 }]),
    ).rejects.toThrow();
  });

  it("CHECK rejeita título com \\n", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());

    await expect(
      repo.insertMany([{ bookId: book.id, title: "linha1\nlinha2", position: 0 }]),
    ).rejects.toThrow();
  });

  it("CHECK rejeita position negativa", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());

    await expect(
      repo.insertMany([{ bookId: book.id, title: "Capítulo 1", position: -1 }]),
    ).rejects.toThrow();
  });

  it("UNIQUE (book_id, position) rejeita duplicatas dentro do mesmo livro", async () => {
    const repo = createRepo();
    const db = getTestDb();
    const { book } = await createTestBook(db);
    await repo.insertMany([{ bookId: book.id, title: "Capítulo 1", position: 0 }]);

    // Constraint é DEFERRABLE INITIALLY DEFERRED — força check imediato para
    // que o segundo insert estoure já, sem precisar de COMMIT.
    await db.execute(sql`SET CONSTRAINTS "chapter_book_position_unique" IMMEDIATE`);

    await expect(
      repo.insertMany([{ bookId: book.id, title: "Capítulo 2", position: 0 }]),
    ).rejects.toThrow();
  });

  it("update aceita title e altera valor persistido", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());
    const [created] = await repo.insertMany([
      { bookId: book.id, title: "Capítulo 1", position: 0 },
    ]);

    const updated = await repo.update(created.id, { title: "Abertura" });
    expect(updated.title).toBe("Abertura");

    const fetched = await repo.findById(created.id);
    expect(fetched?.title).toBe("Abertura");
  });
});
