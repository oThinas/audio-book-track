# UI Contract: Coluna "Foco" na tabela `/books` + Badge "Foco da semana"

**Feature**: 025-chapter-deadline
**Components**:

- `src/components/features/books/book-focus-week-badge.tsx` (NOVO — badge visual puro).
- `src/components/features/books/books-table.tsx` (existente — recebe nova coluna).

> **Importante**: a tela `/books` é uma **tabela** (`BooksTable`), não um grid de cards. A apresentação da feature acontece como **célula de uma coluna nova chamada "Foco"**, inserida entre as colunas existentes `"Capítulos"` e `"Status"`. A badge em si é renderizada dentro dessa célula.

---

## Parte 1 — Nova coluna `"Foco"` em `books-table.tsx`

### Posicionamento

Ordem final de colunas em `books-table.tsx` (FR-025):

1. Título
2. Estúdio
3. Capítulos
4. **Foco** ← nova
5. Status
6. R$/hora
7. Ganho total

### Definição

```tsx
{
  id: "focusThisWeekCount",
  header: "Foco",
  accessorFn: (row) => row.focusThisWeekCount,
  enableSorting: false,                          // FR-013 da spec — padrão da página é não sortar (na verdade /books DEFAULT já sorta — mas Foco em particular não): manter consistência com decisão de produto Q7b para tabela do livro; em /books a tabela é sortável em outras colunas, mas Foco não agrega valor ordenado (decisão de produto a manter no implement). Caso o time prefira sortável: trocar para true.
  cell: ({ row }) => <BookFocusWeekBadge count={row.original.focusThisWeekCount} />,
}
```

### `BookSummaryRow` (interface usada por `BooksTable`)

Atualizar `src/components/features/books/books-table.tsx`:

```ts
export interface BookSummaryRow {
  readonly id: string;
  readonly title: string;
  readonly studio: { readonly id: string; readonly name: string };
  readonly pricePerHourCents: number;
  readonly status: BookStatus;
  readonly totalChapters: number;
  readonly completedChapters: number;
  readonly totalEarningsCents: number;
  readonly focusThisWeekCount: number;        // NOVO
}
```

Map de `BookSummary` → `BookSummaryRow` (provavelmente em `books-client.tsx` ou na fronteira server→client) ganha `focusThisWeekCount: book.focusThisWeekCount`.

---

## Parte 2 — `BookFocusWeekBadge` (componente)

### Props

```ts
interface BookFocusWeekBadgeProps {
  readonly count: number;
}
```

### Render rules (FR-025, FR-026)

#### Caso 1 — `count === 0`

Retorna `null`. Célula da coluna fica vazia (sem badge, sem placeholder textual).

#### Caso 2 — `count > 0`

```html
<Badge variant="secondary" className="gap-1.5">
  <TargetIcon aria-hidden className="h-3 w-3" />
  Foco da semana · 3
</Badge>
```

- `<Badge>` é primitivo shadcn (adicionado em T003).
- `variant="secondary"` → token neutro, dark-mode-friendly (Q20d).
- Ícone `Target` (`lucide-react`) — converge visualmente com o toggle "Foco da semana" no detalhe.
- Texto literal: `"Foco da semana · "` + count.
- Sem destaque interno para atrasados (Q20c).

---

## Acessibilidade

- Texto natural lido pelo screen reader: `"Foco da semana · 3"`. Sem `aria-label` adicional.
- Ícone com `aria-hidden="true"` (decorativo).
- Cabeçalho da coluna usa rótulo curto `"Foco"`. Quando vazio (sem badge), a célula é `<TableCell />` vazio — leitor de tela pula naturalmente.
- Em modo `BookFocusWeekBadge` com `count = 0`, retorna `null` literal: nada para o screen reader anunciar.

---

## Dark mode

- `variant="secondary"` usa tokens `bg-secondary` + `text-secondary-foreground` — adaptação automática.
- Nenhuma cor hardcoded em lugar nenhum.

---

## Comportamento dinâmico

A coluna não reage a mutações locais — `focusThisWeekCount` vem do servidor a cada listagem `/books`. Após alterar um capítulo em `/books/:id` (definir prazo, mudar status), voltar a `/books` força refetch do Server Component (Next.js App Router refaz o RSC). Sem subscription/websocket; sem otimização local de contagem.

---

## Coerência com filtro do detalhe (FR-027)

Garantia testada em integration (T041) e E2E (T043):

> Para qualquer livro listado em `/books` com badge "Foco da semana · N" na coluna "Foco", abrir `/books/:id` e ativar o toggle "Foco da semana" exibe exatamente N capítulos visíveis na tabela.

A regra SQL no `listSummaries` (contracts/api-books-list.md) é espelho exato de `isInFocusWeek` (helper de `lib/domain/chapter-deadline.ts`).

---

## Test plan

### Component (`book-focus-week-badge.spec.tsx`)

- `count = 0` → componente retorna `null` (no DOM emitido).
- `count = 1` → renderiza badge com texto exato `"Foco da semana · 1"`, ícone presente com `aria-hidden="true"`.
- `count = 50` → renderiza com `"Foco da semana · 50"`. Tipografia/layout não quebra.
- Classe contém `bg-secondary` (via verificação de className do `Badge`).

### Books-table (parcial)

- Renderizar `<BooksTable books={[{...mock, focusThisWeekCount: 0}, {...mock, focusThisWeekCount: 5}]} />`.
- Verifica que a primeira linha tem célula vazia na coluna "Foco" e a segunda tem badge com "Foco da semana · 5".
- Verifica que o cabeçalho da nova coluna é `"Foco"` e está posicionado entre `"Capítulos"` e `"Status"`.

### E2E (incluído em `chapter-deadline.spec.ts`, T043)

- Livro novo sem prazos → célula "Foco" vazia.
- Após definir prazo de 1 capítulo dentro da semana via UI → voltar para `/books` → célula "Foco" da linha desse livro exibe `"Foco da semana · 1"`.
- Mover o capítulo para `paid` → voltar para `/books` → célula "Foco" volta a ficar vazia.
