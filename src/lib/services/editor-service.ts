import { getCurrentUserId } from "@/lib/api/request-context";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-actions";
import type { CreateEditorInput, Editor, UpdateEditorInput } from "@/lib/domain/editor";
import { EditorLinkedToActiveChaptersError } from "@/lib/errors/editor-errors";
import type { BlockingBookSummary } from "@/lib/errors/studio-errors";
import type { RepositoryTx } from "@/lib/repositories/book-repository";
import type { EditorListItem, EditorRepository } from "@/lib/repositories/editor-repository";
import type { UnitOfWork } from "@/lib/repositories/unit-of-work";
import type { AuditService } from "@/lib/services/audit-service";

export interface CreateEditorResult {
  readonly editor: Editor;
  readonly reactivated: boolean;
}

export interface SoftDeleteEditorDeps {
  readonly getActiveBooks?: (editorId: string) => Promise<ReadonlyArray<BlockingBookSummary>>;
}

export interface EditorServiceOptions {
  readonly auditService?: AuditService;
  readonly uow?: UnitOfWork;
}

const ENTITY_TYPE = "editor";

export class EditorService {
  constructor(
    private readonly repository: EditorRepository,
    private readonly options: EditorServiceOptions = {},
  ) {}

  async list(): Promise<EditorListItem[]> {
    return this.repository.findAllWithCounts();
  }

  async create(input: CreateEditorInput): Promise<CreateEditorResult> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const existing = await this.repository.findByNameIncludingDeleted(name);
    const existingIsSoftDeleted =
      existing !== null && (await this.repository.findById(existing.id)) === null;

    return this.run(async (tx) => {
      if (existing && existingIsSoftDeleted) {
        const editor = await this.repository.reactivate(existing.id, tx);
        await this.recordAudit(tx, AUDIT_ACTIONS.EDITOR_REACTIVATE, editor.id);
        return { editor, reactivated: true };
      }
      const editor = await this.repository.create({ name, email }, tx);
      await this.recordAudit(tx, AUDIT_ACTIONS.EDITOR_CREATE, editor.id);
      return { editor, reactivated: false };
    });
  }

  async update(id: string, input: UpdateEditorInput): Promise<Editor> {
    return this.run(async (tx) => {
      const editor = await this.repository.update(
        id,
        {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
        },
        tx,
      );
      await this.recordAudit(tx, AUDIT_ACTIONS.EDITOR_UPDATE, id);
      return editor;
    });
  }

  async softDelete(id: string, deps: SoftDeleteEditorDeps = {}): Promise<void> {
    const activeBooks = deps.getActiveBooks ? await deps.getActiveBooks(id) : [];
    if (activeBooks.length > 0) {
      throw new EditorLinkedToActiveChaptersError(id, activeBooks);
    }
    await this.run(async (tx) => {
      await this.repository.softDelete(id, tx);
      await this.recordAudit(tx, AUDIT_ACTIONS.EDITOR_DELETE, id);
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
