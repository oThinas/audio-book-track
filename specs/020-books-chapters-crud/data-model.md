# Data Model: CRUD de Livros e Capítulos

**Feature**: 020-books-chapters-crud
**Date**: 2026-04-23
**Stage**: Phase 1 — modelo físico e invariantes

Este documento descreve o modelo físico PostgreSQL que suporta a feature. É a base para: (i) migrations Drizzle; (ii) repositories; (iii) testes de integração; (iv) contratos de API. Todo valor entre aspas é SQL PostgreSQL real.

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
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title           text NOT NULL,
  studio_id       text NOT NULL REFERENCES studio (id) ON DELETE RESTRICT,
  price_per_hour  numeric(10, 2) NOT NULL CHECK (price_per_hour >= 0.01 AND price_per_hour <= 9999.99),
  pdf_url         text NULL CHECK (pdf_url IS NULL OR (length(pdf_url) <= 2048 AND pdf_url ~* '^https?://')),
  status          text NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'em_edicao', 'em_revisao', 'edicao_retake', 'concluido', 'pago')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
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
| `price_per_hour` | `numeric(10,2)` | Sim | Preço por hora de edição, faixa `[0.01, 9999.99]` (constituição + FR-010). |
| `pdf_url` | `text` | Não | URL do PDF original; deve começar com `http://`/`https://`. |
| `status` | `text` | Sim (default `pendente`) | Cache materializado do status agregado (ver seção 4). |
| `created_at` | `timestamptz` | Sim | Preenchido automaticamente. |
| `updated_at` | `timestamptz` | Sim | Atualizado via `onUpdateNow()` do Drizzle. |

### Constraints e invariantes

- **Unicidade de título por estúdio**: `UNIQUE (lower(title), studio_id)` aplica case-insensitive. Títulos iguais em estúdios distintos são permitidos (A4).
- **`price_per_hour` dentro da faixa** validada via CHECK no banco e Zod na API.
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
  numero          integer NOT NULL CHECK (numero >= 1),
  status          text NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'em_edicao', 'em_revisao', 'edicao_retake', 'concluido', 'pago')),
  narrator_id     text NULL REFERENCES narrator (id) ON DELETE RESTRICT,
  editor_id       text NULL REFERENCES editor (id) ON DELETE RESTRICT,
  horas_editadas  numeric(5, 2) NOT NULL DEFAULT 0
                  CHECK (horas_editadas >= 0 AND horas_editadas <= 999.99),
  num_paginas     integer NOT NULL DEFAULT 0 CHECK (num_paginas >= 0),  -- mantido no schema (Princípio XIII), não exposto nesta feature
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX chapter_book_numero_unique ON chapter (book_id, numero);
CREATE INDEX chapter_book_id_idx ON chapter (book_id);
CREATE INDEX chapter_narrator_id_idx ON chapter (narrator_id) WHERE narrator_id IS NOT NULL;
CREATE INDEX chapter_editor_id_idx ON chapter (editor_id) WHERE editor_id IS NOT NULL;
CREATE INDEX chapter_status_idx ON chapter (book_id, status);
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | `text` | Sim | UUID. |
| `book_id` | `text` FK→book | Sim | Capítulo pertence a um livro. Cascade no delete. |
| `numero` | `integer` | Sim | Número do capítulo dentro do livro. Único por livro. |
| `status` | `text` | Sim (default `pendente`) | Status operacional do capítulo. |
| `narrator_id` | `text` FK→narrator | Não (nullable) | Narrador atribuído. Obrigatório para sair de `pendente`. |
| `editor_id` | `text` FK→editor | Não (nullable) | Editor atribuído. Obrigatório para sair de `em_edicao`. |
| `horas_editadas` | `numeric(5,2)` | Sim (default 0) | Horas de edição registradas. Obrigatório `> 0` para sair de `em_edicao`. |
| `num_paginas` | `integer` | Sim (default 0) | **Preservado no schema** por Princípio XIII/KPI 4; não editável nesta feature (clarificação Q6). |
| `created_at`, `updated_at` | `timestamptz` | Sim | Timestamps. |

### Constraints e invariantes

- `UNIQUE (book_id, numero)` — números únicos dentro do livro.
- `numero` **nunca é reindexado** após exclusão (rastreabilidade histórica, A2). Novos capítulos recebem `MAX(numero) + 1`.
- Machine state enforcement é no service (`isValidTransition(from, to, ctx)`), não no CHECK do banco — regras dependem de `narrator_id`, `editor_id`, `horas_editadas`.
- `narrator_id` e `editor_id` nullable porque um capítulo nasce em `pendente` sem atribuição.
- FK `ON DELETE RESTRICT`: na prática, nunca dispara, porque narrador/editor usam soft-delete.

### Máquina de estados (ref. FR-025)

```text
pendente ──narrator attribuído──▶ em_edicao
em_edicao ──editor + horas > 0──▶ em_revisao
em_revisao ────────────────────▶ edicao_retake  (reprovação opcional)
edicao_retake ─────────────────▶ em_revisao     (após nova edição)
em_revisao ────────────────────▶ concluido      (aprovação)
concluido ─────────────────────▶ pago
pago ──confirmReversion=true──▶ concluido      (única reversão permitida; FR-026)
```

Qualquer outra transição → `422 INVALID_STATUS_TRANSITION`.

### Imutabilidade parcial em `pago`

- Enquanto `status = 'pago'`:
  - `narrator_id`, `editor_id`, `horas_editadas`, `num_paginas`: rejeitados em PATCH com `409 CHAPTER_PAID_LOCKED`.
  - `status`: aceito **apenas** valor `concluido` **e somente se** payload contém `confirmReversion: true`; caso contrário `422 REVERSION_CONFIRMATION_REQUIRED`.
  - DELETE rejeitado com `409 CHAPTER_PAID_LOCKED`.

---

## 4. Cache materializado `book.status`

Helper puro de domínio (`src/lib/domain/book-status.ts`):

```ts
export type BookStatus = "pendente" | "em_edicao" | "em_revisao" | "edicao_retake" | "concluido" | "pago";

export function computeBookStatus(chapters: Array<{ status: BookStatus }>): BookStatus {
  if (chapters.length === 0) {
    throw new Error("computeBookStatus: invariante violada — livro sem capítulos.");
  }
  if (chapters.every((c) => c.status === "pago")) return "pago";
  if (chapters.every((c) => c.status === "concluido" || c.status === "pago")
      && chapters.some((c) => c.status === "concluido")) return "concluido";
  if (chapters.some((c) => c.status === "em_revisao" || c.status === "edicao_retake")) return "em_revisao";
  if (chapters.some((c) => c.status === "em_edicao")) return "em_edicao";
  return "pendente";
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
- Criação do livro com N capítulos (status final inicial = `pendente`).
- PATCH de capítulo (status change, narrador, editor, horas).
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
import { check, index, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { studio } from "./studio";

export const book = pgTable(
  "book",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    studioId: text("studio_id")
      .notNull()
      .references(() => studio.id, { onDelete: "restrict" }),
    pricePerHour: numeric("price_per_hour", { precision: 10, scale: 2 }).notNull(),
    pdfUrl: text("pdf_url"),
    status: text("status", {
      enum: ["pendente", "em_edicao", "em_revisao", "edicao_retake", "concluido", "pago"],
    })
      .notNull()
      .default("pendente"),
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
    check("book_price_per_hour_range", sql`${table.pricePerHour} >= 0.01 AND ${table.pricePerHour} <= 9999.99`),
    check("book_pdf_url_format", sql`${table.pdfUrl} IS NULL OR (length(${table.pdfUrl}) <= 2048 AND ${table.pdfUrl} ~* '^https?://')`),
  ],
);
```

Exemplo `src/lib/db/schema/chapter.ts`:

```ts
import { check, index, integer, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { book } from "./book";
import { narrator } from "./narrator";
import { editor } from "./editor";

export const chapter = pgTable(
  "chapter",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    bookId: text("book_id")
      .notNull()
      .references(() => book.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    status: text("status", {
      enum: ["pendente", "em_edicao", "em_revisao", "edicao_retake", "concluido", "pago"],
    })
      .notNull()
      .default("pendente"),
    narratorId: text("narrator_id").references(() => narrator.id, { onDelete: "restrict" }),
    editorId: text("editor_id").references(() => editor.id, { onDelete: "restrict" }),
    horasEditadas: numeric("horas_editadas", { precision: 5, scale: 2 }).notNull().default("0"),
    numPaginas: integer("num_paginas").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("chapter_book_numero_unique").on(table.bookId, table.numero),
    index("chapter_book_id_idx").on(table.bookId),
    index("chapter_narrator_id_idx").on(table.narratorId),
    index("chapter_editor_id_idx").on(table.editorId),
    index("chapter_book_status_idx").on(table.bookId, table.status),
    check("chapter_numero_positive", sql`${table.numero} >= 1`),
    check("chapter_horas_range", sql`${table.horasEditadas} >= 0 AND ${table.horasEditadas} <= 999.99`),
    check("chapter_num_paginas_non_negative", sql`${table.numPaginas} >= 0`),
  ],
);
```

---

## 7. Relações Drizzle (`relations()`)

Definidas em `src/lib/db/schema/index.ts` ou arquivo dedicado:

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

**Não** há coluna persistida para `book.total_earnings` — Princípio II exige cálculo auditável e determinístico, recomputado em leitura:

```sql
SELECT COALESCE(SUM(ch.horas_editadas * b.price_per_hour), 0) AS total_earnings
FROM book b
JOIN chapter ch ON ch.book_id = b.id
WHERE b.id = :bookId;
```

Para a listagem `/books` (todos os livros com seus totais):

```sql
SELECT b.*,
       COALESCE(SUM(ch.horas_editadas * b.price_per_hour), 0) AS total_earnings,
       COUNT(ch.id) FILTER (WHERE ch.status IN ('concluido', 'pago')) AS completed_chapters,
       COUNT(ch.id) AS total_chapters
FROM book b
LEFT JOIN chapter ch ON ch.book_id = b.id
GROUP BY b.id
ORDER BY b.created_at DESC;
```

Selecionar colunas específicas; **proibido** `SELECT *`.

---

## 9. Resumo de invariantes (para validar em testes)

| # | Invariante | Enforcement |
|---|------------|-------------|
| I1 | Todo livro tem ≥ 1 capítulo | Service layer (criação + cascade de exclusão) |
| I2 | `book.status` = `computeBookStatus(chapters)` em qualquer snapshot | `recomputeBookStatus` chamado após toda mutação |
| I3 | `numero` único por `book_id` | `UNIQUE (book_id, numero)` |
| I4 | Títulos únicos por estúdio (case-insensitive) | `UNIQUE (lower(title), studio_id)` |
| I5 | Nenhum narrador/editor/estúdio ativo com mesmo nome | `UNIQUE (lower(name)) WHERE deleted_at IS NULL` |
| I6 | `price_per_hour ∈ [0.01, 9999.99]` | CHECK no banco + Zod |
| I7 | `horas_editadas ∈ [0, 999.99]` | CHECK + Zod |
| I8 | Capítulo `pago` imutável exceto status reversível com flag | Service layer + API `confirmReversion` flag |
| I9 | Nenhuma operação multi-tabela fora de transação | Service usa `db.transaction(tx => ...)` |
| I10 | `pdf_url` formato HTTP(S) ou NULL | CHECK + Zod |

Todos terão pelo menos 1 teste de integração validando o caminho feliz + 1 caminho de erro.
