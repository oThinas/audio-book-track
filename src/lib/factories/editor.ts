import { and, eq, exists, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/lib/db";
import { book, chapter } from "@/lib/db/schema";
import type { BlockingBookSummary } from "@/lib/errors/studio-errors";
import { createAuditService } from "@/lib/factories/audit";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleUnitOfWork } from "@/lib/repositories/drizzle/drizzle-unit-of-work";
import { EditorService, type SoftDeleteEditorDeps } from "@/lib/services/editor-service";

const ACTIVE_CHAPTER_STATUSES = ["pending", "editing", "reviewing", "retake"] as const;

export function createEditorService(): EditorService {
  return new EditorService(new DrizzleEditorRepository(db), {
    auditService: createAuditService(),
    uow: new DrizzleUnitOfWork(db),
  });
}

export function createGetActiveBooksForEditor(): (
  editorId: string,
) => Promise<ReadonlyArray<BlockingBookSummary>> {
  return async (editorId) => {
    // Books that (a) contain a chapter from the editor AND (b) still have
    // at least one chapter in active status (regardless of the editor).
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
