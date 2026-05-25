# Data Model: Observabilidade em Produção

**Feature**: [029-production-observability](./spec.md) | **Plan**: [plan.md](./plan.md)

Modelo de dados desta feature. Uma única tabela nova (`audit_log`). Sem alteração em tabelas existentes.

## Entidades

### AuditLog

Registro **imutável e write-once** de toda mutação de domínio bem-sucedida e todo evento de autenticação relevante. Único objeto persistente novo desta feature.

#### Schema (Drizzle TypeScript)

```typescript
// src/lib/db/schema/audit-log.ts
import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

    // SEM FK ao user (denormalizado por design — sobrevive a hard-delete LGPD; ver D3)
    userId: uuid("user_id"),

    // Valor do catálogo AUDIT_ACTIONS (ex: "chapter.update", "auth.login.failed")
    action: text("action").notNull(),

    // Categoria da entidade alvo (ex: "chapter", "studio") — null para eventos auth genéricos
    entityType: text("entity_type"),

    // ID da entidade alvo — text (não uuid) por flexibilidade futura (ver D4)
    entityId: text("entity_id"),

    // Header X-Request-Id correspondente (FR-001) — propagado pelo withApiErrorHandler
    requestId: text("request_id").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    // (1) Consulta "ações do usuário X nos últimos N dias"
    index("audit_log_user_created_idx")
      .on(t.userId, t.createdAt.desc())
      .where(sql`${t.userId} IS NOT NULL`),

    // (2) Consulta "ações sobre a entidade <type:id> nos últimos N dias"
    index("audit_log_entity_created_idx").on(t.entityType, t.entityId, t.createdAt.desc()),

    // (3) Correlação por request_id (investigação ponta-a-ponta)
    index("audit_log_request_id_idx").on(t.requestId),

    // (4) BRIN para purge daily — range scan em coluna time-series (D15)
    index("audit_log_created_at_brin_idx").using("brin", t.createdAt),
  ],
);

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
```

#### Migration (SQL gerado por `drizzle-kit generate`)

```sql
CREATE TABLE "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "action" text NOT NULL,
  "entity_type" text,
  "entity_id" text,
  "request_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "audit_log_user_created_idx"
  ON "audit_log" ("user_id", "created_at" DESC)
  WHERE "user_id" IS NOT NULL;

CREATE INDEX "audit_log_entity_created_idx"
  ON "audit_log" ("entity_type", "entity_id", "created_at" DESC);

CREATE INDEX "audit_log_request_id_idx"
  ON "audit_log" ("request_id");

CREATE INDEX "audit_log_created_at_brin_idx"
  ON "audit_log" USING brin ("created_at");
```

Rollback (geração do `down.sql` por `drizzle-kit`):

```sql
DROP INDEX IF EXISTS "audit_log_created_at_brin_idx";
DROP INDEX IF EXISTS "audit_log_request_id_idx";
DROP INDEX IF EXISTS "audit_log_entity_created_idx";
DROP INDEX IF EXISTS "audit_log_user_created_idx";
DROP TABLE IF EXISTS "audit_log";
```

#### Invariantes

| Invariante | Garantia |
|---|---|
| Nenhuma coluna armazena PII direto (IP, UA, email, body, diff) | Teste `audit-log-schema.spec.ts` lista colunas existentes via `information_schema.columns` e falha se aparecer alguma coluna fora da allowlist `[id, user_id, action, entity_type, entity_id, request_id, created_at]`. |
| `action` é valor do catálogo | Tipagem TS força no compile-time. Adicional: teste de integration por service confere que o valor escrito está em `Object.values(AUDIT_ACTIONS)`. |
| Audit é write-once | Repository expõe apenas `insert` e `deleteOlderThan`. Sem método `update`. |
| Audit de mutação de domínio é transacional | `recordWithin(tx, event)` recebe a transação ativa. Rollback da mutação descarta o audit. Teste `audit-service-transactional.spec.ts` força um erro pós-`recordWithin` e verifica que a linha não persiste. |
| Audit não tem `request_id` ausente | NOT NULL no schema. Quando o evento de auth ocorre fora de request HTTP (raro), o service gera um UUID sintético prefixado `"system:"` para preservar coluna NOT NULL e facilitar filtro. |

#### Catálogo de `action` (constante única, fonte da verdade)

```typescript
// src/lib/audit/audit-actions.ts
export const AUDIT_ACTIONS = {
  // Studio
  STUDIO_CREATE: "studio.create",
  STUDIO_UPDATE: "studio.update",
  STUDIO_DELETE: "studio.delete",
  STUDIO_REACTIVATE: "studio.reactivate",

  // Book
  BOOK_CREATE: "book.create",
  BOOK_UPDATE: "book.update",
  BOOK_DELETE: "book.delete",

  // Chapter
  CHAPTER_CREATE: "chapter.create",
  CHAPTER_UPDATE: "chapter.update",
  CHAPTER_DELETE: "chapter.delete",
  CHAPTER_BULK_DELETE: "chapter.bulk_delete",
  CHAPTER_REORDER: "chapter.reorder",
  CHAPTER_STATUS_TRANSITION: "chapter.status.transitioned",

  // Narrator
  NARRATOR_CREATE: "narrator.create",
  NARRATOR_UPDATE: "narrator.update",
  NARRATOR_DELETE: "narrator.delete",
  NARRATOR_REACTIVATE: "narrator.reactivate",

  // Editor
  EDITOR_CREATE: "editor.create",
  EDITOR_UPDATE: "editor.update",
  EDITOR_DELETE: "editor.delete",
  EDITOR_REACTIVATE: "editor.reactivate",

  // Auth
  AUTH_LOGIN_SUCCESS: "auth.login.success",
  AUTH_LOGIN_FAILED: "auth.login.failed",
  AUTH_LOGOUT: "auth.logout",
  AUTH_SIGNUP: "auth.signup",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
```

Total inicial: **22 valores**.

#### Mapeamento mutação → action

Tabela referenciada pelos testes de integration de cada service.

| Service | Método | `action` | `entity_type` | `entity_id` |
|---|---|---|---|---|
| StudioService | `create()` | `studio.create` | `studio` | id criado |
| StudioService | `update()` | `studio.update` | `studio` | id alvo |
| StudioService | `softDelete()` | `studio.delete` | `studio` | id alvo |
| StudioService | `create()` quando reativa | `studio.reactivate` | `studio` | id reativado |
| BookService | `create()` | `book.create` | `book` | id criado |
| BookService | `update()` | `book.update` | `book` | id alvo |
| BookService | `delete()` | `book.delete` | `book` | id alvo |
| ChapterService | `create()` | `chapter.create` | `chapter` | id criado |
| ChapterService | `update()` | `chapter.update` | `chapter` | id alvo |
| ChapterService | `delete()` | `chapter.delete` | `chapter` | id alvo |
| ChapterService | `bulkDelete()` | `chapter.bulk_delete` | `book` | book id (operação composta — agrupada por book) |
| ChapterService | `reorder()` | `chapter.reorder` | `book` | book id |
| ChapterService | `transitionStatus()` | `chapter.status.transitioned` | `chapter` | id alvo |
| NarratorService | `create/update/delete/reactivate` | `narrator.*` | `narrator` | id |
| EditorService | `create/update/delete/reactivate` | `editor.*` | `editor` | id |
| auth callback `signIn` | (success) | `auth.login.success` | `null` | `null` |
| auth callback `signIn` | (failure) | `auth.login.failed` | `null` | `null` |
| auth callback `signOut` | | `auth.logout` | `null` | `null` |
| auth callback `signUp` | | `auth.signup` | `null` | `null` |

**Operações compostas** (ex: `chapter.bulk_delete`, `chapter.reorder`): emitem **uma única linha** com `entity_type=book` + `entity_id=<book_id>` em vez de N linhas por capítulo. Justificativa: representam intenção do usuário no nível do livro, não capítulo. Múltiplas linhas inflariam logs sem ganho de informação.

---

## Operações suportadas (repository contract)

```typescript
// src/lib/repositories/audit-log-repository.ts
import type { NewAuditLog, AuditLog } from "@/lib/db/schema/audit-log";
import type { Transaction } from "@/lib/db";

export interface AuditLogRepository {
  /** Insere uma linha dentro da transação ativa (uso obrigatório para mutações de domínio). */
  insertWithin(tx: Transaction, event: NewAuditLog): Promise<void>;

  /** Insere uma linha em conexão própria (best-effort, usado por callbacks de auth). */
  insert(event: NewAuditLog): Promise<void>;

  /** Apaga linhas com created_at < cutoff. Retorna número de linhas removidas. Idempotente. */
  deleteOlderThan(cutoff: Date): Promise<number>;

  /** Para investigação — lê em ordem cronológica reversa, com paginação. */
  findByUserSince(userId: string, since: Date, limit: number): Promise<readonly AuditLog[]>;
  findByEntity(entityType: string, entityId: string, limit: number): Promise<readonly AuditLog[]>;
  findByRequestId(requestId: string): Promise<readonly AuditLog[]>;
}
```

`findBy*` métodos servem para investigação interna (ferramentas de DB ou script ad-hoc), não para rotas HTTP — não há endpoint público que retorne audit log nesta feature.

---

## Volumetria e custos esperados

| Métrica | Valor estimado |
|---|---|
| Linhas/mês na escala atual (~10 usuários) | 50k – 200k |
| Linhas/mês na escala 5y (~50 usuários) | 250k – 1M |
| Tamanho médio de linha (sem índice) | ≈ 120 bytes |
| Tamanho da tabela em 90 dias (cap. atual) | 50k×3 × 120B = ~18 MB |
| Tamanho dos índices (B-tree compostos + BRIN) | ~12 MB (sobrecarga ~70% sobre tabela) |
| Custo no Supabase free tier | Trivial (free tier = 500 MB) |

Conclusão: zero risco de capacity no horizonte estabelecido.

---

## Mudanças em entidades existentes

**Nenhuma**. Audit log lê informações de mutação **já presentes** no fluxo via `recordWithin(tx, event)` — não modifica schemas de domínio.

`book.status` (cache materializado) continua intacto. Esta feature **não** registra audit para a recomputação automática de `book.status` (não é mutação iniciada por usuário; é efeito colateral idempotente).

---

## Mudanças em env vars (schema Zod)

Adições em `src/lib/env/schema.ts` (validadas por `superRefine` para exigir em produção):

| Env Var | Tipo | Obrigatória em | Onde usada |
|---|---|---|---|
| `SENTRY_DSN` | URL | Produção | Inicialização de `@sentry/nextjs` (server/client/edge) |
| `SENTRY_AUTH_TOKEN` | string (apenas no build) | CI/produção (build) | Plugin de source map upload |
| `SENTRY_ORG` | string | CI/produção (build) | Plugin de source map upload |
| `SENTRY_PROJECT` | string | CI/produção (build) | Plugin de source map upload |
| `CRON_SECRET` | string (≥ 32 chars) | Produção | Autenticação do endpoint `/api/cron/purge-audit-log` |
| `APP_VERSION` | string (opcional) | — | Health endpoint payload + Sentry release tagging |

Em dev/test, `SENTRY_DSN` e `CRON_SECRET` são opcionais. `superRefine` falha se `NODE_ENV=production` e qualquer obrigatória estiver ausente — fail-fast (princípio do `/deployment-patterns`).
