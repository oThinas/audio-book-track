import type { CreateEditorInput, Editor, UpdateEditorInput } from "@/lib/domain/editor";
import type { EditorRepository } from "@/lib/domain/editor-repository";

export class EditorService {
  constructor(private readonly repository: EditorRepository) {}

  async list(): Promise<Editor[]> {
    return this.repository.findAll();
  }

  async create(input: CreateEditorInput): Promise<Editor> {
    return this.repository.create({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
    });
  }

  async update(id: string, input: UpdateEditorInput): Promise<Editor> {
    return this.repository.update(id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
    });
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
