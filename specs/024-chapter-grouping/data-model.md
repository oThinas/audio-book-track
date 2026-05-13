# Phase 1 Data Model — 024 Chapter Grouping

**Feature**: Agrupamento de capítulos por editor/narrador/status na tabela do livro
**Date**: 2026-05-13

---

## 0. Escopo de dados

Esta feature **não introduz entidades de domínio nem altera schema do banco**. Todas as estruturas abaixo são tipos TypeScript de frontend que descrevem (a) o estado de UI do agrupamento e (b) os formatos das funções de agregação. Não há migration, não há tabela nova, não há mudança em contrato HTTP.

Entidades de domínio referenciadas (já existentes, sem mudança):

| Entidade | Campos relevantes | Localização |
|---|---|---|
| `Chapter` | `id`, `number`, `status`, `narrator { id, name } \| null`, `editor { id, name } \| null`, `editedSeconds` | `src/lib/domain/chapter.ts` |
| `Book` | `id`, `pricePerHourCents` | `src/lib/domain/book.ts` |
| `ChapterStatus` | enum: `pending` \| `editing` \| `reviewing` \| `retake` \| `completed` \| `paid` | `src/lib/domain/chapter.ts` |
| `Narrator` / `Editor` | `id`, `name` | `src/lib/domain/{narrator,editor}.ts` |

---

## 1. Estado de UI

### 1.1 `GroupingDimension`

```ts
export const GROUPING_DIMENSIONS = ["narrator", "editor", "status"] as const;
export type GroupingDimension = (typeof GROUPING_DIMENSIONS)[number];
```

**Invariantes**:
- Conjunto fechado. Adicionar uma nova dimensão exige update da feature.
- Os strings correspondem 1:1 a column IDs do TanStack Table (`narrator`, `editor`, `status`).

### 1.2 `GroupingState`

Re-export do tipo do TanStack Table v8 (`type GroupingState = string[]`). Restringido na nossa camada para `GroupingDimension[]`.

**Invariantes**:
- Ordem importa: `state[0]` é o nível mais externo da hierarquia.
- Sem duplicatas (FR-014, FR-019).
- Comprimento ∈ `[0, 3]`. Comprimento `0` = tabela flat.

### 1.3 `ExpandedState`

Re-export do tipo do TanStack Table (`ExpandedState = true | Record<string, boolean>`). Não persistimos; apenas em memória local do componente.

### 1.4 `UnassignedSentinel`

```ts
export const UNASSIGNED_GROUP_KEY = "__unassigned__" as const;
export type UnassignedKey = typeof UNASSIGNED_GROUP_KEY;
```

**Invariantes**:
- Usado como valor de chave de grupo quando `narrator_id` ou `editor_id` é `null`.
- Status nunca é `null` no domínio (não-nullable), então o sentinel só aparece em `narrator`/`editor`.
- Reservado: a string `"__unassigned__"` jamais pode ser um `id` real (UUIDs não casam).

---

## 2. Tipos de agregação

### 2.1 `EarningsCents` (agregação de `earnings`)

```ts
/** Soma de centavos arredondados (half-away-from-zero) por capítulo. */
export type EarningsCents = number; // inteiro, sempre ≥ 0
```

**Função**:
```ts
export function sumCentsRounded(
  _columnId: string,
  leafRows: ReadonlyArray<Row<ChapterRowEntity>>,
  book: Pick<Book, "pricePerHourCents">,
): EarningsCents {
  return leafRows.reduce((acc, leaf) => {
    return acc + computeChapterEarningsCents(leaf.original, book);
  }, 0);
}
```

**Onde mora**: `src/lib/domain/chapter-aggregation.ts`.

**Invariantes**:
- Inteiro não-negativo.
- Arredondamento por capítulo (não somar segundos e depois arredondar — viola constituição Princípio II).
- `book.pricePerHourCents` injetado pela tabela (não acessado via globals).

### 2.2 `StatusBreakdown` (agregação de `statusBreakdown`)

```ts
export type StatusBreakdown = Readonly<Record<ChapterStatus, number>>;
```

**Função**:
```ts
export function countByStatus(
  _columnId: string,
  leafRows: ReadonlyArray<Row<ChapterRowEntity>>,
): StatusBreakdown {
  const counts: Record<ChapterStatus, number> = {
    pending: 0, editing: 0, reviewing: 0, retake: 0, completed: 0, paid: 0,
  };
  for (const leaf of leafRows) {
    counts[leaf.original.status] += 1;
  }
  return counts;
}
```

**Onde mora**: `src/lib/domain/chapter-aggregation.ts`.

**Invariantes**:
- Sempre retorna o registro completo (todas as chaves presentes; valores ≥ 0).
- Soma de todos os valores = quantidade de folhas no grupo.

### 2.3 `EditedSeconds` (built-in `sum`)

Coluna `editedSeconds` usa `aggregationFn: "sum"` built-in do TanStack. Tipo é `number` (≥ 0).

### 2.4 `ChapterCount` (built-in `sum`)

Coluna virtual `chapterCount` com `accessorFn: () => 1` e `aggregationFn: "sum"`. Resultado é o tamanho do grupo (folhas). Alternativa: `row.subRows.length` direto — mas o cell formatter precisa do número, então a coluna explícita simplifica a renderização.

---

## 3. Modelo de URL state

### 3.1 Param: `groupBy`

| Aspecto | Valor |
|---|---|
| Nome do param | `groupBy` |
| Formato | Lista separada por vírgula, sem espaços. Ex: `?groupBy=narrator,editor` |
| Valores aceitos | Qualquer subset ordenado de `GROUPING_DIMENSIONS` |
| Param ausente | Equivale a `[]` (tabela flat) |
| Param vazio (`?groupBy=`) | Equivale a `[]` (tabela flat); param é removido na próxima escrita |
| Param inválido (tokens fora do whitelist, duplicatas) | Descartado silenciosamente → `[]`; URL normalizada na próxima ação do usuário |

### 3.2 Parser

```ts
export function parseGroupingParam(raw: string | null): GroupingDimension[] {
  if (!raw) return [];
  const tokens = raw.split(",").map((t) => t.trim()).filter(Boolean);
  const seen = new Set<string>();
  const result: GroupingDimension[] = [];
  for (const token of tokens) {
    if (seen.has(token)) return [];                 // duplicata → invalida
    if (!isGroupingDimension(token)) return [];     // valor desconhecido → invalida
    seen.add(token);
    result.push(token);
  }
  return result;
}

function isGroupingDimension(value: string): value is GroupingDimension {
  return (GROUPING_DIMENSIONS as readonly string[]).includes(value);
}
```

**Invariantes**:
- Pura, sem side-effects.
- Devolve array novo (imutável).
- Para qualquer input inválido, devolve `[]` (não throw).

### 3.3 Serializer

```ts
export function serializeGroupingParam(grouping: GroupingDimension[]): string | null {
  if (grouping.length === 0) return null;           // null = remover param
  return grouping.join(",");
}
```

---

## 4. Tipos de feature flags

```ts
// src/lib/config/feature-flags.ts
export const featureFlags = {
  SHOW_EARNINGS_IN_NARRATOR_GROUPS: true,
} as const;

export type FeatureFlags = typeof featureFlags;
export type FeatureFlagKey = keyof FeatureFlags;
```

**Invariantes**:
- `as const` garante valores literais (não `boolean` genérico).
- Mudanças exigem PR + redeploy (não há toggle runtime).

---

## 5. Tipos derivados consumidos pela tabela

### 5.1 `ChapterRowEntity` (já existe — referenciado)

Já definido em `src/components/features/chapters/chapter-row.tsx`:

```ts
export interface ChapterRowEntity {
  readonly id: string;
  readonly number: number;
  readonly status: ChapterStatus;
  readonly narrator: { readonly id: string; readonly name: string } | null;
  readonly editor: { readonly id: string; readonly name: string } | null;
  readonly editedSeconds: number;
}
```

**Sem mudança nesta feature** — é o input do TanStack Table como `data`.

### 5.2 `ChapterTableContext` (novo)

Contexto que a `ChaptersTable` precisa para construir colunas (injetado para evitar globals):

```ts
export interface ChapterTableContext {
  readonly book: Pick<Book, "pricePerHourCents">;
  readonly narrators: ReadonlyArray<ChapterRowOption>;
  readonly editors: ReadonlyArray<ChapterRowOption>;
}
```

**Onde mora**: `src/components/features/chapters/chapters-table.tsx` (exportado).

**Invariantes**:
- `pricePerHourCents` é imutável durante a sessão (Princípio II — preço travado quando livro é `paid`; mas mesmo livros não-`paid` não mudam preço em flight).
- Listas de narradores/editores podem ser usadas pelo `ChapterRowEditMode` (sem mudança).

---

## 6. Diagrama de fluxo de dados

```
URL ?groupBy=narrator,editor
        ↓ useSearchParams
parseGroupingParam → GroupingDimension[]
        ↓ setGrouping (TanStack)
useReactTable({ data: chapters, columns, state: { grouping, expanded, sorting } })
        ↓ getGroupedRowModel → table.getRowModel().rows
        ↓ getSortedRowModel (custom sortFn ordena grupos por minutagem desc, unassigned last)
ChaptersTable renderiza row por row:
  row.getIsGrouped() → <ChapterGroupRow> (label + aggregatedCells)
  else              → <ChapterRow chapter={row.original}>
        ↓ user clica em DropdownMenuCheckboxItem
ChapterGroupingControl chama setGrouping(newArray)
        ↓ useChaptersGroupingState.setGrouping
router.replace(`/books/<id>?groupBy=${serialize(newArray)}`, { scroll: false })
        ↓ URL muda → useSearchParams emite novo valor
ciclo recomeça (sem fetch, agregação só recalcula no client)
```

---

## 7. State transitions resumidas

| De | Ação do usuário | Para | Side effect |
|---|---|---|---|
| `grouping = []` | Marca "Narrador" | `["narrator"]` | URL ganha `?groupBy=narrator`; agregação aplica |
| `["narrator"]` | Marca "Editor" | `["narrator", "editor"]` | URL atualiza; hierarquia 2 níveis |
| `["narrator", "editor"]` | Desmarca "Narrador" | `["editor"]` | URL atualiza; remontagem do row model |
| Qualquer | Clica "Sem agrupamento" | `[]` | URL remove `?groupBy`; tabela flat (FR-013) |
| `["narrator"]` | Reload da rota | `["narrator"]` | `expanded` reseta para `{}` (FR-008) |
| `["narrator"]` | Mutação em capítulo (re-fetch) | `["narrator"]` | `expanded` preservado (Q4 clarify) |
| URL inválida (`?groupBy=foo`) | Load | `[]` | URL é re-escrita sem `groupBy` na próxima ação |

---

## 8. Sem mudanças em outros artefatos

- ❌ Sem nova migration Drizzle.
- ❌ Sem alteração em `src/lib/repositories/`.
- ❌ Sem alteração em `src/lib/services/`.
- ❌ Sem novo endpoint em `src/app/api/v1/`.
- ❌ Sem alteração em `src/lib/schemas/` (Zod).
- ✅ Mudança apenas em `src/components/features/chapters/` e adição de `src/lib/domain/chapter-aggregation.ts` + `src/lib/config/feature-flags.ts`.
