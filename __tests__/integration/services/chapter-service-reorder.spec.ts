import { getTestDb } from "@tests/helpers/db";
import {
  createTestBook,
  createTestChapter,
  createTestEditor,
  createTestNarrator,
} from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";

import { BookChaptersVersionConflictError } from "@/lib/errors/book-errors";
import { ChaptersOrderMismatchError } from "@/lib/errors/chapter-errors";
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

describe("ChapterService.reorder", () => {
  it("aplica nova ordem e bumpa chaptersVersion", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter: c1 } = await createTestChapter(db, {
      bookId: book.id,
      title: "A",
      position: 0,
    });
    const { chapter: c2 } = await createTestChapter(db, {
      bookId: book.id,
      title: "B",
      position: 1,
    });
    const { chapter: c3 } = await createTestChapter(db, {
      bookId: book.id,
      title: "C",
      position: 2,
    });

    const before = await new DrizzleBookRepository(db).findById(book.id);
    const versionBefore = before?.chaptersVersion ?? 0;

    const result = await makeService().reorder(book.id, [c3.id, c1.id, c2.id], versionBefore);
    expect(result.chaptersVersion).toBeGreaterThan(versionBefore);

    const after = await new DrizzleChapterRepository(db).listByBookId(book.id);
    expect(after.map((c) => c.title)).toEqual(["C", "A", "B"]);
  });

  it("rejeita expectedVersion divergente com BookChaptersVersionConflictError", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter: c1 } = await createTestChapter(db, {
      bookId: book.id,
      title: "A",
      position: 0,
    });
    const { chapter: c2 } = await createTestChapter(db, {
      bookId: book.id,
      title: "B",
      position: 1,
    });

    await expect(makeService().reorder(book.id, [c2.id, c1.id], 999)).rejects.toBeInstanceOf(
      BookChaptersVersionConflictError,
    );
  });

  it("rejeita orderedIds faltando capítulos do livro (ChaptersOrderMismatchError)", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter: c1 } = await createTestChapter(db, {
      bookId: book.id,
      title: "A",
      position: 0,
    });
    await createTestChapter(db, { bookId: book.id, title: "B", position: 1 });

    const v = (await new DrizzleBookRepository(db).findById(book.id))?.chaptersVersion ?? 0;

    await expect(makeService().reorder(book.id, [c1.id], v)).rejects.toBeInstanceOf(
      ChaptersOrderMismatchError,
    );
  });

  it("preserva dados financeiros do capítulo paid (apenas position muda)", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { narrator } = await createTestNarrator(db);
    const { editor } = await createTestEditor(db);
    const { chapter: paid } = await createTestChapter(db, {
      bookId: book.id,
      title: "Pago",
      position: 0,
      status: "paid",
      narratorId: narrator.id,
      editorId: editor.id,
      editedSeconds: 3600,
    });
    const { chapter: pending } = await createTestChapter(db, {
      bookId: book.id,
      title: "Pendente",
      position: 1,
      status: "pending",
    });

    const v = (await new DrizzleBookRepository(db).findById(book.id))?.chaptersVersion ?? 0;

    await makeService().reorder(book.id, [pending.id, paid.id], v);

    const chapterRepo = new DrizzleChapterRepository(db);
    const reloadedPaid = await chapterRepo.findById(paid.id);
    expect(reloadedPaid?.status).toBe("paid");
    expect(reloadedPaid?.editedSeconds).toBe(3600);
    expect(reloadedPaid?.narratorId).toBe(narrator.id);
    expect(reloadedPaid?.editorId).toBe(editor.id);
    expect(reloadedPaid?.title).toBe("Pago");
    expect(reloadedPaid?.position).toBe(1);
  });
});
