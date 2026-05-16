import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter } from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";

import { BookChaptersVersionConflictError } from "@/lib/errors/book-errors";
import {
  ChapterPositionTargetInvalidError,
  ChapterTitleAlreadyInUseError,
} from "@/lib/errors/chapter-errors";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { ChapterService } from "@/lib/services/chapter-service";

function makeService() {
  const db = getTestDb();
  return new ChapterService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    narratorRepo: new DrizzleNarratorRepository(db),
    editorRepo: new DrizzleEditorRepository(db),
  });
}

describe("ChapterService.create", () => {
  it("insere com position='end' em max+1 e bumpa chaptersVersion", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    await createTestChapter(db, { bookId: book.id, title: "Capítulo 1", position: 0 });
    await createTestChapter(db, { bookId: book.id, title: "Capítulo 2", position: 1 });

    const v = (await new DrizzleBookRepository(db).findById(book.id))?.chaptersVersion ?? 0;
    const result = await makeService().create(book.id, {
      title: "Epílogo",
      position: "end",
      expectedVersion: v,
    });

    expect(result.chapter.position).toBe(2);
    expect(result.chapter.title).toBe("Epílogo");
    expect(result.chaptersVersion).toBeGreaterThan(v);
  });

  it("insere com position='start' em 0 e empurra demais em +1", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    await createTestChapter(db, { bookId: book.id, title: "Capítulo 1", position: 0 });
    await createTestChapter(db, { bookId: book.id, title: "Capítulo 2", position: 1 });

    const v = (await new DrizzleBookRepository(db).findById(book.id))?.chaptersVersion ?? 0;
    await makeService().create(book.id, {
      title: "Prólogo",
      position: "start",
      expectedVersion: v,
    });

    const after = await new DrizzleChapterRepository(db).listByBookId(book.id);
    expect(after.map((c) => c.title)).toEqual(["Prólogo", "Capítulo 1", "Capítulo 2"]);
    expect(after.map((c) => c.position)).toEqual([0, 1, 2]);
  });

  it("insere com position={after: id} logo após o alvo", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter: c1 } = await createTestChapter(db, {
      bookId: book.id,
      title: "Capítulo 1",
      position: 0,
    });
    await createTestChapter(db, { bookId: book.id, title: "Capítulo 2", position: 1 });

    const v = (await new DrizzleBookRepository(db).findById(book.id))?.chaptersVersion ?? 0;
    await makeService().create(book.id, {
      title: "Apresentação",
      position: { after: c1.id },
      expectedVersion: v,
    });

    const after = await new DrizzleChapterRepository(db).listByBookId(book.id);
    expect(after.map((c) => c.title)).toEqual(["Capítulo 1", "Apresentação", "Capítulo 2"]);
  });

  it("rejeita position={after} com id inexistente (ChapterPositionTargetInvalidError)", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    await createTestChapter(db, { bookId: book.id, title: "Capítulo 1", position: 0 });
    const v = (await new DrizzleBookRepository(db).findById(book.id))?.chaptersVersion ?? 0;

    await expect(
      makeService().create(book.id, {
        title: "x",
        position: { after: "00000000-0000-4000-8000-000000000099" },
        expectedVersion: v,
      }),
    ).rejects.toBeInstanceOf(ChapterPositionTargetInvalidError);
  });

  it("rejeita expectedVersion desatualizada (BookChaptersVersionConflictError)", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    await createTestChapter(db, { bookId: book.id, title: "Capítulo 1", position: 0 });

    await expect(
      makeService().create(book.id, {
        title: "Novo",
        position: "end",
        expectedVersion: 999,
      }),
    ).rejects.toBeInstanceOf(BookChaptersVersionConflictError);
  });

  it("rejeita título idêntico a um capítulo existente (ChapterTitleAlreadyInUseError)", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    await createTestChapter(db, { bookId: book.id, title: "Prólogo", position: 0 });

    const v = (await new DrizzleBookRepository(db).findById(book.id))?.chaptersVersion ?? 0;
    await expect(
      makeService().create(book.id, {
        title: "Prólogo",
        position: "end",
        expectedVersion: v,
      }),
    ).rejects.toBeInstanceOf(ChapterTitleAlreadyInUseError);
  });

  it("rejeita título case-insensitive (PRÓLOGO ↔ prólogo)", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    await createTestChapter(db, { bookId: book.id, title: "Prólogo", position: 0 });

    const v = (await new DrizzleBookRepository(db).findById(book.id))?.chaptersVersion ?? 0;
    await expect(
      makeService().create(book.id, {
        title: "  prólogo  ",
        position: "end",
        expectedVersion: v,
      }),
    ).rejects.toBeInstanceOf(ChapterTitleAlreadyInUseError);
  });
});
