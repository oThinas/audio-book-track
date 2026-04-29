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

// Respostas de erro nunca podem vazar stack traces, mensagens de SQL
// ou strings que apontem para o filesystem. Estes padrões cobrem os
// vazamentos mais comuns vistos no Node/PostgreSQL.
const LEAK_PATTERNS = [/Error:/, /\bat \//, /^\s+at /m, /sql:/i, /postgres:\/\//i] as const;

function assertNoLeak(body: string): void {
  for (const pattern of LEAK_PATTERNS) {
    expect(body, `Resposta de erro vazou padrão ${pattern}`).not.toMatch(pattern);
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
  it("422 (validation) — corpo não contém stack traces ou SQL", async () => {
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
    // Sanity: o envelope correto é VALIDATION_ERROR.
    expect(body).toContain("VALIDATION_ERROR");
  });

  it("409 (conflict de domínio) — corpo não contém stack traces ou SQL", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);
    // Tentar renomear um livro para o título de outro dispara
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

  it("500-equivalente (erro não mapeado) — handler rethrows sem produzir corpo vazante", async () => {
    // Quando service.update lança um erro que NÃO é mapeado pelos catches do
    // handler, a única ação correta é rethrow — Next.js converte em 500
    // genérico. Aqui validamos que o handler nunca constrói um Response
    // contendo a mensagem original (que poderia conter SQL/stack).
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
    // Se chegamos aqui, o handler rethrow corretamente — nenhum corpo de
    // resposta foi construído com a mensagem do erro.
  });
});
