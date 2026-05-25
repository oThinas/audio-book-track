import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // No FK to user (denormalized by design — survives LGPD hard-delete).
    userId: text("user_id"),
    // Value from the AUDIT_ACTIONS catalog (e.g. "chapter.update", "auth.login.failed").
    action: text("action").notNull(),
    // Target entity category (e.g. "chapter", "studio") — null for generic auth events.
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    // Matching X-Request-Id header (FR-001) — propagated by withApiErrorHandler.
    requestId: text("request_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    // (1) "Actions by user X over the last N days"
    index("audit_log_user_created_idx")
      .on(t.userId, t.createdAt.desc())
      .where(sql`${t.userId} IS NOT NULL`),
    // (2) "Actions on entity <type:id> over the last N days"
    index("audit_log_entity_created_idx").on(t.entityType, t.entityId, t.createdAt.desc()),
    // (3) Correlation by request_id (end-to-end investigation)
    index("audit_log_request_id_idx").on(t.requestId),
    // (4) BRIN for daily purge — range scan over a time-series column
    index("audit_log_created_at_brin_idx").using("brin", t.createdAt),
  ],
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
