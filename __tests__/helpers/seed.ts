import type { InMemoryBookRepository } from "@tests/repositories/in-memory-book-repository";
import type { InMemoryChapterRepository } from "@tests/repositories/in-memory-chapter-repository";
import type { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";

import type { Book } from "@/lib/domain/book";
import { computeBookStatus } from "@/lib/domain/book-status";
import type { Chapter, ChapterStatus } from "@/lib/domain/chapter";

export interface SeedInMemoryBookOptions {
  readonly studioRepo: InMemoryStudioRepository;
  readonly bookRepo: InMemoryBookRepository;
  readonly chapterRepo: InMemoryChapterRepository;
  readonly statuses: ReadonlyArray<ChapterStatus>;
  readonly studioName?: string;
  readonly bookTitle?: string;
  readonly pricePerHourCents?: number;
  readonly defaultHourlyRateCents?: number;
}

export interface SeedInMemoryBookResult {
  readonly book: Book;
  readonly chapters: ReadonlyArray<Chapter>;
}

/**
 * In-memory seeding helper for unit tests using the InMemory* repositories.
 * Mirrors `__tests__/e2e/helpers/seed.ts` (which targets a real DB) but stays
 * synchronous-friendly and free of network/SQL.
 */
export async function seedInMemoryBook(
  opts: SeedInMemoryBookOptions,
): Promise<SeedInMemoryBookResult> {
  const studio = await opts.studioRepo.create({
    name: opts.studioName ?? `Studio ${crypto.randomUUID().slice(0, 6)}`,
    defaultHourlyRateCents: opts.defaultHourlyRateCents ?? 5000,
  });
  const book = await opts.bookRepo.insert({
    title: opts.bookTitle ?? `Book ${crypto.randomUUID().slice(0, 6)}`,
    studioId: studio.id,
    pricePerHourCents: opts.pricePerHourCents ?? 7500,
  });
  const chapters = await opts.chapterRepo.insertMany(
    opts.statuses.map((status, idx) => ({
      bookId: book.id,
      number: idx + 1,
      status,
      editedSeconds: status === "completed" || status === "paid" ? 3600 : 0,
    })),
  );

  // Persist the computed book status so seeded fixtures match the production
  // invariant that `book.status` is always derived from its chapters.
  if (chapters.length > 0) {
    const nextStatus = computeBookStatus(chapters);
    if (nextStatus !== book.status) {
      const refreshed = await opts.bookRepo.updateStatus(book.id, nextStatus);
      return { book: refreshed, chapters };
    }
  }
  return { book, chapters };
}
