# Data Model: Data Limite por Capítulo

**Feature**: 025-chapter-deadline
**Phase**: 1
**Scope**: 1 nova coluna + 1 novo índice + 1 campo derivado em DTO. Sem novas entidades, sem novas relações.

---

## 1. Entidade: Chapter (estendida)

| Campo | Tipo (PG) | Tipo (TS) | Nullable | Default | Origem | Notas |
|---|---|---|---|---|---|---|
| `id` | `text` | `string` | NO | `crypto.randomUUID()` | existente | PK |
| `book_id` | `text` | `string` | NO | — | existente | FK → `book.id`, ON DELETE CASCADE |
| `number` | `integer` | `number` | NO | — | existente | sequência por livro |
| `status` | `text` (enum) | `ChapterStatus` | NO | `'pending'` | existente | `pending`/`editing`/`reviewing`/`retake`/`completed`/`paid` |
| `narrator_id` | `text` | `string \| null` | YES | `null` | existente | FK → `narrator.id`, ON DELETE RESTRICT |
| `editor_id` | `text` | `string \| null` | YES | `null` | existente | FK → `editor.id`, ON DELETE RESTRICT |
| `edited_seconds` | `integer` | `number` | NO | `0` | existente | 0 ≤ ≤ 3_600_000 |
| **`deadline`** | **`date`** | **`string \| null`** | **YES** | **`null`** | **NOVO (FR-001)** | **formato ISO `YYYY-MM-DD`. Drizzle `mode: "string"`.** |
| `created_at` | `timestamptz` | `Date` | NO | `now()` | existente | |
| `updated_at` | `timestamptz` | `Date` | NO | `now()` | existente | `$onUpdate(() => sql\`now()\`)` |

### Drizzle (schema/chapter.ts) — diff conceitual

```ts
import { date, ... } from "drizzle-orm/pg-core";

export const chapter = pgTable(
  "chapter",
  {
    // ... existentes ...
    deadline: date("deadline", { mode: "string" }),  // nullable, sem default
  },
  (table) => [
    // ... existentes ...
    index("chapter_deadline_active_idx")
      .on(table.deadline)
      .where(sql`${table.deadline} IS NOT NULL`),
  ],
);
```

### Domain (`src/lib/domain/chapter.ts`) — diff conceitual

```ts
export interface Chapter {
  readonly id: string;
  readonly bookId: string;
  readonly number: number;
  readonly status: ChapterStatus;
  readonly narratorId: string | null;
  readonly editorId: string | null;
  readonly editedSeconds: number;
  readonly deadline: string | null; // NOVO — ISO YYYY-MM-DD
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const PAID_LOCKED_FIELDS = [
  "narratorId",
  "editorId",
  "editedSeconds",
  "deadline",      // NOVO
] as const;
```

### Invariantes

- `deadline = null` é estado válido (FR-001).
- `deadline` aceita qualquer data sintaticamente válida no intervalo `(−∞, hoje + 10 anos]` (FR-003). Limite superior aplicado em **validação** (Zod), não em **constraint do banco** — para permitir flexibilidade futura sem migration.
- Capítulo em `status = 'paid'`: `deadline` é imutável junto com `narrator_id`, `editor_id`, `edited_seconds` (FR-004).
- Sem ON DELETE entre `chapter.deadline` e outra entidade — campo escalar.

---

## 2. Entidade derivada: BookSummary (estendida)

`BookSummary` é o DTO retornado por `BookRepository.listSummaries()` e usado para alimentar `/books`. Ganha um campo derivado:

| Campo | Tipo (TS) | Origem | Cálculo |
|---|---|---|---|
| `id`, `title`, `studio`, `pricePerHourCents`, `pdfUrl`, `status`, `totalChapters`, `completedChapters`, `totalEarningsCents`, `createdAt`, `updatedAt` | existente | — | sem mudança |
| **`focusThisWeekCount`** | **`number`** | **NOVO (FR-025, FR-031)** | **`COUNT(*) FILTER (WHERE status IN (pending,editing,reviewing,retake) AND deadline IS NOT NULL AND (deadline < :today OR deadline BETWEEN :monday AND :sunday))`** |

### Diff conceitual (`src/lib/repositories/book-repository.ts`)

```ts
export interface BookSummary {
  // ... existentes ...
  readonly focusThisWeekCount: number; // NOVO
}
```

### Cálculo de `:today`, `:monday`, `:sunday`

- Executado no service (não no repository) — service injeta as datas como argumentos da repository.
- Em `America/Sao_Paulo` (FR-024), via helpers de `src/lib/domain/timezone.ts`.

```ts
// Helper conceitual:
function todayInAppTimezone(now: () => Date = () => new Date()): string;     // "2026-05-14"
function currentWeekRangeInAppTimezone(now: () => Date = () => new Date()): {
  mondayIso: string;   // "2026-05-11"
  sundayIso: string;   // "2026-05-17"
};
```

A função `now` é injetável para tornar o cálculo testável sem `vi.useFakeTimers`.

### Assinatura nova da repository

```ts
// book-repository.ts
export interface ListSummariesOptions {
  readonly todayIso: string;       // "2026-05-14"
  readonly mondayIso: string;      // segunda da semana atual em APP_TIMEZONE
  readonly sundayIso: string;      // domingo da semana atual em APP_TIMEZONE
}

export interface BookRepository {
  // ... existentes ...
  listSummaries(opts: ListSummariesOptions, tx?: RepositoryTx): Promise<BookSummary[]>;
}
```

---

## 3. Helpers de domínio (puros, novos)

### `src/lib/domain/chapter-deadline.ts`

```ts
import type { Chapter, ChapterStatus } from "./chapter";

const ACTIVE_STATUSES: ReadonlySet<ChapterStatus> = new Set([
  "pending",
  "editing",
  "reviewing",
  "retake",
]);

export interface FocusWeekContext {
  readonly todayIso: string;       // "YYYY-MM-DD" em APP_TIMEZONE
  readonly mondayIso: string;      // idem
  readonly sundayIso: string;      // idem
}

/** Atrasado se: status ativo AND deadline < hoje (FR-006). */
export function isOverdue(chapter: Chapter, ctx: FocusWeekContext): boolean;

/** Capítulo entra no "Foco da semana" (FR-019/FR-021). */
export function isInFocusWeek(chapter: Chapter, ctx: FocusWeekContext): boolean;
```

Testes paramétricos cobrem 6 status × 6 posições de deadline relativas (atrasado, ontem, hoje, segunda, domingo, futuro distante, null). 6×7 = 42 combinações.

### `src/lib/domain/timezone.ts`

```ts
export const APP_TIMEZONE = "America/Sao_Paulo" as const;

export function todayInAppTimezone(now?: () => Date): string;
export function currentWeekRangeInAppTimezone(now?: () => Date): {
  readonly mondayIso: string;
  readonly sundayIso: string;
};
```

Usa `date-fns-tz/toZonedTime` + `date-fns/startOfWeek` com `weekStartsOn: 1`.

### `src/lib/utils/format-date.ts`

```ts
/** "DD/MM/YYYY" pt-BR. */
export function formatDeadline(iso: string): string;

/** Tooltip: "hoje", "amanhã", "ontem", "em N dias", "atrasado há N dias". */
export function formatRelativeDeadline(iso: string, ctx: FocusWeekContext): string;
```

---

## 4. Schemas Zod (validação de entrada)

### `src/lib/schemas/chapter.ts` — diff conceitual

```ts
const TEN_YEARS_DAYS = 365 * 10;

const deadlineSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data limite inválida (use formato AAAA-MM-DD).")
  .refine(isCalendarValid, { message: "Data limite inválida." })
  .refine(
    (iso) => isWithinDaysOfToday(iso, TEN_YEARS_DAYS),
    { message: "Data limite não pode ser superior a 10 anos no futuro." },
  )
  .nullable();

export const updateChapterSchema = z.object({
  status: chapterStatusSchema.optional(),
  narratorId: z.uuid("Narrador inválido.").nullable().optional(),
  editorId: z.uuid("Editor inválido.").nullable().optional(),
  editedSeconds: z.number()
    .int().min(EDITED_SECONDS_MIN).max(EDITED_SECONDS_MAX).optional(),
  deadline: deadlineSchema.optional(), // NOVO
  confirmReversion: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Pelo menos um campo deve ser informado.",
});
```

`isCalendarValid` parseia e checa que `new Date(iso).toISOString().startsWith(iso)`. `isWithinDaysOfToday` calcula em `APP_TIMEZONE`.

---

## 5. Erros de domínio

Nenhum erro de domínio novo necessário — o `ChapterPaidLockedError` já cobre o caso "tentou editar deadline em paid" porque agora `PAID_LOCKED_FIELDS` inclui `deadline`. Service simplesmente lança o existente.

`ZodError` (validação) é mapeado pelo `withApiErrorHandler` no envelope `{ kind: "validation", errors: [...] }` com mensagens em PT-BR já vindas do schema.

---

## 6. Migration

Arquivo gerado: `drizzle/migrations/0007_chapter_deadline.sql`

```sql
ALTER TABLE "chapter" ADD COLUMN "deadline" date;

CREATE INDEX "chapter_deadline_active_idx" ON "chapter" ("deadline")
WHERE "deadline" IS NOT NULL;
```

Reversibilidade (manual, não rodada):

```sql
DROP INDEX IF EXISTS "chapter_deadline_active_idx";
ALTER TABLE "chapter" DROP COLUMN IF EXISTS "deadline";
```

Capítulos existentes mantêm `deadline = NULL` (FR-033).

---

## 7. Impacto em entidades NÃO alteradas

- `book`: schema inalterado. Apenas o **DTO** `BookSummary` ganha `focusThisWeekCount`. Não há coluna nova em `book`.
- `narrator`, `editor`, `studio`: sem impacto.
- `chapter` ↔ `book`: relação inalterada (FK + cascade existentes).

---

## 8. Diagrama resumido (texto)

```
book ─┐
      │ (1..n, cascade)
      ▼
   chapter
   ├── id           (PK)
   ├── book_id      (FK book.id)
   ├── number       (unique por book_id)
   ├── status       (pending|editing|reviewing|retake|completed|paid)
   ├── narrator_id  (FK narrator.id, restrict)
   ├── editor_id    (FK editor.id, restrict)
   ├── edited_seconds
   ├── deadline     ★ NOVO ──────── (date NULL, indexado parcial)
   ├── created_at
   └── updated_at
```

---

## Checklist do modelo

- [x] Coluna adicionada como nullable, sem default — coerente com FR-001 e FR-033.
- [x] Drizzle `mode: "string"` — evita off-by-one por fuso.
- [x] Índice parcial — perf sem inflar storage.
- [x] PAID_LOCKED_FIELDS estendido — FR-004.
- [x] BookSummary ganha `focusThisWeekCount` — FR-025/FR-031.
- [x] `:today/:monday/:sunday` calculados em service, injetados na repository — testável.
- [x] Helpers puros isolados em `src/lib/domain/` — Princípio VI.
- [x] Zod com mensagens PT-BR — FR-034.
- [x] Sem erros de domínio novos — reuso de `ChapterPaidLockedError`.
- [x] Migration reversível.
