import type { CreateNarratorInput, Narrator, UpdateNarratorInput } from "@/lib/domain/narrator";
import { NarratorNameAlreadyInUseError, NarratorNotFoundError } from "@/lib/errors/narrator-errors";
import type { NarratorRepository } from "@/lib/repositories/narrator-repository";

interface InternalNarrator extends Narrator {
  readonly deletedAt: Date | null;
}

export class InMemoryNarratorRepository implements NarratorRepository {
  private readonly store = new Map<string, InternalNarrator>();

  async findAll(): Promise<Narrator[]> {
    return Array.from(this.store.values())
      .filter((current) => current.deletedAt === null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(stripDeletedAt);
  }

  async findById(id: string): Promise<Narrator | null> {
    const current = this.store.get(id);
    if (!current || current.deletedAt !== null) {
      return null;
    }
    return stripDeletedAt(current);
  }

  async findByName(name: string): Promise<Narrator | null> {
    const match = this.findActiveByName(name);
    return match ? stripDeletedAt(match) : null;
  }

  async findByNameIncludingDeleted(name: string): Promise<Narrator | null> {
    const lower = name.toLowerCase();
    for (const current of this.store.values()) {
      if (current.name.toLowerCase() === lower) {
        return stripDeletedAt(current);
      }
    }
    return null;
  }

  async create(input: CreateNarratorInput): Promise<Narrator> {
    const name = input.name.trim();
    if (this.findActiveByName(name)) {
      throw new NarratorNameAlreadyInUseError(name);
    }

    const now = new Date();
    const narrator: InternalNarrator = {
      id: crypto.randomUUID(),
      name,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(narrator.id, narrator);
    return stripDeletedAt(narrator);
  }

  async update(id: string, input: UpdateNarratorInput): Promise<Narrator> {
    const existing = this.store.get(id);
    if (!existing || existing.deletedAt !== null) {
      throw new NarratorNotFoundError(id);
    }

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (trimmedName !== existing.name) {
        const duplicate = this.findActiveByName(trimmedName);
        if (duplicate && duplicate.id !== id) {
          throw new NarratorNameAlreadyInUseError(trimmedName);
        }
      }
    }

    const updated: InternalNarrator = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return stripDeletedAt(updated);
  }

  async softDelete(id: string): Promise<void> {
    const existing = this.store.get(id);
    if (!existing || existing.deletedAt !== null) {
      throw new NarratorNotFoundError(id);
    }
    this.store.set(id, { ...existing, deletedAt: new Date(), updatedAt: new Date() });
  }

  async reactivate(id: string): Promise<Narrator> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new NarratorNotFoundError(id);
    }
    const reactivated: InternalNarrator = {
      ...existing,
      deletedAt: null,
      updatedAt: new Date(),
    };
    this.store.set(id, reactivated);
    return stripDeletedAt(reactivated);
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) {
      throw new NarratorNotFoundError(id);
    }
    this.store.delete(id);
  }

  clear(): void {
    this.store.clear();
  }

  private findActiveByName(name: string): InternalNarrator | null {
    const lower = name.toLowerCase();
    for (const current of this.store.values()) {
      if (current.deletedAt === null && current.name.toLowerCase() === lower) {
        return current;
      }
    }
    return null;
  }
}

function stripDeletedAt(current: InternalNarrator): Narrator {
  const { deletedAt: _omit, ...rest } = current;
  return rest;
}
