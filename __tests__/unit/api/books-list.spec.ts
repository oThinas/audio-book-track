import { InMemoryBookRepository } from "@tests/repositories/in-memory-book-repository";
import { InMemoryChapterRepository } from "@tests/repositories/in-memory-chapter-repository";
import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleBooksList } from "@/app/api/v1/books/route";
import { BookService } from "@/lib/services/book-service";

function createDeps(options: { session: { user: { id: string } } | null; service: BookService }) {
  return {
    getSession: vi.fn().mockResolvedValue(options.session),
    createService: vi.fn().mockReturnValue(options.service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

describe("GET /api/v1/books (handleBooksList)", () => {
  let bookRepo: InMemoryBookRepository;
  let chapterRepo: InMemoryChapterRepository;
  let studioRepo: InMemoryStudioRepository;
  let service: BookService;

  beforeEach(() => {
    chapterRepo = new InMemoryChapterRepository();
    studioRepo = new InMemoryStudioRepository();
    bookRepo = new InMemoryBookRepository({ chapterRepo, studioRepo });
    service = new BookService({ bookRepo, chapterRepo, studioRepo });
  });

  it("returns 401 when there is no session", async () => {
    const deps = createDeps({ session: null, service });

    const response = await handleBooksList(deps);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 200 with an empty data array when the user has no books", async () => {
    const deps = createDeps({ session: { user: { id: crypto.randomUUID() } }, service });

    const response = await handleBooksList(deps);
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

    const deps = createDeps({ session: { user: { id: crypto.randomUUID() } }, service });

    const response = await handleBooksList(deps);
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
    const deps = createDeps({ session: { user: { id: crypto.randomUUID() } }, service });

    const response = await handleBooksList(deps);

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
