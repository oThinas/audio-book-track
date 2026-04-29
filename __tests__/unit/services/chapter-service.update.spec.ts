import { InMemoryBookRepository } from "@tests/repositories/in-memory-book-repository";
import { InMemoryChapterRepository } from "@tests/repositories/in-memory-chapter-repository";
import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import type { Book } from "@/lib/domain/book";
import {
  ChapterEditorOrSecondsRequiredError,
  ChapterInvalidTransitionError,
  ChapterNarratorRequiredError,
  ChapterNotFoundError,
  ChapterPaidLockedError,
  ChapterReversionConfirmationRequiredError,
} from "@/lib/errors/chapter-errors";
import { EditorNotFoundError } from "@/lib/errors/editor-errors";
import { NarratorNotFoundError } from "@/lib/errors/narrator-errors";
import { ChapterService } from "@/lib/services/chapter-service";

interface Setup {
  service: ChapterService;
  bookRepo: InMemoryBookRepository;
  chapterRepo: InMemoryChapterRepository;
  narratorRepo: InMemoryNarratorRepository;
  editorRepo: InMemoryEditorRepository;
  studioRepo: InMemoryStudioRepository;
}

function makeService(): Setup {
  const chapterRepo = new InMemoryChapterRepository();
  const studioRepo = new InMemoryStudioRepository();
  const narratorRepo = new InMemoryNarratorRepository();
  const editorRepo = new InMemoryEditorRepository();
  const bookRepo = new InMemoryBookRepository({ chapterRepo, studioRepo });
  const service = new ChapterService({
    bookRepo,
    chapterRepo,
    narratorRepo,
    editorRepo,
  });
  return { service, bookRepo, chapterRepo, narratorRepo, editorRepo, studioRepo };
}

async function seedBook(setup: Setup): Promise<Book> {
  const studio = await setup.studioRepo.create({ name: "S", defaultHourlyRateCents: 7500 });
  return setup.bookRepo.insert({
    title: "B",
    studioId: studio.id,
    pricePerHourCents: 7500,
  });
}

describe("ChapterService.update", () => {
  let setup: Setup;

  beforeEach(() => {
    setup = makeService();
  });

  it("throws ChapterNotFoundError when the chapter does not exist", async () => {
    await expect(
      setup.service.update(crypto.randomUUID(), { status: "editing" }),
    ).rejects.toBeInstanceOf(ChapterNotFoundError);
  });

  describe("transitions from non-paid status", () => {
    it("transitions pending → editing when narrator is provided", async () => {
      const book = await seedBook(setup);
      const narrator = await setup.narratorRepo.create({ name: "Ana" });
      const [chapter] = await setup.chapterRepo.insertMany([
        { bookId: book.id, number: 1, status: "pending" },
      ]);

      const result = await setup.service.update(chapter.id, {
        status: "editing",
        narratorId: narrator.id,
      });

      expect(result.chapter.status).toBe("editing");
      expect(result.chapter.narratorId).toBe(narrator.id);
      expect(result.bookStatus).toBe("editing");
    });

    it("rejects pending → editing without narrator (NARRATOR_REQUIRED)", async () => {
      const book = await seedBook(setup);
      const [chapter] = await setup.chapterRepo.insertMany([
        { bookId: book.id, number: 1, status: "pending" },
      ]);

      await expect(setup.service.update(chapter.id, { status: "editing" })).rejects.toBeInstanceOf(
        ChapterNarratorRequiredError,
      );
    });

    it("transitions editing → reviewing when editor and editedSeconds > 0 are provided", async () => {
      const book = await seedBook(setup);
      const narrator = await setup.narratorRepo.create({ name: "Ana" });
      const editor = await setup.editorRepo.create({ name: "Bruno", email: "b@x.com" });
      const [chapter] = await setup.chapterRepo.insertMany([
        {
          bookId: book.id,
          number: 1,
          status: "editing",
          narratorId: narrator.id,
        },
      ]);

      const result = await setup.service.update(chapter.id, {
        status: "reviewing",
        editorId: editor.id,
        editedSeconds: 3600,
      });

      expect(result.chapter.status).toBe("reviewing");
      expect(result.chapter.editorId).toBe(editor.id);
      expect(result.chapter.editedSeconds).toBe(3600);
      expect(result.bookStatus).toBe("reviewing");
    });

    it("rejects editing → reviewing without editor (EDITOR_OR_SECONDS_REQUIRED)", async () => {
      const book = await seedBook(setup);
      const narrator = await setup.narratorRepo.create({ name: "Ana" });
      const [chapter] = await setup.chapterRepo.insertMany([
        {
          bookId: book.id,
          number: 1,
          status: "editing",
          narratorId: narrator.id,
          editedSeconds: 3600,
        },
      ]);

      await expect(
        setup.service.update(chapter.id, { status: "reviewing" }),
      ).rejects.toBeInstanceOf(ChapterEditorOrSecondsRequiredError);
    });

    it("rejects editing → reviewing when editedSeconds is 0", async () => {
      const book = await seedBook(setup);
      const narrator = await setup.narratorRepo.create({ name: "Ana" });
      const editor = await setup.editorRepo.create({ name: "Bruno", email: "b@x.com" });
      const [chapter] = await setup.chapterRepo.insertMany([
        {
          bookId: book.id,
          number: 1,
          status: "editing",
          narratorId: narrator.id,
        },
      ]);

      await expect(
        setup.service.update(chapter.id, {
          status: "reviewing",
          editorId: editor.id,
          editedSeconds: 0,
        }),
      ).rejects.toBeInstanceOf(ChapterEditorOrSecondsRequiredError);
    });

    it("allows reviewing → retake and retake → reviewing", async () => {
      const book = await seedBook(setup);
      const [chapter] = await setup.chapterRepo.insertMany([
        { bookId: book.id, number: 1, status: "reviewing" },
      ]);

      const retake = await setup.service.update(chapter.id, { status: "retake" });
      expect(retake.chapter.status).toBe("retake");

      const back = await setup.service.update(chapter.id, { status: "reviewing" });
      expect(back.chapter.status).toBe("reviewing");
    });

    it("allows reviewing → completed and completed → paid", async () => {
      const book = await seedBook(setup);
      const [chapter] = await setup.chapterRepo.insertMany([
        { bookId: book.id, number: 1, status: "reviewing" },
      ]);

      const completed = await setup.service.update(chapter.id, { status: "completed" });
      expect(completed.chapter.status).toBe("completed");

      const paid = await setup.service.update(chapter.id, { status: "paid" });
      expect(paid.chapter.status).toBe("paid");
    });

    it("rejects invalid transitions (e.g. pending → completed)", async () => {
      const book = await seedBook(setup);
      const [chapter] = await setup.chapterRepo.insertMany([
        { bookId: book.id, number: 1, status: "pending" },
      ]);

      await expect(
        setup.service.update(chapter.id, { status: "completed" }),
      ).rejects.toBeInstanceOf(ChapterInvalidTransitionError);
    });

    it("updates narratorId/editorId/editedSeconds without status change", async () => {
      const book = await seedBook(setup);
      const narrator = await setup.narratorRepo.create({ name: "Ana" });
      const editor = await setup.editorRepo.create({ name: "Bruno", email: "b@x.com" });
      const [chapter] = await setup.chapterRepo.insertMany([
        { bookId: book.id, number: 1, status: "editing", narratorId: narrator.id },
      ]);

      const result = await setup.service.update(chapter.id, {
        editorId: editor.id,
        editedSeconds: 1800,
      });

      expect(result.chapter.status).toBe("editing");
      expect(result.chapter.editorId).toBe(editor.id);
      expect(result.chapter.editedSeconds).toBe(1800);
    });

    it("rejects narratorId pointing to a non-existent narrator", async () => {
      const book = await seedBook(setup);
      const [chapter] = await setup.chapterRepo.insertMany([
        { bookId: book.id, number: 1, status: "pending" },
      ]);

      await expect(
        setup.service.update(chapter.id, {
          status: "editing",
          narratorId: crypto.randomUUID(),
        }),
      ).rejects.toBeInstanceOf(NarratorNotFoundError);
    });

    it("rejects editorId pointing to a non-existent editor", async () => {
      const book = await seedBook(setup);
      const [chapter] = await setup.chapterRepo.insertMany([
        { bookId: book.id, number: 1, status: "editing" },
      ]);

      await expect(
        setup.service.update(chapter.id, {
          editorId: crypto.randomUUID(),
        }),
      ).rejects.toBeInstanceOf(EditorNotFoundError);
    });
  });

  describe("paid chapter — locked and reversion", () => {
    it("rejects narratorId mutation on a paid chapter (CHAPTER_PAID_LOCKED)", async () => {
      const book = await seedBook(setup);
      const narrator = await setup.narratorRepo.create({ name: "Ana" });
      const [chapter] = await setup.chapterRepo.insertMany([
        { bookId: book.id, number: 1, status: "paid" },
      ]);

      await expect(
        setup.service.update(chapter.id, { narratorId: narrator.id }),
      ).rejects.toBeInstanceOf(ChapterPaidLockedError);
    });

    it("rejects editedSeconds mutation on a paid chapter", async () => {
      const book = await seedBook(setup);
      const [chapter] = await setup.chapterRepo.insertMany([
        { bookId: book.id, number: 1, status: "paid" },
      ]);

      await expect(
        setup.service.update(chapter.id, { editedSeconds: 7200 }),
      ).rejects.toBeInstanceOf(ChapterPaidLockedError);
    });

    it("rejects paid → completed without confirmReversion (REVERSION_CONFIRMATION_REQUIRED)", async () => {
      const book = await seedBook(setup);
      const [chapter] = await setup.chapterRepo.insertMany([
        { bookId: book.id, number: 1, status: "paid" },
      ]);

      await expect(
        setup.service.update(chapter.id, { status: "completed" }),
      ).rejects.toBeInstanceOf(ChapterReversionConfirmationRequiredError);
    });

    it("accepts paid → completed when confirmReversion is true", async () => {
      const book = await seedBook(setup);
      const [chapter] = await setup.chapterRepo.insertMany([
        { bookId: book.id, number: 1, status: "paid" },
      ]);

      const result = await setup.service.update(chapter.id, {
        status: "completed",
        confirmReversion: true,
      });

      expect(result.chapter.status).toBe("completed");
      expect(result.bookStatus).toBe("completed");
    });

    it("rejects paid → any status other than completed", async () => {
      const book = await seedBook(setup);
      const [chapter] = await setup.chapterRepo.insertMany([
        { bookId: book.id, number: 1, status: "paid" },
      ]);

      await expect(
        setup.service.update(chapter.id, { status: "pending", confirmReversion: true }),
      ).rejects.toBeInstanceOf(ChapterInvalidTransitionError);
    });
  });

  describe("recomputes book.status after every update", () => {
    it("reviewing chapter advanced to completed promotes book.status to completed", async () => {
      const book = await seedBook(setup);
      const [reviewing, paid] = await setup.chapterRepo.insertMany([
        { bookId: book.id, number: 1, status: "reviewing" },
        { bookId: book.id, number: 2, status: "paid" },
      ]);
      void paid;

      const result = await setup.service.update(reviewing.id, { status: "completed" });

      expect(result.bookStatus).toBe("completed");
      const persisted = await setup.bookRepo.findById(book.id);
      expect(persisted?.status).toBe("completed");
    });

    it("adding a narrator to last pending while another paid keeps book pending", async () => {
      const book = await seedBook(setup);
      const narrator = await setup.narratorRepo.create({ name: "Ana" });
      const [pending, paid] = await setup.chapterRepo.insertMany([
        { bookId: book.id, number: 1, status: "pending" },
        { bookId: book.id, number: 2, status: "paid" },
      ]);
      void paid;

      const result = await setup.service.update(pending.id, {
        narratorId: narrator.id,
      });

      // Narrator alone does not change chapter.status; book stays pending.
      expect(result.chapter.status).toBe("pending");
      expect(result.bookStatus).toBe("pending");
    });
  });
});
