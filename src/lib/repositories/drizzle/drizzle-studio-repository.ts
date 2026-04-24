import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getUniqueConstraintName } from "@/lib/db/postgres-errors";
import type * as schema from "@/lib/db/schema";
import { studio } from "@/lib/db/schema";
import type { CreateStudioInput, Studio, UpdateStudioInput } from "@/lib/domain/studio";
import { StudioNameAlreadyInUseError, StudioNotFoundError } from "@/lib/errors/studio-errors";
import type { RepositoryTx } from "@/lib/repositories/book-repository";
import type {
  ReactivateStudioOverrides,
  StudioRepository,
} from "@/lib/repositories/studio-repository";

type Executor = NodePgDatabase<typeof schema>;

const STUDIO_COLUMNS = {
  id: studio.id,
  name: studio.name,
  defaultHourlyRateCents: studio.defaultHourlyRateCents,
  createdAt: studio.createdAt,
  updatedAt: studio.updatedAt,
} as const;

const STUDIO_NAME_CONSTRAINT = "studio_name_unique_active";

type StudioRow = {
  id: string;
  name: string;
  defaultHourlyRateCents: number;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: StudioRow): Studio {
  return {
    id: row.id,
    name: row.name,
    defaultHourlyRateCents: row.defaultHourlyRateCents,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleStudioRepository implements StudioRepository {
  constructor(private readonly db: Executor) {}

  private executor(tx?: RepositoryTx): Executor {
    return (tx as Executor | undefined) ?? this.db;
  }

  async findAll(): Promise<Studio[]> {
    const rows = await this.db
      .select(STUDIO_COLUMNS)
      .from(studio)
      .where(isNull(studio.deletedAt))
      .orderBy(asc(studio.createdAt));
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Studio | null> {
    const rows = await this.db
      .select(STUDIO_COLUMNS)
      .from(studio)
      .where(and(eq(studio.id, id), isNull(studio.deletedAt)));
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async findByIdIncludingDeleted(id: string): Promise<Studio | null> {
    const rows = await this.db.select(STUDIO_COLUMNS).from(studio).where(eq(studio.id, id));
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async findByName(name: string): Promise<Studio | null> {
    const rows = await this.db
      .select(STUDIO_COLUMNS)
      .from(studio)
      .where(and(sql`lower(${studio.name}) = lower(${name})`, isNull(studio.deletedAt)));
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async findByNameIncludingDeleted(name: string): Promise<Studio | null> {
    const rows = await this.db
      .select(STUDIO_COLUMNS)
      .from(studio)
      .where(sql`lower(${studio.name}) = lower(${name})`);
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async create(input: CreateStudioInput, tx?: RepositoryTx): Promise<Studio> {
    try {
      const [row] = await this.executor(tx)
        .insert(studio)
        .values({
          name: input.name,
          defaultHourlyRateCents: input.defaultHourlyRateCents,
        })
        .returning(STUDIO_COLUMNS);
      return toDomain(row);
    } catch (error) {
      if (getUniqueConstraintName(error) === STUDIO_NAME_CONSTRAINT) {
        throw new StudioNameAlreadyInUseError(input.name);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateStudioInput, tx?: RepositoryTx): Promise<Studio> {
    try {
      const [row] = await this.executor(tx)
        .update(studio)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.defaultHourlyRateCents !== undefined
            ? { defaultHourlyRateCents: input.defaultHourlyRateCents }
            : {}),
        })
        .where(and(eq(studio.id, id), isNull(studio.deletedAt)))
        .returning(STUDIO_COLUMNS);

      if (!row) {
        throw new StudioNotFoundError(id);
      }
      return toDomain(row);
    } catch (error) {
      if (error instanceof StudioNotFoundError) {
        throw error;
      }
      if (getUniqueConstraintName(error) === STUDIO_NAME_CONSTRAINT && input.name !== undefined) {
        throw new StudioNameAlreadyInUseError(input.name);
      }
      throw error;
    }
  }

  async softDelete(id: string, tx?: RepositoryTx): Promise<void> {
    const [row] = await this.executor(tx)
      .update(studio)
      .set({ deletedAt: new Date() })
      .where(and(eq(studio.id, id), isNull(studio.deletedAt)))
      .returning({ id: studio.id });

    if (!row) {
      throw new StudioNotFoundError(id);
    }
  }

  async reactivate(
    id: string,
    overrides?: ReactivateStudioOverrides,
    tx?: RepositoryTx,
  ): Promise<Studio> {
    const [row] = await this.executor(tx)
      .update(studio)
      .set({
        deletedAt: null,
        ...(overrides?.defaultHourlyRateCents !== undefined
          ? { defaultHourlyRateCents: overrides.defaultHourlyRateCents }
          : {}),
      })
      .where(eq(studio.id, id))
      .returning(STUDIO_COLUMNS);

    if (!row) {
      throw new StudioNotFoundError(id);
    }
    return toDomain(row);
  }

  async delete(id: string, tx?: RepositoryTx): Promise<void> {
    const deleted = await this.executor(tx)
      .delete(studio)
      .where(eq(studio.id, id))
      .returning({ id: studio.id });

    if (deleted.length === 0) {
      throw new StudioNotFoundError(id);
    }
  }
}
