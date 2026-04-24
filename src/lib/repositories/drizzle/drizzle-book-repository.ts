import { desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getUniqueConstraintName } from "@/lib/db/postgres-errors";
import type * as schema from "@/lib/db/schema";
import { book } from "@/lib/db/schema";
import type { Book, BookStatus } from "@/lib/domain/book";
import { BookNotFoundError, BookTitleAlreadyInUseError } from "@/lib/errors/book-errors";
import type {
  BookRepository,
  InsertBookInput,
  RepositoryTx,
  UpdateBookInput,
} from "@/lib/repositories/book-repository";

type Executor = NodePgDatabase<typeof schema>;

const BOOK_COLUMNS = {
  id: book.id,
  title: book.title,
  studioId: book.studioId,
  pricePerHourCents: book.pricePerHourCents,
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

  async listByUser(_userId: string, tx?: RepositoryTx): Promise<Book[]> {
    const rows = await this.executor(tx)
      .select(BOOK_COLUMNS)
      .from(book)
      .orderBy(desc(book.createdAt));
    return rows.map(toDomain);
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
}
