import type { BookRepository, BookSummary } from "@/lib/repositories/book-repository";
import type { ChapterRepository } from "@/lib/repositories/chapter-repository";
import type { StudioRepository } from "@/lib/repositories/studio-repository";

export interface BookServiceDeps {
  readonly bookRepo: BookRepository;
  readonly chapterRepo: ChapterRepository;
  readonly studioRepo: StudioRepository;
}

export class BookService {
  constructor(protected readonly deps: BookServiceDeps) {}

  async listForUser(userId: string): Promise<BookSummary[]> {
    return this.deps.bookRepo.listSummariesByUser(userId);
  }
}
