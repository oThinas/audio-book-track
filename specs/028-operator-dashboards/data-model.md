# Phase 1 — Data Model

Mudanças no banco de dados e nos tipos de domínio para suportar a feature.

## Migrations

### Migration: `add_chapter_completed_paid_at_and_dashboard_widgets`

Drizzle: gerada via `bun run db:generate` após editar os schemas (D1, D2 abaixo).

```sql
-- D1: chapter timestamps
ALTER TABLE chapter
  ADD COLUMN completed_at timestamp with time zone,
  ADD COLUMN paid_at timestamp with time zone;

CREATE INDEX chapter_completed_at_idx
  ON chapter (completed_at)
  WHERE completed_at IS NOT NULL;

CREATE INDEX chapter_paid_at_idx
  ON chapter (paid_at)
  WHERE paid_at IS NOT NULL;

-- Backfill: aproximação via updated_at
UPDATE chapter
   SET completed_at = updated_at
 WHERE status IN ('completed', 'paid')
   AND completed_at IS NULL;

UPDATE chapter
   SET paid_at = updated_at
 WHERE status = 'paid'
   AND paid_at IS NULL;

-- D2: user_preference.dashboard_widgets
ALTER TABLE user_preference
  ADD COLUMN dashboard_widgets jsonb NOT NULL
  DEFAULT '["a-receber-agora","receita-periodo","ticket-medio","ranking-estudio","ranking-narrador","ranking-editor","funil-status","atrasados","grafico-receita"]'::jsonb;
```

**Reversibilidade** (down migration):

```sql
DROP INDEX chapter_paid_at_idx;
DROP INDEX chapter_completed_at_idx;
ALTER TABLE chapter DROP COLUMN paid_at;
ALTER TABLE chapter DROP COLUMN completed_at;
ALTER TABLE user_preference DROP COLUMN dashboard_widgets;
```

### Considerações

- Backfill é **idempotente** (`IS NULL` guard) — re-aplicar a migration não corrompe dados.
- Índices são parciais (`WHERE … IS NOT NULL`) — não ocupam espaço para a maioria das linhas (capítulos ainda não finalizados).
- `dashboard_widgets` default = array com **todas** as 9 chaves → usuários existentes ganham dashboard completo na primeira visita (FR-030).

## Drizzle schema changes

### `src/lib/db/schema/chapter.ts`

```typescript
// Adicionar campos:
completedAt: timestamp("completed_at", { withTimezone: true }),
paidAt: timestamp("paid_at", { withTimezone: true }),

// Adicionar índices na tupla de retorno:
index("chapter_completed_at_idx")
  .on(table.completedAt)
  .where(sql`${table.completedAt} IS NOT NULL`),
index("chapter_paid_at_idx")
  .on(table.paidAt)
  .where(sql`${table.paidAt} IS NOT NULL`),
```

### `src/lib/db/schema/user-preference.ts`

```typescript
import { jsonb } from "drizzle-orm/pg-core";
import type { DashboardWidgetKey } from "../../domain/dashboard-widget";

// Adicionar campo:
dashboardWidgets: jsonb("dashboard_widgets")
  .$type<DashboardWidgetKey[]>()
  .notNull()
  .default(sql`'["a-receber-agora","receita-periodo","ticket-medio","ranking-estudio","ranking-narrador","ranking-editor","funil-status","atrasados","grafico-receita"]'::jsonb`),
```

## Domain types

### `src/lib/domain/chapter.ts` (edit)

```typescript
export interface Chapter {
  readonly id: string;
  readonly bookId: string;
  readonly title: string;
  readonly position: number;
  readonly status: ChapterStatus;
  readonly narratorId: string | null;
  readonly editorId: string | null;
  readonly editedSeconds: number;
  readonly deadline: string | null;
  readonly completedAt: Date | null;   // NEW
  readonly paidAt: Date | null;        // NEW
  readonly createdAt: Date;
}

export const PAID_LOCKED_FIELDS = [
  "title",
  "narratorId",
  "editorId",
  "editedSeconds",
  "deadline",
  "completedAt",  // NEW · escrita automática; não editável após paid
  "paidAt",       // NEW · idem
] as const;
```

### `src/lib/domain/dashboard-widget.ts` (new)

```typescript
import { z } from "zod";

export const DASHBOARD_WIDGETS = [
  "a-receber-agora",
  "receita-periodo",
  "ticket-medio",
  "ranking-estudio",
  "ranking-narrador",
  "ranking-editor",
  "funil-status",
  "atrasados",
  "grafico-receita",
] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGETS)[number];

export const DEFAULT_DASHBOARD_WIDGETS: readonly DashboardWidgetKey[] = DASHBOARD_WIDGETS;

export const dashboardWidgetSchema = z.enum(DASHBOARD_WIDGETS);
export const dashboardWidgetsArraySchema = z
  .array(dashboardWidgetSchema)
  .max(DASHBOARD_WIDGETS.length)
  .transform((arr) => Array.from(new Set(arr))); // dedup

export interface DashboardWidgetMeta {
  readonly key: DashboardWidgetKey;
  readonly section: "financeiro" | "operacional" | "retrospectiva";
  readonly titlePtBr: string;
  readonly descriptionPtBr: string;
}

export const DASHBOARD_WIDGET_META: ReadonlyArray<DashboardWidgetMeta> = [
  {
    key: "a-receber-agora",
    section: "financeiro",
    titlePtBr: "A receber agora",
    descriptionPtBr:
      "Soma de receita dos capítulos em status Concluído que ainda não foram pagos. Snapshot atual, sem filtro de período.",
  },
  {
    key: "receita-periodo",
    section: "financeiro",
    titlePtBr: "Receita realizada no período",
    descriptionPtBr:
      "Soma de receita dos capítulos pagos no período filtrado, considerando a data de pagamento.",
  },
  {
    key: "ticket-medio",
    section: "financeiro",
    titlePtBr: "Ticket médio",
    descriptionPtBr:
      "Receita média por capítulo pago no período. Útil para comparar rentabilidade entre períodos.",
  },
  {
    key: "ranking-estudio",
    section: "financeiro",
    titlePtBr: "Ranking por estúdio",
    descriptionPtBr:
      "Top 10 estúdios por receita realizada no período. Ordenado descendente.",
  },
  {
    key: "ranking-narrador",
    section: "financeiro",
    titlePtBr: "Ranking por narrador",
    descriptionPtBr:
      "Top 10 narradores por receita gerada via capítulos pagos no período.",
  },
  {
    key: "ranking-editor",
    section: "financeiro",
    titlePtBr: "Ranking por editor",
    descriptionPtBr: "Top 10 editores por receita gerada via capítulos pagos no período.",
  },
  {
    key: "funil-status",
    section: "operacional",
    titlePtBr: "Funil de status",
    descriptionPtBr:
      "Contagem atual de capítulos em cada estado do ciclo de vida. Ignora o filtro de período.",
  },
  {
    key: "atrasados",
    section: "operacional",
    titlePtBr: "Capítulos atrasados",
    descriptionPtBr:
      "Contagem de capítulos com prazo vencido em status ativo. Botão leva ao livro com o atraso mais antigo.",
  },
  {
    key: "grafico-receita",
    section: "retrospectiva",
    titlePtBr: "Gráfico de receita",
    descriptionPtBr:
      "Evolução temporal da receita realizada no período. Granularidade diária, semanal ou mensal conforme o tamanho do recorte.",
  },
] as const;
```

### `src/lib/domain/dashboard-period.ts` (new)

```typescript
import { z } from "zod";

export const PERIOD_PRESETS = [
  "today",
  "this-week",
  "this-month",
  "this-quarter",
  "this-year",
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export interface DateRangeIso {
  readonly fromIso: string;        // YYYY-MM-DD
  readonly toIso: string;          // YYYY-MM-DD (inclusive)
  readonly preset: PeriodPreset | "custom";
}

export const periodSearchParamsSchema = z.object({
  preset: z.enum(PERIOD_PRESETS).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type PeriodSearchParams = z.infer<typeof periodSearchParamsSchema>;

// Helpers puros (signatures, impl em testes RED → GREEN):
export declare function getPresetRange(preset: PeriodPreset, todayIso: string): DateRangeIso;
export declare function parsePeriodSearchParams(
  params: PeriodSearchParams,
  todayIso: string,
): DateRangeIso;
```

### `src/lib/domain/dashboard-bucketing.ts` (new)

```typescript
export type Granularity = "day" | "week" | "month";

export interface Bucket {
  readonly startIso: string;       // YYYY-MM-DD inclusive
  readonly endIso: string;         // YYYY-MM-DD inclusive
  readonly labelPtBr: string;      // "12/05/2026", "Semana de 11–17/05/2026", "Maio 2026"
}

export declare function inferGranularity(fromIso: string, toIso: string): Granularity;
export declare function bucketDates(fromIso: string, toIso: string, g: Granularity): Bucket[];
export declare function formatBucketLabel(bucket: Bucket, g: Granularity): string;
```

### `src/lib/domain/earnings-aggregations.ts` (new)

```typescript
import type { Bucket } from "./dashboard-bucketing";

export interface BucketAmount {
  readonly startIso: string;
  readonly cents: number;
}

// Pure helper: dado o conjunto de buckets e a tabela esparsa do DB,
// retorna uma lista densa com 0 nos vazios (FR-024).
export declare function densifyBuckets(
  buckets: ReadonlyArray<Bucket>,
  sparse: ReadonlyArray<BucketAmount>,
): ReadonlyArray<BucketAmount>;

// Pure helper: ticket médio com guarda contra divisão por zero (FR-015).
export declare function ticketMedioCents(totalCents: number, count: number): number;
```

## Service-level snapshots (returned by `DashboardService`)

### FinancialSnapshot

```typescript
import type { ChapterStatus } from "@/lib/domain/chapter";

export interface FinancialSnapshot {
  readonly periodo: DateRangeIso;
  // FR-013: snapshot atual (sem período)
  readonly aReceberAgoraCents: number;
  // FR-014: período
  readonly receitaPeriodoCents: number;
  // FR-015
  readonly ticketMedioCents: number;
  readonly chaptersPagosCount: number;
  // FR-016 / FR-017 / FR-018
  readonly rankingEstudio: ReadonlyArray<RankingEntry>;
  readonly rankingNarrador: ReadonlyArray<RankingEntry>;
  readonly rankingEditor: ReadonlyArray<RankingEntry>;
  // Auditoria — quais widgets foram efetivamente calculados
  readonly computedWidgets: ReadonlyArray<DashboardWidgetKey>;
}

export interface RankingEntry {
  readonly entityId: string;
  readonly name: string;
  readonly archived: boolean;       // FR-018
  readonly chaptersPaidCount: number;
  readonly totalCents: number;
}
```

### OperationalSnapshot

```typescript
export interface OperationalSnapshot {
  // FR-019
  readonly funnel: Readonly<Record<ChapterStatus, number>>;
  // FR-020 / FR-021 / FR-021a
  readonly overdueCount: number;
  readonly firstOverdueBookId: string | null;
  readonly computedWidgets: ReadonlyArray<DashboardWidgetKey>;
}
```

### RetrospectiveSnapshot

```typescript
export interface RetrospectiveSnapshot {
  readonly periodo: DateRangeIso;
  readonly granularity: Granularity;
  readonly buckets: ReadonlyArray<RetrospectiveBucket>;
  readonly computedWidgets: ReadonlyArray<DashboardWidgetKey>;
}

export interface RetrospectiveBucket {
  readonly startIso: string;
  readonly endIso: string;
  readonly labelPtBr: string;
  readonly cents: number;
}
```

## Indexing decisions

| Index | Coluna | Tipo | Justificativa |
|-------|--------|------|---------------|
| `chapter_completed_at_idx` | `(completed_at)` | parcial `WHERE completed_at IS NOT NULL` | Acelera queries futuras se quisermos KPI "Capítulos concluídos no período"; barato de manter. |
| `chapter_paid_at_idx` | `(paid_at)` | parcial `WHERE paid_at IS NOT NULL` | Crítico para `receita-periodo`, `ticket-medio`, `ranking-*`, `grafico-receita`. Maioria das linhas tem `NULL` (capítulos não-pagos) → índice parcial economiza espaço. |

Índices existentes que **já cobrem** outras necessidades (não precisam ser recriados):

- `chapter_book_id_idx` — FK base.
- `chapter_book_status_idx` `(book_id, status)` — útil pro funil (`SELECT status, COUNT(*) ... GROUP BY status`); PostgreSQL pode usar index-only scan se status estiver nas colunas indexadas.
- `chapter_deadline_active_idx` — para query de atrasados (`WHERE deadline IS NOT NULL` + filtro de status em código).
- `chapter_narrator_id_idx` / `chapter_editor_id_idx` — FKs para rankings.

## Atomicity / Unit of Work

Todas as escritas de `completed_at` / `paid_at` em `chapter-service.ts` rodam **dentro da transação existente** que já chama `recomputeBookStatusAndBumpVersion` (`SavepointUnitOfWork`). Nenhum BEGIN/COMMIT novo é introduzido — apenas SET adicional no UPDATE da transição.

## React 19 / Composition notes

> Fonte: `/vercel-composition-patterns` skill + Next.js 16 (React 19).

Componentes desta feature seguem as seguintes regras:

1. **Sem `forwardRef`**: `ref` é prop normal em React 19. Componentes filhos que precisarem expor ref simplesmente declaram `ref` no props type.
2. **`use(Context)` em vez de `useContext(Context)`**: para hooks que consomem contexto do compound component (ex: `useRankingTabContext`), prefira:
   ```tsx
   import { use } from "react";
   const ctx = use(RankingTabContext);
   ```
3. **Compound API exportada como objeto namespace**: `RankingTabs.List`, `RankingTabs.Trigger`, `RankingTabs.Content` (ver D14 no research). Build agnóstico de tree-shaking — cada sub-componente é declarado individualmente e anexado ao componente principal.
4. **Children-first**: componentes recebem `children: React.ReactNode` em vez de props específicas tipo `headerText`, `bodyText`. Apenas quando children não cobre o caso (ex: KPI que precisa de um número formatado + tooltip + ícone), considerar sub-componentes nomeados.
5. **Sem `React.FC`**: tipar com função regular `(props) => JSX.Element` ou interface explícita. Reduz inferência ambígua e segue convenção TS atual.
