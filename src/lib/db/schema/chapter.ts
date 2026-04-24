import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { book } from "./book";
import { editor } from "./editor";
import { narrator } from "./narrator";

export const chapter = pgTable(
  "chapter",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bookId: text("book_id")
      .notNull()
      .references(() => book.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    status: text("status", {
      enum: ["pending", "editing", "reviewing", "retake", "completed", "paid"],
    })
      .notNull()
      .default("pending"),
    narratorId: text("narrator_id").references(() => narrator.id, { onDelete: "restrict" }),
    editorId: text("editor_id").references(() => editor.id, { onDelete: "restrict" }),
    editedSeconds: integer("edited_seconds").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("chapter_book_number_unique").on(table.bookId, table.number),
    index("chapter_book_id_idx").on(table.bookId),
    index("chapter_narrator_id_idx")
      .on(table.narratorId)
      .where(sql`${table.narratorId} IS NOT NULL`),
    index("chapter_editor_id_idx").on(table.editorId).where(sql`${table.editorId} IS NOT NULL`),
    index("chapter_book_status_idx").on(table.bookId, table.status),
    check("chapter_number_positive", sql`${table.number} >= 1`),
    check(
      "chapter_edited_seconds_range",
      sql`${table.editedSeconds} >= 0 AND ${table.editedSeconds} <= 3600000`,
    ),
  ],
);
