import type { CreateStudioInput, Studio, UpdateStudioInput } from "@/lib/domain/studio";
import { StudioNameAlreadyInUseError, StudioNotFoundError } from "@/lib/errors/studio-errors";
import type {
  ReactivateStudioOverrides,
  StudioRepository,
} from "@/lib/repositories/studio-repository";

interface InternalStudio extends Studio {
  readonly deletedAt: Date | null;
}

export class InMemoryStudioRepository implements StudioRepository {
  private readonly store = new Map<string, InternalStudio>();

  async findAll(): Promise<Studio[]> {
    return Array.from(this.store.values())
      .filter((current) => current.deletedAt === null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(stripDeletedAt);
  }

  async findById(id: string): Promise<Studio | null> {
    const current = this.store.get(id);
    if (!current || current.deletedAt !== null) {
      return null;
    }
    return stripDeletedAt(current);
  }

  async findByName(name: string): Promise<Studio | null> {
    const match = this.findActiveByName(name);
    return match ? stripDeletedAt(match) : null;
  }

  async findByNameIncludingDeleted(name: string): Promise<Studio | null> {
    const lower = name.toLowerCase();
    for (const current of this.store.values()) {
      if (current.name.toLowerCase() === lower) {
        return stripDeletedAt(current);
      }
    }
    return null;
  }

  async create(input: CreateStudioInput): Promise<Studio> {
    if (this.findActiveByName(input.name)) {
      throw new StudioNameAlreadyInUseError(input.name);
    }

    const now = new Date();
    const newStudio: InternalStudio = {
      id: crypto.randomUUID(),
      name: input.name,
      defaultHourlyRateCents: input.defaultHourlyRateCents,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(newStudio.id, newStudio);
    return stripDeletedAt(newStudio);
  }

  async update(id: string, input: UpdateStudioInput): Promise<Studio> {
    const existing = this.store.get(id);
    if (!existing || existing.deletedAt !== null) {
      throw new StudioNotFoundError(id);
    }

    if (input.name !== undefined && input.name !== existing.name) {
      const duplicate = this.findActiveByName(input.name);
      if (duplicate && duplicate.id !== id) {
        throw new StudioNameAlreadyInUseError(input.name);
      }
    }

    const updated: InternalStudio = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.defaultHourlyRateCents !== undefined
        ? { defaultHourlyRateCents: input.defaultHourlyRateCents }
        : {}),
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return stripDeletedAt(updated);
  }

  async softDelete(id: string): Promise<void> {
    const existing = this.store.get(id);
    if (!existing || existing.deletedAt !== null) {
      throw new StudioNotFoundError(id);
    }
    this.store.set(id, { ...existing, deletedAt: new Date(), updatedAt: new Date() });
  }

  async reactivate(id: string, overrides?: ReactivateStudioOverrides): Promise<Studio> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new StudioNotFoundError(id);
    }
    const reactivated: InternalStudio = {
      ...existing,
      deletedAt: null,
      ...(overrides?.defaultHourlyRateCents !== undefined
        ? { defaultHourlyRateCents: overrides.defaultHourlyRateCents }
        : {}),
      updatedAt: new Date(),
    };
    this.store.set(id, reactivated);
    return stripDeletedAt(reactivated);
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) {
      throw new StudioNotFoundError(id);
    }
    this.store.delete(id);
  }

  private findActiveByName(name: string): InternalStudio | null {
    const lower = name.toLowerCase();
    for (const current of this.store.values()) {
      if (current.deletedAt === null && current.name.toLowerCase() === lower) {
        return current;
      }
    }
    return null;
  }
}

function stripDeletedAt(current: InternalStudio): Studio {
  const { deletedAt: _omit, ...rest } = current;
  return rest;
}
