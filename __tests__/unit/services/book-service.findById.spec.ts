import { NoOpUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { InMemoryBookRepository } from "@tests/repositories/in-memory-book-repository";
import { InMemoryChapterRepository } from "@tests/repositories/in-memory-chapter-repository";
import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { BookService } from "@/lib/services/book-service";

describe("BookService.findByIdForUser", () => {
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

  it("returns null when the book does not exist", async () => {
    expect(await service.findByIdForUser(crypto.randomUUID(), crypto.randomUUID())).toBeNull();
  });

  it("returns the book with studio, aggregates and chapters with embedded narrator/editor", async () => {
    const studio = await studioRepo.create({ name: "Sonora", defaultHourlyRateCents: 7500 });
    const narrator = await narratorRepo.create({ name: "Ana Silva" });
    const editor = await editorRepo.create({ name: "Bruno Gomes", email: "bruno@example.com" });
    const book = await bookRepo.insert({
      title: "Dom Casmurro",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await chapterRepo.insertMany([
      {
        bookId: book.id,
        number: 1,
        status: "completed",
        editedSeconds: 3600,
        narratorId: narrator.id,
        editorId: editor.id,
      },
      {
        bookId: book.id,
        number: 2,
        status: "paid",
        editedSeconds: 7200,
        narratorId: narrator.id,
      },
      { bookId: book.id, number: 3, status: "pending" },
    ]);

    const detail = await service.findByIdForUser(book.id, crypto.randomUUID());

    expect(detail).not.toBeNull();
    if (!detail) return;

    expect(detail.id).toBe(book.id);
    expect(detail.title).toBe("Dom Casmurro");
    expect(detail.studio).toEqual({ id: studio.id, name: "Sonora" });
    expect(detail.pricePerHourCents).toBe(7500);
    expect(detail.totalChapters).toBe(3);
    expect(detail.completedChapters).toBe(2);
    expect(detail.totalEarningsCents).toBe(22_500);
    expect(detail.chapters).toHaveLength(3);

    const [chapter1, chapter2, chapter3] = detail.chapters;
    expect(chapter1.number).toBe(1);
    expect(chapter1.narrator).toEqual({ id: narrator.id, name: "Ana Silva" });
    expect(chapter1.editor).toEqual({ id: editor.id, name: "Bruno Gomes" });
    expect(chapter1.editedSeconds).toBe(3600);

    expect(chapter2.narrator).toEqual({ id: narrator.id, name: "Ana Silva" });
    expect(chapter2.editor).toBeNull();

    expect(chapter3.narrator).toBeNull();
    expect(chapter3.editor).toBeNull();
  });

  it("orders chapters by number ASC", async () => {
    const studio = await studioRepo.create({ name: "S", defaultHourlyRateCents: 7500 });
    const book = await bookRepo.insert({
      title: "B",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await chapterRepo.insertMany([
      { bookId: book.id, number: 3, status: "pending" },
      { bookId: book.id, number: 1, status: "pending" },
      { bookId: book.id, number: 2, status: "pending" },
    ]);

    const detail = await service.findByIdForUser(book.id, crypto.randomUUID());

    expect(detail?.chapters.map((c) => c.number)).toEqual([1, 2, 3]);
  });

  it("returns totals = 0 and empty chapters when the book has no chapters", async () => {
    const studio = await studioRepo.create({ name: "S", defaultHourlyRateCents: 7500 });
    const book = await bookRepo.insert({
      title: "Empty",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });

    const detail = await service.findByIdForUser(book.id, crypto.randomUUID());

    expect(detail).not.toBeNull();
    if (!detail) return;
    expect(detail.totalChapters).toBe(0);
    expect(detail.completedChapters).toBe(0);
    expect(detail.totalEarningsCents).toBe(0);
    expect(detail.chapters).toEqual([]);
  });

  it("resolves studio name even when the studio is soft-deleted (historical books)", async () => {
    const studio = await studioRepo.create({ name: "Legacy", defaultHourlyRateCents: 7500 });
    const book = await bookRepo.insert({
      title: "Historical",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await chapterRepo.insertMany([
      { bookId: book.id, number: 1, status: "paid", editedSeconds: 3600 },
    ]);
    await studioRepo.softDelete(studio.id);

    const detail = await service.findByIdForUser(book.id, crypto.randomUUID());

    expect(detail?.studio).toEqual({ id: studio.id, name: "Legacy" });
  });
});
