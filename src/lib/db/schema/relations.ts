import { relations } from "drizzle-orm";
import { book } from "./book";
import { chapter } from "./chapter";
import { editor } from "./editor";
import { narrator } from "./narrator";
import { studio } from "./studio";

export const bookRelations = relations(book, ({ one, many }) => ({
  studio: one(studio, { fields: [book.studioId], references: [studio.id] }),
  chapters: many(chapter),
}));

export const chapterRelations = relations(chapter, ({ one }) => ({
  book: one(book, { fields: [chapter.bookId], references: [book.id] }),
  narrator: one(narrator, { fields: [chapter.narratorId], references: [narrator.id] }),
  editor: one(editor, { fields: [chapter.editorId], references: [editor.id] }),
}));

export const studioRelations = relations(studio, ({ many }) => ({
  books: many(book),
}));

export const narratorRelations = relations(narrator, ({ many }) => ({
  chapters: many(chapter),
}));

export const editorRelations = relations(editor, ({ many }) => ({
  chapters: many(chapter),
}));
