import { sql } from "drizzle-orm";
import { check, index, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { studio } from "./studio";

export const book = pgTable(
  "book",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    studioId: text("studio_id")
      .notNull()
      .references(() => studio.id, { onDelete: "restrict" }),
    pricePerHour: numeric("price_per_hour", { precision: 10, scale: 2 }).notNull(),
    pdfUrl: text("pdf_url"),
    status: text("status", {
      enum: ["pending", "editing", "reviewing", "retake", "completed", "paid"],
    })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("book_studio_id_idx").on(table.studioId),
    uniqueIndex("book_title_studio_unique").on(sql`lower(${table.title})`, table.studioId),
    index("book_created_at_idx").on(table.createdAt),
    check(
      "book_price_per_hour_range",
      sql`${table.pricePerHour} >= 0.01 AND ${table.pricePerHour} <= 9999.99`,
    ),
    check(
      "book_pdf_url_format",
      sql`${table.pdfUrl} IS NULL OR (length(${table.pdfUrl}) <= 2048 AND ${table.pdfUrl} ~* '^https?://')`,
    ),
  ],
);
