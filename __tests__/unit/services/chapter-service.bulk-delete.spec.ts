import { seedInMemoryBook } from "@tests/helpers/seed";
import { NoOpUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { InMemoryBookRepository } from "@tests/repositories/in-memory-book-repository";
import { InMemoryChapterRepository } from "@tests/repositories/in-memory-chapter-repository";
import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { BookNotFoundError } from "@/lib/errors/book-errors";
import { ChapterPaidLockedError, ChaptersNotInBookError } from "@/lib/errors/chapter-errors";
import { ChapterService } from "@/lib/services/chapter-service";

describe("ChapterService.bulkDelete", () => {
  let bookRepo: InMemoryBookRepository;
  let chapterRepo: InMemoryChapterRepository;
  let studioRepo: InMemoryStudioRepository;
  let narratorRepo: InMemoryNarratorRepository;
  let editorRepo: InMemoryEditorRepository;
  let service: ChapterService;

  beforeEach(() => {
    chapterRepo = new InMemoryChapterRepository();
    studioRepo = new InMemoryStudioRepository();
    narratorRepo = new InMemoryNarratorRepository();
    editorRepo = new InMemoryEditorRepository();
    bookRepo = new InMemoryBookRepository({ chapterRepo, studioRepo });
    service = new ChapterService({
      bookRepo,
      chapterRepo,
      narratorRepo,
      editorRepo,
      uow: new NoOpUnitOfWork(),
    });
  });

  it("deletes multiple non-paid chapters and recomputes book.status", async () => {
    const { book, chapters } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending", "editing", "completed", "completed"],
    });

    const result = await service.bulkDelete(book.id, [chapters[0].id, chapters[1].id]);

    expect(result.bookDeleted).toBe(false);
    expect(result.deletedCount).toBe(2);
    expect(await chapterRepo.countByBookId(book.id)).toBe(2);
    const refreshed = await bookRepo.findById(book.id);
    expect(refreshed?.status).toBe("completed");
  });

  it("throws CHAPTER_PAID_LOCKED atomically when any id is paid (nothing deleted)", async () => {
    const { book, chapters } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending", "paid", "completed"],
    });

    await expect(
      service.bulkDelete(book.id, [chapters[0].id, chapters[1].id]),
    ).rejects.toBeInstanceOf(ChapterPaidLockedError);

    expect(await chapterRepo.countByBookId(book.id)).toBe(3);
  });

  it("throws CHAPTERS_NOT_IN_BOOK when any chapter does not belong to the book", async () => {
    const a = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending"],
    });
    const b = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending"],
    });

    await expect(
      service.bulkDelete(a.book.id, [a.chapters[0].id, b.chapters[0].id]),
    ).rejects.toBeInstanceOf(ChaptersNotInBookError);

    expect(await chapterRepo.countByBookId(a.book.id)).toBe(1);
    expect(await chapterRepo.countByBookId(b.book.id)).toBe(1);
  });

  it("throws BookNotFoundError when the book does not exist", async () => {
    await expect(
      service.bulkDelete(crypto.randomUUID(), [crypto.randomUUID()]),
    ).rejects.toBeInstanceOf(BookNotFoundError);
  });

  it("cascade-deletes the book when all non-paid chapters are removed and no paid remain", async () => {
    const { book, chapters } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending", "completed"],
    });

    const result = await service.bulkDelete(book.id, [chapters[0].id, chapters[1].id]);

    expect(result.bookDeleted).toBe(true);
    expect(result.deletedCount).toBe(2);
    expect(await bookRepo.findById(book.id)).toBeNull();
  });

  it("preserves the book when paid chapters remain even after deleting all non-paid", async () => {
    const { book, chapters } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending", "completed", "paid"],
    });

    const result = await service.bulkDelete(book.id, [chapters[0].id, chapters[1].id]);

    expect(result.bookDeleted).toBe(false);
    expect(await bookRepo.findById(book.id)).not.toBeNull();
    expect(await chapterRepo.countByBookId(book.id)).toBe(1);
  });

  it("dedupes duplicated ids in the input", async () => {
    const { book, chapters } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending", "completed"],
    });

    const result = await service.bulkDelete(book.id, [chapters[0].id, chapters[0].id]);

    expect(result.deletedCount).toBe(1);
    expect(await chapterRepo.countByBookId(book.id)).toBe(1);
  });
});
