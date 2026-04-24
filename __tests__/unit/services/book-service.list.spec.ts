import { NoOpUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { InMemoryBookRepository } from "@tests/repositories/in-memory-book-repository";
import { InMemoryChapterRepository } from "@tests/repositories/in-memory-chapter-repository";
import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { BookService } from "@/lib/services/book-service";

describe("BookService.listForUser", () => {
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

  it("returns an empty array when the user has no books", async () => {
    expect(await service.listForUser(crypto.randomUUID())).toEqual([]);
  });

  it("resolves studio, totalChapters, completedChapters and totalEarningsCents for each book", async () => {
    const studio = await studioRepo.create({
      name: "Sonora",
      defaultHourlyRateCents: 7500,
    });
    const book = await bookRepo.insert({
      title: "Dom Casmurro",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await chapterRepo.insertMany([
      { bookId: book.id, number: 1, status: "completed", editedSeconds: 3600 }, // 7500 cents
      { bookId: book.id, number: 2, status: "paid", editedSeconds: 7200 }, // 15000 cents
      { bookId: book.id, number: 3, status: "pending", editedSeconds: 0 }, // 0 cents
    ]);

    const [summary] = await service.listForUser(crypto.randomUUID());

    expect(summary.id).toBe(book.id);
    expect(summary.title).toBe("Dom Casmurro");
    expect(summary.studio).toEqual({ id: studio.id, name: "Sonora" });
    expect(summary.pricePerHourCents).toBe(7500);
    expect(summary.totalChapters).toBe(3);
    expect(summary.completedChapters).toBe(2);
    expect(summary.totalEarningsCents).toBe(22_500);
    expect(summary.status).toBe("pending");
  });

  it("counts completed and paid chapters toward completedChapters", async () => {
    const studio = await studioRepo.create({ name: "S", defaultHourlyRateCents: 7500 });
    const book = await bookRepo.insert({
      title: "B",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await chapterRepo.insertMany([
      { bookId: book.id, number: 1, status: "paid", editedSeconds: 3600 },
      { bookId: book.id, number: 2, status: "paid", editedSeconds: 3600 },
    ]);

    const [summary] = await service.listForUser(crypto.randomUUID());

    expect(summary.completedChapters).toBe(2);
    expect(summary.totalEarningsCents).toBe(15_000);
  });

  it("resolves studio name even when the studio has been soft-deleted (historical books)", async () => {
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

    const [summary] = await service.listForUser(crypto.randomUUID());

    expect(summary.studio).toEqual({ id: studio.id, name: "Legacy" });
  });

  it("returns books ordered by createdAt DESC", async () => {
    const studio = await studioRepo.create({ name: "S", defaultHourlyRateCents: 7500 });
    const older = await bookRepo.insert({
      title: "Older",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await chapterRepo.insertMany([{ bookId: older.id, number: 1, status: "pending" }]);

    await new Promise((r) => setTimeout(r, 5));

    const newer = await bookRepo.insert({
      title: "Newer",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await chapterRepo.insertMany([{ bookId: newer.id, number: 1, status: "pending" }]);

    const result = await service.listForUser(crypto.randomUUID());

    expect(result.map((s) => s.title)).toEqual(["Newer", "Older"]);
  });
});
