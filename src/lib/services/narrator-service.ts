import type { CreateNarratorInput, Narrator, UpdateNarratorInput } from "@/lib/domain/narrator";
import { NarratorLinkedToActiveChaptersError } from "@/lib/errors/narrator-errors";
import type { BlockingBookSummary } from "@/lib/errors/studio-errors";
import type { NarratorListItem, NarratorRepository } from "@/lib/repositories/narrator-repository";

export interface CreateNarratorResult {
  readonly narrator: Narrator;
  readonly reactivated: boolean;
}

export interface SoftDeleteNarratorDeps {
  /**
   * Returns the list of active books (with at least one chapter in
   * `pending|editing|reviewing|retake`) where the narrator has at least one chapter.
   *
   * Default returns [] (no blocking). The production factory wires this to
   * the real implementation via Drizzle JOIN `chapter` × `book` × `chapter`.
   */
  readonly getActiveBooks?: (narratorId: string) => Promise<ReadonlyArray<BlockingBookSummary>>;
}

export class NarratorService {
  constructor(private readonly repository: NarratorRepository) {}

  async list(): Promise<NarratorListItem[]> {
    return this.repository.findAllWithCounts();
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
    const activeBooks = deps.getActiveBooks ? await deps.getActiveBooks(id) : [];
    if (activeBooks.length > 0) {
      throw new NarratorLinkedToActiveChaptersError(id, activeBooks);
    }
    await this.repository.softDelete(id);
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
