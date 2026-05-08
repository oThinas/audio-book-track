import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter, createTestStudio } from "@tests/helpers/factories";
import { wrapForTest } from "@tests/helpers/route-context";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { describe, expect, it } from "vitest";

import { type BooksRouteDeps, handleBooksList } from "@/app/api/v1/books/route";
import { book } from "@/lib/db/schema";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { BookService } from "@/lib/services/book-service";

function createRepo() {
  return new DrizzleBookRepository(getTestDb());
}

describe("DrizzleBookRepository.listSummaries (SQL aggregation)", () => {
  it("returns an empty array when there are no books", async () => {
    const repo = createRepo();

    expect(await repo.listSummaries()).toEqual([]);
  });

  it("computes totalChapters, completedChapters and totalEarningsCents per book", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db, {
      name: "Sonora",
      defaultHourlyRateCents: 7500,
    });
    const { book: createdBook } = await createTestBook(db, {
      title: "Dom Casmurro",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await createTestChapter(db, {
      bookId: createdBook.id,
      number: 1,
      status: "completed",
      editedSeconds: 3600,
    });
    await createTestChapter(db, {
      bookId: createdBook.id,
      number: 2,
      status: "paid",
      editedSeconds: 7200,
    });
    await createTestChapter(db, {
      bookId: createdBook.id,
      number: 3,
      status: "pending",
      editedSeconds: 0,
    });

    const repo = createRepo();
    const summaries = await repo.listSummaries();

    expect(summaries).toHaveLength(1);
    const [summary] = summaries;
    expect(summary.id).toBe(createdBook.id);
    expect(summary.title).toBe("Dom Casmurro");
    expect(summary.studio).toEqual({ id: studio.id, name: "Sonora" });
    expect(summary.pricePerHourCents).toBe(7500);
    expect(summary.totalChapters).toBe(3);
    expect(summary.completedChapters).toBe(2);
    expect(summary.totalEarningsCents).toBe(22_500);
  });

  it("returns totalChapters=0 and totalEarningsCents=0 for a book with no chapters (LEFT JOIN edge case)", async () => {
    const db = getTestDb();
    const { book: createdBook } = await createTestBook(db, { pricePerHourCents: 7500 });

    const repo = createRepo();
    const [summary] = await repo.listSummaries();

    expect(summary.id).toBe(createdBook.id);
    expect(summary.totalChapters).toBe(0);
    expect(summary.completedChapters).toBe(0);
    expect(summary.totalEarningsCents).toBe(0);
  });

  it("resolves studio name even when the studio has been soft-deleted", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db, {
      name: "Legacy Studio",
      defaultHourlyRateCents: 7500,
    });
    const { book: createdBook } = await createTestBook(db, {
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await createTestChapter(db, {
      bookId: createdBook.id,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });

    await new DrizzleStudioRepository(db).softDelete(studio.id);

    const [summary] = await createRepo().listSummaries();

    expect(summary.studio).toEqual({ id: studio.id, name: "Legacy Studio" });
  });

  it("orders results by createdAt DESC", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);
    const [older] = await db
      .insert(book)
      .values({
        title: "Older",
        studioId: studio.id,
        pricePerHourCents: 7500,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      })
      .returning();
    const [newer] = await db
      .insert(book)
      .values({
        title: "Newer",
        studioId: studio.id,
        pricePerHourCents: 7500,
        createdAt: new Date("2026-06-01T00:00:00Z"),
        updatedAt: new Date("2026-06-01T00:00:00Z"),
      })
      .returning();

    const summaries = await createRepo().listSummaries();

    expect(summaries.map((s) => s.id)).toEqual([newer.id, older.id]);
  });

  it("rounds earnings per-row before summing (matches JS formula in data-model)", async () => {
    const db = getTestDb();
    const { book: createdBook } = await createTestBook(db, { pricePerHourCents: 7500 });
    await createTestChapter(db, {
      bookId: createdBook.id,
      number: 1,
      status: "paid",
      editedSeconds: 3601,
    });
    await createTestChapter(db, {
      bookId: createdBook.id,
      number: 2,
      status: "paid",
      editedSeconds: 3599,
    });

    const [summary] = await createRepo().listSummaries();
    expect(summary.totalEarningsCents).toBe(15_000);
  });
});

describe("GET /api/v1/books (handleBooksList, real DB)", () => {
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

  function buildGet(session: { user: { id: string } } | null) {
    return wrapForTest((req, ctx) => handleBooksList(req, ctx, buildTestRouteDeps()), {
      session,
    });
  }

  const ROUTE_CTX = { params: Promise.resolve({}) };

  function makeRequest(): Request {
    return new Request("http://test.local/api/v1/books");
  }

  it("returns 401 when there is no session", async () => {
    const GET = buildGet(null);
    const response = await GET(makeRequest(), ROUTE_CTX);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 200 with correct aggregations for 3 books with chapters in varied states", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db, {
      name: "Sonora",
      defaultHourlyRateCents: 7500,
    });

    const [bookA] = await db
      .insert(book)
      .values({
        title: "Alpha",
        studioId: studio.id,
        pricePerHourCents: 7500,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      })
      .returning();
    await createTestChapter(db, {
      bookId: bookA.id,
      number: 1,
      status: "paid",
      editedSeconds: 7200,
    });
    await createTestChapter(db, {
      bookId: bookA.id,
      number: 2,
      status: "completed",
      editedSeconds: 3600,
    });
    await createTestChapter(db, {
      bookId: bookA.id,
      number: 3,
      status: "editing",
      editedSeconds: 0,
    });

    const [bookB] = await db
      .insert(book)
      .values({
        title: "Beta",
        studioId: studio.id,
        pricePerHourCents: 6000,
        createdAt: new Date("2026-02-01T00:00:00Z"),
        updatedAt: new Date("2026-02-01T00:00:00Z"),
      })
      .returning();
    await createTestChapter(db, {
      bookId: bookB.id,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });

    await db.insert(book).values({
      title: "Gamma",
      studioId: studio.id,
      pricePerHourCents: 9000,
      createdAt: new Date("2026-03-01T00:00:00Z"),
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });

    const GET = buildGet({ user: { id: crypto.randomUUID() } });
    const response = await GET(makeRequest(), ROUTE_CTX);
    const body = (await response.json()) as {
      data: Array<{
        id: string;
        title: string;
        totalChapters: number;
        completedChapters: number;
        totalEarningsCents: number;
      }>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.data).toHaveLength(3);
    expect(body.data.map((b) => b.title)).toEqual(["Gamma", "Beta", "Alpha"]);

    const alpha = body.data.find((b) => b.title === "Alpha") as (typeof body.data)[number];
    expect(alpha.totalChapters).toBe(3);
    expect(alpha.completedChapters).toBe(2);
    expect(alpha.totalEarningsCents).toBe(22_500);

    const beta = body.data.find((b) => b.title === "Beta") as (typeof body.data)[number];
    expect(beta.totalChapters).toBe(1);
    expect(beta.completedChapters).toBe(1);
    expect(beta.totalEarningsCents).toBe(6_000);

    const gamma = body.data.find((b) => b.title === "Gamma") as (typeof body.data)[number];
    expect(gamma.totalChapters).toBe(0);
    expect(gamma.completedChapters).toBe(0);
    expect(gamma.totalEarningsCents).toBe(0);
  });
});
