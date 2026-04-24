# Data Model: CRUD de Livros e Capítulos

**Feature**: 020-books-chapters-crud
**Date**: 2026-04-23
**Stage**: Phase 1 — modelo físico e invariantes

Este documento descreve o modelo físico PostgreSQL que suporta a feature. É a base para: (i) migrations Drizzle; (ii) repositories; (iii) testes de integração; (iv) contratos de API. Todo valor entre aspas é SQL PostgreSQL real.

**Convenção de nomenclatura**: nomes de tabela, coluna e valor de enum no banco são **em inglês**. Labels/strings exibidas ao usuário (português brasileiro) são resolvidas na camada de apresentação (componentes React), nunca no banco nem na API. Tradução canônica de status:

| Status (DB / API) | Rótulo UI (pt-BR) |
|---|---|
| `pending` | Pendente |
| `editing` | Em edição |
| `reviewing` | Em revisão |
| `retake` | Retake |
| `completed` | Concluído |
| `paid` | Pago |

---

## 1. Resumo das mudanças

### Tabelas novas

- `book` — um livro por produtor.
- `chapter` — N capítulos por livro.

### Tabelas alteradas (migrations aditivas)

- `studio` — adiciona `deleted_at timestamptz NULL` + substitui índice único byte-exato por índice case-insensitive parcial.
- `narrator` — adiciona `deleted_at timestamptz NULL` + mesma mudança de índice.
- `editor` — adiciona `deleted_at timestamptz NULL` + mesma mudança de índice. (O índice de `email` continua igual.)

### Tabelas não afetadas

- `user`, `session`, `account`, `verification`, `user_preference` — intocadas.

### Refatoração de código-fonte (sem impacto em dados)

- `src/lib/db/schema.ts` é quebrado em `src/lib/db/schema/<entidade>.ts` + `index.ts`. Nenhum rename de coluna/tabela. Migrations existentes permanecem válidas.

---

## 2. Tabela `book`

```sql
CREATE TABLE book (
  id                    text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title                 text NOT NULL,
  studio_id             text NOT NULL REFERENCES studio (id) ON DELETE RESTRICT,
  price_per_hour_cents  integer NOT NULL CHECK (price_per_hour_cents >= 1 AND price_per_hour_cents <= 999999),
  pdf_url               text NULL CHECK (pdf_url IS NULL OR (length(pdf_url) <= 2048 AND pdf_url ~* '^https?://')),
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'editing', 'reviewing', 'retake', 'completed', 'paid')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX book_studio_id_idx ON book (studio_id);
CREATE UNIQUE INDEX book_title_studio_unique ON book (lower(title), studio_id);
CREATE INDEX book_created_at_idx ON book (created_at DESC);
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | `text` | Sim | UUID gerado pelo PostgreSQL. |
| `title` | `text` | Sim | Título do livro. Normalizado via `trim()` no application layer. |
| `studio_id` | `text` FK→studio | Sim | Livro sempre pertence a um estúdio ativo (veja regra de desarquive). |
| `price_per_hour_cents` | `integer` | Sim | Preço por hora de edição **em centavos**, faixa `[1, 999999]` — equivalente a `R$ 0,01` a `R$ 9.999,99` (Princípio XI + FR-010). |
| `pdf_url` | `text` | Não | URL do PDF original; deve começar com `http://`/`https://`. |
| `status` | `text` | Sim (default `pending`) | Cache materializado do status agregado (ver seção 4). |
| `created_at` | `timestamptz` | Sim | Preenchido automaticamente. |
| `updated_at` | `timestamptz` | Sim | Atualizado via `onUpdateNow()` do Drizzle. |

### Constraints e invariantes

- **Unicidade de título por estúdio**: `UNIQUE (lower(title), studio_id)` aplica case-insensitive. Títulos iguais em estúdios distintos são permitidos (A4).
- **`price_per_hour_cents` dentro da faixa** validada via CHECK no banco (`integer` cents) e Zod na API (`int` ≥ 1, ≤ 999999).
- **`pdf_url` com prefixo `http://` ou `https://`** validada via regex no CHECK e Zod.
- **Invariante de domínio (código)**: todo livro persistido tem ≥ 1 capítulo. Enforcement:
  - Criação via service: transação que cria o livro também cria ≥ 1 capítulo em `chapter`.
  - Exclusão via service: quando o último capítulo é removido, o livro é removido na mesma transação (ON DELETE CASCADE em `chapter.book_id` + service checking `COUNT(*)`).
- **`status` é derivado**: nunca atualizado diretamente por API; apenas pelo service `recomputeBookStatus(bookId, tx)`.

### Relacionamentos

- `book.studio_id` → `studio.id` (N:1).
- `chapter.book_id` → `book.id` (1:N, com `ON DELETE CASCADE`).
- Referências futuras (fora do escopo): relatórios agregados de ganho.

---

## 3. Tabela `chapter`

```sql
CREATE TABLE chapter (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  book_id         text NOT NULL REFERENCES book (id) ON DELETE CASCADE,
  number          integer NOT NULL CHECK (number >= 1),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'editing', 'reviewing', 'retake', 'completed', 'paid')),
  narrator_id     text NULL REFERENCES narrator (id) ON DELETE RESTRICT,
  editor_id       text NULL REFERENCES editor (id) ON DELETE RESTRICT,
  edited_seconds  integer NOT NULL DEFAULT 0
                  CHECK (edited_seconds >= 0 AND edited_seconds <= 3600000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX chapter_book_number_unique ON chapter (book_id, number);
CREATE INDEX chapter_book_id_idx ON chapter (book_id);
CREATE INDEX chapter_narrator_id_idx ON chapter (narrator_id) WHERE narrator_id IS NOT NULL;
CREATE INDEX chapter_editor_id_idx ON chapter (editor_id) WHERE editor_id IS NOT NULL;
CREATE INDEX chapter_book_status_idx ON chapter (book_id, status);
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | `text` | Sim | UUID. |
| `book_id` | `text` FK→book | Sim | Capítulo pertence a um livro. Cascade no delete. |
| `number` | `integer` | Sim | Número do capítulo dentro do livro. Único por livro. |
| `status` | `text` | Sim (default `pending`) | Status operacional do capítulo. |
| `narrator_id` | `text` FK→narrator | Não (nullable) | Narrador atribuído. Obrigatório para sair de `pending`. |
| `editor_id` | `text` FK→editor | Não (nullable) | Editor atribuído. Obrigatório para sair de `editing`. |
| `edited_seconds` | `integer` | Sim (default 0) | Tempo de edição registrado **em segundos**, faixa `[0, 3600000]` (até 1000 horas). Obrigatório `> 0` para sair de `editing`. |
| `created_at`, `updated_at` | `timestamptz` | Sim | Timestamps. |

> ℹ️ Sobre KPIs de produção: o KPI 4 do Princípio XIII (constitution v2.13.0) é "Minutagem média por capítulo" = `AVG(chapter.edited_seconds) / 60` sobre capítulos com status ∈ {`reviewing`, `retake`, `completed`, `paid`}. Nenhum campo adicional (`num_pages`, `duration_minutes`, etc.) é necessário — `edited_seconds` já é coletado em US5 desta feature e é suficiente para alimentar o KPI em feature futura.

### Constraints e invariantes

- `UNIQUE (book_id, number)` — números únicos dentro do livro.
- `number` **nunca é reindexado** após exclusão (rastreabilidade histórica, A2). Novos capítulos recebem `MAX(number) + 1`.
- Machine state enforcement é no service (`isValidTransition(from, to, ctx)`), não no CHECK do banco — regras dependem de `narrator_id`, `editor_id`, `edited_seconds`.
- `narrator_id` e `editor_id` nullable porque um capítulo nasce em `pending` sem atribuição.
- FK `ON DELETE RESTRICT`: na prática, nunca dispara, porque narrador/editor usam soft-delete.

### Máquina de estados (ref. FR-025)

```text
pending   ──narrator attribuído──▶ editing
editing   ──editor + edited_seconds > 0──▶ reviewing
reviewing ──────────────────────▶ retake      (reprovação opcional)
retake    ──────────────────────▶ reviewing   (após nova edição)
reviewing ──────────────────────▶ completed   (aprovação)
completed ──────────────────────▶ paid
paid      ──confirmReversion=true──▶ completed (única reversão permitida; FR-026)
```

Qualquer outra transição → `422 INVALID_STATUS_TRANSITION`.

### Imutabilidade parcial em `paid`

- Enquanto `status = 'paid'`:
  - `narrator_id`, `editor_id`, `edited_seconds`: rejeitados em PATCH com `409 CHAPTER_PAID_LOCKED`.
  - `status`: aceito **apenas** valor `completed` **e somente se** payload contém `confirmReversion: true`; caso contrário `422 REVERSION_CONFIRMATION_REQUIRED`.
  - DELETE rejeitado com `409 CHAPTER_PAID_LOCKED`.

---

## 4. Cache materializado `book.status`

Helper puro de domínio (`src/lib/domain/book-status.ts`):

```ts
export type BookStatus =
  | "pending"
  | "editing"
  | "reviewing"
  | "retake"
  | "completed"
  | "paid";

export function computeBookStatus(chapters: Array<{ status: BookStatus }>): BookStatus {
  if (chapters.length === 0) {
    throw new Error("computeBookStatus: invariante violada — livro sem capítulos.");
  }
  if (chapters.every((c) => c.status === "paid")) return "paid";
  if (
    chapters.every((c) => c.status === "completed" || c.status === "paid") &&
    chapters.some((c) => c.status === "completed")
  ) {
    return "completed";
  }
  if (chapters.some((c) => c.status === "reviewing" || c.status === "retake")) return "reviewing";
  if (chapters.some((c) => c.status === "editing")) return "editing";
  return "pending";
}
```

Service wrapper (`src/lib/services/book-status-recompute.ts`):

```ts
export async function recomputeBookStatus(
  bookId: string,
  tx: DrizzleTransaction,
  bookRepo: BookRepository,
  chapterRepo: ChapterRepository,
): Promise<BookStatus> {
  const chapters = await chapterRepo.listByBookId(bookId, tx);
  const nextStatus = computeBookStatus(chapters);
  await bookRepo.updateStatus(bookId, nextStatus, tx);
  return nextStatus;
}
```

Chamado obrigatoriamente após:
- Criação do livro com N capítulos (status final inicial = `pending`).
- PATCH de capítulo (status change, narrador, editor, segundos editados).
- DELETE individual de capítulo (antes do cascade-delete do livro se aplicável).
- Bulk delete de capítulos.
- Aumento de capítulos via `PATCH /books/:id`.

---

## 5. Tabelas alteradas — `studio`, `narrator`, `editor`

Migração aditiva (SQL conceitual; gerada via `drizzle-kit generate`):

```sql
-- Soft-delete columns
ALTER TABLE studio   ADD COLUMN deleted_at timestamptz NULL;
ALTER TABLE narrator ADD COLUMN deleted_at timestamptz NULL;
ALTER TABLE editor   ADD COLUMN deleted_at timestamptz NULL;

-- Replace byte-exact unique indexes with case-insensitive partial indexes
DROP INDEX studio_name_unique;
CREATE UNIQUE INDEX studio_name_unique_active
  ON studio (lower(name)) WHERE deleted_at IS NULL;

DROP INDEX narrator_name_unique;
CREATE UNIQUE INDEX narrator_name_unique_active
  ON narrator (lower(name)) WHERE deleted_at IS NULL;

DROP INDEX editor_name_unique;
CREATE UNIQUE INDEX editor_name_unique_active
  ON editor (lower(name)) WHERE deleted_at IS NULL;
-- editor_email_unique permanece como está (emails únicos globalmente).

-- Supporting indexes for deleted_at predicates
CREATE INDEX studio_deleted_at_idx   ON studio   (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX narrator_deleted_at_idx ON narrator (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX editor_deleted_at_idx   ON editor   (deleted_at) WHERE deleted_at IS NOT NULL;
```

### Semântica de `deleted_at`

- `deleted_at IS NULL`: registro **ativo** — aparece em listagens, seletores, contagens.
- `deleted_at IS NOT NULL`: registro **soft-deleted** — filtrado fora de toda UI, mas FKs continuam resolvendo nomes em capítulos históricos.

### Desarquive automático (ver research §3)

Implementado no service layer de cada entidade (`studio-service.ts`, `narrator-service.ts`, `editor-service.ts`):

```ts
async create(input: CreateStudioInput, tx: DrizzleTransaction): Promise<CreateResult> {
  // Primeiro: verificar colisão com soft-deleted
  const existing = await this.repo.findByNameIncludingDeleted(input.name, tx);
  if (existing?.deleted_at !== null) {
    // Reativar
    await this.repo.update(existing.id, { deletedAt: null, ...maybeInlineDefaults }, tx);
    return { studio: existing, reactivated: true };
  }
  if (existing?.deleted_at === null) {
    throw new ConflictError("NAME_ALREADY_IN_USE");
  }
  // Caso contrário: inserir normalmente
  const created = await this.repo.insert(input, tx);
  return { studio: created, reactivated: false };
}
```

### Efeito nas colunas derivadas

- Listagem `/studios` filtra `WHERE deleted_at IS NULL`.
- COUNT de "Livros" em `/studios`: `LEFT JOIN book ON book.studio_id = studio.id` agrupado; estúdios soft-deleted nem sequer entram na tabela exibida, então não somam.
- COUNT de "Capítulos" em `/narrators`/`/editors`: `LEFT JOIN chapter ...` filtrando narrador/editor não-soft-deleted na projeção principal.

---

## 6. Drizzle schema por entidade

Estrutura final em `src/lib/db/schema/`:

```text
src/lib/db/schema/
├── index.ts           # barrel: export * from "./auth"; export * from "./user-preference"; ...
├── auth.ts            # user, session, account, verification (movidos sem alteração)
├── user-preference.ts # userPreference (movido)
├── studio.ts          # studio + deleted_at
├── narrator.ts        # narrator + deleted_at
├── editor.ts          # editor + deleted_at
├── book.ts            # NOVO
└── chapter.ts         # NOVO
```

Exemplo `src/lib/db/schema/book.ts`:

```ts
import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { studio } from "./studio";

export const book = pgTable(
  "book",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    studioId: text("studio_id")
      .notNull()
      .references(() => studio.id, { onDelete: "restrict" }),
    pricePerHourCents: integer("price_per_hour_cents").notNull(),
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
      "book_price_per_hour_cents_range",
      sql`${table.pricePerHourCents} >= 1 AND ${table.pricePerHourCents} <= 999999`,
    ),
    check(
      "book_pdf_url_format",
      sql`${table.pdfUrl} IS NULL OR (length(${table.pdfUrl}) <= 2048 AND ${table.pdfUrl} ~* '^https?://')`,
    ),
  ],
);
```

Exemplo `src/lib/db/schema/chapter.ts`:

```ts
import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { book } from "./book";
import { editor } from "./editor";
import { narrator } from "./narrator";

export const chapter = pgTable(
  "chapter",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
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
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("chapter_book_number_unique").on(table.bookId, table.number),
    index("chapter_book_id_idx").on(table.bookId),
    index("chapter_narrator_id_idx").on(table.narratorId).where(sql`${table.narratorId} IS NOT NULL`),
    index("chapter_editor_id_idx").on(table.editorId).where(sql`${table.editorId} IS NOT NULL`),
    index("chapter_book_status_idx").on(table.bookId, table.status),
    check("chapter_number_positive", sql`${table.number} >= 1`),
    check(
      "chapter_edited_seconds_range",
      sql`${table.editedSeconds} >= 0 AND ${table.editedSeconds} <= 3600000`,
    ),
  ],
);
```

---

## 7. Relações Drizzle (`relations()`)

Definidas em `src/lib/db/schema/relations.ts`:

```ts
import { relations } from "drizzle-orm";
import { book } from "./book";
import { chapter } from "./chapter";
import { studio } from "./studio";
import { narrator } from "./narrator";
import { editor } from "./editor";

export const bookRelations = relations(book, ({ one, many }) => ({
  studio: one(studio, { fields: [book.studioId], references: [studio.id] }),
  chapters: many(chapter),
}));

export const chapterRelations = relations(chapter, ({ one }) => ({
  book: one(book, { fields: [chapter.bookId], references: [book.id] }),
  narrator: one(narrator, { fields: [chapter.narratorId], references: [narrator.id] }),
  editor: one(editor, { fields: [chapter.editorId], references: [editor.id] }),
}));
```

---

## 8. Fórmula de ganho total (on-read)

**Não** há coluna persistida para `book.total_earnings_cents` — Princípio II exige cálculo auditável e determinístico, recomputado em leitura. A fórmula é integer-cents per-row e somada no banco, para manter paridade 1:1 com o helper TypeScript `computeEarnings(editedSeconds, pricePerHourCents)`:

```sql
-- ganho por livro (centavos)
SELECT COALESCE(
         SUM(
           ROUND((ch.edited_seconds::numeric * b.price_per_hour_cents) / 3600)
         )::bigint,
         0
       ) AS total_earnings_cents
FROM book b
JOIN chapter ch ON ch.book_id = b.id
WHERE b.id = :bookId;
```

Para a listagem `/books` (todos os livros com seus totais):

```sql
SELECT b.id, b.title, b.studio_id, b.price_per_hour_cents, b.pdf_url, b.status, b.created_at, b.updated_at,
       COALESCE(
         SUM(
           ROUND((ch.edited_seconds::numeric * b.price_per_hour_cents) / 3600)
         )::bigint,
         0
       ) AS total_earnings_cents,
       COUNT(ch.id) FILTER (WHERE ch.status IN ('completed', 'paid')) AS completed_chapters,
       COUNT(ch.id) AS total_chapters
FROM book b
LEFT JOIN chapter ch ON ch.book_id = b.id
GROUP BY b.id
ORDER BY b.created_at DESC;
```

O cast `::numeric` evita overflow de `integer × integer` (produto pode ultrapassar 2³¹ mesmo para valores válidos). `ROUND` do PostgreSQL usa half-away-from-zero para numéricos não-negativos, espelhando `Math.round` do JS nesse domínio. Selecionar colunas específicas; **proibido** `SELECT *`.

---

## 9. Resumo de invariantes (para validar em testes)

| # | Invariante | Enforcement |
|---|------------|-------------|
| I1 | Todo livro tem ≥ 1 capítulo | Service layer (criação + cascade de exclusão) |
| I2 | `book.status` = `computeBookStatus(chapters)` em qualquer snapshot | `recomputeBookStatus` chamado após toda mutação |
| I3 | `number` único por `book_id` | `UNIQUE (book_id, number)` |
| I4 | Títulos únicos por estúdio (case-insensitive) | `UNIQUE (lower(title), studio_id)` |
| I5 | Nenhum narrador/editor/estúdio ativo com mesmo nome | `UNIQUE (lower(name)) WHERE deleted_at IS NULL` |
| I6 | `price_per_hour_cents ∈ [1, 999999]` | CHECK no banco + Zod |
| I7 | `edited_seconds ∈ [0, 3600000]` | CHECK + Zod |
| I8 | Capítulo `paid` imutável exceto status reversível com flag | Service layer + API `confirmReversion` flag |
| I9 | Nenhuma operação multi-tabela fora de transação | Service usa `db.transaction(tx => ...)` |
| I10 | `pdf_url` formato HTTP(S) ou NULL | CHECK + Zod |

Todos terão pelo menos 1 teste de integração validando o caminho feliz + 1 caminho de erro.
