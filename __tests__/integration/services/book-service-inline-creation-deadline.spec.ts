import { getTestDb } from "@tests/helpers/db";
import { createTestStudio } from "@tests/helpers/factories";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { describe, expect, it } from "vitest";

import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { BookService } from "@/lib/services/book-service";

function createService() {
  const db = getTestDb();
  return new BookService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    studioRepo: new DrizzleStudioRepository(db),
    narratorRepo: new DrizzleNarratorRepository(db),
    editorRepo: new DrizzleEditorRepository(db),
    uow: new SavepointUnitOfWork(db),
  });
}

describe("BookService.create — regressão FR-032 (criação inline não coleta deadline)", () => {
  it("todos os capítulos criados via fluxo inline nascem com deadline = null", async () => {
    const { studio } = await createTestStudio(getTestDb());
    const service = createService();

    const { chapters } = await service.create({
      title: "Livro Inline",
      studioId: studio.id,
      pricePerHourCents: 8500,
      numChapters: 7,
    });

    expect(chapters).toHaveLength(7);
    for (const c of chapters) {
      expect(c.deadline).toBeNull();
    }
  });
});
