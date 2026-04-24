import type { CreateStudioInput, Studio, UpdateStudioInput } from "@/lib/domain/studio";
import type { StudioRepository } from "@/lib/domain/studio-repository";
import { StudioNameAlreadyInUseError, StudioNotFoundError } from "@/lib/errors/studio-errors";

export class InMemoryStudioRepository implements StudioRepository {
  private readonly store = new Map<string, Studio>();

  async findAll(): Promise<Studio[]> {
    return Array.from(this.store.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  async findById(id: string): Promise<Studio | null> {
    return this.store.get(id) ?? null;
  }

  async findByName(name: string): Promise<Studio | null> {
    for (const current of this.store.values()) {
      if (current.name === name) {
        return current;
      }
    }
    return null;
  }

  async create(input: CreateStudioInput): Promise<Studio> {
    const name = input.name;

    if (await this.findByName(name)) {
      throw new StudioNameAlreadyInUseError(name);
    }

    const now = new Date();
    const newStudio: Studio = {
      id: crypto.randomUUID(),
      name,
      defaultHourlyRateCents: input.defaultHourlyRateCents,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(newStudio.id, newStudio);
    return newStudio;
  }

  async update(id: string, input: UpdateStudioInput): Promise<Studio> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new StudioNotFoundError(id);
    }

    if (input.name !== undefined && input.name !== existing.name) {
      const duplicate = await this.findByName(input.name);
      if (duplicate && duplicate.id !== id) {
        throw new StudioNameAlreadyInUseError(input.name);
      }
    }

    const updated: Studio = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.defaultHourlyRateCents !== undefined
        ? { defaultHourlyRateCents: input.defaultHourlyRateCents }
        : {}),
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) {
      throw new StudioNotFoundError(id);
    }
    this.store.delete(id);
  }
}
