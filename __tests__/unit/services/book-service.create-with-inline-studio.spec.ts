import { NoOpUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { InMemoryBookRepository } from "@tests/repositories/in-memory-book-repository";
import { InMemoryChapterRepository } from "@tests/repositories/in-memory-chapter-repository";
import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { BookInlineStudioInvalidError } from "@/lib/errors/book-errors";
import { BookService } from "@/lib/services/book-service";

describe("BookService.create with inlineStudioId", () => {
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

  it("propagates pricePerHourCents to the inline studio's defaultHourlyRateCents on success", async () => {
    const inlineStudio = await studioRepo.create({
      name: "Estúdio Inline",
      defaultHourlyRateCents: 1,
    });

    const { book } = await service.create({
      title: "Dom Casmurro",
      studioId: inlineStudio.id,
      pricePerHourCents: 7500,
      numChapters: 2,
      inlineStudioId: inlineStudio.id,
    });

    expect(book.studioId).toBe(inlineStudio.id);
    expect(book.pricePerHourCents).toBe(7500);

    const refreshed = await studioRepo.findById(inlineStudio.id);
    expect(refreshed?.defaultHourlyRateCents).toBe(7500);
  });

  it("rejects with INLINE_STUDIO_INVALID when inlineStudioId does not match studioId", async () => {
    const inlineStudio = await studioRepo.create({
      name: "Inline",
      defaultHourlyRateCents: 1,
    });
    const otherStudio = await studioRepo.create({
      name: "Outro",
      defaultHourlyRateCents: 5000,
    });

    await expect(
      service.create({
        title: "Conflito",
        studioId: otherStudio.id,
        pricePerHourCents: 7500,
        numChapters: 1,
        inlineStudioId: inlineStudio.id,
      }),
    ).rejects.toBeInstanceOf(BookInlineStudioInvalidError);
  });

  it("rejects with INLINE_STUDIO_INVALID when the inline studio's defaultHourlyRateCents is not the placeholder (1)", async () => {
    const studio = await studioRepo.create({
      name: "Já Customizado",
      defaultHourlyRateCents: 5000,
    });

    await expect(
      service.create({
        title: "Anti-abuso",
        studioId: studio.id,
        pricePerHourCents: 7500,
        numChapters: 1,
        inlineStudioId: studio.id,
      }),
    ).rejects.toBeInstanceOf(BookInlineStudioInvalidError);
  });

  it("rejects with INLINE_STUDIO_INVALID when inlineStudioId references a non-existent studio", async () => {
    const studio = await studioRepo.create({
      name: "Atual",
      defaultHourlyRateCents: 1,
    });
    // Soft-delete to simulate "not found / archived" path.
    await studioRepo.softDelete(studio.id);

    await expect(
      service.create({
        title: "Estúdio sumido",
        studioId: studio.id,
        pricePerHourCents: 7500,
        numChapters: 1,
        inlineStudioId: studio.id,
      }),
    ).rejects.toBeInstanceOf(BookInlineStudioInvalidError);
  });

  it("creates the book without propagation when inlineStudioId is omitted", async () => {
    const studio = await studioRepo.create({
      name: "Normal",
      defaultHourlyRateCents: 5000,
    });

    const { book } = await service.create({
      title: "Sem propagação",
      studioId: studio.id,
      pricePerHourCents: 9000,
      numChapters: 1,
    });

    expect(book.pricePerHourCents).toBe(9000);
    const refreshed = await studioRepo.findById(studio.id);
    expect(refreshed?.defaultHourlyRateCents).toBe(5000);
  });
});
