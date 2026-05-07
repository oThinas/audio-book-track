import { NoOpUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { InMemoryBookRepository } from "@tests/repositories/in-memory-book-repository";
import { InMemoryChapterRepository } from "@tests/repositories/in-memory-chapter-repository";
import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { handleBooksList } from "@/app/api/v1/books/route";
import type { AuthenticatedContext } from "@/lib/api/with-error-handler";
import { BookService } from "@/lib/services/book-service";

function buildContext(): AuthenticatedContext<Record<string, never>> {
  return {
    params: Promise.resolve({}),
    session: { user: { id: crypto.randomUUID() } },
    requestId: "test-request-id",
  };
}

describe("handleBooksList", () => {
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

  it("returns 200 with an empty data array when the user has no books", async () => {
    const response = await handleBooksList(
      new Request("http://localhost/api/v1/books"),
      buildContext(),
      { createService: () => service },
    );
    const body = (await response.json()) as { data: unknown[] };

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("returns 200 with aggregated book summaries", async () => {
    const studio = await studioRepo.create({ name: "Sonora", defaultHourlyRateCents: 7500 });
    const book = await bookRepo.insert({
      title: "Dom Casmurro",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await chapterRepo.insertMany([
      { bookId: book.id, number: 1, status: "paid", editedSeconds: 3600 },
    ]);

    const response = await handleBooksList(
      new Request("http://localhost/api/v1/books"),
      buildContext(),
      { createService: () => service },
    );
    const body = (await response.json()) as {
      data: Array<{
        id: string;
        title: string;
        studio: { id: string; name: string };
        totalChapters: number;
        completedChapters: number;
        totalEarningsCents: number;
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(book.id);
    expect(body.data[0].studio).toEqual({ id: studio.id, name: "Sonora" });
    expect(body.data[0].totalChapters).toBe(1);
    expect(body.data[0].completedChapters).toBe(1);
    expect(body.data[0].totalEarningsCents).toBe(7500);
  });

  it("sets Cache-Control: no-store", async () => {
    const response = await handleBooksList(
      new Request("http://localhost/api/v1/books"),
      buildContext(),
      { createService: () => service },
    );

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
