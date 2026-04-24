import { sql } from "drizzle-orm";
import { index, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const studio = pgTable(
  "studio",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    defaultHourlyRate: numeric("default_hourly_rate", { precision: 10, scale: 2 }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("studio_name_unique_active")
      .on(sql`lower(${table.name})`)
      .where(sql`${table.deletedAt} IS NULL`),
    index("studio_deleted_at_idx").on(table.deletedAt).where(sql`${table.deletedAt} IS NOT NULL`),
  ],
);
