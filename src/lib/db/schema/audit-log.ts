import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // SEM FK ao user (denormalizado por design — sobrevive a hard-delete LGPD).
    userId: text("user_id"),
    // Valor do catálogo AUDIT_ACTIONS (ex: "chapter.update", "auth.login.failed").
    action: text("action").notNull(),
    // Categoria da entidade alvo (ex: "chapter", "studio") — null para auth genéricos.
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    // Header X-Request-Id correspondente (FR-001) — propagado pelo withApiErrorHandler.
    requestId: text("request_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    // (1) "Ações do usuário X nos últimos N dias"
    index("audit_log_user_created_idx")
      .on(t.userId, t.createdAt.desc())
      .where(sql`${t.userId} IS NOT NULL`),
    // (2) "Ações sobre a entidade <type:id> nos últimos N dias"
    index("audit_log_entity_created_idx").on(t.entityType, t.entityId, t.createdAt.desc()),
    // (3) Correlação por request_id (investigação ponta-a-ponta)
    index("audit_log_request_id_idx").on(t.requestId),
    // (4) BRIN para purge diária — range scan em coluna time-series
    index("audit_log_created_at_brin_idx").using("brin", t.createdAt),
  ],
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
