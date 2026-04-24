import type { BookRepository } from "@/lib/repositories/book-repository";
import type { ChapterRepository } from "@/lib/repositories/chapter-repository";

export interface ChapterServiceDeps {
  readonly bookRepo: BookRepository;
  readonly chapterRepo: ChapterRepository;
}

export class ChapterService {
  constructor(protected readonly deps: ChapterServiceDeps) {}
}
