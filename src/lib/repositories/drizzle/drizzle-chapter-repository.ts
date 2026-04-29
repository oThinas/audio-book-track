import { asc, eq, inArray, max, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getUniqueConstraintName } from "@/lib/db/postgres-errors";
import type * as schema from "@/lib/db/schema";
import { chapter } from "@/lib/db/schema";
import type { Chapter, ChapterStatus } from "@/lib/domain/chapter";
import { ChapterNotFoundError, ChapterNumberAlreadyInUseError } from "@/lib/errors/chapter-errors";
import type { RepositoryTx } from "@/lib/repositories/book-repository";
import type {
  ChapterRepository,
  InsertChapterInput,
  UpdateChapterInput,
} from "@/lib/repositories/chapter-repository";

type Executor = NodePgDatabase<typeof schema>;

const CHAPTER_COLUMNS = {
  id: chapter.id,
  bookId: chapter.bookId,
  number: chapter.number,
  status: chapter.status,
  narratorId: chapter.narratorId,
  editorId: chapter.editorId,
  editedSeconds: chapter.editedSeconds,
  createdAt: chapter.createdAt,
  updatedAt: chapter.updatedAt,
} as const;

const CHAPTER_NUMBER_CONSTRAINT = "chapter_book_number_unique";

type ChapterRow = {
  id: string;
  bookId: string;
  number: number;
  status: ChapterStatus;
  narratorId: string | null;
  editorId: string | null;
  editedSeconds: number;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: ChapterRow): Chapter {
  return {
    id: row.id,
    bookId: row.bookId,
    number: row.number,
    status: row.status,
    narratorId: row.narratorId,
    editorId: row.editorId,
    editedSeconds: row.editedSeconds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleChapterRepository implements ChapterRepository {
  constructor(private readonly db: Executor) {}

  private executor(tx?: RepositoryTx): Executor {
    return (tx as Executor | undefined) ?? this.db;
  }

  async listByBookId(bookId: string, tx?: RepositoryTx): Promise<Chapter[]> {
    const rows = await this.executor(tx)
      .select(CHAPTER_COLUMNS)
      .from(chapter)
      .where(eq(chapter.bookId, bookId))
      .orderBy(asc(chapter.number));
    return rows.map(toDomain);
  }

  async findById(id: string, tx?: RepositoryTx): Promise<Chapter | null> {
    const rows = await this.executor(tx)
      .select(CHAPTER_COLUMNS)
      .from(chapter)
      .where(eq(chapter.id, id));
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async insertMany(
    inputs: ReadonlyArray<InsertChapterInput>,
    tx?: RepositoryTx,
  ): Promise<Chapter[]> {
    if (inputs.length === 0) {
      return [];
    }

    try {
      const rows = await this.executor(tx)
        .insert(chapter)
        .values(
          inputs.map((input) => ({
            bookId: input.bookId,
            number: input.number,
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.narratorId !== undefined ? { narratorId: input.narratorId } : {}),
            ...(input.editorId !== undefined ? { editorId: input.editorId } : {}),
            ...(input.editedSeconds !== undefined ? { editedSeconds: input.editedSeconds } : {}),
          })),
        )
        .returning(CHAPTER_COLUMNS);
      return rows.map(toDomain);
    } catch (error) {
      if (getUniqueConstraintName(error) === CHAPTER_NUMBER_CONSTRAINT) {
        const first = inputs[0];
        throw new ChapterNumberAlreadyInUseError(first.bookId, first.number);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateChapterInput, tx?: RepositoryTx): Promise<Chapter> {
    const [row] = await this.executor(tx)
      .update(chapter)
      .set({
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.narratorId !== undefined ? { narratorId: input.narratorId } : {}),
        ...(input.editorId !== undefined ? { editorId: input.editorId } : {}),
        ...(input.editedSeconds !== undefined ? { editedSeconds: input.editedSeconds } : {}),
      })
      .where(eq(chapter.id, id))
      .returning(CHAPTER_COLUMNS);

    if (!row) {
      throw new ChapterNotFoundError(id);
    }
    return toDomain(row);
  }

  async delete(id: string, tx?: RepositoryTx): Promise<void> {
    const deleted = await this.executor(tx)
      .delete(chapter)
      .where(eq(chapter.id, id))
      .returning({ id: chapter.id });

    if (deleted.length === 0) {
      throw new ChapterNotFoundError(id);
    }
  }

  async deleteMany(ids: ReadonlyArray<string>, tx?: RepositoryTx): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    const deleted = await this.executor(tx)
      .delete(chapter)
      .where(inArray(chapter.id, [...ids]))
      .returning({ id: chapter.id });
    return deleted.length;
  }

  async countByBookId(bookId: string, tx?: RepositoryTx): Promise<number> {
    const rows = await this.executor(tx)
      .select({ count: sql<number>`count(*)::int` })
      .from(chapter)
      .where(eq(chapter.bookId, bookId));
    return rows[0]?.count ?? 0;
  }

  async maxNumberByBookId(bookId: string, tx?: RepositoryTx): Promise<number> {
    const rows = await this.executor(tx)
      .select({ max: max(chapter.number) })
      .from(chapter)
      .where(eq(chapter.bookId, bookId));
    return rows[0]?.max ?? 0;
  }
}
