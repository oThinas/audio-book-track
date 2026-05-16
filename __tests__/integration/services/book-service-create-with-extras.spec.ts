import { getTestDb } from "@tests/helpers/db";
import { createTestStudio } from "@tests/helpers/factories";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { describe, expect, it } from "vitest";

import { ChapterTitleAlreadyInUseError } from "@/lib/errors/chapter-errors";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { BookService } from "@/lib/services/book-service";

function makeService() {
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

describe("BookService.create — chapters input (numbered + extras)", () => {
  it("cria 3 numerados + Prólogo (start) + Epílogo (end) na ordem correta", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);

    const result = await makeService().create({
      title: "Livro 1",
      studioId: studio.id,
      pricePerHourCents: 7500,
      chapters: {
        numbered: 3,
        extras: [
          { kind: "template", template: "prologue", position: "start" },
          { kind: "template", template: "epilogue", position: "end" },
        ],
      },
    });

    const chapters = await new DrizzleChapterRepository(db).listByBookId(result.book.id);
    expect(chapters.map((c) => c.title)).toEqual([
      "Prólogo",
      "Capítulo 1",
      "Capítulo 2",
      "Capítulo 3",
      "Epílogo",
    ]);
    expect(chapters.map((c) => c.position)).toEqual([0, 1, 2, 3, 4]);
  });

  it("cria livro com numbered=0 e apenas extras (Prólogo + Epílogo)", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);

    const result = await makeService().create({
      title: "Livro 2",
      studioId: studio.id,
      pricePerHourCents: 7500,
      chapters: {
        numbered: 0,
        extras: [
          { kind: "template", template: "prologue", position: "start" },
          { kind: "template", template: "epilogue", position: "end" },
        ],
      },
    });

    const chapters = await new DrizzleChapterRepository(db).listByBookId(result.book.id);
    expect(chapters.map((c) => c.title)).toEqual(["Prólogo", "Epílogo"]);
  });

  it("posiciona extras start em ordem reversa de declaração (último start vira position 0)", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);

    const result = await makeService().create({
      title: "Livro 3",
      studioId: studio.id,
      pricePerHourCents: 7500,
      chapters: {
        numbered: 2,
        extras: [
          { kind: "template", template: "prologue", position: "start" },
          { kind: "template", template: "presentation", position: "start" },
        ],
      },
    });

    const chapters = await new DrizzleChapterRepository(db).listByBookId(result.book.id);
    // Apresentação foi declarada depois de Prólogo, então Apresentação fica antes (position 0).
    expect(chapters.map((c) => c.title)).toEqual([
      "Apresentação",
      "Prólogo",
      "Capítulo 1",
      "Capítulo 2",
    ]);
  });

  it("aceita extras custom com title livre", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);

    const result = await makeService().create({
      title: "Livro 4",
      studioId: studio.id,
      pricePerHourCents: 7500,
      chapters: {
        numbered: 1,
        extras: [{ kind: "custom", title: "Nota do tradutor", position: "end" }],
      },
    });

    const chapters = await new DrizzleChapterRepository(db).listByBookId(result.book.id);
    expect(chapters.map((c) => c.title)).toEqual(["Capítulo 1", "Nota do tradutor"]);
  });

  it("rejeita dois extras com o mesmo título (ChapterTitleAlreadyInUseError)", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);

    await expect(
      makeService().create({
        title: "Livro com duplicata",
        studioId: studio.id,
        pricePerHourCents: 7500,
        chapters: {
          numbered: 0,
          extras: [
            { kind: "template", template: "prologue", position: "start" },
            { kind: "template", template: "prologue", position: "end" },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(ChapterTitleAlreadyInUseError);
  });

  it("rejeita extra custom colidindo com um capítulo numerado", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db);

    await expect(
      makeService().create({
        title: "Livro com colisão custom × numerado",
        studioId: studio.id,
        pricePerHourCents: 7500,
        chapters: {
          numbered: 2,
          extras: [{ kind: "custom", title: "Capítulo 2", position: "end" }],
        },
      }),
    ).rejects.toBeInstanceOf(ChapterTitleAlreadyInUseError);
  });
});
