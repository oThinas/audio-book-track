import type { CreateEditorInput, Editor, UpdateEditorInput } from "@/lib/domain/editor";

export interface EditorRepository {
  findAll(): Promise<Editor[]>;
  findById(id: string): Promise<Editor | null>;
  findByName(name: string): Promise<Editor | null>;
  findByEmail(email: string): Promise<Editor | null>;
  create(input: CreateEditorInput): Promise<Editor>;
  update(id: string, input: UpdateEditorInput): Promise<Editor>;
  delete(id: string): Promise<void>;
}
