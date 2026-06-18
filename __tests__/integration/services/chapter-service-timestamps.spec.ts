import { getTestDb } from "@tests/helpers/db";
import {
  createTestBook,
  createTestChapter,
  createTestEditor,
  createTestNarrator,
} from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";

import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { ChapterService } from "@/lib/services/chapter-service";

async function createReviewingChapter() {
  const db = getTestDb();
  const { book } = await createTestBook(db);
  const { narrator } = await createTestNarrator(db);
  const { editor } = await createTestEditor(db);
  const { chapter } = await createTestChapter(db, {
    bookId: book.id,
    status: "reviewing",
    narratorId: narrator.id,
    editorId: editor.id,
    editedSeconds: 1800,
  });
  return chapter;
}

function createService() {
  const db = getTestDb();
  return new ChapterService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    narratorRepo: new DrizzleNarratorRepository(db),
    editorRepo: new DrizzleEditorRepository(db),
  });
}

describe("ChapterService — completed_at / paid_at timestamps", () => {
  it("sets completed_at when transitioning reviewing → completed", async () => {
    const service = createService();
    const chapter = await createReviewingChapter();
    expect(chapter.completedAt).toBeNull();

    const result = await service.update(chapter.id, { status: "completed" });
    expect(result.chapter.completedAt).toBeInstanceOf(Date);
    expect(result.chapter.paidAt).toBeNull();
  });

  it("sets paid_at when transitioning completed → paid (and keeps completed_at)", async () => {
    const service = createService();
    const chapter = await createReviewingChapter();
    const completed = await service.update(chapter.id, { status: "completed" });

    const paid = await service.update(chapter.id, { status: "paid" });
    expect(paid.chapter.paidAt).toBeInstanceOf(Date);
    expect(paid.chapter.completedAt?.getTime()).toBe(completed.chapter.completedAt?.getTime());
  });

  it("keeps completed_at when reverting completed → reviewing (audit trail)", async () => {
    const service = createService();
    const chapter = await createReviewingChapter();
    const completed = await service.update(chapter.id, { status: "completed" });

    const reverted = await service.update(chapter.id, {
      status: "reviewing",
      confirmReversion: true,
    });
    expect(reverted.chapter.completedAt?.getTime()).toBe(completed.chapter.completedAt?.getTime());
  });

  it("does not overwrite completed_at on re-transition reviewing → completed", async () => {
    const service = createService();
    const chapter = await createReviewingChapter();
    const first = await service.update(chapter.id, { status: "completed" });
    await service.update(chapter.id, { status: "reviewing", confirmReversion: true });

    const second = await service.update(chapter.id, { status: "completed" });
    expect(second.chapter.completedAt?.getTime()).toBe(first.chapter.completedAt?.getTime());
  });
});
