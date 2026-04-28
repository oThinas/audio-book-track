import { seedInMemoryBook } from "@tests/helpers/seed";
import { NoOpUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { InMemoryBookRepository } from "@tests/repositories/in-memory-book-repository";
import { InMemoryChapterRepository } from "@tests/repositories/in-memory-chapter-repository";
import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import {
  BookCannotReduceChaptersError,
  BookNotFoundError,
  BookPaidPriceLockedError,
  BookPaidStudioLockedError,
  BookStudioNotFoundError,
  BookTitleAlreadyInUseError,
} from "@/lib/errors/book-errors";
import { BookService } from "@/lib/services/book-service";

describe("BookService.update", () => {
  let bookRepo: InMemoryBookRepository;
  let chapterRepo: InMemoryChapterRepository;
  let studioRepo: InMemoryStudioRepository;
  let narratorRepo: InMemoryNarratorRepository;
  let editorRepo: InMemoryEditorRepository;
  let service: BookService;

  beforeEach(() => {
    chapterRepo = new InMemoryChapterRepository();
    studioRepo = new InMemoryStudioRepository();
    narratorRepo = new InMemoryNarratorRepository();
    editorRepo = new InMemoryEditorRepository();
    bookRepo = new InMemoryBookRepository({ chapterRepo, studioRepo });
    service = new BookService({
      bookRepo,
      chapterRepo,
      studioRepo,
      narratorRepo,
      editorRepo,
      uow: new NoOpUnitOfWork(),
    });
  });

  it("updates the title of a book", async () => {
    const { book } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending"],
      bookTitle: "Antigo",
    });

    const result = await service.update(book.id, { title: "Novo título" });

    expect(result.book.title).toBe("Novo título");
    const refreshed = await bookRepo.findById(book.id);
    expect(refreshed?.title).toBe("Novo título");
  });

  it("appends new chapters with sequential numbers when numChapters increases", async () => {
    const { book } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending", "pending"],
    });

    const result = await service.update(book.id, { numChapters: 5 });

    expect(result.chaptersAdded).toBe(3);
    const chapters = await chapterRepo.listByBookId(book.id);
    expect(chapters).toHaveLength(5);
    expect(chapters.map((c) => c.number)).toEqual([1, 2, 3, 4, 5]);
    expect(chapters.slice(2).every((c) => c.status === "pending")).toBe(true);
  });

  it("numbers new chapters after MAX(number)+1 even if existing chapters are not contiguous", async () => {
    const { book } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending", "pending", "pending"],
    });
    // Simulate a gap: delete chapter #2 so MAX(number) = 3 but count = 2.
    const all = await chapterRepo.listByBookId(book.id);
    await chapterRepo.delete(all[1].id);
    expect(await chapterRepo.countByBookId(book.id)).toBe(2);

    const result = await service.update(book.id, { numChapters: 4 });

    expect(result.chaptersAdded).toBe(2);
    const chapters = await chapterRepo.listByBookId(book.id);
    expect(chapters.map((c) => c.number).sort((a, b) => a - b)).toEqual([1, 3, 4, 5]);
  });

  it("throws BookCannotReduceChaptersError when numChapters < current total", async () => {
    const { book } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending", "pending", "pending"],
    });

    await expect(service.update(book.id, { numChapters: 2 })).rejects.toBeInstanceOf(
      BookCannotReduceChaptersError,
    );
  });

  it("is idempotent when numChapters equals current total", async () => {
    const { book } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending", "pending"],
    });

    const result = await service.update(book.id, { numChapters: 2 });

    expect(result.chaptersAdded).toBe(0);
    expect(await chapterRepo.countByBookId(book.id)).toBe(2);
  });

  it("throws BookPaidPriceLockedError when changing pricePerHourCents with a paid chapter", async () => {
    const { book } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["paid", "pending"],
    });

    await expect(service.update(book.id, { pricePerHourCents: 9000 })).rejects.toBeInstanceOf(
      BookPaidPriceLockedError,
    );
  });

  it("allows pricePerHourCents change when no chapter is paid", async () => {
    const { book } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending", "completed"],
    });

    const result = await service.update(book.id, { pricePerHourCents: 9000 });

    expect(result.book.pricePerHourCents).toBe(9000);
  });

  it("throws BookPaidStudioLockedError when changing studioId with a paid chapter", async () => {
    const { book } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["paid"],
    });
    const newStudio = await studioRepo.create({ name: "Outro", defaultHourlyRateCents: 5000 });

    await expect(service.update(book.id, { studioId: newStudio.id })).rejects.toBeInstanceOf(
      BookPaidStudioLockedError,
    );
  });

  it("throws BookStudioNotFoundError when target studioId does not exist", async () => {
    const { book } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending"],
    });

    await expect(service.update(book.id, { studioId: crypto.randomUUID() })).rejects.toBeInstanceOf(
      BookStudioNotFoundError,
    );
  });

  it("throws BookTitleAlreadyInUseError when the new title collides in the same studio", async () => {
    const { book: existing } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending"],
      studioName: "Sonora",
      bookTitle: "Dom Casmurro",
    });
    const second = await bookRepo.insert({
      title: "Outro Livro",
      studioId: existing.studioId,
      pricePerHourCents: 7500,
    });

    await expect(service.update(second.id, { title: "dom casmurro" })).rejects.toBeInstanceOf(
      BookTitleAlreadyInUseError,
    );
  });

  it("throws BookNotFoundError when the book does not exist", async () => {
    await expect(
      service.update(crypto.randomUUID(), { title: "irrelevante" }),
    ).rejects.toBeInstanceOf(BookNotFoundError);
  });

  it("recomputes book.status after appending new pending chapters to a completed book", async () => {
    const { book } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["completed", "completed"],
    });
    expect((await bookRepo.findById(book.id))?.status).toBe("completed");

    await service.update(book.id, { numChapters: 4 });

    const refreshed = await bookRepo.findById(book.id);
    expect(refreshed?.status).toBe("pending");
  });
});
