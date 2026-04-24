import type { Book } from "@/lib/domain/book";
import { computeBookStatus } from "@/lib/domain/book-status";
import type { BookRepository, RepositoryTx } from "@/lib/repositories/book-repository";
import type { ChapterRepository } from "@/lib/repositories/chapter-repository";

export interface RecomputeBookStatusDeps {
  readonly bookRepo: BookRepository;
  readonly chapterRepo: ChapterRepository;
}

export async function recomputeBookStatus(
  bookId: string,
  deps: RecomputeBookStatusDeps,
  tx?: RepositoryTx,
): Promise<Book> {
  const chapters = await deps.chapterRepo.listByBookId(bookId, tx);
  const nextStatus = computeBookStatus(chapters);
  return deps.bookRepo.updateStatus(bookId, nextStatus, tx);
}
