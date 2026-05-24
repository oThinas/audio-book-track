import { getCurrentUserId } from "@/lib/api/request-context";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-actions";
import type { CreateStudioInput, Studio, UpdateStudioInput } from "@/lib/domain/studio";
import { type BlockingBookSummary, StudioHasActiveBooksError } from "@/lib/errors/studio-errors";
import type { RepositoryTx } from "@/lib/repositories/book-repository";
import type {
  StudioListItem,
  StudioListOptions,
  StudioRepository,
} from "@/lib/repositories/studio-repository";
import type { UnitOfWork } from "@/lib/repositories/unit-of-work";
import type { AuditService } from "@/lib/services/audit-service";

export interface CreateStudioOptions {
  readonly inline?: boolean;
}

export interface CreateStudioResult {
  readonly studio: Studio;
  readonly reactivated: boolean;
  readonly rateResetForInline?: boolean;
}

export interface SoftDeleteStudioDeps {
  readonly getActiveBooks?: (studioId: string) => Promise<ReadonlyArray<BlockingBookSummary>>;
}

export interface StudioServiceOptions {
  readonly auditService?: AuditService;
  readonly uow?: UnitOfWork;
}

const ENTITY_TYPE = "studio";

export class StudioService {
  constructor(
    private readonly repository: StudioRepository,
    private readonly options: StudioServiceOptions = {},
  ) {}

  async list(options?: StudioListOptions): Promise<StudioListItem[]> {
    return this.repository.findAllWithCounts(options);
  }

  async create(
    input: CreateStudioInput,
    options: CreateStudioOptions = {},
  ): Promise<CreateStudioResult> {
    const name = input.name.trim();
    const existing = await this.repository.findByNameIncludingDeleted(name);
    const existingIsSoftDeleted =
      existing !== null && (await this.repository.findById(existing.id)) === null;

    return this.run(async (tx) => {
      if (existing && existingIsSoftDeleted) {
        const studio = await this.repository.reactivate(
          existing.id,
          options.inline ? { defaultHourlyRateCents: input.defaultHourlyRateCents } : undefined,
          tx,
        );
        await this.recordAudit(tx, AUDIT_ACTIONS.STUDIO_REACTIVATE, studio.id);
        return {
          studio,
          reactivated: true,
          ...(options.inline ? { rateResetForInline: true } : {}),
        };
      }
      const studio = await this.repository.create(
        { name, defaultHourlyRateCents: input.defaultHourlyRateCents },
        tx,
      );
      await this.recordAudit(tx, AUDIT_ACTIONS.STUDIO_CREATE, studio.id);
      return { studio, reactivated: false };
    });
  }

  async update(id: string, input: UpdateStudioInput): Promise<Studio> {
    return this.run(async (tx) => {
      const studio = await this.repository.update(
        id,
        {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.defaultHourlyRateCents !== undefined
            ? { defaultHourlyRateCents: input.defaultHourlyRateCents }
            : {}),
        },
        tx,
      );
      await this.recordAudit(tx, AUDIT_ACTIONS.STUDIO_UPDATE, id);
      return studio;
    });
  }

  async softDelete(id: string, deps: SoftDeleteStudioDeps = {}): Promise<void> {
    const activeBooks = deps.getActiveBooks ? await deps.getActiveBooks(id) : [];
    if (activeBooks.length > 0) {
      throw new StudioHasActiveBooksError(id, activeBooks);
    }
    await this.run(async (tx) => {
      await this.repository.softDelete(id, tx);
      await this.recordAudit(tx, AUDIT_ACTIONS.STUDIO_DELETE, id);
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
