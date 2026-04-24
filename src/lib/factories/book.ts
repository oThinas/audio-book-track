import { db } from "@/lib/db";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { BookService } from "@/lib/services/book-service";

export function createBookService(): BookService {
  return new BookService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    studioRepo: new DrizzleStudioRepository(db),
  });
}
