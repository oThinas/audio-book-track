import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestStudio } from "@tests/helpers/factories";
import { jsonRequest } from "@tests/helpers/http";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { describe, expect, it, vi } from "vitest";

import { handleBookUpdate } from "@/app/api/v1/books/[id]/route";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import type { BookService } from "@/lib/services/book-service";
import { BookService as BookServiceImpl } from "@/lib/services/book-service";

// Error responses must never leak stack traces, SQL messages or strings
// that point to the filesystem. These patterns cover the most common
// leaks seen in Node/PostgreSQL.
const LEAK_PATTERNS = [/Error:/, /\bat \//, /^\s+at /m, /sql:/i, /postgres:\/\//i] as const;

function assertNoLeak(body: string): void {
  for (const pattern of LEAK_PATTERNS) {
    expect(body, `Error response leaked pattern ${pattern}`).not.toMatch(pattern);
  }
}

function createRouteDeps(service: BookService) {
  return {
    getSession: vi.fn().mockResolvedValue({ user: { id: crypto.randomUUID() } }),
    createService: vi.fn().mockReturnValue(service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

function createRealService(): BookService {
  const db = getTestDb();
  return new BookServiceImpl({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    studioRepo: new DrizzleStudioRepository(db),
    narratorRepo: new DrizzleNarratorRepository(db),
    editorRepo: new DrizzleEditorRepository(db),
    uow: new SavepointUnitOfWork(db),
  });
}

const ROUTE_URL = "http://test.local/api/v1/books/x";

describe("API error responses — FR-017 (no stack/SQL leaks)", () => {
  it("422 (validation) — body should not contain stack traces or SQL", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);
    const { book } = await createTestBook(db, { studioId: studio.id });

    const response = await handleBookUpdate(
      jsonRequest(ROUTE_URL, { pdfUrl: "ftp://invalid.example/file.pdf" }, { method: "PATCH" }),
      book.id,
      createRouteDeps(createRealService()),
    );

    expect(response.status).toBe(422);
    const body = await response.text();
    assertNoLeak(body);
    // Sanity: the correct envelope is VALIDATION_ERROR.
    expect(body).toContain("VALIDATION_ERROR");
  });

  it("409 (domain conflict) — body should not contain stack traces or SQL", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);
    // Renaming a book to another book's title triggers
    // BookTitleAlreadyInUseError → conflictResponse(409).
    const { book: existing } = await createTestBook(db, {
      studioId: studio.id,
      title: "Título Existente",
    });
    const { book: target } = await createTestBook(db, {
      studioId: studio.id,
      title: "Outro Título",
    });
    expect(existing.title).toBe("Título Existente");

    const response = await handleBookUpdate(
      jsonRequest(ROUTE_URL, { title: "Título Existente" }, { method: "PATCH" }),
      target.id,
      createRouteDeps(createRealService()),
    );

    expect(response.status).toBe(409);
    const body = await response.text();
    assertNoLeak(body);
    expect(body).toContain("TITLE_ALREADY_IN_USE");
  });

  it("500-equivalent (unmapped error) — handler rethrows without producing a leaky body", async () => {
    // When service.update throws an error NOT mapped by the handler's catches,
    // the only correct action is to rethrow — Next.js converts it into a generic
    // 500. Here we verify the handler never builds a Response containing the
    // original message (which could contain SQL/stack).
    const leakyError = new Error(
      'postgres://user:pw@host/db: relation "book" does not exist\n    at /home/app/db.ts:42:7\n    at processTicksAndRejections',
    );
    const stubService = {
      update: vi.fn().mockRejectedValue(leakyError),
    } as unknown as BookService;

    const db = getTestDb();
    const { studio } = await createTestStudio(db);
    const { book } = await createTestBook(db, { studioId: studio.id });

    await expect(
      handleBookUpdate(
        jsonRequest(ROUTE_URL, { title: "Novo título" }, { method: "PATCH" }),
        book.id,
        createRouteDeps(stubService),
      ),
    ).rejects.toBe(leakyError);
    // If we got here, the handler rethrew correctly — no response body was
    // built with the error message.
  });
});
