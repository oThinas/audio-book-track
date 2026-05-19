import { sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
    title: text("title").notNull(),
    position: integer("position").notNull(),
    status: text("status", {
      enum: ["pending", "editing", "reviewing", "retake", "completed", "paid"],
    })
      .notNull()
      .default("pending"),
    narratorId: text("narrator_id").references(() => narrator.id, { onDelete: "restrict" }),
    editorId: text("editor_id").references(() => editor.id, { onDelete: "restrict" }),
    editedSeconds: integer("edited_seconds").notNull().default(0),
    deadline: date("deadline", { mode: "string" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [
    index("chapter_book_id_idx").on(table.bookId),
    index("chapter_book_position_idx").on(table.bookId, table.position),
    index("chapter_narrator_id_idx")
      .on(table.narratorId)
      .where(sql`${table.narratorId} IS NOT NULL`),
    index("chapter_editor_id_idx").on(table.editorId).where(sql`${table.editorId} IS NOT NULL`),
    index("chapter_book_status_idx").on(table.bookId, table.status),
    index("chapter_deadline_active_idx")
      .on(table.deadline)
      .where(sql`${table.deadline} IS NOT NULL`),
    index("chapter_completed_at_idx")
      .on(table.completedAt)
      .where(sql`${table.completedAt} IS NOT NULL`),
    index("chapter_paid_at_idx").on(table.paidAt).where(sql`${table.paidAt} IS NOT NULL`),
    check("chapter_title_length", sql`length(${table.title}) <= 100`),
    check("chapter_title_no_newline", sql`${table.title} !~ E'[\\n\\r]'`),
    check("chapter_position_nonnegative", sql`${table.position} >= 0`),
    check(
      "chapter_edited_seconds_range",
      sql`${table.editedSeconds} >= 0 AND ${table.editedSeconds} <= 3600000`,
    ),
  ],
);
