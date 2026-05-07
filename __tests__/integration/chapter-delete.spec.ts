import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter } from "@tests/helpers/factories";
import { wrapForTest } from "@tests/helpers/route-context";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { type ChapterByIdRouteDeps, handleChapterDelete } from "@/app/api/v1/chapters/[id]/route";
import { book as bookTable, chapter as chapterTable } from "@/lib/db/schema";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { ChapterService } from "@/lib/services/chapter-service";

function buildTestRouteDeps(): ChapterByIdRouteDeps {
  const db = getTestDb();
  const service = new ChapterService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    narratorRepo: new DrizzleNarratorRepository(db),
    editorRepo: new DrizzleEditorRepository(db),
    uow: new SavepointUnitOfWork(db),
  });
  return { createService: () => service };
}

function buildDelete(session: { user: { id: string } } | null) {
  return wrapForTest<{ id: string }>(
    (req, ctx) => handleChapterDelete(req, ctx, buildTestRouteDeps()),
    { session },
  );
}

function makeRequest(): Request {
  return new Request("http://test.local/api/v1/chapters/x", { method: "DELETE" });
}

describe("DELETE /api/v1/chapters/:id (handleChapterDelete)", () => {
  const session = { user: { id: crypto.randomUUID() } };

  it("returns 401 when there is no session", async () => {
    const DELETE = buildDelete(null);
    const response = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: crypto.randomUUID() }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 NOT_FOUND when chapter does not exist", async () => {
    const DELETE = buildDelete(session);
    const response = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: crypto.randomUUID() }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 409 CHAPTER_PAID_LOCKED when the chapter is paid", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });

    const DELETE = buildDelete(session);
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: chapter.id }) });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("CHAPTER_PAID_LOCKED");

    const stillThere = await db.select().from(chapterTable).where(eq(chapterTable.id, chapter.id));
    expect(stillThere).toHaveLength(1);
  });

  it("returns 204 and recomputes book.status when the chapter is deleted (no cascade)", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    await createTestChapter(db, { bookId: book.id, number: 1, status: "completed" });
    const { chapter: target } = await createTestChapter(db, {
      bookId: book.id,
      number: 2,
      status: "pending",
    });

    const DELETE = buildDelete(session);
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: target.id }) });

    expect(response.status).toBe(204);
    expect(response.headers.get("X-Book-Deleted")).toBeNull();

    const remaining = await db.select().from(chapterTable).where(eq(chapterTable.bookId, book.id));
    expect(remaining).toHaveLength(1);

    const [refreshed] = await db.select().from(bookTable).where(eq(bookTable.id, book.id));
    expect(refreshed.status).toBe("completed");
  });

  it("cascade-deletes the book and emits X-Book-Deleted: true when removing the last non-paid chapter", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter: only } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "pending",
    });

    const DELETE = buildDelete(session);
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: only.id }) });

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

  it("does NOT cascade-delete when paid chapters remain even if last non-paid is removed", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });
    const { chapter: target } = await createTestChapter(db, {
      bookId: book.id,
      number: 2,
      status: "pending",
    });

    const DELETE = buildDelete(session);
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: target.id }) });

    expect(response.status).toBe(204);
    expect(response.headers.get("X-Book-Deleted")).toBeNull();

    const bookRows = await db.select().from(bookTable).where(eq(bookTable.id, book.id));
    expect(bookRows).toHaveLength(1);
  });
});
