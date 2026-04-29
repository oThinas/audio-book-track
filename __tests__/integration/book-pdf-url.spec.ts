import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestStudio } from "@tests/helpers/factories";
import { jsonRequest } from "@tests/helpers/http";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { handleBookUpdate } from "@/app/api/v1/books/[id]/route";
import { book as bookTable } from "@/lib/db/schema";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { BookService } from "@/lib/services/book-service";

function createRouteDeps(session: { user: { id: string } } | null) {
  const db = getTestDb();
  const service = new BookService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    studioRepo: new DrizzleStudioRepository(db),
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

const ROUTE_URL = "http://test.local/api/v1/books/x";

describe("PATCH /api/v1/books/:id — pdfUrl", () => {
  it("persists an https URL and returns it in the detail response", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);
    const { book } = await createTestBook(db, { studioId: studio.id });

    const response = await handleBookUpdate(
      jsonRequest(ROUTE_URL, { pdfUrl: "https://example.com/livro.pdf" }, { method: "PATCH" }),
      book.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { pdfUrl: string | null } };
    expect(body.data.pdfUrl).toBe("https://example.com/livro.pdf");

    const [persisted] = await db.select().from(bookTable).where(eq(bookTable.id, book.id));
    expect(persisted?.pdfUrl).toBe("https://example.com/livro.pdf");
  });

  it("persists an http URL", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);
    const { book } = await createTestBook(db, { studioId: studio.id });

    const response = await handleBookUpdate(
      jsonRequest(ROUTE_URL, { pdfUrl: "http://internal.example/file.pdf" }, { method: "PATCH" }),
      book.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );

    expect(response.status).toBe(200);
    const [persisted] = await db.select().from(bookTable).where(eq(bookTable.id, book.id));
    expect(persisted?.pdfUrl).toBe("http://internal.example/file.pdf");
  });

  it("clears the pdfUrl when null is sent", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);
    const { book } = await createTestBook(db, {
      studioId: studio.id,
      pdfUrl: "https://example.com/old.pdf",
    });

    const response = await handleBookUpdate(
      jsonRequest(ROUTE_URL, { pdfUrl: null }, { method: "PATCH" }),
      book.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { pdfUrl: string | null } };
    expect(body.data.pdfUrl).toBeNull();

    const [persisted] = await db.select().from(bookTable).where(eq(bookTable.id, book.id));
    expect(persisted?.pdfUrl).toBeNull();
  });

  it("returns 422 when the URL has no http(s) prefix", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);
    const { book } = await createTestBook(db, { studioId: studio.id });

    const response = await handleBookUpdate(
      jsonRequest(ROUTE_URL, { pdfUrl: "example.com/file.pdf" }, { method: "PATCH" }),
      book.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );

    expect(response.status).toBe(422);
    const body = (await response.json()) as {
      error: { code: string; details?: ReadonlyArray<{ field: string; message: string }> };
    };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details?.some((d) => d.field === "pdfUrl")).toBe(true);
  });

  it("returns 422 for ftp:// URL", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);
    const { book } = await createTestBook(db, { studioId: studio.id });

    const response = await handleBookUpdate(
      jsonRequest(ROUTE_URL, { pdfUrl: "ftp://example.com/file.pdf" }, { method: "PATCH" }),
      book.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );

    expect(response.status).toBe(422);
  });

  it("returns 422 for javascript: URL (XSS guard)", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);
    const { book } = await createTestBook(db, { studioId: studio.id });

    const response = await handleBookUpdate(
      jsonRequest(ROUTE_URL, { pdfUrl: "javascript:alert(1)" }, { method: "PATCH" }),
      book.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );

    expect(response.status).toBe(422);
  });

  it("does not change pdfUrl when the field is omitted", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);
    const { book } = await createTestBook(db, {
      studioId: studio.id,
      pdfUrl: "https://example.com/keep.pdf",
    });

    const response = await handleBookUpdate(
      jsonRequest(ROUTE_URL, { title: "Novo título" }, { method: "PATCH" }),
      book.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );

    expect(response.status).toBe(200);
    const [persisted] = await db.select().from(bookTable).where(eq(bookTable.id, book.id));
    expect(persisted?.pdfUrl).toBe("https://example.com/keep.pdf");
    expect(persisted?.title).toBe("Novo título");
  });

  it("trims whitespace from the URL before persisting", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);
    const { book } = await createTestBook(db, { studioId: studio.id });

    const response = await handleBookUpdate(
      jsonRequest(
        ROUTE_URL,
        { pdfUrl: "  https://example.com/trimmed.pdf  " },
        { method: "PATCH" },
      ),
      book.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );

    expect(response.status).toBe(200);
    const [persisted] = await db.select().from(bookTable).where(eq(bookTable.id, book.id));
    expect(persisted?.pdfUrl).toBe("https://example.com/trimmed.pdf");
  });
});
