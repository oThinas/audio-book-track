import { InMemoryBookRepository } from "@tests/repositories/in-memory-book-repository";
import { InMemoryChapterRepository } from "@tests/repositories/in-memory-chapter-repository";
import { beforeEach, describe, expect, it } from "vitest";

import type { Book } from "@/lib/domain/book";
import { recomputeBookStatus } from "@/lib/services/book-status-recompute";

describe("recomputeBookStatus", () => {
  let bookRepo: InMemoryBookRepository;
  let chapterRepo: InMemoryChapterRepository;
  let book: Book;

  beforeEach(async () => {
    bookRepo = new InMemoryBookRepository();
    chapterRepo = new InMemoryChapterRepository();
    book = await bookRepo.insert({
      title: "Dom Casmurro",
      studioId: crypto.randomUUID(),
      pricePerHourCents: 7500,
    });
  });

  it("throws when the book has no chapters", async () => {
    await expect(recomputeBookStatus(book.id, { bookRepo, chapterRepo })).rejects.toThrow(
      /sem capítulos/,
    );
  });

  it("sets status to paid when every chapter is paid", async () => {
    await chapterRepo.insertMany([
      { bookId: book.id, number: 1, status: "paid" },
      { bookId: book.id, number: 2, status: "paid" },
    ]);

    const updated = await recomputeBookStatus(book.id, { bookRepo, chapterRepo });

    expect(updated.status).toBe("paid");
    const reloaded = await bookRepo.findById(book.id);
    expect(reloaded?.status).toBe("paid");
  });

  it("sets status to completed when every chapter is completed or paid with at least one completed", async () => {
    await chapterRepo.insertMany([
      { bookId: book.id, number: 1, status: "completed" },
      { bookId: book.id, number: 2, status: "paid" },
    ]);

    const updated = await recomputeBookStatus(book.id, { bookRepo, chapterRepo });

    expect(updated.status).toBe("completed");
  });

  it("sets status to reviewing when any chapter is reviewing", async () => {
    await chapterRepo.insertMany([
      { bookId: book.id, number: 1, status: "pending" },
      { bookId: book.id, number: 2, status: "reviewing" },
    ]);

    const updated = await recomputeBookStatus(book.id, { bookRepo, chapterRepo });

    expect(updated.status).toBe("reviewing");
  });

  it("sets status to editing when there is editing but no reviewing/retake", async () => {
    await chapterRepo.insertMany([
      { bookId: book.id, number: 1, status: "pending" },
      { bookId: book.id, number: 2, status: "editing" },
    ]);

    const updated = await recomputeBookStatus(book.id, { bookRepo, chapterRepo });

    expect(updated.status).toBe("editing");
  });

  it("defaults to pending when only pending chapters exist", async () => {
    await chapterRepo.insertMany([
      { bookId: book.id, number: 1, status: "pending" },
      { bookId: book.id, number: 2, status: "pending" },
    ]);

    const updated = await recomputeBookStatus(book.id, { bookRepo, chapterRepo });

    expect(updated.status).toBe("pending");
  });

  it("US5.13 — after deleting a pending chapter, only paid remains → paid", async () => {
    // Before: [pending, paid] → pending
    const chapters = await chapterRepo.insertMany([
      { bookId: book.id, number: 1, status: "pending" },
      { bookId: book.id, number: 2, status: "paid" },
    ]);
    await recomputeBookStatus(book.id, { bookRepo, chapterRepo });
    const beforeDelete = await bookRepo.findById(book.id);
    expect(beforeDelete?.status).toBe("pending");

    // User deletes the pending chapter
    await chapterRepo.delete(chapters[0].id);

    // After: [paid] → paid
    const updated = await recomputeBookStatus(book.id, { bookRepo, chapterRepo });
    expect(updated.status).toBe("paid");
  });

  it("US5.14 — after adding a pending chapter to a book with one paid, result is pending", async () => {
    // Before: [paid] → paid
    await chapterRepo.insertMany([{ bookId: book.id, number: 1, status: "paid" }]);
    await recomputeBookStatus(book.id, { bookRepo, chapterRepo });
    const beforeAdd = await bookRepo.findById(book.id);
    expect(beforeAdd?.status).toBe("paid");

    // User increases numChapters by 1 (new pending chapter)
    await chapterRepo.insertMany([{ bookId: book.id, number: 2, status: "pending" }]);

    // After: [paid, pending] → pending
    const updated = await recomputeBookStatus(book.id, { bookRepo, chapterRepo });
    expect(updated.status).toBe("pending");
  });
});
