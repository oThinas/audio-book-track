import type { CreateEditorInput, Editor, UpdateEditorInput } from "@/lib/domain/editor";
import { EditorLinkedToActiveChaptersError } from "@/lib/errors/editor-errors";
import type { EditorRepository } from "@/lib/repositories/editor-repository";

export interface CreateEditorResult {
  readonly editor: Editor;
  readonly reactivated: boolean;
}

export interface SoftDeleteEditorDeps {
  /**
   * Placeholder dep — retorna a quantidade de capítulos ativos vinculados ao editor.
   * Default retorna 0 (nenhum bloqueio). US11 liga à implementação real via chapter/book repos.
   */
  readonly getActiveChaptersCount?: (editorId: string) => Promise<number>;
}

export class EditorService {
  constructor(private readonly repository: EditorRepository) {}

  async list(): Promise<Editor[]> {
    return this.repository.findAll();
  }

  async create(input: CreateEditorInput): Promise<CreateEditorResult> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const existing = await this.repository.findByNameIncludingDeleted(name);

    if (existing) {
      const existingIsSoftDeleted = (await this.repository.findById(existing.id)) === null;
      if (!existingIsSoftDeleted) {
        return {
          editor: await this.repository.create({ name, email }),
          reactivated: false,
        };
      }
      // Reativa — email global unique preservado (email original mantido para auditabilidade).
      const editor = await this.repository.reactivate(existing.id);
      return { editor, reactivated: true };
    }

    const editor = await this.repository.create({ name, email });
    return { editor, reactivated: false };
  }

  async update(id: string, input: UpdateEditorInput): Promise<Editor> {
    return this.repository.update(id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
    });
  }

  async softDelete(id: string, deps: SoftDeleteEditorDeps = {}): Promise<void> {
    const activeCount = deps.getActiveChaptersCount ? await deps.getActiveChaptersCount(id) : 0;
    if (activeCount > 0) {
      throw new EditorLinkedToActiveChaptersError(id, activeCount);
    }
    await this.repository.softDelete(id);
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
