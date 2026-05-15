# Phase 1 — Data Model: Chapter titles, reordering, and extra-chapter templates

**Feature**: 026-chapter-titles-reordering
**Date**: 2026-05-15

---

## Entities

### Chapter (modificada)

Tabela `chapter` — uma entrada por capítulo. Capítulo pertence a exatamente um livro.

| Campo | Tipo PostgreSQL | Nulidade | Default | Observação |
|-------|-----------------|----------|---------|------------|
| `id` | `text` PK | NOT NULL | `crypto.randomUUID()` | Inalterado |
| `book_id` | `text` FK → `book.id` ON DELETE CASCADE | NOT NULL | — | Inalterado |
| **`title`** *(novo)* | `text` | NOT NULL | — | CHECK `length(title) <= 100`, CHECK `title !~ E'[\\n\\r]'`. Trim aplicado no servidor antes de persistir. |
| **`position`** *(novo)* | `integer` | NOT NULL | — | CHECK `position >= 0`. Único por `book_id` (constraint DEFERRABLE INITIALLY DEFERRED). Sequência densa `0..N-1`. |
| ~~`number`~~ *(removida)* | — | — | — | Substituída por `title` (rótulo) + `position` (ordem). |
| `status` | `text` enum | NOT NULL | `pending` | Inalterado |
| `narrator_id` | `text` FK → `narrator.id` ON DELETE RESTRICT | NULL | — | Inalterado |
| `editor_id` | `text` FK → `editor.id` ON DELETE RESTRICT | NULL | — | Inalterado |
| `edited_seconds` | `integer` | NOT NULL | 0 | Inalterado |
| `deadline` | `date` | NULL | — | Inalterado |
| `created_at` | `timestamptz` | NOT NULL | `now()` | Inalterado |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Inalterado |

**Índices.**
- `chapter_book_id_idx` (`book_id`) — mantido.
- `chapter_book_position_idx` (`book_id`, `position`) — **novo**. Suporta `ORDER BY position` por livro.
- `chapter_book_position_unique` UNIQUE (`book_id`, `position`) DEFERRABLE INITIALLY DEFERRED — **novo**. Garante unicidade da posição dentro do livro, permitindo permutações dentro de transação.
- `chapter_narrator_id_idx` parcial — mantido.
- `chapter_editor_id_idx` parcial — mantido.
- `chapter_book_status_idx` (`book_id`, `status`) — mantido.
- `chapter_deadline_active_idx` parcial — mantido.
- ~~`chapter_book_number_unique`~~ — **removido**.

**Constraints.**
- `chapter_title_length` CHECK `length(title) <= 100`.
- `chapter_title_no_newline` CHECK `title !~ E'[\\n\\r]'`.
- `chapter_position_nonnegative` CHECK `position >= 0`.
- `chapter_edited_seconds_range` — mantido.
- ~~`chapter_number_positive`~~ — removido.

### Book (modificada)

Tabela `book` — uma entrada por livro.

| Campo | Tipo PostgreSQL | Nulidade | Default | Observação |
|-------|-----------------|----------|---------|------------|
| `id`, `title`, `studio_id`, `price_per_hour_cents`, `pdf_url`, `status`, `created_at`, `updated_at` | — | — | — | Inalterados |
| **`chapters_version`** *(novo)* | `integer` | NOT NULL | 0 | Bumpada em toda mutação de capítulo dentro da mesma transação. |

Sem novos índices ou constraints em `book`.

---

## Domain types (TypeScript)

```ts
// src/lib/domain/chapter.ts
export interface Chapter {
  readonly id: string;
  readonly bookId: string;
  readonly title: string;                // <-- novo
  readonly position: number;             // <-- novo (substitui number)
  readonly status: ChapterStatus;
  readonly narratorId: string | null;
  readonly editorId: string | null;
  readonly editedSeconds: number;
  readonly deadline: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const PAID_LOCKED_FIELDS = [
  "narratorId",
  "editorId",
  "editedSeconds",
  "deadline",
  "title",                               // <-- novo
] as const;
export type PaidLockedField = (typeof PAID_LOCKED_FIELDS)[number];

// src/lib/domain/book.ts
export interface Book {
  // …campos existentes…
  readonly chaptersVersion: number;      // <-- novo
}
```

```ts
// src/lib/domain/chapter-templates.ts
export const CHAPTER_TEMPLATES = {
  prologue:     { label: "Prólogo",     defaultTitle: "Prólogo" },
  epilogue:     { label: "Epílogo",     defaultTitle: "Epílogo" },
  presentation: { label: "Apresentação", defaultTitle: "Apresentação" },
} as const;
export type ChapterTemplateKey = keyof typeof CHAPTER_TEMPLATES;
```

```ts
// src/lib/domain/chapter-title.ts
export const CHAPTER_TITLE_MAX = 100;

export function normalizeChapterTitle(raw: string): string {
  return raw.trim();
}

export function validateChapterTitle(raw: string):
  | { ok: true; value: string }
  | { ok: false; reason: "empty" | "too_long" | "has_newline" } {
  const trimmed = normalizeChapterTitle(raw);
  if (trimmed.length === 0) return { ok: false, reason: "empty" };
  if (trimmed.length > CHAPTER_TITLE_MAX) return { ok: false, reason: "too_long" };
  if (/[\n\r]/.test(trimmed)) return { ok: false, reason: "has_newline" };
  return { ok: true, value: trimmed };
}
```

```ts
// src/lib/domain/next-chapter-title.ts
const NUMBERED_RE = /^Capítulo (\d+)$/;

export function nextChapterTitle(existingTitles: readonly string[]): string {
  let max = 0;
  for (const t of existingTitles) {
    const m = NUMBERED_RE.exec(t);
    if (m) {
      const n = Number(m[1]);
      if (Number.isInteger(n) && n > max) max = n;
    }
  }
  return `Capítulo ${max + 1}`;
}
```

```ts
// src/lib/domain/normalize-positions.ts
/**
 * Recebe lista de chapters na ordem desejada e retorna a mesma lista com
 * positions densas 0..N-1. Helper puro (não toca banco).
 */
export function densifyPositions<T extends { id: string }>(
  ordered: readonly T[],
): ReadonlyArray<{ id: string; position: number }> {
  return ordered.map((c, idx) => ({ id: c.id, position: idx }));
}
```

---

## Invariants

Garantidas por uma combinação de schema (constraints) e service (regras).

1. **(book_id, position) é único e denso por livro.** Para todo livro, o conjunto de `position` dos seus capítulos é exatamente `{0, 1, …, N-1}` onde `N` é a contagem de capítulos. Verificável em uma query única.
2. **`title` é obrigatório, com 1..100 caracteres, trim aplicado, sem `\n`/`\r`.** Garantida no schema (CHECK) + Zod no servidor.
3. **`title` é imutável quando o capítulo está `paid`.** Garantida por `PAID_LOCKED_FIELDS` no `ChapterService.update`.
4. **`chapters_version` é monotonicamente crescente por livro.** Bumpada em toda mutação de capítulo na mesma transação via `BookStatusRecomputeService.bumpAndRecompute`.
5. **Reorder não altera nenhum outro campo do capítulo.** Garantida pelo repositório (`reorder` faz `UPDATE chapter SET position = $1 WHERE id = $2 AND book_id = $3` — nenhum outro campo no SET).
6. **Adicionar capítulo nasce em `position` igual ao alvo, com `position` dos demais empurrados em 1.** Garantida pelo `ChapterService.create` + UPDATE em batch antes do INSERT.

---

## State transitions

Sem mudanças no state machine de `ChapterStatus`. A feature não introduz nem altera transições.

---

## Validation rules (Zod schemas)

### `updateChapterSchema` (estendido)

Localização: `src/lib/schemas/chapter.ts`.

```ts
title: z
  .string()
  .max(100, "Título deve ter no máximo 100 caracteres.")
  .refine((s) => !/[\n\r]/.test(s), { message: "Título não pode ter quebras de linha." })
  .transform((s) => s.trim())
  .refine((s) => s.length > 0, { message: "Título é obrigatório." })
  .optional(),
```

`title` passa pela mesma sequência refine → transform → refine: rejeita newline antes de trim, faz trim, depois rejeita vazio. Mensagens em PT-BR.

### `createChapterSchema` (novo)

```ts
const positionTargetSchema = z.union([
  z.literal("start"),
  z.literal("end"),
  z.object({ after: z.uuid("Capítulo de referência inválido.") }),
]);

export const createChapterSchema = z.object({
  title: titleSchema,                                          // mesmo do update
  position: positionTargetSchema,
  expectedVersion: z.number().int().nonnegative(),
});
```

### `reorderChaptersSchema` (novo)

```ts
export const reorderChaptersSchema = z.object({
  orderedIds: z
    .array(z.uuid("Capítulo inválido."))
    .min(1, "Lista de capítulos não pode estar vazia.")
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "Lista de capítulos não pode conter duplicatas.",
    }),
  expectedVersion: z.number().int().nonnegative(),
});
```

### `createBookSchema` (estendido para extras)

```ts
const extraChapterSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("template"),
    template: z.enum(["prologue", "epilogue", "presentation"]),
    position: z.enum(["start", "end"]),
  }),
  z.object({
    kind: z.literal("custom"),
    title: titleSchema,
    position: z.enum(["start", "end"]),
  }),
]);

export const createBookSchema = z.object({
  title: z.string().trim().min(1, "Título do livro é obrigatório."),
  studioId: z.uuid("Estúdio inválido."),
  inlineStudioId: z.uuid().optional(),
  pricePerHourCents: z.number().int().min(1).max(999_999),
  chapters: z.object({
    numbered: z.number().int().min(0).max(NUM_CHAPTERS_MAX),
    extras: z.array(extraChapterSchema).max(20),                // teto defensivo
  }),
}).refine((b) => b.chapters.numbered > 0 || b.chapters.extras.length > 0, {
  message: "Livro deve ter pelo menos um capítulo (numerado ou extra).",
  path: ["chapters"],
});
```

`numChapters` legado é removido em favor de `chapters: { numbered, extras }`.

### `updateBookSchema` (estendido)

Remove o campo `numChapters` (que ampliava capítulos via PATCH). Mantém `title`, `studioId`, `pricePerHourCents`, `pdfUrl`.

---

## Service signatures (impacto)

```ts
// src/lib/services/chapter-service.ts
class ChapterService {
  // estendidos
  async update(chapterId: string, input: UpdateChapterServiceInput & { title?: string }): Promise<UpdateChapterResult>;

  // novos
  async create(bookId: string, input: CreateChapterServiceInput): Promise<CreateChapterResult>;
  async reorder(bookId: string, orderedIds: readonly string[], expectedVersion: number): Promise<ReorderChaptersResult>;
}

interface CreateChapterServiceInput {
  readonly title: string;
  readonly position: "start" | "end" | { after: string };
  readonly expectedVersion: number;
}
interface CreateChapterResult {
  readonly chapter: Chapter;
  readonly bookStatus: BookStatus;
  readonly chaptersVersion: number;
}
interface ReorderChaptersResult {
  readonly chaptersVersion: number;
}
```

```ts
// src/lib/services/book-service.ts
interface CreateBookServiceInput {
  // …existentes (title, studioId, pricePerHourCents, inlineStudioId)…
  readonly chapters: {
    readonly numbered: number;
    readonly extras: ReadonlyArray<
      | { kind: "template"; template: ChapterTemplateKey; position: "start" | "end" }
      | { kind: "custom"; title: string; position: "start" | "end" }
    >;
  };
}
// numChapters removido do input.
```

```ts
// src/lib/services/book-status-recompute.ts
export async function recomputeBookStatusAndBumpVersion(
  bookId: string,
  deps: { bookRepo: BookRepository; chapterRepo: ChapterRepository },
  tx?: RepositoryTx,
): Promise<Book>;
// substitui recomputeBookStatus — bumpa chapters_version no mesmo UPDATE.
```

---

## Repository signatures (impacto)

```ts
// src/lib/repositories/chapter-repository.ts
interface ChapterRepository {
  // estendidos: aceitam title + position
  insertMany(rows: ReadonlyArray<InsertChapterRow>, tx?: RepositoryTx): Promise<Chapter[]>;
  update(id: string, input: UpdateChapterRow, tx?: RepositoryTx): Promise<Chapter>;

  // existentes (sem mudança de assinatura, mas ORDER BY position):
  listByBookId(bookId: string, tx?: RepositoryTx): Promise<Chapter[]>;

  // novo
  reorder(
    bookId: string,
    pairs: ReadonlyArray<{ id: string; position: number }>,
    tx?: RepositoryTx,
  ): Promise<void>;
}

interface InsertChapterRow {
  readonly bookId: string;
  readonly title: string;
  readonly position: number;
  readonly status?: ChapterStatus;
  // …demais existentes opcionais…
}
interface UpdateChapterRow {
  readonly title?: string;
  readonly position?: number;            // tipicamente só via reorder; mas API permite
  // …demais existentes…
}
```

```ts
// src/lib/repositories/book-repository.ts
interface BookRepository {
  // novo
  bumpChaptersVersion(bookId: string, tx?: RepositoryTx): Promise<number>;
  // Atualiza chapters_version (= chapters_version + 1) e retorna o novo valor.
}
```

---

## Relationships

Sem mudanças nas FKs: `chapter.book_id → book.id ON DELETE CASCADE`, `chapter.narrator_id → narrator.id ON DELETE RESTRICT`, `chapter.editor_id → editor.id ON DELETE RESTRICT`. Soft-delete continua aplicado em `studio`/`narrator`/`editor`.

---

## Migration plan

Ver detalhes em [research.md § R-008](./research.md). Single migration `0008_chapter_title_position_book_version.sql` aplicada via `bun run db:migrate`.

**Sequência forward** (resumo, ver SQL completo em research.md):

1. `book.chapters_version` adicionada com default 0.
2. `chapter.title` adicionada nullable; backfill `'Capítulo ' || number::text`; depois `NOT NULL`.
3. `chapter.position` adicionada nullable; backfill `row_number() over (partition by book_id order by number) - 1`; depois `NOT NULL`.
4. Constraints adicionadas (`chapter_title_length`, `chapter_title_no_newline`, `chapter_position_nonnegative`, `chapter_book_position_unique` DEFERRABLE INITIALLY DEFERRED).
5. Índice `chapter_book_position_idx` criado.
6. `chapter.number`, seu unique index e seu CHECK removidos.

**Rollback** disponível e simétrico.

**Cobertura de teste para a migration**: o reset de schema-per-worker (Playwright) e o `BEGIN/ROLLBACK` (Vitest integration) cobrem o roundtrip automaticamente; verificação manual em snapshot do banco antes/depois faz parte do `quickstart.md`.
