import type { Book, BookStatus } from "@/lib/domain/book";

export type RepositoryTx = unknown;

export interface InsertBookInput {
  readonly title: string;
  readonly studioId: string;
  readonly pricePerHourCents: number;
  readonly pdfUrl?: string | null;
}

export interface UpdateBookInput {
  readonly title?: string;
  readonly studioId?: string;
  readonly pricePerHourCents?: number;
  readonly pdfUrl?: string | null;
}

export interface BookSummary {
  readonly id: string;
  readonly title: string;
  readonly studio: { readonly id: string; readonly name: string };
  readonly pricePerHourCents: number;
  readonly pdfUrl: string | null;
  readonly status: BookStatus;
  readonly totalChapters: number;
  readonly completedChapters: number;
  readonly totalEarningsCents: number;
  readonly focusThisWeekCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ListSummariesOptions {
  readonly todayIso: string;
  readonly mondayIso: string;
  readonly sundayIso: string;
}

export interface BookRepository {
  list(tx?: RepositoryTx): Promise<Book[]>;
  listSummaries(opts: ListSummariesOptions, tx?: RepositoryTx): Promise<BookSummary[]>;
  findById(id: string, tx?: RepositoryTx): Promise<Book | null>;
  insert(input: InsertBookInput, tx?: RepositoryTx): Promise<Book>;
  update(id: string, input: UpdateBookInput, tx?: RepositoryTx): Promise<Book>;
  updateStatus(id: string, status: BookStatus, tx?: RepositoryTx): Promise<Book>;
  delete(id: string, tx?: RepositoryTx): Promise<void>;
  bumpChaptersVersion(id: string, tx?: RepositoryTx): Promise<number>;
}
