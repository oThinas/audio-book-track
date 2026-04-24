import type { CreateEditorInput, Editor, UpdateEditorInput } from "@/lib/domain/editor";
import {
  EditorEmailAlreadyInUseError,
  EditorNameAlreadyInUseError,
  EditorNotFoundError,
} from "@/lib/errors/editor-errors";
import type { EditorRepository } from "@/lib/repositories/editor-repository";

export class InMemoryEditorRepository implements EditorRepository {
  private readonly store = new Map<string, Editor>();

  async findAll(): Promise<Editor[]> {
    return Array.from(this.store.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  async findById(id: string): Promise<Editor | null> {
    return this.store.get(id) ?? null;
  }

  async findByName(name: string): Promise<Editor | null> {
    for (const current of this.store.values()) {
      if (current.name === name) {
        return current;
      }
    }
    return null;
  }

  async findByEmail(email: string): Promise<Editor | null> {
    for (const current of this.store.values()) {
      if (current.email === email) {
        return current;
      }
    }
    return null;
  }

  async create(input: CreateEditorInput): Promise<Editor> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();

    if (await this.findByName(name)) {
      throw new EditorNameAlreadyInUseError(name);
    }
    if (await this.findByEmail(email)) {
      throw new EditorEmailAlreadyInUseError(email);
    }

    const now = new Date();
    const newEditor: Editor = {
      id: crypto.randomUUID(),
      name,
      email,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(newEditor.id, newEditor);
    return newEditor;
  }

  async update(id: string, input: UpdateEditorInput): Promise<Editor> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new EditorNotFoundError(id);
    }

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (trimmedName !== existing.name) {
        const duplicate = await this.findByName(trimmedName);
        if (duplicate && duplicate.id !== id) {
          throw new EditorNameAlreadyInUseError(trimmedName);
        }
      }
    }

    if (input.email !== undefined) {
      const normalizedEmail = input.email.trim().toLowerCase();
      if (normalizedEmail !== existing.email) {
        const duplicate = await this.findByEmail(normalizedEmail);
        if (duplicate && duplicate.id !== id) {
          throw new EditorEmailAlreadyInUseError(normalizedEmail);
        }
      }
    }

    const updated: Editor = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      email: input.email !== undefined ? input.email.trim().toLowerCase() : existing.email,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return updated;
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
}
