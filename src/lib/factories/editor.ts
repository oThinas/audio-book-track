import { and, eq, exists, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/lib/db";
import { book, chapter } from "@/lib/db/schema";
import type { BlockingBookSummary } from "@/lib/errors/studio-errors";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { EditorService, type SoftDeleteEditorDeps } from "@/lib/services/editor-service";

const ACTIVE_CHAPTER_STATUSES = ["pending", "editing", "reviewing", "retake"] as const;

export function createEditorService(): EditorService {
  const repository = new DrizzleEditorRepository(db);
  return new EditorService(repository);
}

export function createGetActiveBooksForEditor(): (
  editorId: string,
) => Promise<ReadonlyArray<BlockingBookSummary>> {
  return async (editorId) => {
    // Livros que (a) contêm um capítulo do editor E (b) ainda têm
    // ao menos um capítulo em status ativo (independente do editor).
    const activeChapter = alias(chapter, "active_chapter");

    const rows = await db
      .selectDistinct({ id: book.id, title: book.title })
      .from(book)
      .innerJoin(chapter, eq(chapter.bookId, book.id))
      .where(
        and(
          eq(chapter.editorId, editorId),
          exists(
            db
              .select({ id: activeChapter.id })
              .from(activeChapter)
              .where(
                and(
                  eq(activeChapter.bookId, book.id),
                  inArray(activeChapter.status, ACTIVE_CHAPTER_STATUSES),
                ),
              ),
          ),
        ),
      );
    return rows;
  };
}

export function createEditorSoftDeleteDeps(): SoftDeleteEditorDeps {
  return { getActiveBooks: createGetActiveBooksForEditor() };
}
