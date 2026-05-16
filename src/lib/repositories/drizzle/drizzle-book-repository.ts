import { desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getUniqueConstraintName } from "@/lib/db/postgres-errors";
import type * as schema from "@/lib/db/schema";
import { book, chapter, studio } from "@/lib/db/schema";
import type { Book, BookStatus } from "@/lib/domain/book";
import { BookNotFoundError, BookTitleAlreadyInUseError } from "@/lib/errors/book-errors";
import type {
  BookRepository,
  BookSummary,
  InsertBookInput,
  ListSummariesOptions,
  RepositoryTx,
  UpdateBookInput,
} from "@/lib/repositories/book-repository";

type Executor = NodePgDatabase<typeof schema>;

const BOOK_COLUMNS = {
  id: book.id,
  title: book.title,
  studioId: book.studioId,
  pricePerHourCents: book.pricePerHourCents,
  chaptersVersion: book.chaptersVersion,
  pdfUrl: book.pdfUrl,
  status: book.status,
  createdAt: book.createdAt,
  updatedAt: book.updatedAt,
} as const;

const BOOK_TITLE_CONSTRAINT = "book_title_studio_unique";

type BookRow = {
  id: string;
  title: string;
  studioId: string;
  pricePerHourCents: number;
  chaptersVersion: number;
  pdfUrl: string | null;
  status: BookStatus;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    studioId: row.studioId,
    pricePerHourCents: row.pricePerHourCents,
    chaptersVersion: row.chaptersVersion,
    pdfUrl: row.pdfUrl,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleBookRepository implements BookRepository {
  constructor(private readonly db: Executor) {}

  private executor(tx?: RepositoryTx): Executor {
    return (tx as Executor | undefined) ?? this.db;
  }

  async list(tx?: RepositoryTx): Promise<Book[]> {
    const rows = await this.executor(tx)
      .select(BOOK_COLUMNS)
      .from(book)
      .orderBy(desc(book.createdAt));
    return rows.map(toDomain);
  }

  async listSummaries(opts: ListSummariesOptions, tx?: RepositoryTx): Promise<BookSummary[]> {
    // JOIN studio without deleted_at filter — historical books must resolve
    // the studio name even when the studio has been soft-deleted.
    const rows = await this.executor(tx)
      .select({
        id: book.id,
        title: book.title,
        pricePerHourCents: book.pricePerHourCents,
        pdfUrl: book.pdfUrl,
        status: book.status,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        studioId: studio.id,
        studioName: studio.name,
        totalChapters: sql<number>`coalesce(count(${chapter.id}), 0)::int`,
        completedChapters: sql<number>`coalesce(count(${chapter.id}) filter (where ${chapter.status} in ('completed', 'paid')), 0)::int`,
        totalEarningsCents: sql<number>`coalesce(sum(round(${chapter.editedSeconds}::numeric * ${book.pricePerHourCents} / 3600))::int, 0)`,
        focusThisWeekCount: sql<number>`coalesce(count(${chapter.id}) filter (
          where ${chapter.status} in ('pending', 'editing', 'reviewing', 'retake')
          and ${chapter.deadline} is not null
          and (
            ${chapter.deadline} < ${opts.todayIso}::date
            or ${chapter.deadline} between ${opts.mondayIso}::date and ${opts.sundayIso}::date
          )
        ), 0)::int`,
      })
      .from(book)
      .innerJoin(studio, eq(studio.id, book.studioId))
      .leftJoin(chapter, eq(chapter.bookId, book.id))
      .groupBy(book.id, studio.id, studio.name)
      .orderBy(desc(book.createdAt));

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      studio: { id: row.studioId, name: row.studioName },
      pricePerHourCents: row.pricePerHourCents,
      pdfUrl: row.pdfUrl,
      status: row.status,
      totalChapters: row.totalChapters,
      completedChapters: row.completedChapters,
      totalEarningsCents: row.totalEarningsCents,
      focusThisWeekCount: row.focusThisWeekCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async findById(id: string, tx?: RepositoryTx): Promise<Book | null> {
    const rows = await this.executor(tx).select(BOOK_COLUMNS).from(book).where(eq(book.id, id));
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async insert(input: InsertBookInput, tx?: RepositoryTx): Promise<Book> {
    try {
      const [row] = await this.executor(tx)
        .insert(book)
        .values({
          title: input.title,
          studioId: input.studioId,
          pricePerHourCents: input.pricePerHourCents,
          pdfUrl: input.pdfUrl ?? null,
        })
        .returning(BOOK_COLUMNS);
      return toDomain(row);
    } catch (error) {
      if (getUniqueConstraintName(error) === BOOK_TITLE_CONSTRAINT) {
        throw new BookTitleAlreadyInUseError(input.title, input.studioId);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateBookInput, tx?: RepositoryTx): Promise<Book> {
    try {
      const [row] = await this.executor(tx)
        .update(book)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.studioId !== undefined ? { studioId: input.studioId } : {}),
          ...(input.pricePerHourCents !== undefined
            ? { pricePerHourCents: input.pricePerHourCents }
            : {}),
          ...(input.pdfUrl !== undefined ? { pdfUrl: input.pdfUrl } : {}),
        })
        .where(eq(book.id, id))
        .returning(BOOK_COLUMNS);

      if (!row) {
        throw new BookNotFoundError(id);
      }
      return toDomain(row);
    } catch (error) {
      if (error instanceof BookNotFoundError) {
        throw error;
      }
      if (
        getUniqueConstraintName(error) === BOOK_TITLE_CONSTRAINT &&
        (input.title !== undefined || input.studioId !== undefined)
      ) {
        throw new BookTitleAlreadyInUseError(input.title ?? "", input.studioId ?? "");
      }
      throw error;
    }
  }

  async updateStatus(id: string, status: BookStatus, tx?: RepositoryTx): Promise<Book> {
    const [row] = await this.executor(tx)
      .update(book)
      .set({ status })
      .where(eq(book.id, id))
      .returning(BOOK_COLUMNS);

    if (!row) {
      throw new BookNotFoundError(id);
    }
    return toDomain(row);
  }

  async delete(id: string, tx?: RepositoryTx): Promise<void> {
    const deleted = await this.executor(tx)
      .delete(book)
      .where(eq(book.id, id))
      .returning({ id: book.id });

    if (deleted.length === 0) {
      throw new BookNotFoundError(id);
    }
  }

  async bumpChaptersVersion(id: string, tx?: RepositoryTx): Promise<number> {
    const [row] = await this.executor(tx)
      .update(book)
      .set({ chaptersVersion: sql`${book.chaptersVersion} + 1` })
      .where(eq(book.id, id))
      .returning({ chaptersVersion: book.chaptersVersion });

    if (!row) {
      throw new BookNotFoundError(id);
    }
    return row.chaptersVersion;
  }
}
