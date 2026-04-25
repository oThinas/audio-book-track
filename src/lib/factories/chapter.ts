import { db } from "@/lib/db";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { DrizzleUnitOfWork } from "@/lib/repositories/drizzle/drizzle-unit-of-work";
import { ChapterService } from "@/lib/services/chapter-service";

export function createChapterService(): ChapterService {
  return new ChapterService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    narratorRepo: new DrizzleNarratorRepository(db),
    editorRepo: new DrizzleEditorRepository(db),
    uow: new DrizzleUnitOfWork(db),
  });
}
