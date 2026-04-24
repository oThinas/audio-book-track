import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getUniqueConstraintName } from "@/lib/db/postgres-errors";
import type * as schema from "@/lib/db/schema";
import { editor } from "@/lib/db/schema";
import type { CreateEditorInput, Editor, UpdateEditorInput } from "@/lib/domain/editor";
import {
  EditorEmailAlreadyInUseError,
  EditorNameAlreadyInUseError,
  EditorNotFoundError,
} from "@/lib/errors/editor-errors";
import type { RepositoryTx } from "@/lib/repositories/book-repository";
import type {
  EditorRepository,
  ReactivateEditorOverrides,
} from "@/lib/repositories/editor-repository";

type Executor = NodePgDatabase<typeof schema>;

const EDITOR_COLUMNS = {
  id: editor.id,
  name: editor.name,
  email: editor.email,
  createdAt: editor.createdAt,
  updatedAt: editor.updatedAt,
} as const;

const EDITOR_NAME_CONSTRAINT = "editor_name_unique_active";
const EDITOR_EMAIL_CONSTRAINT = "editor_email_unique";

export class DrizzleEditorRepository implements EditorRepository {
  constructor(private readonly db: Executor) {}

  private executor(tx?: RepositoryTx): Executor {
    return (tx as Executor | undefined) ?? this.db;
  }

  async findAll(): Promise<Editor[]> {
    return this.db
      .select(EDITOR_COLUMNS)
      .from(editor)
      .where(isNull(editor.deletedAt))
      .orderBy(asc(editor.createdAt));
  }

  async findById(id: string): Promise<Editor | null> {
    const rows = await this.db
      .select(EDITOR_COLUMNS)
      .from(editor)
      .where(and(eq(editor.id, id), isNull(editor.deletedAt)));
    return rows[0] ?? null;
  }

  async findByName(name: string): Promise<Editor | null> {
    const rows = await this.db
      .select(EDITOR_COLUMNS)
      .from(editor)
      .where(and(sql`lower(${editor.name}) = lower(${name})`, isNull(editor.deletedAt)));
    return rows[0] ?? null;
  }

  async findByNameIncludingDeleted(name: string): Promise<Editor | null> {
    const rows = await this.db
      .select(EDITOR_COLUMNS)
      .from(editor)
      .where(sql`lower(${editor.name}) = lower(${name})`);
    return rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<Editor | null> {
    const rows = await this.db.select(EDITOR_COLUMNS).from(editor).where(eq(editor.email, email));
    return rows[0] ?? null;
  }

  async create(input: CreateEditorInput, tx?: RepositoryTx): Promise<Editor> {
    try {
      const [row] = await this.executor(tx)
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

  async update(id: string, input: UpdateEditorInput, tx?: RepositoryTx): Promise<Editor> {
    try {
      const [row] = await this.executor(tx)
        .update(editor)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
        })
        .where(and(eq(editor.id, id), isNull(editor.deletedAt)))
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

  async softDelete(id: string, tx?: RepositoryTx): Promise<void> {
    const [row] = await this.executor(tx)
      .update(editor)
      .set({ deletedAt: new Date() })
      .where(and(eq(editor.id, id), isNull(editor.deletedAt)))
      .returning({ id: editor.id });

    if (!row) {
      throw new EditorNotFoundError(id);
    }
  }

  async reactivate(
    id: string,
    overrides?: ReactivateEditorOverrides,
    tx?: RepositoryTx,
  ): Promise<Editor> {
    try {
      const [row] = await this.executor(tx)
        .update(editor)
        .set({
          deletedAt: null,
          ...(overrides?.email !== undefined ? { email: overrides.email } : {}),
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
      if (
        getUniqueConstraintName(error) === EDITOR_EMAIL_CONSTRAINT &&
        overrides?.email !== undefined
      ) {
        throw new EditorEmailAlreadyInUseError(overrides.email);
      }
      throw error;
    }
  }

  async delete(id: string, tx?: RepositoryTx): Promise<void> {
    const deleted = await this.executor(tx)
      .delete(editor)
      .where(eq(editor.id, id))
      .returning({ id: editor.id });

    if (deleted.length === 0) {
      throw new EditorNotFoundError(id);
    }
  }
}
