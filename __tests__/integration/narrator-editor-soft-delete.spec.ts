import { getTestDb } from "@tests/helpers/db";
import {
  createTestBook,
  createTestChapter,
  createTestEditor,
  createTestNarrator,
  createTestStudio,
} from "@tests/helpers/factories";
import { and, eq, exists, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { handleEditorsDelete } from "@/app/api/v1/editors/[id]/route";
import { handleNarratorsDelete } from "@/app/api/v1/narrators/[id]/route";
import { book, chapter, editor, narrator } from "@/lib/db/schema";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { EditorService } from "@/lib/services/editor-service";
import { NarratorService } from "@/lib/services/narrator-service";

const ACTIVE_STATUSES = ["pending", "editing", "reviewing", "retake"] as const;

function buildGetActiveBooksForNarrator() {
  const db = getTestDb();
  return async (narratorId: string) => {
    const activeChapter = alias(chapter, "active_chapter");
    return db
      .selectDistinct({ id: book.id, title: book.title })
      .from(book)
      .innerJoin(chapter, eq(chapter.bookId, book.id))
      .where(
        and(
          eq(chapter.narratorId, narratorId),
          exists(
            db
              .select({ id: activeChapter.id })
              .from(activeChapter)
              .where(
                and(
                  eq(activeChapter.bookId, book.id),
                  inArray(activeChapter.status, ACTIVE_STATUSES),
                ),
              ),
          ),
        ),
      );
  };
}

function buildGetActiveBooksForEditor() {
  const db = getTestDb();
  return async (editorId: string) => {
    const activeChapter = alias(chapter, "active_chapter");
    return db
      .selectDistinct({ id: book.id, title: book.title })
      .from(book)
      .innerJoin(chapter, eq(chapter.bookId, book.id))
      .where(
        and(
          eq(chapter.editorId, editorId),
          exists(
            db
              .select({ id: activeChapter.id })
              .from(activeChapter)
              .where(
                and(
                  eq(activeChapter.bookId, book.id),
                  inArray(activeChapter.status, ACTIVE_STATUSES),
                ),
              ),
          ),
        ),
      );
  };
}

function createNarratorDeps() {
  const db = getTestDb();
  const service = new NarratorService(new DrizzleNarratorRepository(db));
  return {
    getSession: vi.fn().mockResolvedValue({ user: { id: crypto.randomUUID() } }),
    createService: vi.fn().mockReturnValue(service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
    createSoftDeleteDeps: () => ({ getActiveBooks: buildGetActiveBooksForNarrator() }),
  };
}

function createEditorDeps() {
  const db = getTestDb();
  const service = new EditorService(new DrizzleEditorRepository(db));
  return {
    getSession: vi.fn().mockResolvedValue({ user: { id: crypto.randomUUID() } }),
    createService: vi.fn().mockReturnValue(service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
    createSoftDeleteDeps: () => ({ getActiveBooks: buildGetActiveBooksForEditor() }),
  };
}

describe("DELETE /api/v1/narrators/:id (handleNarratorsDelete) — NARRATOR_LINKED_TO_ACTIVE_CHAPTERS", () => {
  it("returns 204 and soft-deletes when narrator has no chapters", async () => {
    const db = getTestDb();
    const { narrator: created } = await createTestNarrator(db, { name: "Sem Capítulos" });

    const response = await handleNarratorsDelete(createNarratorDeps(), { id: created.id });

    expect(response.status).toBe(204);
    const [row] = await db.select().from(narrator).where(eq(narrator.id, created.id));
    expect(row?.deletedAt).not.toBeNull();
  });

  it("returns 204 when narrator's chapters are all in completed/paid books", async () => {
    const db = getTestDb();
    const { narrator: created } = await createTestNarrator(db, { name: "Tudo Pago" });
    const { studio } = await createTestStudio(db);
    const { book: bookRow } = await createTestBook(db, { studioId: studio.id });
    await createTestChapter(db, {
      bookId: bookRow.id,
      number: 1,
      status: "completed",
      narratorId: created.id,
    });
    await createTestChapter(db, {
      bookId: bookRow.id,
      number: 2,
      status: "paid",
      narratorId: created.id,
    });

    const response = await handleNarratorsDelete(createNarratorDeps(), { id: created.id });

    expect(response.status).toBe(204);
  });

  it("returns 409 when narrator's chapter belongs to a book with at least one active chapter", async () => {
    const db = getTestDb();
    const { narrator: created } = await createTestNarrator(db, { name: "Em Produção" });
    const { studio } = await createTestStudio(db);
    const { book: blockingBook } = await createTestBook(db, {
      studioId: studio.id,
      title: "Livro Em Produção",
    });
    // Narrator has a paid chapter, but the book also has an editing chapter (different narrator).
    await createTestChapter(db, {
      bookId: blockingBook.id,
      number: 1,
      status: "paid",
      narratorId: created.id,
    });
    await createTestChapter(db, {
      bookId: blockingBook.id,
      number: 2,
      status: "editing",
      narratorId: null, // outro capítulo, sem narrador
    });

    const response = await handleNarratorsDelete(createNarratorDeps(), { id: created.id });

    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      error: {
        code: string;
        details: { books: Array<{ id: string; title: string }> };
      };
    };
    expect(body.error.code).toBe("NARRATOR_LINKED_TO_ACTIVE_CHAPTERS");
    expect(body.error.details.books.map((b) => b.id)).toEqual([blockingBook.id]);
    expect(body.error.details.books[0]?.title).toBe("Livro Em Produção");

    // narrator NÃO foi soft-deletado
    const [row] = await db.select().from(narrator).where(eq(narrator.id, created.id));
    expect(row?.deletedAt).toBeNull();
  });

  it("returns 404 when narrator does not exist", async () => {
    const response = await handleNarratorsDelete(createNarratorDeps(), { id: crypto.randomUUID() });

    expect(response.status).toBe(404);
  });

  it("preserves narrator history (livros antigos continuam resolvendo o nome)", async () => {
    const db = getTestDb();
    const { narrator: created } = await createTestNarrator(db, { name: "Histórico" });
    const { studio } = await createTestStudio(db);
    const { book: bookRow } = await createTestBook(db, { studioId: studio.id });
    await createTestChapter(db, {
      bookId: bookRow.id,
      number: 1,
      status: "paid",
      narratorId: created.id,
    });

    const response = await handleNarratorsDelete(createNarratorDeps(), { id: created.id });
    expect(response.status).toBe(204);

    // O registro continua na tabela (apenas com deleted_at preenchido)
    const [persisted] = await db.select().from(narrator).where(eq(narrator.id, created.id));
    expect(persisted?.id).toBe(created.id);
    expect(persisted?.name).toBe("Histórico");
    expect(persisted?.deletedAt).not.toBeNull();
  });
});

describe("DELETE /api/v1/editors/:id (handleEditorsDelete) — EDITOR_LINKED_TO_ACTIVE_CHAPTERS", () => {
  it("returns 204 and soft-deletes when editor has no chapters", async () => {
    const db = getTestDb();
    const { editor: created } = await createTestEditor(db, { name: "Sem Capítulos" });

    const response = await handleEditorsDelete(createEditorDeps(), { id: created.id });

    expect(response.status).toBe(204);
    const [row] = await db.select().from(editor).where(eq(editor.id, created.id));
    expect(row?.deletedAt).not.toBeNull();
  });

  it("returns 204 when editor's chapters are all in completed/paid books", async () => {
    const db = getTestDb();
    const { editor: created } = await createTestEditor(db, { name: "Tudo Pago" });
    const { studio } = await createTestStudio(db);
    const { book: bookRow } = await createTestBook(db, { studioId: studio.id });
    await createTestChapter(db, {
      bookId: bookRow.id,
      number: 1,
      status: "completed",
      editorId: created.id,
    });
    await createTestChapter(db, {
      bookId: bookRow.id,
      number: 2,
      status: "paid",
      editorId: created.id,
    });

    const response = await handleEditorsDelete(createEditorDeps(), { id: created.id });

    expect(response.status).toBe(204);
  });

  it("returns 409 when editor's chapter belongs to a book with at least one active chapter", async () => {
    const db = getTestDb();
    const { editor: created } = await createTestEditor(db, { name: "Em Edição" });
    const { studio } = await createTestStudio(db);
    const { book: blockingBook } = await createTestBook(db, {
      studioId: studio.id,
      title: "Livro Em Edição",
    });
    await createTestChapter(db, {
      bookId: blockingBook.id,
      number: 1,
      status: "completed",
      editorId: created.id,
    });
    await createTestChapter(db, {
      bookId: blockingBook.id,
      number: 2,
      status: "reviewing",
      editorId: null,
    });

    const response = await handleEditorsDelete(createEditorDeps(), { id: created.id });

    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      error: {
        code: string;
        details: { books: Array<{ id: string; title: string }> };
      };
    };
    expect(body.error.code).toBe("EDITOR_LINKED_TO_ACTIVE_CHAPTERS");
    expect(body.error.details.books.map((b) => b.id)).toEqual([blockingBook.id]);
  });

  it("blocks for each active status: pending, editing, reviewing, retake", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);

    for (const status of ACTIVE_STATUSES) {
      const { editor: created } = await createTestEditor(db, {
        name: `Editor ${status}`,
        email: `editor-${status}@test.local`,
      });
      const { book: bookRow } = await createTestBook(db, {
        studioId: studio.id,
        title: `Livro ${status}`,
      });
      await createTestChapter(db, {
        bookId: bookRow.id,
        number: 1,
        status,
        editorId: created.id,
      });

      const response = await handleEditorsDelete(createEditorDeps(), { id: created.id });

      expect(response.status).toBe(409);
    }
  });

  it("returns 404 when editor does not exist", async () => {
    const response = await handleEditorsDelete(createEditorDeps(), { id: crypto.randomUUID() });

    expect(response.status).toBe(404);
  });
});
