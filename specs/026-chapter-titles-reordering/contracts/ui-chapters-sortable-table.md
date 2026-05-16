# Contract: `<ChaptersTable />` sortable

**Type**: UI component (alteração)
**Feature**: 026-chapter-titles-reordering
**File**: `src/components/features/chapters/chapters-table.tsx` + `chapter-row.tsx`

## Purpose

Tabela atual de capítulos de `/books/:id` ganha **drag-and-drop** + **botões ↑/↓** + **célula de título** (substituindo a célula de número).

## Visual changes per row

1. **Drag handle** (`<GripVertical />` de `lucide-react`) à esquerda. Cursor `grab` no hover, `grabbing` enquanto arrasta. Visível apenas no hover/focus em desktop; sempre visível em mobile.
2. **Botões ↑/↓** ao lado do handle: `<Button size="icon" variant="ghost">` com ícones `ChevronUp` / `ChevronDown`. Visíveis sempre (não escondidos em hover) para acessibilidade. Desabilitados nas extremidades (↑ na primeira linha, ↓ na última).
3. **Célula de título** substitui a célula `Capítulo N`. Exibe `chapter.title` truncado com tooltip se > 60 chars. No modo edição, vira `<Input>` ligado a `useChapterRowEdit`.

Colunas restantes (status, narrador, editor, edited_seconds, deadline, foco da semana, ações) inalteradas — exceto que a coluna de "número" não existe mais. A nova coluna de "título" ocupa a posição original do número.

## Reorder mechanics

- Wrapper: `<DndContext>` + `<SortableContext items={chapterIds} strategy={verticalListSortingStrategy}>` do `@dnd-kit/sortable`.
- Cada `<ChapterRow>` usa `useSortable({ id: chapter.id })`.
- Sensor padrão (`PointerSensor` + `KeyboardSensor`) cobre mouse, touch e teclado.
- Botões ↑/↓ chamam `useChaptersReorder().moveBy(chapterId, delta)`, que reusa a mesma lógica de aplicar a nova ordem + dispatch para o servidor.
- Drag overlay: clone da linha com sombra leve (`<DragOverlay>`).
- `onDragEnd`: cliente aplica nova ordem otimisticamente; dispara `PUT /chapters/order`. Em erro, reverte.

## Acessibilidade

- Cada handle tem `aria-label="Arrastar capítulo: {title}"`. `@dnd-kit` anuncia "Picked up", "Over", "Dropped".
- Botões ↑/↓ têm `aria-label="Mover capítulo {title} para cima"` / "...para baixo".
- Toast em PT-BR para erros: "Falha ao reordenar — a ordem foi revertida.".

## Performance

- Memo nas linhas (`React.memo` ou key=id).
- Sem re-render em cascata: o hook `useChaptersReorder` retorna ordem ordenada já memorizada com `useMemo`.

## Hooks consumidos

- `useChaptersReorder({ bookId, chapters, chaptersVersion })` — estado da ordem (otimista) + função `apply(orderedIds)` + função `moveBy(id, delta)`.
- `useChaptersTable(...)` — já existente; passa `orderedIds` para o reorder hook.

## Testes

- Unit (`use-chapters-reorder.spec.tsx`): aplicar nova ordem, rollback em erro, conflict 409.
- E2E: arrastar uma linha, recarregar, confirmar persistência.
- E2E: usar botão ↑ para mover, com navegação por teclado.
