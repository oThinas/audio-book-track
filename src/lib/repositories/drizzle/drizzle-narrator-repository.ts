import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { isUniqueViolation } from "@/lib/db/postgres-errors";
import type * as schema from "@/lib/db/schema";
import { narrator } from "@/lib/db/schema";
import type { CreateNarratorInput, Narrator, UpdateNarratorInput } from "@/lib/domain/narrator";
import { NarratorNameAlreadyInUseError, NarratorNotFoundError } from "@/lib/errors/narrator-errors";
import type { RepositoryTx } from "@/lib/repositories/book-repository";
import type { NarratorRepository } from "@/lib/repositories/narrator-repository";

type Executor = NodePgDatabase<typeof schema>;

const NARRATOR_COLUMNS = {
  id: narrator.id,
  name: narrator.name,
  createdAt: narrator.createdAt,
  updatedAt: narrator.updatedAt,
} as const;

export class DrizzleNarratorRepository implements NarratorRepository {
  constructor(private readonly db: Executor) {}

  private executor(tx?: RepositoryTx): Executor {
    return (tx as Executor | undefined) ?? this.db;
  }

  async findAll(): Promise<Narrator[]> {
    return this.db
      .select(NARRATOR_COLUMNS)
      .from(narrator)
      .where(isNull(narrator.deletedAt))
      .orderBy(asc(narrator.createdAt));
  }

  async findById(id: string): Promise<Narrator | null> {
    const rows = await this.db
      .select(NARRATOR_COLUMNS)
      .from(narrator)
      .where(and(eq(narrator.id, id), isNull(narrator.deletedAt)));
    return rows[0] ?? null;
  }

  async findByName(name: string): Promise<Narrator | null> {
    const rows = await this.db
      .select(NARRATOR_COLUMNS)
      .from(narrator)
      .where(and(sql`lower(${narrator.name}) = lower(${name})`, isNull(narrator.deletedAt)));
    return rows[0] ?? null;
  }

  async findByNameIncludingDeleted(name: string): Promise<Narrator | null> {
    const rows = await this.db
      .select(NARRATOR_COLUMNS)
      .from(narrator)
      .where(sql`lower(${narrator.name}) = lower(${name})`);
    return rows[0] ?? null;
  }

  async create(input: CreateNarratorInput, tx?: RepositoryTx): Promise<Narrator> {
    try {
      const [row] = await this.executor(tx)
        .insert(narrator)
        .values({ name: input.name })
        .returning(NARRATOR_COLUMNS);
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new NarratorNameAlreadyInUseError(input.name);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateNarratorInput, tx?: RepositoryTx): Promise<Narrator> {
    try {
      const [row] = await this.executor(tx)
        .update(narrator)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
        })
        .where(and(eq(narrator.id, id), isNull(narrator.deletedAt)))
        .returning(NARRATOR_COLUMNS);

      if (!row) {
        throw new NarratorNotFoundError(id);
      }
      return row;
    } catch (error) {
      if (error instanceof NarratorNotFoundError) {
        throw error;
      }
      if (isUniqueViolation(error) && input.name !== undefined) {
        throw new NarratorNameAlreadyInUseError(input.name);
      }
      throw error;
    }
  }

  async softDelete(id: string, tx?: RepositoryTx): Promise<void> {
    const [row] = await this.executor(tx)
      .update(narrator)
      .set({ deletedAt: new Date() })
      .where(and(eq(narrator.id, id), isNull(narrator.deletedAt)))
      .returning({ id: narrator.id });

    if (!row) {
      throw new NarratorNotFoundError(id);
    }
  }

  async reactivate(id: string, tx?: RepositoryTx): Promise<Narrator> {
    const [row] = await this.executor(tx)
      .update(narrator)
      .set({ deletedAt: null })
      .where(eq(narrator.id, id))
      .returning(NARRATOR_COLUMNS);

    if (!row) {
      throw new NarratorNotFoundError(id);
    }
    return row;
  }

  async delete(id: string, tx?: RepositoryTx): Promise<void> {
    const deleted = await this.executor(tx)
      .delete(narrator)
      .where(eq(narrator.id, id))
      .returning({ id: narrator.id });

    if (deleted.length === 0) {
      throw new NarratorNotFoundError(id);
    }
  }
}
