import { getCurrentUserId } from "@/lib/api/request-context";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-actions";
import type { CreateNarratorInput, Narrator, UpdateNarratorInput } from "@/lib/domain/narrator";
import { NarratorLinkedToActiveChaptersError } from "@/lib/errors/narrator-errors";
import type { BlockingBookSummary } from "@/lib/errors/studio-errors";
import type { RepositoryTx } from "@/lib/repositories/book-repository";
import type { NarratorListItem, NarratorRepository } from "@/lib/repositories/narrator-repository";
import type { UnitOfWork } from "@/lib/repositories/unit-of-work";
import type { AuditService } from "@/lib/services/audit-service";

export interface CreateNarratorResult {
  readonly narrator: Narrator;
  readonly reactivated: boolean;
}

export interface SoftDeleteNarratorDeps {
  readonly getActiveBooks?: (narratorId: string) => Promise<ReadonlyArray<BlockingBookSummary>>;
}

export interface NarratorServiceOptions {
  readonly auditService?: AuditService;
  readonly uow?: UnitOfWork;
}

const ENTITY_TYPE = "narrator";

export class NarratorService {
  constructor(
    private readonly repository: NarratorRepository,
    private readonly options: NarratorServiceOptions = {},
  ) {}

  async list(): Promise<NarratorListItem[]> {
    return this.repository.findAllWithCounts();
  }

  async create(input: CreateNarratorInput): Promise<CreateNarratorResult> {
    const name = input.name.trim();
    const existing = await this.repository.findByNameIncludingDeleted(name);
    const existingIsSoftDeleted =
      existing !== null && (await this.repository.findById(existing.id)) === null;

    return this.run(async (tx) => {
      if (existing && existingIsSoftDeleted) {
        const narrator = await this.repository.reactivate(existing.id, tx);
        await this.recordAudit(tx, AUDIT_ACTIONS.NARRATOR_REACTIVATE, narrator.id);
        return { narrator, reactivated: true };
      }
      const narrator = await this.repository.create({ name }, tx);
      await this.recordAudit(tx, AUDIT_ACTIONS.NARRATOR_CREATE, narrator.id);
      return { narrator, reactivated: false };
    });
  }

  async update(id: string, input: UpdateNarratorInput): Promise<Narrator> {
    return this.run(async (tx) => {
      const narrator = await this.repository.update(id, input, tx);
      await this.recordAudit(tx, AUDIT_ACTIONS.NARRATOR_UPDATE, id);
      return narrator;
    });
  }

  async softDelete(id: string, deps: SoftDeleteNarratorDeps = {}): Promise<void> {
    const activeBooks = deps.getActiveBooks ? await deps.getActiveBooks(id) : [];
    if (activeBooks.length > 0) {
      throw new NarratorLinkedToActiveChaptersError(id, activeBooks);
    }
    await this.run(async (tx) => {
      await this.repository.softDelete(id, tx);
      await this.recordAudit(tx, AUDIT_ACTIONS.NARRATOR_DELETE, id);
    });
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  private async run<T>(operation: (tx: RepositoryTx | undefined) => Promise<T>): Promise<T> {
    if (this.options.uow) {
      return this.options.uow.transaction((tx) => operation(tx));
    }
    return operation(undefined);
  }

  private async recordAudit(
    tx: RepositoryTx | undefined,
    action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
    entityId: string,
  ): Promise<void> {
    if (!this.options.auditService) return;
    await this.options.auditService.recordWithin(tx, {
      action,
      userId: getCurrentUserId(),
      entityType: ENTITY_TYPE,
      entityId,
    });
  }
}
