import { db } from "@/lib/db";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { EditorService } from "@/lib/services/editor-service";

export function createEditorService(): EditorService {
  const repository = new DrizzleEditorRepository(db);
  return new EditorService(repository);
}
