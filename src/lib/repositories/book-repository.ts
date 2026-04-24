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

export interface BookRepository {
  listByUser(userId: string, tx?: RepositoryTx): Promise<Book[]>;
  findById(id: string, tx?: RepositoryTx): Promise<Book | null>;
  insert(input: InsertBookInput, tx?: RepositoryTx): Promise<Book>;
  update(id: string, input: UpdateBookInput, tx?: RepositoryTx): Promise<Book>;
  updateStatus(id: string, status: BookStatus, tx?: RepositoryTx): Promise<Book>;
  delete(id: string, tx?: RepositoryTx): Promise<void>;
}
