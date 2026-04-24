import { asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "@/lib/db/schema";
import { studio } from "@/lib/db/schema";
import type { CreateStudioInput, Studio, UpdateStudioInput } from "@/lib/domain/studio";
import type { StudioRepository } from "@/lib/domain/studio-repository";
import { StudioNameAlreadyInUseError, StudioNotFoundError } from "@/lib/errors/studio-errors";

const STUDIO_COLUMNS = {
  id: studio.id,
  name: studio.name,
  defaultHourlyRateCents: studio.defaultHourlyRateCents,
  createdAt: studio.createdAt,
  updatedAt: studio.updatedAt,
} as const;

const POSTGRES_UNIQUE_VIOLATION = "23505";
const STUDIO_NAME_CONSTRAINT = "studio_name_unique_active";

function getUniqueConstraintName(error: unknown): string | null {
  const direct = extractConstraint(error);
  if (direct !== null) {
    return direct;
  }
  if (error instanceof Error && error.cause !== undefined) {
    return extractConstraint(error.cause);
  }
  return null;
}

function extractConstraint(candidate: unknown): string | null {
  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }
  const record = candidate as { code?: unknown; constraint?: unknown };
  if (record.code !== POSTGRES_UNIQUE_VIOLATION) {
    return null;
  }
  return typeof record.constraint === "string" ? record.constraint : null;
}

type DrizzleStudioRow = {
  id: string;
  name: string;
  defaultHourlyRateCents: number;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: DrizzleStudioRow): Studio {
  return {
    id: row.id,
    name: row.name,
    defaultHourlyRateCents: row.defaultHourlyRateCents,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleStudioRepository implements StudioRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async findAll(): Promise<Studio[]> {
    const rows = await this.db.select(STUDIO_COLUMNS).from(studio).orderBy(asc(studio.createdAt));
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Studio | null> {
    const rows = await this.db.select(STUDIO_COLUMNS).from(studio).where(eq(studio.id, id));
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async findByName(name: string): Promise<Studio | null> {
    const rows = await this.db.select(STUDIO_COLUMNS).from(studio).where(eq(studio.name, name));
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async create(input: CreateStudioInput): Promise<Studio> {
    try {
      const [row] = await this.db
        .insert(studio)
        .values({
          name: input.name,
          defaultHourlyRateCents: input.defaultHourlyRateCents,
        })
        .returning(STUDIO_COLUMNS);
      return toDomain(row);
    } catch (error) {
      const constraint = getUniqueConstraintName(error);
      if (constraint === STUDIO_NAME_CONSTRAINT) {
        throw new StudioNameAlreadyInUseError(input.name);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateStudioInput): Promise<Studio> {
    try {
      const [row] = await this.db
        .update(studio)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.defaultHourlyRateCents !== undefined
            ? { defaultHourlyRateCents: input.defaultHourlyRateCents }
            : {}),
        })
        .where(eq(studio.id, id))
        .returning(STUDIO_COLUMNS);

      if (!row) {
        throw new StudioNotFoundError(id);
      }
      return toDomain(row);
    } catch (error) {
      if (error instanceof StudioNotFoundError) {
        throw error;
      }
      const constraint = getUniqueConstraintName(error);
      if (constraint === STUDIO_NAME_CONSTRAINT && input.name !== undefined) {
        throw new StudioNameAlreadyInUseError(input.name);
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.db
      .delete(studio)
      .where(eq(studio.id, id))
      .returning({ id: studio.id });

    if (deleted.length === 0) {
      throw new StudioNotFoundError(id);
    }
  }
}
