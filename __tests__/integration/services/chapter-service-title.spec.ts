import { getTestDb } from "@tests/helpers/db";
import {
  createTestBook,
  createTestChapter,
  createTestEditor,
  createTestNarrator,
} from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";

import { ChapterPaidLockedError } from "@/lib/errors/chapter-errors";
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

describe("ChapterService.update — title (feature 026)", () => {
  it("atualiza title de capítulo não-pago e bumpa chaptersVersion", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      title: "Capítulo 1",
      position: 0,
      status: "pending",
    });

    const before = await new DrizzleBookRepository(db).findById(book.id);
    const versionBefore = before?.chaptersVersion ?? 0;

    const result = await makeService().update(chapter.id, { title: "Abertura" });

    expect(result.chapter.title).toBe("Abertura");
    const after = await new DrizzleBookRepository(db).findById(book.id);
    expect(after?.chaptersVersion).toBe(versionBefore + 1);
  });

  it("rejeita alteração de title em capítulo paid (ChapterPaidLockedError)", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { narrator } = await createTestNarrator(db);
    const { editor } = await createTestEditor(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      title: "Capítulo 1",
      position: 0,
      status: "paid",
      narratorId: narrator.id,
      editorId: editor.id,
      editedSeconds: 3600,
    });

    await expect(makeService().update(chapter.id, { title: "Outro" })).rejects.toBeInstanceOf(
      ChapterPaidLockedError,
    );
  });

  it("permite outras edições em capítulo pending sem mexer em title", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { narrator } = await createTestNarrator(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      title: "Capítulo 1",
      position: 0,
      status: "pending",
    });

    const result = await makeService().update(chapter.id, { narratorId: narrator.id });
    expect(result.chapter.title).toBe("Capítulo 1");
    expect(result.chapter.narratorId).toBe(narrator.id);
  });
});
