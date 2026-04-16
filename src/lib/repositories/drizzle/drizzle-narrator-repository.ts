import { asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "@/lib/db/schema";
import { narrator } from "@/lib/db/schema";
import type { CreateNarratorInput, Narrator, UpdateNarratorInput } from "@/lib/domain/narrator";
import type { NarratorRepository } from "@/lib/domain/narrator-repository";
import {
  NarratorEmailAlreadyInUseError,
  NarratorNotFoundError,
} from "@/lib/errors/narrator-errors";

const NARRATOR_COLUMNS = {
  id: narrator.id,
  name: narrator.name,
  email: narrator.email,
  createdAt: narrator.createdAt,
  updatedAt: narrator.updatedAt,
} as const;

const POSTGRES_UNIQUE_VIOLATION = "23505";

function hasUniqueViolationCode(candidate: unknown): boolean {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    "code" in candidate &&
    (candidate as { code: unknown }).code === POSTGRES_UNIQUE_VIOLATION
  );
}

function isUniqueViolation(error: unknown): boolean {
  if (hasUniqueViolationCode(error)) {
    return true;
  }
  if (error instanceof Error && error.cause !== undefined) {
    return hasUniqueViolationCode(error.cause);
  }
  return false;
}

export class DrizzleNarratorRepository implements NarratorRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async findAll(): Promise<Narrator[]> {
    return this.db.select(NARRATOR_COLUMNS).from(narrator).orderBy(asc(narrator.createdAt));
  }

  async findById(id: string): Promise<Narrator | null> {
    const rows = await this.db.select(NARRATOR_COLUMNS).from(narrator).where(eq(narrator.id, id));
    return rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<Narrator | null> {
    const rows = await this.db
      .select(NARRATOR_COLUMNS)
      .from(narrator)
      .where(eq(narrator.email, email));
    return rows[0] ?? null;
  }

  async create(input: CreateNarratorInput): Promise<Narrator> {
    try {
      const [row] = await this.db
        .insert(narrator)
        .values({ name: input.name, email: input.email })
        .returning(NARRATOR_COLUMNS);
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new NarratorEmailAlreadyInUseError(input.email);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateNarratorInput): Promise<Narrator> {
    try {
      const [row] = await this.db
        .update(narrator)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
        })
        .where(eq(narrator.id, id))
        .returning(NARRATOR_COLUMNS);

      if (!row) {
        throw new NarratorNotFoundError(id);
      }
      return row;
    } catch (error) {
      if (error instanceof NarratorNotFoundError) {
        throw error;
      }
      if (isUniqueViolation(error) && input.email !== undefined) {
        throw new NarratorEmailAlreadyInUseError(input.email);
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.db
      .delete(narrator)
      .where(eq(narrator.id, id))
      .returning({ id: narrator.id });

    if (deleted.length === 0) {
      throw new NarratorNotFoundError(id);
    }
  }
}
