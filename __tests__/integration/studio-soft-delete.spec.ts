import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter, createTestStudio } from "@tests/helpers/factories";
import { wrapForTest } from "@tests/helpers/route-context";
import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { handleStudiosDelete, type StudioByIdRouteDeps } from "@/app/api/v1/studios/[id]/route";
import { book, chapter, studio } from "@/lib/db/schema";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { StudioService } from "@/lib/services/studio-service";

function buildTestRouteDeps(): StudioByIdRouteDeps {
  const db = getTestDb();
  const service = new StudioService(new DrizzleStudioRepository(db));
  return {
    createService: () => service,
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

function buildDelete(session: { user: { id: string } } | null) {
  return wrapForTest<{ id: string }>(
    (req, ctx) => handleStudiosDelete(req, ctx, buildTestRouteDeps()),
    { session },
  );
}

function makeRequest(): Request {
  return new Request("http://test.local/api/v1/studios/x", { method: "DELETE" });
}

describe("DELETE /api/v1/studios/:id (handleStudiosDelete) — STUDIO_HAS_ACTIVE_BOOKS precondition", () => {
  const session = { user: { id: crypto.randomUUID() } };

  it("returns 204 and soft-deletes when studio has no books", async () => {
    const db = getTestDb();
    const { studio: created } = await createTestStudio(db, { name: "Sem Livros" });

    const DELETE = buildDelete(session);
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: created.id }) });

    expect(response.status).toBe(204);

    const [row] = await db.select().from(studio).where(eq(studio.id, created.id));
    expect(row?.deletedAt).not.toBeNull();
  });

  it("returns 204 and soft-deletes when all chapters are completed/paid", async () => {
    const db = getTestDb();
    const { studio: created } = await createTestStudio(db, { name: "Tudo Pago" });
    const { book: createdBook } = await createTestBook(db, {
      studioId: created.id,
      title: "Livro Pago",
    });
    await createTestChapter(db, { bookId: createdBook.id, number: 1, status: "completed" });
    await createTestChapter(db, { bookId: createdBook.id, number: 2, status: "paid" });

    const DELETE = buildDelete(session);
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: created.id }) });

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

    const { book: okBook } = await createTestBook(db, {
      studioId: created.id,
      title: "Livro OK",
    });
    await createTestChapter(db, { bookId: okBook.id, number: 1, status: "completed" });

    const DELETE = buildDelete(session);
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: created.id }) });

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

    const [row] = await db.select().from(studio).where(eq(studio.id, created.id));
    expect(row?.deletedAt).toBeNull();
  });

  it("blocks for each active status: pending, editing, reviewing, retake", async () => {
    const db = getTestDb();

    for (const status of ["pending", "editing", "reviewing", "retake"] as const) {
      const { studio: created } = await createTestStudio(db, { name: `Studio ${status}` });
      const { book: createdBook } = await createTestBook(db, {
        studioId: created.id,
        title: `Livro ${status}`,
      });
      await createTestChapter(db, { bookId: createdBook.id, number: 1, status });

      const DELETE = buildDelete(session);
      const response = await DELETE(makeRequest(), {
        params: Promise.resolve({ id: created.id }),
      });

      expect(response.status).toBe(409);
    }
  });

  it("returns 404 when studio does not exist", async () => {
    const DELETE = buildDelete(session);
    const response = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: crypto.randomUUID() }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 when studio is already soft-deleted", async () => {
    const db = getTestDb();
    const { studio: created } = await createTestStudio(db, { name: "Já Soft-Deletado" });
    await db.update(studio).set({ deletedAt: new Date() }).where(eq(studio.id, created.id));

    const DELETE = buildDelete(session);
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: created.id }) });

    expect(response.status).toBe(404);
  });

  it("deduplicates blocking books (one row per book even with multiple active chapters)", async () => {
    const db = getTestDb();
    const { studio: created } = await createTestStudio(db, { name: "Multi Capítulos" });
    const { book: createdBook } = await createTestBook(db, {
      studioId: created.id,
      title: "Livro Multi",
    });
    await createTestChapter(db, { bookId: createdBook.id, number: 1, status: "pending" });
    await createTestChapter(db, { bookId: createdBook.id, number: 2, status: "editing" });
    await createTestChapter(db, { bookId: createdBook.id, number: 3, status: "reviewing" });

    const DELETE = buildDelete(session);
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: created.id }) });

    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      error: { details: { books: Array<{ id: string; title: string }> } };
    };
    expect(body.error.details.books).toHaveLength(1);
    expect(body.error.details.books[0]?.id).toBe(createdBook.id);
  });

  it("preserves the soft-deleted studio in book-detail history (historical book still resolves the studio)", async () => {
    const db = getTestDb();
    const { studio: created } = await createTestStudio(db, { name: "Histórico" });
    const { book: createdBook } = await createTestBook(db, {
      studioId: created.id,
      title: "Livro Histórico",
    });
    await createTestChapter(db, { bookId: createdBook.id, number: 1, status: "paid" });

    const DELETE = buildDelete(session);
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: created.id }) });
    expect(response.status).toBe(204);

    const repo = new DrizzleStudioRepository(db);
    const stillResolvable = await repo.findByIdIncludingDeleted(created.id);
    expect(stillResolvable?.id).toBe(created.id);
    expect(stillResolvable?.name).toBe("Histórico");
  });
});
