# UI Contract — `ChapterGroupRow`

**Feature**: 024 Chapter Grouping
**Component**: `src/components/features/chapters/chapter-group-row.tsx`

---

## Props

```ts
export interface ChapterGroupRowProps {
  readonly row: Row<ChapterRowEntity>;       // TanStack row no nível do grupo
  readonly groupingDimension: GroupingDimension; // dimensão do nível
  readonly showEarningsColumn: boolean;       // ver "Feature flag" abaixo
  readonly columnCount: number;               // total de colunas visíveis (para colSpan se necessário)
}
```

---

## Renderização

A row representa **um grupo** (TanStack `row.getIsGrouped() === true`).

### Layout da linha

| Coluna | Conteúdo |
|---|---|
| 1 (label) | Botão de expand/collapse + label do grupo + indicador de profundidade |
| 2 (count) | Número de capítulos no grupo (`row.subRows.length`) |
| 3 (minutagem) | Soma de `editedSeconds` formatada (ver "Formatação") |
| 4 (ganho) | Soma de centavos formatada como BRL — opcional (ver "Feature flag") |
| 5 (status breakdown) | Lista compacta em PT-BR (ver "Formatação") |

A row de grupo NÃO mostra colunas de seleção (checkbox), ações (editar/excluir) ou narrator/editor/status individuais — essas vivem apenas em rows-folha (`<ChapterRow>`).

### Label do grupo

- Dimensão `narrator` ou `editor`:
  - `groupKey = row.getGroupingValue("narrator" | "editor")` → string (`id` ou `__unassigned__`).
  - Se `__unassigned__` → "Sem atribuição".
  - Senão → `row.original.narrator?.name` ou `row.original.editor?.name` da primeira folha. (Como todas as folhas do grupo compartilham o mesmo narrator/editor, basta pegar de qualquer folha.)
- Dimensão `status`:
  - `groupKey = row.getGroupingValue("status")` → `ChapterStatus`.
  - Renderiza `<StatusBadge status={groupKey}>` (componente já existente).

### Indentação por profundidade

- `row.depth` (0-based) indica nível na hierarquia.
- `padding-left` = `depth * 1.5rem` (Tailwind `pl-6 / pl-12 / ...` ou cálculo via `style={{ paddingLeft: ... }}` com design token).

### Botão de expand/collapse

- `<Button variant="ghost" size="icon" aria-expanded={row.getIsExpanded()} onClick={row.getToggleExpandedHandler()}>`.
- Ícone: `<ChevronRight />` quando colapsado, `<ChevronDown />` quando expandido.

---

## Formatação

### Minutagem

`formatGroupedSeconds(totalSeconds): string`:
- Calcula `hours = Math.floor(totalSeconds / 3600)` e `minutes = Math.floor((totalSeconds % 3600) / 60)`.
- Renderiza:
  - `hours === 0` → `"Ymin"` (ex: `"23min"`)
  - `minutes === 0` → `"Xh"` (ex: `"3h"`)
  - Senão → `"Xh Ymin"` (ex: `"1h 24min"`)
- `0 segundos` → `"0min"`.

**Onde mora**: `src/lib/utils.ts` (ao lado de `formatSecondsAsHHMMSS` existente).

### Ganho em BRL

Usar `formatCentsBRL(cents)` existente em `src/lib/utils.ts`. Ex: `R$ 1.245,30`.

### Status breakdown

`formatStatusBreakdown(breakdown: StatusBreakdown, groupingDimensionAtLevel: GroupingDimension | null): string`:
- Quando `groupingDimensionAtLevel === "status"` (a row já representa um status), retorna a contagem total apenas (FR-015): `"5 capítulos"`.
- Senão: lista status com contagem > 0, em ordem do enum (`pending → editing → reviewing → retake → completed → paid`), separados por `" · "`.
- Ex: `"3 concluídos · 1 em revisão"` (rótulos PT-BR singular/plural).

**Onde mora**: `src/lib/domain/chapter-aggregation.ts` (próximo das funções de agregação para coesão).

---

## Feature flag (FR-011)

- `showEarningsColumn` é injetada pela tabela pai. Cálculo:
  ```ts
  const isNarratorGroupLevel = groupingDimension === "narrator";
  const showEarningsColumn = !isNarratorGroupLevel || featureFlags.SHOW_EARNINGS_IN_NARRATOR_GROUPS;
  ```
- Quando `false`, a célula de ganho renderiza `<TableCell />` vazia (mantém alinhamento de colunas).
- A flag **não esconde a coluna do header da tabela** — apenas a célula agregada do grupo. Folhas mostram ganho normalmente.

---

## A11y

- Row inteira: `role="row"` (nativo de `<tr>`).
- Botão de expansão: `aria-expanded` + `aria-controls` (apontando para algum id de container se possível; opcional).
- Label do grupo é texto plain ou `<StatusBadge>` — screen readers leem natural.

---

## Data-testids

| Elemento | testid |
|---|---|
| Row do grupo | `chapter-group-row-<dimension>-<groupKey>` (ex: `chapter-group-row-narrator-abc-123`) |
| Botão expand/collapse | `chapter-group-toggle-<groupKey>` |
| Cell count | `chapter-group-count-<groupKey>` |
| Cell minutagem | `chapter-group-seconds-<groupKey>` |
| Cell ganho | `chapter-group-earnings-<groupKey>` |
| Cell breakdown | `chapter-group-breakdown-<groupKey>` |

---

## Test cases (E2E)

| ID | Setup | Expected |
|---|---|---|
| G-1 | Livro com 2 editores, agrupado por editor | 2 group rows + 1 "Sem atribuição" no fim |
| G-2 | Editor com 6 caps, soma `editedSeconds`=5040 (1h 24min) | Cell minutagem = "1h 24min" |
| G-3 | Editor com soma `editedSeconds`=0 | Cell minutagem = "0min" |
| G-4 | Editor com cap `paid` + cap `reviewing` | Cell breakdown = "1 pago · 1 em revisão" |
| G-5 | Agrupado por status (status = `paid`) | Cell breakdown = "N capítulos" (sem redundância) |
| G-6 | Flag `false`, agrupado por narrador | Cell de ganho vazia para grupos de narrador |
| G-7 | Flag `true`, agrupado por narrador | Cell de ganho mostra BRL formatado |
| G-8 | Group toggle click | row.getIsExpanded() vira true, sub-rows aparecem |
