# UI Contract — `ChapterGroupingControl`

**Feature**: 024 Chapter Grouping
**Component**: `src/components/features/chapters/chapter-grouping-control.tsx`

---

## Props

```ts
export interface ChapterGroupingControlProps {
  /** Estado atual da hierarquia de agrupamento. Ordem importa. */
  readonly grouping: ReadonlyArray<GroupingDimension>;
  /** Callback de mudança. Recebe nova hierarquia ordenada. */
  readonly onGroupingChange: (next: GroupingDimension[]) => void;
}
```

---

## Comportamento

### Trigger (botão fechado)

- `<Button variant="outline" size="sm">`.
- Texto: "Agrupar por" quando `grouping.length === 0`; senão, "Agrupando: " + lista de rótulos separada por " → ". Ex: "Agrupando: Narrador → Editor".
- Ícone: `<ChevronDown />` à direita; vira `<ChevronUp />` quando aberto.

### Menu aberto

- Header (não-clicável): "Agrupar por" (label em PT-BR).
- Item especial no topo: "Sem agrupamento" — clicar zera `grouping` (`onGroupingChange([])`); habilitado apenas quando `grouping.length > 0`.
- Separador.
- Três `DropdownMenuCheckboxItem`, na ordem fixa:
  - "Narrador" (`narrator`)
  - "Editor" (`editor`)
  - "Status" (`status`)
- Cada item:
  - `checked = grouping.includes(dimensão)`.
  - Clicar em item NÃO-marcado → `onGroupingChange([...grouping, dimensão])`.
  - Clicar em item marcado → `onGroupingChange(grouping.filter(d => d !== dimensão))`.

### Indicador de ordem

- Cada item marcado mostra um pequeno badge à direita com o índice 1-based dentro da hierarquia atual (ex: "1", "2"). Permite ao usuário visualizar a ordem que ele construiu pelos cliques.

### Acessibilidade

- Trigger: `aria-haspopup="menu"`, `aria-expanded` reflete estado aberto/fechado (gerenciado pelo Radix via shadcn).
- Cada item: `role="menuitemcheckbox"`, `aria-checked` reflete estado.
- Suporte completo a teclado: ↑/↓ navega, Space/Enter toggla, Esc fecha.

### Dark mode

- Componentes shadcn já garantem suporte; sem cores hardcoded.

### Data-testids (E2E)

| Elemento | testid |
|---|---|
| Trigger | `chapter-grouping-trigger` |
| Item "Sem agrupamento" | `chapter-grouping-clear` |
| Item por dimensão | `chapter-grouping-item-<dimension>` |
| Badge de ordem | `chapter-grouping-order-<dimension>` |

---

## Não-comportamentos (out of scope)

- **Sem drag-and-drop** — confirmado em clarify Q2.
- **Sem botão de "↑/↓"** para reordenar — usuário desmarca e re-marca.
- **Sem botão "Colapsar todos"** — fora do escopo (FR-008 cobre estado de expansão).
- **Sem filtro** — esta feature não filtra capítulos.

---

## Test cases (referência para E2E)

| ID | Pre-state | Ação | Expected post-state |
|---|---|---|---|
| C-1 | `grouping = []` | Click trigger | Menu aberto, todos itens desmarcados |
| C-2 | `grouping = []`, menu aberto | Click "Narrador" | `onGroupingChange(["narrator"])` |
| C-3 | `grouping = ["narrator"]` | Reabre menu | "Narrador" marcado com badge "1" |
| C-4 | `grouping = ["narrator"]`, menu aberto | Click "Editor" | `onGroupingChange(["narrator","editor"])` |
| C-5 | `grouping = ["narrator","editor"]` | Reabre menu | "Narrador" badge "1", "Editor" badge "2" |
| C-6 | `grouping = ["narrator","editor"]`, menu aberto | Click "Narrador" (marcado) | `onGroupingChange(["editor"])` |
| C-7 | `grouping = ["narrator","editor"]`, menu aberto | Click "Sem agrupamento" | `onGroupingChange([])` |
| C-8 | `grouping = []` | Trigger texto | "Agrupar por" |
| C-9 | `grouping = ["narrator","editor"]` | Trigger texto | "Agrupando: Narrador → Editor" |
