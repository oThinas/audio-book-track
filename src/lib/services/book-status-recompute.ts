import type { Book } from "@/lib/domain/book";
import { computeBookStatus } from "@/lib/domain/book-status";
import type { BookRepository, RepositoryTx } from "@/lib/repositories/book-repository";
import type { ChapterRepository } from "@/lib/repositories/chapter-repository";

export interface RecomputeBookStatusDeps {
  readonly bookRepo: BookRepository;
  readonly chapterRepo: ChapterRepository;
}

export async function recomputeBookStatusAndBumpVersion(
  bookId: string,
  deps: RecomputeBookStatusDeps,
  tx?: RepositoryTx,
): Promise<Book> {
  const chapters = await deps.chapterRepo.listByBookId(bookId, tx);
  const nextStatus = computeBookStatus(chapters);
  const updated = await deps.bookRepo.updateStatus(bookId, nextStatus, tx);
  await deps.bookRepo.bumpChaptersVersion(bookId, tx);
  const refreshed = await deps.bookRepo.findById(bookId, tx);
  return refreshed ?? updated;
}

// @deprecated — usar recomputeBookStatusAndBumpVersion. Mantido temporariamente
// para callers em refator. Removido na Phase 6.
export const recomputeBookStatus = recomputeBookStatusAndBumpVersion;
