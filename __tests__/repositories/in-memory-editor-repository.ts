import type { CreateEditorInput, Editor, UpdateEditorInput } from "@/lib/domain/editor";
import {
  EditorEmailAlreadyInUseError,
  EditorNameAlreadyInUseError,
  EditorNotFoundError,
} from "@/lib/errors/editor-errors";
import type {
  EditorRepository,
  ReactivateEditorOverrides,
} from "@/lib/repositories/editor-repository";

interface InternalEditor extends Editor {
  readonly deletedAt: Date | null;
}

export class InMemoryEditorRepository implements EditorRepository {
  private readonly store = new Map<string, InternalEditor>();

  async findAll(): Promise<Editor[]> {
    return Array.from(this.store.values())
      .filter((current) => current.deletedAt === null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(stripDeletedAt);
  }

  async findById(id: string): Promise<Editor | null> {
    const current = this.store.get(id);
    if (!current || current.deletedAt !== null) {
      return null;
    }
    return stripDeletedAt(current);
  }

  async findByName(name: string): Promise<Editor | null> {
    const match = this.findActiveByName(name);
    return match ? stripDeletedAt(match) : null;
  }

  async findByNameIncludingDeleted(name: string): Promise<Editor | null> {
    const lower = name.toLowerCase();
    for (const current of this.store.values()) {
      if (current.name.toLowerCase() === lower) {
        return stripDeletedAt(current);
      }
    }
    return null;
  }

  async findByEmail(email: string): Promise<Editor | null> {
    for (const current of this.store.values()) {
      if (current.email === email) {
        return stripDeletedAt(current);
      }
    }
    return null;
  }

  async create(input: CreateEditorInput): Promise<Editor> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();

    if (this.findActiveByName(name)) {
      throw new EditorNameAlreadyInUseError(name);
    }
    if (this.findAnyByEmail(email)) {
      throw new EditorEmailAlreadyInUseError(email);
    }

    const now = new Date();
    const newEditor: InternalEditor = {
      id: crypto.randomUUID(),
      name,
      email,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(newEditor.id, newEditor);
    return stripDeletedAt(newEditor);
  }

  async update(id: string, input: UpdateEditorInput): Promise<Editor> {
    const existing = this.store.get(id);
    if (!existing || existing.deletedAt !== null) {
      throw new EditorNotFoundError(id);
    }

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (trimmedName !== existing.name) {
        const duplicate = this.findActiveByName(trimmedName);
        if (duplicate && duplicate.id !== id) {
          throw new EditorNameAlreadyInUseError(trimmedName);
        }
      }
    }

    if (input.email !== undefined) {
      const normalizedEmail = input.email.trim().toLowerCase();
      if (normalizedEmail !== existing.email) {
        const duplicate = this.findAnyByEmail(normalizedEmail);
        if (duplicate && duplicate.id !== id) {
          throw new EditorEmailAlreadyInUseError(normalizedEmail);
        }
      }
    }

    const updated: InternalEditor = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      email: input.email !== undefined ? input.email.trim().toLowerCase() : existing.email,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return stripDeletedAt(updated);
  }

  async softDelete(id: string): Promise<void> {
    const existing = this.store.get(id);
    if (!existing || existing.deletedAt !== null) {
      throw new EditorNotFoundError(id);
    }
    this.store.set(id, { ...existing, deletedAt: new Date(), updatedAt: new Date() });
  }

  async reactivate(id: string, overrides?: ReactivateEditorOverrides): Promise<Editor> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new EditorNotFoundError(id);
    }

    if (overrides?.email !== undefined) {
      const normalizedEmail = overrides.email.trim().toLowerCase();
      if (normalizedEmail !== existing.email) {
        const duplicate = this.findAnyByEmail(normalizedEmail);
        if (duplicate && duplicate.id !== id) {
          throw new EditorEmailAlreadyInUseError(normalizedEmail);
        }
      }
    }

    const reactivated: InternalEditor = {
      ...existing,
      deletedAt: null,
      ...(overrides?.email !== undefined ? { email: overrides.email.trim().toLowerCase() } : {}),
      updatedAt: new Date(),
    };
    this.store.set(id, reactivated);
    return stripDeletedAt(reactivated);
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) {
      throw new EditorNotFoundError(id);
    }
    this.store.delete(id);
  }

  clear(): void {
    this.store.clear();
  }

  private findActiveByName(name: string): InternalEditor | null {
    const lower = name.toLowerCase();
    for (const current of this.store.values()) {
      if (current.deletedAt === null && current.name.toLowerCase() === lower) {
        return current;
      }
    }
    return null;
  }

  private findAnyByEmail(email: string): InternalEditor | null {
    for (const current of this.store.values()) {
      if (current.email === email) {
        return current;
      }
    }
    return null;
  }
}

function stripDeletedAt(current: InternalEditor): Editor {
  const { deletedAt: _omit, ...rest } = current;
  return rest;
}
