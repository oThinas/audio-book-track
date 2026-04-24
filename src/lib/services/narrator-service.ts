import type { CreateNarratorInput, Narrator, UpdateNarratorInput } from "@/lib/domain/narrator";
import { NarratorLinkedToActiveChaptersError } from "@/lib/errors/narrator-errors";
import type { NarratorRepository } from "@/lib/repositories/narrator-repository";

export interface CreateNarratorResult {
  readonly narrator: Narrator;
  readonly reactivated: boolean;
}

export interface SoftDeleteNarratorDeps {
  /**
   * Placeholder dep — retorna a quantidade de capítulos ativos vinculados ao narrador.
   * Default retorna 0 (nenhum bloqueio). US11 liga à implementação real via chapter/book repos.
   */
  readonly getActiveChaptersCount?: (narratorId: string) => Promise<number>;
}

export class NarratorService {
  constructor(private readonly repository: NarratorRepository) {}

  async list(): Promise<Narrator[]> {
    return this.repository.findAll();
  }

  async create(input: CreateNarratorInput): Promise<CreateNarratorResult> {
    const name = input.name.trim();
    const existing = await this.repository.findByNameIncludingDeleted(name);

    if (existing) {
      const existingIsSoftDeleted = (await this.repository.findById(existing.id)) === null;
      if (!existingIsSoftDeleted) {
        return { narrator: await this.repository.create({ name }), reactivated: false };
      }
      const narrator = await this.repository.reactivate(existing.id);
      return { narrator, reactivated: true };
    }

    const narrator = await this.repository.create({ name });
    return { narrator, reactivated: false };
  }

  async update(id: string, input: UpdateNarratorInput): Promise<Narrator> {
    return this.repository.update(id, input);
  }

  async softDelete(id: string, deps: SoftDeleteNarratorDeps = {}): Promise<void> {
    const activeCount = deps.getActiveChaptersCount ? await deps.getActiveChaptersCount(id) : 0;
    if (activeCount > 0) {
      throw new NarratorLinkedToActiveChaptersError(id, activeCount);
    }
    await this.repository.softDelete(id);
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
