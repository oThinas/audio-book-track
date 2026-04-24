import type { Book } from "@/lib/domain/book";
import type { Chapter } from "@/lib/domain/chapter";
import { BookStudioNotFoundError } from "@/lib/errors/book-errors";
import type { BookRepository, BookSummary } from "@/lib/repositories/book-repository";
import type { ChapterRepository } from "@/lib/repositories/chapter-repository";
import type { StudioRepository } from "@/lib/repositories/studio-repository";
import type { UnitOfWork } from "@/lib/repositories/unit-of-work";

import { recomputeBookStatus } from "./book-status-recompute";

export interface BookServiceDeps {
  readonly bookRepo: BookRepository;
  readonly chapterRepo: ChapterRepository;
  readonly studioRepo: StudioRepository;
  readonly uow: UnitOfWork;
}

export interface CreateBookServiceInput {
  readonly title: string;
  readonly studioId: string;
  readonly pricePerHourCents: number;
  readonly numChapters: number;
}

export interface CreateBookResult {
  readonly book: Book;
  readonly chapters: readonly Chapter[];
}

export class BookService {
  constructor(protected readonly deps: BookServiceDeps) {}

  async listForUser(userId: string): Promise<BookSummary[]> {
    return this.deps.bookRepo.listSummariesByUser(userId);
  }

  async create(input: CreateBookServiceInput, _userId: string): Promise<CreateBookResult> {
    const studio = await this.deps.studioRepo.findById(input.studioId);
    if (!studio) {
      throw new BookStudioNotFoundError(input.studioId);
    }

    return this.deps.uow.transaction(async (tx) => {
      const inserted = await this.deps.bookRepo.insert(
        {
          title: input.title,
          studioId: input.studioId,
          pricePerHourCents: input.pricePerHourCents,
        },
        tx,
      );

      const chapters = await this.deps.chapterRepo.insertMany(
        Array.from({ length: input.numChapters }, (_, index) => ({
          bookId: inserted.id,
          number: index + 1,
          status: "pending" as const,
        })),
        tx,
      );

      const withStatus = await recomputeBookStatus(
        inserted.id,
        { bookRepo: this.deps.bookRepo, chapterRepo: this.deps.chapterRepo },
        tx,
      );

      return { book: withStatus, chapters };
    });
  }
}
