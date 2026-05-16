import { getTestDb } from "@tests/helpers/db";
import { createTestBook } from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";

import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";

function createRepo() {
  return new DrizzleChapterRepository(getTestDb());
}

describe("DrizzleChapterRepository.reorder", () => {
  it("aplica positions a vários capítulos preservando densidade 0..N-1", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());
    const inserted = await repo.insertMany([
      { bookId: book.id, title: "A", position: 0 },
      { bookId: book.id, title: "B", position: 1 },
      { bookId: book.id, title: "C", position: 2 },
    ]);

    // Inverter a ordem: [C, B, A]
    await repo.reorder(book.id, [
      { id: inserted[2].id, position: 0 },
      { id: inserted[1].id, position: 1 },
      { id: inserted[0].id, position: 2 },
    ]);

    const after = await repo.listByBookId(book.id);
    expect(after.map((c) => ({ title: c.title, position: c.position }))).toEqual([
      { title: "C", position: 0 },
      { title: "B", position: 1 },
      { title: "A", position: 2 },
    ]);
  });

  it("DEFERRABLE permite permutação (swap) dentro de uma transação", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());
    const [a, b] = await repo.insertMany([
      { bookId: book.id, title: "A", position: 0 },
      { bookId: book.id, title: "B", position: 1 },
    ]);

    // Swap A↔B em uma única chamada de reorder (constraint deferred).
    await repo.reorder(book.id, [
      { id: a.id, position: 1 },
      { id: b.id, position: 0 },
    ]);

    const after = await repo.listByBookId(book.id);
    expect(after.map((c) => c.title)).toEqual(["B", "A"]);
  });

  it("aceita lista vazia sem erro", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());
    await expect(repo.reorder(book.id, [])).resolves.toBeUndefined();
  });

  it("escala até 50 itens em uma única operação", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());
    const inserted = await repo.insertMany(
      Array.from({ length: 50 }, (_, i) => ({
        bookId: book.id,
        title: `Capítulo ${i + 1}`,
        position: i,
      })),
    );

    // Inverter completamente.
    const reversed = [...inserted].reverse();
    await repo.reorder(
      book.id,
      reversed.map((c, idx) => ({ id: c.id, position: idx })),
    );

    const after = await repo.listByBookId(book.id);
    expect(after).toHaveLength(50);
    expect(after[0].title).toBe("Capítulo 50");
    expect(after[49].title).toBe("Capítulo 1");
  });
});
