import type { BookRepository } from "@/lib/repositories/book-repository";
import type { ChapterRepository } from "@/lib/repositories/chapter-repository";

export interface BookServiceDeps {
  readonly bookRepo: BookRepository;
  readonly chapterRepo: ChapterRepository;
}

export class BookService {
  constructor(protected readonly deps: BookServiceDeps) {}
}
