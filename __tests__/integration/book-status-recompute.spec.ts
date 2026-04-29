import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter, createTestNarrator } from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";

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

describe("recomputeBookStatus integration", () => {
  it("dvancing the only non-paid chapter to completed promotes book.status to completed", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter: reviewing } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "reviewing",
    });
    await createTestChapter(db, {
      bookId: book.id,
      number: 2,
      status: "paid",
      editedSeconds: 3600,
    });

    const result = await makeService().update(reviewing.id, { status: "completed" });

    expect(result.bookStatus).toBe("completed");
    const persisted = await new DrizzleBookRepository(db).findById(book.id);
    expect(persisted?.status).toBe("completed");
  });

  it("assigning a narrator to a pending chapter (book has 1 paid) keeps book.status pending", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { narrator } = await createTestNarrator(db);
    const { chapter: pending } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "pending",
    });
    await createTestChapter(db, {
      bookId: book.id,
      number: 2,
      status: "paid",
      editedSeconds: 3600,
    });

    const result = await makeService().update(pending.id, {
      narratorId: narrator.id,
    });

    expect(result.chapter.status).toBe("pending");
    expect(result.bookStatus).toBe("pending");
    const persisted = await new DrizzleBookRepository(db).findById(book.id);
    expect(persisted?.status).toBe("pending");
  });

  it("reverting the last paid chapter back to completed unlocks book.status to completed", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter: paid1 } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });
    await createTestChapter(db, {
      bookId: book.id,
      number: 2,
      status: "completed",
      editedSeconds: 3600,
    });

    const result = await makeService().update(paid1.id, {
      status: "completed",
      confirmReversion: true,
    });

    expect(result.chapter.status).toBe("completed");
    expect(result.bookStatus).toBe("completed");
  });

  // Silence unused import warning for DrizzleEditorRepository (kept for symmetry with factory).
  void DrizzleEditorRepository;
});
