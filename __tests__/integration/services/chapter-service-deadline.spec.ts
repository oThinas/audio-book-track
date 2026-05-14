import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter } from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";

import { ChapterPaidLockedError } from "@/lib/errors/chapter-errors";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { ChapterService } from "@/lib/services/chapter-service";

function createService() {
  const db = getTestDb();
  return new ChapterService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    narratorRepo: new DrizzleNarratorRepository(db),
    editorRepo: new DrizzleEditorRepository(db),
  });
}

describe("ChapterService — deadline", () => {
  it("updates the deadline of a pending chapter", async () => {
    const service = createService();
    const { chapter } = await createTestChapter(getTestDb(), { deadline: null });

    const result = await service.update(chapter.id, { deadline: "2026-06-15" });
    expect(result.chapter.deadline).toBe("2026-06-15");
  });

  it("clears the deadline (null) of a pending chapter", async () => {
    const service = createService();
    const { chapter } = await createTestChapter(getTestDb(), { deadline: "2026-06-15" });

    const result = await service.update(chapter.id, { deadline: null });
    expect(result.chapter.deadline).toBeNull();
  });

  it("rejects deadline changes on a paid chapter", async () => {
    const service = createService();
    const { book } = await createTestBook(getTestDb(), { status: "paid" });
    const { chapter } = await createTestChapter(getTestDb(), {
      bookId: book.id,
      status: "paid",
      deadline: "2026-06-15",
      editedSeconds: 3600,
    });

    await expect(service.update(chapter.id, { deadline: "2026-07-01" })).rejects.toThrow(
      ChapterPaidLockedError,
    );
  });

  it("allows deadline updates in every status other than paid", async () => {
    const service = createService();
    const statuses = ["pending", "editing", "reviewing", "retake", "completed"] as const;
    for (const status of statuses) {
      const { chapter } = await createTestChapter(getTestDb(), {
        status,
        deadline: null,
        narratorId: null,
        editorId: null,
        editedSeconds: 0,
      });
      const result = await service.update(chapter.id, { deadline: "2026-06-15" });
      expect(result.chapter.deadline).toBe("2026-06-15");
    }
  });
});
