import { asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "@/lib/db/schema";
import { editor } from "@/lib/db/schema";
import type { CreateEditorInput, Editor, UpdateEditorInput } from "@/lib/domain/editor";
import type { EditorRepository } from "@/lib/domain/editor-repository";
import {
  EditorEmailAlreadyInUseError,
  EditorNameAlreadyInUseError,
  EditorNotFoundError,
} from "@/lib/errors/editor-errors";

const EDITOR_COLUMNS = {
  id: editor.id,
  name: editor.name,
  email: editor.email,
  createdAt: editor.createdAt,
  updatedAt: editor.updatedAt,
} as const;

const POSTGRES_UNIQUE_VIOLATION = "23505";
const EDITOR_NAME_CONSTRAINT = "editor_name_unique";
const EDITOR_EMAIL_CONSTRAINT = "editor_email_unique";

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

export class DrizzleEditorRepository implements EditorRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async findAll(): Promise<Editor[]> {
    return this.db.select(EDITOR_COLUMNS).from(editor).orderBy(asc(editor.createdAt));
  }

  async findById(id: string): Promise<Editor | null> {
    const rows = await this.db.select(EDITOR_COLUMNS).from(editor).where(eq(editor.id, id));
    return rows[0] ?? null;
  }

  async findByName(name: string): Promise<Editor | null> {
    const rows = await this.db.select(EDITOR_COLUMNS).from(editor).where(eq(editor.name, name));
    return rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<Editor | null> {
    const rows = await this.db.select(EDITOR_COLUMNS).from(editor).where(eq(editor.email, email));
    return rows[0] ?? null;
  }

  async create(input: CreateEditorInput): Promise<Editor> {
    try {
      const [row] = await this.db
        .insert(editor)
        .values({ name: input.name, email: input.email })
        .returning(EDITOR_COLUMNS);
      return row;
    } catch (error) {
      const constraint = getUniqueConstraintName(error);
      if (constraint === EDITOR_NAME_CONSTRAINT) {
        throw new EditorNameAlreadyInUseError(input.name);
      }
      if (constraint === EDITOR_EMAIL_CONSTRAINT) {
        throw new EditorEmailAlreadyInUseError(input.email);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateEditorInput): Promise<Editor> {
    try {
      const [row] = await this.db
        .update(editor)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
        })
        .where(eq(editor.id, id))
        .returning(EDITOR_COLUMNS);

      if (!row) {
        throw new EditorNotFoundError(id);
      }
      return row;
    } catch (error) {
      if (error instanceof EditorNotFoundError) {
        throw error;
      }
      const constraint = getUniqueConstraintName(error);
      if (constraint === EDITOR_NAME_CONSTRAINT && input.name !== undefined) {
        throw new EditorNameAlreadyInUseError(input.name);
      }
      if (constraint === EDITOR_EMAIL_CONSTRAINT && input.email !== undefined) {
        throw new EditorEmailAlreadyInUseError(input.email);
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.db
      .delete(editor)
      .where(eq(editor.id, id))
      .returning({ id: editor.id });

    if (deleted.length === 0) {
      throw new EditorNotFoundError(id);
    }
  }
}
