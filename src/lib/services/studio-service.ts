import type { CreateStudioInput, Studio, UpdateStudioInput } from "@/lib/domain/studio";
import { StudioHasActiveBooksError } from "@/lib/errors/studio-errors";
import type { StudioRepository } from "@/lib/repositories/studio-repository";

export interface CreateStudioOptions {
  readonly inline?: boolean;
}

export interface CreateStudioResult {
  readonly studio: Studio;
  readonly reactivated: boolean;
  readonly rateResetForInline?: boolean;
}

export interface SoftDeleteStudioDeps {
  /**
   * Placeholder dep — retorna a quantidade de livros do estúdio com capítulos ativos.
   * Default retorna 0 (nenhum bloqueio). US10 liga à implementação real via chapter/book repos.
   */
  readonly getActiveBooksCount?: (studioId: string) => Promise<number>;
}

export class StudioService {
  constructor(private readonly repository: StudioRepository) {}

  async list(): Promise<Studio[]> {
    return this.repository.findAll();
  }

  async create(
    input: CreateStudioInput,
    options: CreateStudioOptions = {},
  ): Promise<CreateStudioResult> {
    const name = input.name.trim();
    const existing = await this.repository.findByNameIncludingDeleted(name);

    if (existing) {
      const existingIsSoftDeleted = (await this.repository.findById(existing.id)) === null;
      if (!existingIsSoftDeleted) {
        return {
          studio: await this.repository.create({
            name,
            defaultHourlyRateCents: input.defaultHourlyRateCents,
          }),
          reactivated: false,
        };
      }

      const studio = await this.repository.reactivate(
        existing.id,
        options.inline ? { defaultHourlyRateCents: input.defaultHourlyRateCents } : undefined,
      );
      return {
        studio,
        reactivated: true,
        ...(options.inline ? { rateResetForInline: true } : {}),
      };
    }

    const studio = await this.repository.create({
      name,
      defaultHourlyRateCents: input.defaultHourlyRateCents,
    });
    return { studio, reactivated: false };
  }

  async update(id: string, input: UpdateStudioInput): Promise<Studio> {
    return this.repository.update(id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.defaultHourlyRateCents !== undefined
        ? { defaultHourlyRateCents: input.defaultHourlyRateCents }
        : {}),
    });
  }

  async softDelete(id: string, deps: SoftDeleteStudioDeps = {}): Promise<void> {
    const activeCount = deps.getActiveBooksCount ? await deps.getActiveBooksCount(id) : 0;
    if (activeCount > 0) {
      throw new StudioHasActiveBooksError(id, activeCount);
    }
    await this.repository.softDelete(id);
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
