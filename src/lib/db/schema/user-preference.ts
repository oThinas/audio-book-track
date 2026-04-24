import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const userPreference = pgTable(
  "user_preference",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    theme: text("theme", { enum: ["light", "dark", "system"] })
      .notNull()
      .default("system"),
    fontSize: text("font_size", { enum: ["small", "medium", "large"] })
      .notNull()
      .default("medium"),
    primaryColor: text("primary_color", {
      enum: ["blue", "orange", "green", "red", "amber"],
    })
      .notNull()
      .default("blue"),
    favoritePage: text("favorite_page", {
      enum: ["dashboard", "books", "studios", "editors", "narrators", "settings"],
    })
      .notNull()
      .default("dashboard"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("user_preference_user_id_idx").on(table.userId)],
);
