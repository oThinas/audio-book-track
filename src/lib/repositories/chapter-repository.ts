import type { Chapter, ChapterStatus } from "@/lib/domain/chapter";

import type { RepositoryTx } from "./book-repository";

export interface InsertChapterInput {
  readonly bookId: string;
  readonly number: number;
  readonly status?: ChapterStatus;
  readonly narratorId?: string | null;
  readonly editorId?: string | null;
  readonly editedSeconds?: number;
}

export interface UpdateChapterInput {
  readonly status?: ChapterStatus;
  readonly narratorId?: string | null;
  readonly editorId?: string | null;
  readonly editedSeconds?: number;
}

export interface ChapterRepository {
  listByBookId(bookId: string, tx?: RepositoryTx): Promise<Chapter[]>;
  findById(id: string, tx?: RepositoryTx): Promise<Chapter | null>;
  insertMany(inputs: ReadonlyArray<InsertChapterInput>, tx?: RepositoryTx): Promise<Chapter[]>;
  update(id: string, input: UpdateChapterInput, tx?: RepositoryTx): Promise<Chapter>;
  delete(id: string, tx?: RepositoryTx): Promise<void>;
  deleteMany(ids: ReadonlyArray<string>, tx?: RepositoryTx): Promise<number>;
  countByBookId(bookId: string, tx?: RepositoryTx): Promise<number>;
  maxNumberByBookId(bookId: string, tx?: RepositoryTx): Promise<number>;
}
