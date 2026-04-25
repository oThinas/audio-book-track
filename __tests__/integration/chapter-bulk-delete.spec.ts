import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter } from "@tests/helpers/factories";
import { jsonRequest } from "@tests/helpers/http";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { handleChaptersBulkDelete } from "@/app/api/v1/books/[id]/chapters/bulk-delete/route";
import { book as bookTable, chapter as chapterTable } from "@/lib/db/schema";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { ChapterService } from "@/lib/services/chapter-service";

function createRouteDeps(session: { user: { id: string } } | null) {
  const db = getTestDb();
  const service = new ChapterService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    narratorRepo: new DrizzleNarratorRepository(db),
    editorRepo: new DrizzleEditorRepository(db),
    uow: new SavepointUnitOfWork(db),
  });
  return {
    getSession: vi.fn().mockResolvedValue(session),
    createService: vi.fn().mockReturnValue(service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

const URL = "http://test.local/api/v1/books/x/chapters/bulk-delete";

describe("POST /api/v1/books/:id/chapters/bulk-delete (handleChaptersBulkDelete)", () => {
  it("returns 401 when there is no session", async () => {
    const response = await handleChaptersBulkDelete(
      jsonRequest(URL, { chapterIds: [crypto.randomUUID()] }),
      crypto.randomUUID(),
      createRouteDeps(null),
    );
    expect(response.status).toBe(401);
  });

  it("returns 422 VALIDATION_ERROR for an empty chapterIds list", async () => {
    const response = await handleChaptersBulkDelete(
      jsonRequest(URL, { chapterIds: [] }),
      crypto.randomUUID(),
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 NOT_FOUND when book does not exist", async () => {
    const response = await handleChaptersBulkDelete(
      jsonRequest(URL, { chapterIds: [crypto.randomUUID()] }),
      crypto.randomUUID(),
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 422 CHAPTERS_NOT_IN_BOOK when an id belongs to a different book", async () => {
    const db = getTestDb();
    const { book: a } = await createTestBook(db);
    const { book: b } = await createTestBook(db);
    const { chapter: chA } = await createTestChapter(db, {
      bookId: a.id,
      number: 1,
      status: "pending",
    });
    const { chapter: chB } = await createTestChapter(db, {
      bookId: b.id,
      number: 1,
      status: "pending",
    });

    const response = await handleChaptersBulkDelete(
      jsonRequest(URL, { chapterIds: [chA.id, chB.id] }),
      a.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("CHAPTERS_NOT_IN_BOOK");

    // Atomic — neither chapter was deleted.
    const remaining = await db.select().from(chapterTable);
    expect(remaining).toHaveLength(2);
  });

  it("returns 409 CHAPTER_PAID_LOCKED atomically when one of the ids is paid", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter: c1 } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "pending",
    });
    const { chapter: c2 } = await createTestChapter(db, {
      bookId: book.id,
      number: 2,
      status: "paid",
      editedSeconds: 3600,
    });

    const response = await handleChaptersBulkDelete(
      jsonRequest(URL, { chapterIds: [c1.id, c2.id] }),
      book.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("CHAPTER_PAID_LOCKED");

    const remaining = await db.select().from(chapterTable).where(eq(chapterTable.bookId, book.id));
    expect(remaining).toHaveLength(2);
  });

  it("returns 204 and recomputes book.status when removing several non-paid chapters", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter: c1 } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "pending",
    });
    const { chapter: c2 } = await createTestChapter(db, {
      bookId: book.id,
      number: 2,
      status: "editing",
    });
    await createTestChapter(db, {
      bookId: book.id,
      number: 3,
      status: "completed",
      editedSeconds: 3600,
    });

    const response = await handleChaptersBulkDelete(
      jsonRequest(URL, { chapterIds: [c1.id, c2.id] }),
      book.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("X-Book-Deleted")).toBeNull();

    const remaining = await db.select().from(chapterTable).where(eq(chapterTable.bookId, book.id));
    expect(remaining).toHaveLength(1);
    const [refreshedBook] = await db.select().from(bookTable).where(eq(bookTable.id, book.id));
    expect(refreshedBook.status).toBe("completed");
  });

  it("cascade-deletes the book and emits X-Book-Deleted: true when removing all non-paid and no paid remains", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter: c1 } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "pending",
    });
    const { chapter: c2 } = await createTestChapter(db, {
      bookId: book.id,
      number: 2,
      status: "completed",
      editedSeconds: 3600,
    });

    const response = await handleChaptersBulkDelete(
      jsonRequest(URL, { chapterIds: [c1.id, c2.id] }),
      book.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("X-Book-Deleted")).toBe("true");

    const bookRows = await db.select().from(bookTable).where(eq(bookTable.id, book.id));
    expect(bookRows).toHaveLength(0);
    const chapterRows = await db
      .select()
      .from(chapterTable)
      .where(eq(chapterTable.bookId, book.id));
    expect(chapterRows).toHaveLength(0);
  });

  it("preserves the book when paid chapters remain after removing all non-paid", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter: c1 } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "pending",
    });
    await createTestChapter(db, {
      bookId: book.id,
      number: 2,
      status: "paid",
      editedSeconds: 3600,
    });

    const response = await handleChaptersBulkDelete(
      jsonRequest(URL, { chapterIds: [c1.id] }),
      book.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("X-Book-Deleted")).toBeNull();

    const remaining = await db.select().from(chapterTable).where(eq(chapterTable.bookId, book.id));
    expect(remaining).toHaveLength(1);
    const [refreshed] = await db.select().from(bookTable).where(eq(bookTable.id, book.id));
    expect(refreshed.status).toBe("paid");
  });
});
