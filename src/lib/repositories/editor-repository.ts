import type { CreateEditorInput, Editor, UpdateEditorInput } from "@/lib/domain/editor";

import type { RepositoryTx } from "./book-repository";

export interface ReactivateEditorOverrides {
  readonly email?: string;
}

export interface EditorRepository {
  findAll(): Promise<Editor[]>;
  findById(id: string): Promise<Editor | null>;
  findByName(name: string): Promise<Editor | null>;
  findByNameIncludingDeleted(name: string): Promise<Editor | null>;
  findByEmail(email: string): Promise<Editor | null>;
  create(input: CreateEditorInput, tx?: RepositoryTx): Promise<Editor>;
  update(id: string, input: UpdateEditorInput, tx?: RepositoryTx): Promise<Editor>;
  softDelete(id: string, tx?: RepositoryTx): Promise<void>;
  reactivate(id: string, overrides?: ReactivateEditorOverrides, tx?: RepositoryTx): Promise<Editor>;
  delete(id: string, tx?: RepositoryTx): Promise<void>;
}
