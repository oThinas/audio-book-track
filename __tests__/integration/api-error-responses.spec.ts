import { getTestDb } from "@tests/helpers/db";
import {
  createTestBook,
  createTestChapter,
  createTestEditor,
  createTestNarrator,
  createTestStudio,
} from "@tests/helpers/factories";
import { jsonRequest } from "@tests/helpers/http";
import { wrapForTest } from "@tests/helpers/route-context";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { describe, expect, it } from "vitest";
import {
  type ChaptersBulkDeleteRouteDeps,
  handleChaptersBulkDelete,
} from "@/app/api/v1/books/[id]/chapters/bulk-delete/route";
import { type BookByIdRouteDeps, handleBookUpdate } from "@/app/api/v1/books/[id]/route";
import {
  type ChapterByIdRouteDeps,
  handleChapterDelete,
  handleChapterUpdate,
} from "@/app/api/v1/chapters/[id]/route";
import { handleEditorsDelete } from "@/app/api/v1/editors/[id]/route";
import { handleNarratorsDelete } from "@/app/api/v1/narrators/[id]/route";
import { handleStudiosDelete, type StudioByIdRouteDeps } from "@/app/api/v1/studios/[id]/route";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { BookService } from "@/lib/services/book-service";
import { ChapterService } from "@/lib/services/chapter-service";
import { EditorService } from "@/lib/services/editor-service";
import { NarratorService } from "@/lib/services/narrator-service";
import { StudioService } from "@/lib/services/studio-service";

// Error responses must never leak stack traces, SQL messages,
// internal paths, UUIDs in user-facing messages, or domain English jargon.
const LEAK_PATTERNS = [
  /\bError:\s/, // Node Error toString prefix
  /^\s+at\s/m, // stack trace frame
  /\bat\s\//, // path-prefixed stack frame
  /sql:/i, // pg/Drizzle wrapper noise
  /postgres:\/\//i, // connection string
  /\bSELECT\s/i, // raw SQL
  /\bINSERT\s/i,
  /\bUPDATE\s/i,
  /\bDELETE\s/i, // raw SQL verbs (do not flag JSON envelope)
  /relation\s+"\w+"\s+does\s+not\s+exist/i,
  /^\/(home|usr|var|tmp|root)\//m, // FS paths
] as const;

function assertNoLeak(body: string): void {
  for (const pattern of LEAK_PATTERNS) {
    expect(body, `Error response leaked pattern ${pattern}`).not.toMatch(pattern);
  }
}

function buildBookByIdDeps(): BookByIdRouteDeps {
  const db = getTestDb();
  return {
    createService: () =>
      new BookService({
        bookRepo: new DrizzleBookRepository(db),
        chapterRepo: new DrizzleChapterRepository(db),
        studioRepo: new DrizzleStudioRepository(db),
        narratorRepo: new DrizzleNarratorRepository(db),
        editorRepo: new DrizzleEditorRepository(db),
        uow: new SavepointUnitOfWork(db),
      }),
  };
}

function buildChapterByIdDeps(): ChapterByIdRouteDeps {
  const db = getTestDb();
  return {
    createService: () =>
      new ChapterService({
        bookRepo: new DrizzleBookRepository(db),
        chapterRepo: new DrizzleChapterRepository(db),
        narratorRepo: new DrizzleNarratorRepository(db),
        editorRepo: new DrizzleEditorRepository(db),
        uow: new SavepointUnitOfWork(db),
      }),
  };
}

function buildBulkDeleteDeps(): ChaptersBulkDeleteRouteDeps {
  return buildChapterByIdDeps();
}

function buildStudioByIdDeps(): StudioByIdRouteDeps {
  const db = getTestDb();
  return {
    createService: () => new StudioService(new DrizzleStudioRepository(db)),
    createSoftDeleteDeps: () => ({
      getActiveBooks: async () => [],
    }),
  };
}

const SESSION = { user: { id: crypto.randomUUID() } };
const ROUTE_URL = "http://test.local/api/v1/x";

describe("API error responses — FR-017 + D-09 (no stack/SQL/path leaks across routes)", () => {
  describe("validation errors (422 VALIDATION_ERROR)", () => {
    it("PATCH /books/:id with invalid pdfUrl scheme", async () => {
      const db = getTestDb();
      const { studio } = await createTestStudio(db);
      const { book } = await createTestBook(db, { studioId: studio.id });

      const PATCH = wrapForTest<{ id: string }>(
        (req, ctx) => handleBookUpdate(req, ctx, buildBookByIdDeps()),
        { session: SESSION },
      );
      const response = await PATCH(
        jsonRequest(ROUTE_URL, { pdfUrl: "ftp://invalid.example/file.pdf" }, { method: "PATCH" }),
        { params: Promise.resolve({ id: book.id }) },
      );

      expect(response.status).toBe(422);
      const body = await response.text();
      assertNoLeak(body);
      expect(body).toContain("VALIDATION_ERROR");
    });

    it("PATCH /chapters/:id with empty body", async () => {
      const PATCH = wrapForTest<{ id: string }>(
        (req, ctx) => handleChapterUpdate(req, ctx, buildChapterByIdDeps()),
        { session: SESSION },
      );
      const response = await PATCH(jsonRequest(ROUTE_URL, {}, { method: "PATCH" }), {
        params: Promise.resolve({ id: crypto.randomUUID() }),
      });

      expect(response.status).toBe(422);
      const body = await response.text();
      assertNoLeak(body);
      expect(body).toContain("VALIDATION_ERROR");
    });

    it("POST /books/:id/chapters/bulk-delete with empty list", async () => {
      const POST = wrapForTest<{ id: string }>(
        (req, ctx) => handleChaptersBulkDelete(req, ctx, buildBulkDeleteDeps()),
        { session: SESSION },
      );
      const response = await POST(jsonRequest(ROUTE_URL, { chapterIds: [] }), {
        params: Promise.resolve({ id: crypto.randomUUID() }),
      });

      expect(response.status).toBe(422);
      const body = await response.text();
      assertNoLeak(body);
      expect(body).toContain("VALIDATION_ERROR");
    });
  });

  describe("not-found errors (404)", () => {
    it("PATCH /books/:id when book does not exist → BOOK_NOT_FOUND", async () => {
      const PATCH = wrapForTest<{ id: string }>(
        (req, ctx) => handleBookUpdate(req, ctx, buildBookByIdDeps()),
        { session: SESSION },
      );
      const response = await PATCH(jsonRequest(ROUTE_URL, { title: "x" }, { method: "PATCH" }), {
        params: Promise.resolve({ id: crypto.randomUUID() }),
      });

      expect(response.status).toBe(404);
      const body = await response.text();
      assertNoLeak(body);
      expect(body).toContain("BOOK_NOT_FOUND");
    });

    it("DELETE /chapters/:id when chapter does not exist → CHAPTER_NOT_FOUND", async () => {
      const DELETE = wrapForTest<{ id: string }>(
        (req, ctx) => handleChapterDelete(req, ctx, buildChapterByIdDeps()),
        { session: SESSION },
      );
      const response = await DELETE(new Request(ROUTE_URL, { method: "DELETE" }), {
        params: Promise.resolve({ id: crypto.randomUUID() }),
      });

      expect(response.status).toBe(404);
      const body = await response.text();
      assertNoLeak(body);
      expect(body).toContain("CHAPTER_NOT_FOUND");
    });

    it("DELETE /studios/:id when studio does not exist → STUDIO_NOT_FOUND", async () => {
      const DELETE = wrapForTest<{ id: string }>(
        (req, ctx) => handleStudiosDelete(req, ctx, buildStudioByIdDeps()),
        { session: SESSION },
      );
      const response = await DELETE(new Request(ROUTE_URL, { method: "DELETE" }), {
        params: Promise.resolve({ id: crypto.randomUUID() }),
      });

      expect(response.status).toBe(404);
      const body = await response.text();
      assertNoLeak(body);
      expect(body).toContain("STUDIO_NOT_FOUND");
    });
  });

  describe("domain conflict errors (409)", () => {
    it("PATCH /books/:id with title collision → TITLE_ALREADY_IN_USE", async () => {
      const db = getTestDb();
      const { studio } = await createTestStudio(db);
      await createTestBook(db, { studioId: studio.id, title: "Título Existente" });
      const { book: target } = await createTestBook(db, {
        studioId: studio.id,
        title: "Outro Título",
      });

      const PATCH = wrapForTest<{ id: string }>(
        (req, ctx) => handleBookUpdate(req, ctx, buildBookByIdDeps()),
        { session: SESSION },
      );
      const response = await PATCH(
        jsonRequest(ROUTE_URL, { title: "Título Existente" }, { method: "PATCH" }),
        { params: Promise.resolve({ id: target.id }) },
      );

      expect(response.status).toBe(409);
      const body = await response.text();
      assertNoLeak(body);
      expect(body).toContain("TITLE_ALREADY_IN_USE");
    });

    it("PATCH /chapters/:id with paid chapter mutation → CHAPTER_PAID_LOCKED", async () => {
      const db = getTestDb();
      const { book } = await createTestBook(db);
      const { narrator } = await createTestNarrator(db);
      const { chapter } = await createTestChapter(db, {
        bookId: book.id,
        number: 1,
        status: "paid",
      });

      const PATCH = wrapForTest<{ id: string }>(
        (req, ctx) => handleChapterUpdate(req, ctx, buildChapterByIdDeps()),
        { session: SESSION },
      );
      const response = await PATCH(
        jsonRequest(ROUTE_URL, { narratorId: narrator.id }, { method: "PATCH" }),
        { params: Promise.resolve({ id: chapter.id }) },
      );

      expect(response.status).toBe(409);
      const body = await response.text();
      assertNoLeak(body);
      expect(body).toContain("CHAPTER_PAID_LOCKED");
    });
  });

  describe("blocking-list errors (409 with details.books)", () => {
    it("DELETE /studios/:id with active books → STUDIO_HAS_ACTIVE_BOOKS", async () => {
      const db = getTestDb();
      const { studio } = await createTestStudio(db);
      const { book } = await createTestBook(db, { studioId: studio.id });
      await createTestChapter(db, { bookId: book.id, number: 1, status: "editing" });

      const DELETE = wrapForTest<{ id: string }>(
        (req, ctx) =>
          handleStudiosDelete(req, ctx, {
            createService: () => new StudioService(new DrizzleStudioRepository(db)),
            createSoftDeleteDeps: () => ({
              getActiveBooks: async () => [{ id: book.id, title: book.title }],
            }),
          }),
        { session: SESSION },
      );
      const response = await DELETE(new Request(ROUTE_URL, { method: "DELETE" }), {
        params: Promise.resolve({ id: studio.id }),
      });

      expect(response.status).toBe(409);
      const body = await response.text();
      assertNoLeak(body);
      expect(body).toContain("STUDIO_HAS_ACTIVE_BOOKS");
      expect(body).toContain(book.title);
    });

    it("DELETE /narrators/:id with active chapters → NARRATOR_LINKED_TO_ACTIVE_CHAPTERS", async () => {
      const db = getTestDb();
      const { narrator } = await createTestNarrator(db);
      const { book } = await createTestBook(db);
      await createTestChapter(db, {
        bookId: book.id,
        number: 1,
        status: "editing",
        narratorId: narrator.id,
      });

      const DELETE = wrapForTest<{ id: string }>(
        (req, ctx) =>
          handleNarratorsDelete(req, ctx, {
            createService: () => new NarratorService(new DrizzleNarratorRepository(db)),
            createSoftDeleteDeps: () => ({
              getActiveBooks: async () => [{ id: book.id, title: book.title }],
            }),
          }),
        { session: SESSION },
      );
      const response = await DELETE(new Request(ROUTE_URL, { method: "DELETE" }), {
        params: Promise.resolve({ id: narrator.id }),
      });

      expect(response.status).toBe(409);
      const body = await response.text();
      assertNoLeak(body);
      expect(body).toContain("NARRATOR_LINKED_TO_ACTIVE_CHAPTERS");
    });

    it("DELETE /editors/:id with active chapters → EDITOR_LINKED_TO_ACTIVE_CHAPTERS", async () => {
      const db = getTestDb();
      const { editor } = await createTestEditor(db);
      const { book } = await createTestBook(db);
      await createTestChapter(db, {
        bookId: book.id,
        number: 1,
        status: "reviewing",
        editorId: editor.id,
      });

      const DELETE = wrapForTest<{ id: string }>(
        (req, ctx) =>
          handleEditorsDelete(req, ctx, {
            createService: () => new EditorService(new DrizzleEditorRepository(db)),
            createSoftDeleteDeps: () => ({
              getActiveBooks: async () => [{ id: book.id, title: book.title }],
            }),
          }),
        { session: SESSION },
      );
      const response = await DELETE(new Request(ROUTE_URL, { method: "DELETE" }), {
        params: Promise.resolve({ id: editor.id }),
      });

      expect(response.status).toBe(409);
      const body = await response.text();
      assertNoLeak(body);
      expect(body).toContain("EDITOR_LINKED_TO_ACTIVE_CHAPTERS");
    });
  });

  describe("unmapped errors (500 INTERNAL_ERROR)", () => {
    it("handler rethrow of leaky raw error → wrapper produces generic 500 body", async () => {
      const leakyError = new Error(
        'postgres://user:pw@host/db: relation "book" does not exist\n    at /home/app/db.ts:42:7',
      );
      const stubService = {
        update: () => {
          throw leakyError;
        },
        findById: () => Promise.resolve(null),
      } as unknown as BookService;

      const db = getTestDb();
      const { studio } = await createTestStudio(db);
      const { book } = await createTestBook(db, { studioId: studio.id });

      const PATCH = wrapForTest<{ id: string }>(
        (req, ctx) =>
          handleBookUpdate(req, ctx, {
            createService: () => stubService,
          }),
        { session: SESSION },
      );
      const response = await PATCH(
        jsonRequest(ROUTE_URL, { title: "Novo título" }, { method: "PATCH" }),
        { params: Promise.resolve({ id: book.id }) },
      );

      expect(response.status).toBe(500);
      const body = await response.text();
      assertNoLeak(body);
      expect(body).toContain("INTERNAL_ERROR");
      expect(response.headers.get("X-Request-Id")).not.toBeNull();
    });
  });
});
