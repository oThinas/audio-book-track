import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "@/lib/db/schema";
import { chapter } from "@/lib/db/schema";
import type { Chapter, ChapterStatus } from "@/lib/domain/chapter";
import { ChapterNotFoundError } from "@/lib/errors/chapter-errors";
import type { RepositoryTx } from "@/lib/repositories/book-repository";
import type {
  ChapterReorderPair,
  ChapterRepository,
  InsertChapterInput,
  UpdateChapterInput,
} from "@/lib/repositories/chapter-repository";

type Executor = NodePgDatabase<typeof schema>;

const CHAPTER_COLUMNS = {
  id: chapter.id,
  bookId: chapter.bookId,
  title: chapter.title,
  position: chapter.position,
  status: chapter.status,
  narratorId: chapter.narratorId,
  editorId: chapter.editorId,
  editedSeconds: chapter.editedSeconds,
  deadline: chapter.deadline,
  createdAt: chapter.createdAt,
  updatedAt: chapter.updatedAt,
} as const;

type ChapterRow = {
  id: string;
  bookId: string;
  title: string;
  position: number;
  status: ChapterStatus;
  narratorId: string | null;
  editorId: string | null;
  editedSeconds: number;
  deadline: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: ChapterRow): Chapter {
  return {
    id: row.id,
    bookId: row.bookId,
    title: row.title,
    position: row.position,
    status: row.status,
    narratorId: row.narratorId,
    editorId: row.editorId,
    editedSeconds: row.editedSeconds,
    deadline: row.deadline,
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
      .orderBy(asc(chapter.position));
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

    const rows = await this.executor(tx)
      .insert(chapter)
      .values(
        inputs.map((input) => ({
          bookId: input.bookId,
          title: input.title,
          position: input.position,
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.narratorId !== undefined ? { narratorId: input.narratorId } : {}),
          ...(input.editorId !== undefined ? { editorId: input.editorId } : {}),
          ...(input.editedSeconds !== undefined ? { editedSeconds: input.editedSeconds } : {}),
          ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
        })),
      )
      .returning(CHAPTER_COLUMNS);
    return rows.map(toDomain);
  }

  async update(id: string, input: UpdateChapterInput, tx?: RepositoryTx): Promise<Chapter> {
    const [row] = await this.executor(tx)
      .update(chapter)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.narratorId !== undefined ? { narratorId: input.narratorId } : {}),
        ...(input.editorId !== undefined ? { editorId: input.editorId } : {}),
        ...(input.editedSeconds !== undefined ? { editedSeconds: input.editedSeconds } : {}),
        ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
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

  async reorder(
    bookId: string,
    pairs: ReadonlyArray<ChapterReorderPair>,
    tx?: RepositoryTx,
  ): Promise<void> {
    if (pairs.length === 0) {
      return;
    }
    const exec = this.executor(tx);
    for (const pair of pairs) {
      await exec
        .update(chapter)
        .set({ position: pair.position })
        .where(and(eq(chapter.id, pair.id), eq(chapter.bookId, bookId)));
    }
  }
}
