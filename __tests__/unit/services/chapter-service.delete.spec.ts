import { seedInMemoryBook } from "@tests/helpers/seed";
import { NoOpUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { InMemoryBookRepository } from "@tests/repositories/in-memory-book-repository";
import { InMemoryChapterRepository } from "@tests/repositories/in-memory-chapter-repository";
import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { ChapterNotFoundError, ChapterPaidLockedError } from "@/lib/errors/chapter-errors";
import { ChapterService } from "@/lib/services/chapter-service";

describe("ChapterService.delete", () => {
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

  it("deletes a non-paid chapter and recomputes book.status", async () => {
    const { book, chapters } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending", "completed", "completed"],
    });

    const result = await service.delete(chapters[0].id);

    expect(result.bookDeleted).toBe(false);
    expect(await chapterRepo.findById(chapters[0].id)).toBeNull();
    expect(await chapterRepo.countByBookId(book.id)).toBe(2);
    const refreshed = await bookRepo.findById(book.id);
    expect(refreshed?.status).toBe("completed");
  });

  it("throws CHAPTER_PAID_LOCKED when the chapter is paid", async () => {
    const { chapters } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["paid", "pending"],
    });

    await expect(service.delete(chapters[0].id)).rejects.toBeInstanceOf(ChapterPaidLockedError);
  });

  it("throws ChapterNotFoundError when the chapter does not exist", async () => {
    await expect(service.delete(crypto.randomUUID())).rejects.toBeInstanceOf(ChapterNotFoundError);
  });

  it("cascade-deletes the book when removing the last non-paid chapter and no paid chapter remains", async () => {
    const { book, chapters } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending"],
    });

    const result = await service.delete(chapters[0].id);

    expect(result.bookDeleted).toBe(true);
    expect(result.bookId).toBe(book.id);
    expect(await bookRepo.findById(book.id)).toBeNull();
    expect(await chapterRepo.countByBookId(book.id)).toBe(0);
  });

  it("does NOT cascade-delete the book when paid chapters remain even if last non-paid is removed", async () => {
    const { book, chapters } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending", "paid"],
    });

    const result = await service.delete(chapters[0].id);

    expect(result.bookDeleted).toBe(false);
    expect(await bookRepo.findById(book.id)).not.toBeNull();
    expect(await chapterRepo.countByBookId(book.id)).toBe(1);
  });

  it("recomputes book.status after deletion (e.g. removing a pending leaves only completed)", async () => {
    const { book, chapters } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending", "completed"],
    });

    await service.delete(chapters[0].id);

    const refreshed = await bookRepo.findById(book.id);
    expect(refreshed?.status).toBe("completed");
  });
});
