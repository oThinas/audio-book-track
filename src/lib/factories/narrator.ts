import { and, eq, exists, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/lib/db";
import { book, chapter } from "@/lib/db/schema";
import type { BlockingBookSummary } from "@/lib/errors/studio-errors";
import { createAuditService } from "@/lib/factories/audit";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { DrizzleUnitOfWork } from "@/lib/repositories/drizzle/drizzle-unit-of-work";
import { NarratorService, type SoftDeleteNarratorDeps } from "@/lib/services/narrator-service";

const ACTIVE_CHAPTER_STATUSES = ["pending", "editing", "reviewing", "retake"] as const;

export function createNarratorService(): NarratorService {
  return new NarratorService(new DrizzleNarratorRepository(db), {
    auditService: createAuditService(),
    uow: new DrizzleUnitOfWork(db),
  });
}

export function createGetActiveBooksForNarrator(): (
  narratorId: string,
) => Promise<ReadonlyArray<BlockingBookSummary>> {
  return async (narratorId) => {
    // Books that (a) contain a chapter from the narrator AND (b) still have
    // at least one chapter in active status (regardless of the narrator).
    const activeChapter = alias(chapter, "active_chapter");

    const rows = await db
      .selectDistinct({ id: book.id, title: book.title })
      .from(book)
      .innerJoin(chapter, eq(chapter.bookId, book.id))
      .where(
        and(
          eq(chapter.narratorId, narratorId),
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

export function createNarratorSoftDeleteDeps(): SoftDeleteNarratorDeps {
  return { getActiveBooks: createGetActiveBooksForNarrator() };
}
