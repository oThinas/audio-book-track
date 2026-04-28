import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { book, chapter } from "@/lib/db/schema";
import type { BlockingBookSummary } from "@/lib/errors/studio-errors";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { type SoftDeleteStudioDeps, StudioService } from "@/lib/services/studio-service";

const ACTIVE_CHAPTER_STATUSES = ["pending", "editing", "reviewing", "retake"] as const;

export function createStudioService(): StudioService {
  const repository = new DrizzleStudioRepository(db);
  return new StudioService(repository);
}

export function createGetActiveBooks(): (
  studioId: string,
) => Promise<ReadonlyArray<BlockingBookSummary>> {
  return async (studioId) => {
    const rows = await db
      .selectDistinct({ id: book.id, title: book.title })
      .from(book)
      .innerJoin(chapter, eq(chapter.bookId, book.id))
      .where(and(eq(book.studioId, studioId), inArray(chapter.status, ACTIVE_CHAPTER_STATUSES)));
    return rows;
  };
}

export function createStudioSoftDeleteDeps(): SoftDeleteStudioDeps {
  return { getActiveBooks: createGetActiveBooks() };
}
