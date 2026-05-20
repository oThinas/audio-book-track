import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { DashboardWidgetKey } from "@/lib/domain/dashboard-widget";
import { user } from "./auth";

const DEFAULT_DASHBOARD_WIDGETS_SQL = sql`'["a-receber-agora","receita-periodo","ticket-medio","ranking-estudio","ranking-narrador","ranking-editor","funil-status","atrasados","grafico-receita"]'::jsonb`;

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
    dashboardWidgets: jsonb("dashboard_widgets")
      .$type<DashboardWidgetKey[]>()
      .notNull()
      .default(DEFAULT_DASHBOARD_WIDGETS_SQL),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [uniqueIndex("user_preference_user_id_idx").on(table.userId)],
);
