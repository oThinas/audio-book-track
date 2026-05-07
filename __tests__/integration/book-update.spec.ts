import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter, createTestStudio } from "@tests/helpers/factories";
import { jsonRequest } from "@tests/helpers/http";
import { wrapForTest } from "@tests/helpers/route-context";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { count, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { type BookByIdRouteDeps, handleBookUpdate } from "@/app/api/v1/books/[id]/route";
import { book as bookTable, chapter as chapterTable } from "@/lib/db/schema";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { BookService } from "@/lib/services/book-service";

function buildTestRouteDeps(): BookByIdRouteDeps {
  const db = getTestDb();
  const service = new BookService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    studioRepo: new DrizzleStudioRepository(db),
    narratorRepo: new DrizzleNarratorRepository(db),
    editorRepo: new DrizzleEditorRepository(db),
    uow: new SavepointUnitOfWork(db),
  });
  return { createService: () => service };
}

function buildPatch(session: { user: { id: string } } | null) {
  return wrapForTest<{ id: string }>(
    (req, ctx) => handleBookUpdate(req, ctx, buildTestRouteDeps()),
    { session },
  );
}

const URL = "http://test.local/api/v1/books/x";

describe("PATCH /api/v1/books/:id (handleBookUpdate)", () => {
  const session = { user: { id: crypto.randomUUID() } };

  it("returns 401 without a session", async () => {
    const PATCH = buildPatch(null);
    const response = await PATCH(jsonRequest(URL, { title: "Novo" }, { method: "PATCH" }), {
      params: Promise.resolve({ id: crypto.randomUUID() }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 422 when payload is empty", async () => {
    const PATCH = buildPatch(session);
    const response = await PATCH(jsonRequest(URL, {}, { method: "PATCH" }), {
      params: Promise.resolve({ id: crypto.randomUUID() }),
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 NOT_FOUND when the book does not exist", async () => {
    const PATCH = buildPatch(session);
    const response = await PATCH(jsonRequest(URL, { title: "Algo" }, { method: "PATCH" }), {
      params: Promise.resolve({ id: crypto.randomUUID() }),
    });
    expect(response.status).toBe(404);
  });

  it("updates the title and returns the refreshed detail", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db, { title: "Antigo" });
    await createTestChapter(db, { bookId: book.id, number: 1, status: "pending" });

    const PATCH = buildPatch(session);
    const response = await PATCH(jsonRequest(URL, { title: "Novo" }, { method: "PATCH" }), {
      params: Promise.resolve({ id: book.id }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { id: string; title: string } };
    expect(body.data.id).toBe(book.id);
    expect(body.data.title).toBe("Novo");

    const [refreshed] = await db.select().from(bookTable).where(eq(bookTable.id, book.id));
    expect(refreshed.title).toBe("Novo");
  });

  it("appends Y-X chapters atomically when numChapters increases", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    await createTestChapter(db, { bookId: book.id, number: 1, status: "pending" });
    await createTestChapter(db, { bookId: book.id, number: 2, status: "pending" });

    const PATCH = buildPatch(session);
    const response = await PATCH(jsonRequest(URL, { numChapters: 5 }, { method: "PATCH" }), {
      params: Promise.resolve({ id: book.id }),
    });
    expect(response.status).toBe(200);

    const [{ n }] = await db
      .select({ n: count(chapterTable.id) })
      .from(chapterTable)
      .where(eq(chapterTable.bookId, book.id));
    expect(n).toBe(5);

    const numbers = (
      await db
        .select({ number: chapterTable.number })
        .from(chapterTable)
        .where(eq(chapterTable.bookId, book.id))
    )
      .map((r) => r.number)
      .sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns 422 CANNOT_REDUCE_CHAPTERS when numChapters < current total", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    await createTestChapter(db, { bookId: book.id, number: 1, status: "pending" });
    await createTestChapter(db, { bookId: book.id, number: 2, status: "pending" });
    await createTestChapter(db, { bookId: book.id, number: 3, status: "pending" });

    const PATCH = buildPatch(session);
    const response = await PATCH(jsonRequest(URL, { numChapters: 2 }, { method: "PATCH" }), {
      params: Promise.resolve({ id: book.id }),
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("BOOK_CANNOT_REDUCE_CHAPTERS");
  });

  it("returns 409 BOOK_PAID_PRICE_LOCKED when changing pricePerHourCents with a paid chapter", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db, { pricePerHourCents: 7500 });
    await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });

    const PATCH = buildPatch(session);
    const response = await PATCH(
      jsonRequest(URL, { pricePerHourCents: 9000 }, { method: "PATCH" }),
      {
        params: Promise.resolve({ id: book.id }),
      },
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("BOOK_PAID_PRICE_LOCKED");

    const [unchanged] = await db.select().from(bookTable).where(eq(bookTable.id, book.id));
    expect(unchanged.pricePerHourCents).toBe(7500);
  });

  it("returns 409 BOOK_PAID_STUDIO_LOCKED when changing studioId with a paid chapter", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });
    const { studio: other } = await createTestStudio(db, { name: "Outro estúdio" });

    const PATCH = buildPatch(session);
    const response = await PATCH(jsonRequest(URL, { studioId: other.id }, { method: "PATCH" }), {
      params: Promise.resolve({ id: book.id }),
    });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("BOOK_PAID_STUDIO_LOCKED");
  });

  it("returns 409 TITLE_ALREADY_IN_USE when the new title collides in the same studio", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);
    const { book: a } = await createTestBook(db, {
      studioId: studio.id,
      title: "Dom Casmurro",
    });
    const { book: b } = await createTestBook(db, { studioId: studio.id, title: "Outro" });
    await createTestChapter(db, { bookId: b.id, number: 1, status: "pending" });

    const PATCH = buildPatch(session);
    const response = await PATCH(jsonRequest(URL, { title: "dom casmurro" }, { method: "PATCH" }), {
      params: Promise.resolve({ id: b.id }),
    });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("TITLE_ALREADY_IN_USE");

    const [refreshed] = await db.select().from(bookTable).where(eq(bookTable.id, a.id));
    expect(refreshed.title).toBe("Dom Casmurro");
  });

  it("returns 422 STUDIO_REFERENCE_INVALID when target studioId does not exist", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    await createTestChapter(db, { bookId: book.id, number: 1, status: "pending" });

    const PATCH = buildPatch(session);
    const response = await PATCH(
      jsonRequest(URL, { studioId: crypto.randomUUID() }, { method: "PATCH" }),
      { params: Promise.resolve({ id: book.id }) },
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("STUDIO_REFERENCE_INVALID");
  });
});
