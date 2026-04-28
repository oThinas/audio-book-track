import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter, createTestStudio } from "@tests/helpers/factories";
import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { handleStudiosDelete } from "@/app/api/v1/studios/[id]/route";
import { book, chapter, studio } from "@/lib/db/schema";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { StudioService } from "@/lib/services/studio-service";

function createDeps() {
  const db = getTestDb();
  const repo = new DrizzleStudioRepository(db);
  const service = new StudioService(repo);
  return {
    getSession: vi
      .fn()
      .mockResolvedValue({ user: { id: crypto.randomUUID() }, session: { id: "s1" } }),
    createService: vi.fn().mockReturnValue(service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
    createSoftDeleteDeps: () => ({
      getActiveBooks: async (studioId: string) => {
        const rows = await db
          .selectDistinct({ id: book.id, title: book.title })
          .from(book)
          .innerJoin(chapter, eq(chapter.bookId, book.id))
          .where(
            and(
              eq(book.studioId, studioId),
              inArray(chapter.status, ["pending", "editing", "reviewing", "retake"]),
            ),
          );
        return rows;
      },
    }),
  };
}

describe("DELETE /api/v1/studios/:id (handleStudiosDelete) — STUDIO_HAS_ACTIVE_BOOKS precondition", () => {
  it("returns 204 and soft-deletes when studio has no books", async () => {
    const db = getTestDb();
    const { studio: created } = await createTestStudio(db, { name: "Sem Livros" });

    const response = await handleStudiosDelete(createDeps(), { id: created.id });

    expect(response.status).toBe(204);

    const [row] = await db.select().from(studio).where(eq(studio.id, created.id));
    expect(row?.deletedAt).not.toBeNull();
  });

  it("returns 204 and soft-deletes when all chapters are completed/paid", async () => {
    const db = getTestDb();
    const { studio: created } = await createTestStudio(db, { name: "Tudo Pago" });
    const { book } = await createTestBook(db, { studioId: created.id, title: "Livro Pago" });
    await createTestChapter(db, { bookId: book.id, number: 1, status: "completed" });
    await createTestChapter(db, { bookId: book.id, number: 2, status: "paid" });

    const response = await handleStudiosDelete(createDeps(), { id: created.id });

    expect(response.status).toBe(204);

    const [row] = await db.select().from(studio).where(eq(studio.id, created.id));
    expect(row?.deletedAt).not.toBeNull();
  });

  it("returns 409 STUDIO_HAS_ACTIVE_BOOKS with details when ≥ 1 book has an active chapter", async () => {
    const db = getTestDb();
    const { studio: created } = await createTestStudio(db, { name: "Em Produção" });
    const { book: blocking } = await createTestBook(db, {
      studioId: created.id,
      title: "Livro Em Edição",
    });
    await createTestChapter(db, { bookId: blocking.id, number: 1, status: "editing" });

    // Adiciona um livro "OK" (capítulos completed) para garantir que NÃO bloqueia
    const { book: okBook } = await createTestBook(db, {
      studioId: created.id,
      title: "Livro OK",
    });
    await createTestChapter(db, { bookId: okBook.id, number: 1, status: "completed" });

    const response = await handleStudiosDelete(createDeps(), { id: created.id });

    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      error: {
        code: string;
        message: string;
        details: { books: Array<{ id: string; title: string }> };
      };
    };
    expect(body.error.code).toBe("STUDIO_HAS_ACTIVE_BOOKS");
    expect(body.error.details.books.map((b) => b.id)).toEqual([blocking.id]);
    expect(body.error.details.books[0]?.title).toBe("Livro Em Edição");

    // estúdio NÃO foi soft-deletado
    const [row] = await db.select().from(studio).where(eq(studio.id, created.id));
    expect(row?.deletedAt).toBeNull();
  });

  it("blocks for each active status: pending, editing, reviewing, retake", async () => {
    const db = getTestDb();

    for (const status of ["pending", "editing", "reviewing", "retake"] as const) {
      const { studio: created } = await createTestStudio(db, { name: `Studio ${status}` });
      const { book } = await createTestBook(db, {
        studioId: created.id,
        title: `Livro ${status}`,
      });
      await createTestChapter(db, { bookId: book.id, number: 1, status });

      const response = await handleStudiosDelete(createDeps(), { id: created.id });

      expect(response.status).toBe(409);
    }
  });

  it("returns 404 when studio does not exist", async () => {
    const response = await handleStudiosDelete(createDeps(), { id: crypto.randomUUID() });

    expect(response.status).toBe(404);
  });

  it("returns 404 when studio is already soft-deleted", async () => {
    const db = getTestDb();
    const { studio: created } = await createTestStudio(db, { name: "Já Soft-Deletado" });
    await db.update(studio).set({ deletedAt: new Date() }).where(eq(studio.id, created.id));

    const response = await handleStudiosDelete(createDeps(), { id: created.id });

    expect(response.status).toBe(404);
  });

  it("deduplicates blocking books (one row per book even with multiple active chapters)", async () => {
    const db = getTestDb();
    const { studio: created } = await createTestStudio(db, { name: "Multi Capítulos" });
    const { book } = await createTestBook(db, {
      studioId: created.id,
      title: "Livro Multi",
    });
    await createTestChapter(db, { bookId: book.id, number: 1, status: "pending" });
    await createTestChapter(db, { bookId: book.id, number: 2, status: "editing" });
    await createTestChapter(db, { bookId: book.id, number: 3, status: "reviewing" });

    const response = await handleStudiosDelete(createDeps(), { id: created.id });

    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      error: { details: { books: Array<{ id: string; title: string }> } };
    };
    expect(body.error.details.books).toHaveLength(1);
    expect(body.error.details.books[0]?.id).toBe(book.id);
  });

  it("preserves the soft-deleted studio in book-detail history (livro histórico continua resolvendo o estúdio)", async () => {
    const db = getTestDb();
    const { studio: created } = await createTestStudio(db, { name: "Histórico" });
    const { book } = await createTestBook(db, {
      studioId: created.id,
      title: "Livro Histórico",
    });
    await createTestChapter(db, { bookId: book.id, number: 1, status: "paid" });

    const response = await handleStudiosDelete(createDeps(), { id: created.id });
    expect(response.status).toBe(204);

    // findByIdIncludingDeleted ainda retorna o estúdio (para resolver histórico do livro)
    const repo = new DrizzleStudioRepository(db);
    const stillResolvable = await repo.findByIdIncludingDeleted(created.id);
    expect(stillResolvable?.id).toBe(created.id);
    expect(stillResolvable?.name).toBe("Histórico");
  });
});
