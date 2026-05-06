import type { CreateEditorInput, Editor, UpdateEditorInput } from "@/lib/domain/editor";
import { EditorLinkedToActiveChaptersError } from "@/lib/errors/editor-errors";
import type { BlockingBookSummary } from "@/lib/errors/studio-errors";
import type { EditorListItem, EditorRepository } from "@/lib/repositories/editor-repository";

export interface CreateEditorResult {
  readonly editor: Editor;
  readonly reactivated: boolean;
}

export interface SoftDeleteEditorDeps {
  /**
   * Returns the list of active books (with at least one chapter in
   * `pending|editing|reviewing|retake`) where the editor has at least one chapter.
   *
   * Default returns [] (no blocking). The production factory wires this to
   * the real implementation via Drizzle JOIN `chapter` × `book` × `chapter`.
   */
  readonly getActiveBooks?: (editorId: string) => Promise<ReadonlyArray<BlockingBookSummary>>;
}

export class EditorService {
  constructor(private readonly repository: EditorRepository) {}

  async list(): Promise<EditorListItem[]> {
    return this.repository.findAllWithCounts();
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
      // Reactivate — global unique email preserved (original email kept for auditability).
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
    const activeBooks = deps.getActiveBooks ? await deps.getActiveBooks(id) : [];
    if (activeBooks.length > 0) {
      throw new EditorLinkedToActiveChaptersError(id, activeBooks);
    }
    await this.repository.softDelete(id);
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
