import { getTestDb } from "@tests/helpers/db";
import { createTestStudio } from "@tests/helpers/factories";
import { wrapForTest } from "@tests/helpers/route-context";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { type BooksRouteDeps, handleBooksCreate } from "@/app/api/v1/books/route";
import { book, chapter } from "@/lib/db/schema";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { BookService } from "@/lib/services/book-service";

function makeRequest(body: unknown): Request {
  return new Request("http://test.local/api/v1/books", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function buildTestRouteDeps(): BooksRouteDeps {
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

function buildPost(session: { user: { id: string } } | null) {
  return wrapForTest((req, ctx) => handleBooksCreate(req, ctx, buildTestRouteDeps()), {
    session,
  });
}

const ROUTE_CTX = { params: Promise.resolve({}) };

describe("POST /api/v1/books (handleBooksCreate)", () => {
  let userId: string;

  beforeEach(() => {
    userId = crypto.randomUUID();
  });

  it("returns 401 when there is no session", async () => {
    const POST = buildPost(null);
    const response = await POST(
      makeRequest({
        title: "x",
        studioId: crypto.randomUUID(),
        pricePerHourCents: 7500,
        chapters: { numbered: 1, extras: [] },
      }),
      ROUTE_CTX,
    );
    expect(response.status).toBe(401);
  });

  it("returns 422 VALIDATION_ERROR for invalid payload", async () => {
    const POST = buildPost({ user: { id: userId } });
    const response = await POST(
      makeRequest({
        title: "",
        studioId: "not-a-uuid",
        pricePerHourCents: 0,
        chapters: { numbered: 0, extras: [] },
      }),
      ROUTE_CTX,
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 STUDIO_REFERENCE_INVALID when studioId does not exist", async () => {
    const POST = buildPost({ user: { id: userId } });
    const response = await POST(
      makeRequest({
        title: "Dom Casmurro",
        studioId: crypto.randomUUID(),
        pricePerHourCents: 7500,
        chapters: { numbered: 1, extras: [] },
      }),
      ROUTE_CTX,
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("STUDIO_REFERENCE_INVALID");
  });

  it("creates book + N chapters atomically and returns 201 with Location header", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db, {
      name: "Sonora",
      defaultHourlyRateCents: 7500,
    });

    const POST = buildPost({ user: { id: userId } });
    const response = await POST(
      makeRequest({
        title: "Dom Casmurro",
        studioId: studio.id,
        pricePerHourCents: 7500,
        chapters: { numbered: 10, extras: [] },
      }),
      ROUTE_CTX,
    );
    const body = (await response.json()) as {
      data: {
        id: string;
        title: string;
        studioId: string;
        pricePerHourCents: number;
        status: string;
        chapters: Array<{
          title: string;
          position: number;
          status: string;
          editedSeconds: number;
        }>;
      };
    };

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v1/books/${body.data.id}`);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.data.title).toBe("Dom Casmurro");
    expect(body.data.studioId).toBe(studio.id);
    expect(body.data.pricePerHourCents).toBe(7500);
    expect(body.data.status).toBe("pending");
    expect(body.data.chapters).toHaveLength(10);
    expect(body.data.chapters.map((c) => c.title)).toEqual([
      "Capítulo 1",
      "Capítulo 2",
      "Capítulo 3",
      "Capítulo 4",
      "Capítulo 5",
      "Capítulo 6",
      "Capítulo 7",
      "Capítulo 8",
      "Capítulo 9",
      "Capítulo 10",
    ]);
    expect(body.data.chapters.map((c) => c.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(body.data.chapters.every((c) => c.status === "pending")).toBe(true);
    expect(body.data.chapters.every((c) => c.editedSeconds === 0)).toBe(true);

    const [bookRow] = await db.select().from(book).where(eq(book.id, body.data.id));
    expect(bookRow.status).toBe("pending");

    const [chapterCount] = await db
      .select({ n: count(chapter.id) })
      .from(chapter)
      .where(eq(chapter.bookId, body.data.id));
    expect(chapterCount.n).toBe(10);
  });

  it("returns 409 TITLE_ALREADY_IN_USE when lower(title) conflicts in the same studio", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);

    const POST = buildPost({ user: { id: userId } });

    await POST(
      makeRequest({
        title: "Dom Casmurro",
        studioId: studio.id,
        pricePerHourCents: 7500,
        chapters: { numbered: 1, extras: [] },
      }),
      ROUTE_CTX,
    );

    const response = await POST(
      makeRequest({
        title: "dom casmurro",
        studioId: studio.id,
        pricePerHourCents: 6000,
        chapters: { numbered: 1, extras: [] },
      }),
      ROUTE_CTX,
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("TITLE_ALREADY_IN_USE");

    const rows = await db.select().from(book);
    expect(rows).toHaveLength(1);
  });

  it("rolls back when the unique-title constraint fires mid-transaction (no orphan chapters)", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);

    const POST = buildPost({ user: { id: userId } });

    await POST(
      makeRequest({
        title: "Atomic",
        studioId: studio.id,
        pricePerHourCents: 7500,
        chapters: { numbered: 5, extras: [] },
      }),
      ROUTE_CTX,
    );

    const initialChapterCount = await db.select({ n: count(chapter.id) }).from(chapter);
    expect(initialChapterCount[0].n).toBe(5);

    await POST(
      makeRequest({
        title: "Atomic",
        studioId: studio.id,
        pricePerHourCents: 7500,
        chapters: { numbered: 10, extras: [] },
      }),
      ROUTE_CTX,
    );

    const afterChapterCount = await db.select({ n: count(chapter.id) }).from(chapter);
    expect(afterChapterCount[0].n).toBe(5);

    const books = await db.select().from(book);
    expect(books).toHaveLength(1);
  });
});
