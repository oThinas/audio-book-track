import type { CreateNarratorInput, Narrator, UpdateNarratorInput } from "@/lib/domain/narrator";
import type { NarratorRepository } from "@/lib/domain/narrator-repository";
import { NarratorNameAlreadyInUseError, NarratorNotFoundError } from "@/lib/errors/narrator-errors";

export class InMemoryNarratorRepository implements NarratorRepository {
  private readonly store = new Map<string, Narrator>();

  async findAll(): Promise<Narrator[]> {
    return Array.from(this.store.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  async findById(id: string): Promise<Narrator | null> {
    return this.store.get(id) ?? null;
  }

  async findByName(name: string): Promise<Narrator | null> {
    for (const narrator of this.store.values()) {
      if (narrator.name === name) {
        return narrator;
      }
    }
    return null;
  }

  async create(input: CreateNarratorInput): Promise<Narrator> {
    const name = input.name.trim();
    const existing = await this.findByName(name);
    if (existing) {
      throw new NarratorNameAlreadyInUseError(name);
    }

    const now = new Date();
    const narrator: Narrator = {
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(narrator.id, narrator);
    return narrator;
  }

  async update(id: string, input: UpdateNarratorInput): Promise<Narrator> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new NarratorNotFoundError(id);
    }

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (trimmedName !== existing.name) {
        const duplicate = await this.findByName(trimmedName);
        if (duplicate && duplicate.id !== id) {
          throw new NarratorNameAlreadyInUseError(trimmedName);
        }
      }
    }

    const updated: Narrator = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return updated;
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
}
