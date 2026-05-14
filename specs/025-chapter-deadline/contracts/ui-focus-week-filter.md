# UI Contract: Toggle "Foco da semana" + URL state

**Feature**: 025-chapter-deadline
**Components**:

- `src/components/features/chapters/chapter-focus-week-toggle.tsx` (NOVO — visual)
- `src/components/features/chapters/hooks/use-focus-week-filter.ts` (NOVO — lógica)
- `src/lib/url/focus-param.ts` (NOVO — parse/serialize)

---

## URL contract

| Estado | URL |
|---|---|
| Filtro desligado (default) | `/books/:id` (sem `focus`) |
| Filtro ligado | `/books/:id?focus=week` |

Coexistência com 024:

- `/books/:id?focus=week&group=narrator,status` — ambos respeitados.

Valores reconhecidos para `focus`:

- `"week"` → liga filtro.
- ausente / qualquer outro valor (`"all"`, `"asdf"`, `""`) → filtro desligado.

### `src/lib/url/focus-param.ts`

```ts
export type FocusWeekState = "week" | null;

export function parseFocusParam(searchParams: URLSearchParams): FocusWeekState {
  const raw = searchParams.get("focus");
  return raw === "week" ? "week" : null;
}

export function serializeFocusParam(value: FocusWeekState): string | null {
  return value === "week" ? "week" : null;
}
```

---

## Hook contract

```ts
// src/components/features/chapters/hooks/use-focus-week-filter.ts
export interface UseFocusWeekFilterResult {
  readonly enabled: boolean;
  readonly toggle: () => void;
  readonly applyFilter: (chapters: ReadonlyArray<Chapter>) => Chapter[];
}

export function useFocusWeekFilter(): UseFocusWeekFilterResult;
```

Comportamento:

- Lê `searchParams` via `useSearchParams()` (Next.js App Router).
- `toggle()` chama `router.replace(...)` mantendo todos os outros params; usa `serializeFocusParam` para `set`/`delete` `focus`.
- `applyFilter` é uma função pura derivada (memoizada por `useMemo`) que retorna o array filtrado segundo `isInFocusWeek(c, ctx)`.
- `ctx` (FocusWeekContext) é calculado uma vez por render via `useMemo(() => ({ todayIso, mondayIso, sundayIso }), [])` — não recalcula a cada keystroke. Aceitável recalcular ao montar/remontar; mudança de dia durante sessão aberta é cobertura de Edge Case na spec mas não exige refresh automático (gestor recarrega a página).

---

## Toggle visual

```tsx
<Button
  variant={enabled ? "default" : "outline"}
  size="sm"
  onClick={toggle}
  aria-pressed={enabled}
  className="gap-2"
>
  <TargetIcon aria-hidden className="h-4 w-4" />
  Foco da semana
</Button>
```

- Ícone `Target` (`lucide-react`) — converge com a badge na coluna "Foco" da tabela `/books`.
- `aria-pressed` informa estado de toggle ao leitor de tela.
- Posicionamento: ao lado do controle de grouping existente (feature 024), na barra de ações da tabela.

### Mobile-first

- O botão respeita o gap mínimo de toque (44×44 área de toque). `size="sm"` mantém visual; padding interno do shadcn já atende.
- Em viewport estreita, o controle pode quebrar abaixo do grouping (flex-wrap natural).

---

## Comportamento de filtro (FR-019 a FR-024)

Pseudo-código de `applyFilter`:

```ts
function applyFilter(chapters: ReadonlyArray<Chapter>): Chapter[] {
  if (!enabled) return [...chapters];
  return chapters.filter((c) => isInFocusWeek(c, ctx));
}
```

`isInFocusWeek` (de `src/lib/domain/chapter-deadline.ts`):

```ts
function isInFocusWeek(c: Chapter, ctx: FocusWeekContext): boolean {
  if (c.deadline === null) return false;
  if (!ACTIVE_STATUSES.has(c.status)) return false;
  // atrasado OR dentro da semana
  return c.deadline < ctx.todayIso || (c.deadline >= ctx.mondayIso && c.deadline <= ctx.sundayIso);
}
```

---

## Combinação com grouping (feature 024)

Pipeline na `chapters-table.tsx`:

```tsx
const { applyFilter, enabled } = useFocusWeekFilter();
const filteredChapters = useMemo(() => applyFilter(chapters), [applyFilter, chapters]);
const { groups } = useChaptersGroupingState(filteredChapters, groupingParams);
```

- Filtro reduz a lista. Agrupamento opera sobre o reduzido. Resultado: grupos vazios são automaticamente ocultos (já é comportamento de 024).

---

## Estado vazio

Quando o filtro está ligado e nenhum capítulo casa:

```tsx
{filteredChapters.length === 0 && enabled && (
  <TableEmptyState>
    Nenhum capítulo no foco desta semana.
  </TableEmptyState>
)}
```

(Reuso de padrão de empty state já existente na tabela.)

---

## Test plan

### Unit (`focus-param.ts`)

- `parseFocusParam(new URLSearchParams("?focus=week"))` → `"week"`.
- `parseFocusParam(new URLSearchParams(""))` → `null`.
- `parseFocusParam(new URLSearchParams("?focus=banana"))` → `null`.
- `serializeFocusParam("week")` → `"week"`.
- `serializeFocusParam(null)` → `null`.

### Unit (`use-focus-week-filter`)

Mockar `next/navigation` (allowed; framework boundary). Render com `Wrapper` controlando search params.

- `?focus=week` → `enabled === true`; filtro aplicado.
- Sem param → `enabled === false`; lista completa retornada.
- `toggle()` quando desligado chama `router.replace` com `focus=week`.
- `toggle()` quando ligado chama `router.replace` sem `focus`.
- `toggle()` preserva `?group=narrator,status` se presente.

### Unit (helper `isInFocusWeek`)

Tabela paramétrica (status × deadline relative position):

| status | deadline | esperado |
|---|---|---|
| pending | null | false |
| pending | hoje − 1 | true |
| pending | hoje | true |
| pending | segunda | true |
| pending | domingo | true |
| pending | domingo + 1 | false |
| editing | hoje − 5 | true |
| reviewing | sábado | true |
| retake | quarta | true |
| completed | hoje − 1 | false |
| completed | quarta | false |
| paid | quarta | false |
| paid | hoje − 100 | false |

### Integration / E2E

- E2E: criar livro com capítulos fixture, ligar filtro, conferir contagem. Recarregar URL para validar persistência.
- E2E combinação: ligar filtro + grouping ao mesmo tempo (feature 024).
