# Contract: `useStudiosList`

**File**: `src/components/features/studios/hooks/use-studios-list.ts`
**Consumer**: `src/components/features/studios/studios-client.tsx`
**Replaces logic from**: `studios-client.tsx` (l. 22–77 da versão pré-refatoração)

---

## Signature

```ts
import type { Studio } from "@/lib/domain/studio";
import type { StudioListItem } from "@/lib/repositories/studio-repository";

export interface UseStudiosListReturn {
  // State
  readonly studios: readonly StudioListItem[];
  readonly sortedStudios: readonly StudioListItem[];
  readonly isCreating: boolean;
  readonly studioToDelete: Studio | null;
  readonly isDeleteDialogOpen: boolean;

  // Callbacks
  readonly handleNewClick: () => void;
  readonly handleCreated: (studio: Studio) => void;
  readonly handleCancelled: () => void;
  readonly handleUpdated: (studio: Studio) => void;
  readonly handleRequestDelete: (studio: Studio) => void;
  readonly handleDeleteDialogChange: (open: boolean) => void;
  readonly handleDeleted: (id: string) => void;
}

export function useStudiosList(
  initial: readonly StudioListItem[],
): UseStudiosListReturn;
```

## Inputs

| Param | Type | Notes |
|---|---|---|
| `initial` | `readonly StudioListItem[]` | Lista inicial vinda do Server Component. Hook **não** faz fetch desta lista — Server Component carrega. |

## Output details

### State

| Field | Type | Description |
|---|---|---|
| `studios` | `readonly StudioListItem[]` | Lista corrente, atualizada localmente após mutações. |
| `sortedStudios` | `readonly StudioListItem[]` | `studios` ordenado por `createdAt` desc. **Memoizado** (`useMemo`). |
| `isCreating` | `boolean` | `true` quando a linha de criação inline está visível. |
| `studioToDelete` | `Studio \| null` | Estúdio alvo do dialog de delete, ou `null`. |
| `isDeleteDialogOpen` | `boolean` | `studioToDelete !== null`. Conveniência para `<Dialog open={...}>`. |

### Callbacks

| Callback | Signature | Behavior |
|---|---|---|
| `handleNewClick` | `() => void` | Se `isCreating === true`, foca o input da linha de criação (via DOM `getElementById`). Se `false`, ativa modo de criação. |
| `handleCreated` | `(studio: Studio) => void` | Insere `{ ...studio, booksCount: 0 }` no estado, sai do modo criação, dispara `router.refresh()`. |
| `handleCancelled` | `() => void` | Sai do modo criação. |
| `handleUpdated` | `(studio: Studio) => void` | Substitui o estúdio por id, **preserva** o `booksCount` existente, dispara `router.refresh()`. |
| `handleRequestDelete` | `(studio: Studio) => void` | Define `studioToDelete = studio` (abre dialog). |
| `handleDeleteDialogChange` | `(open: boolean) => void` | Quando `open === false`, define `studioToDelete = null`. |
| `handleDeleted` | `(id: string) => void` | Remove estúdio do estado, dispara `router.refresh()`. |

## Side effects

- Lê `useRouter()` do `next/navigation` para chamar `router.refresh()` após cada mutação observável.
- Acessa `document.getElementById(NEW_ROW_NAME_INPUT_ID)` em `handleNewClick` quando o modo já está ativo (foco no input). Componente expõe esse ID via constante compartilhada.
- **Não** faz `fetch` — mutações são responsabilidade dos hooks específicos (`useCreateStudioForm`, `useDeleteStudio`).

## Invariants

- `sortedStudios.length === studios.length` sempre.
- `sortedStudios[0].createdAt >= sortedStudios[N-1].createdAt`.
- `isDeleteDialogOpen === (studioToDelete !== null)`.
- Após `handleCreated(studio)`: `studios.find(s => s.id === studio.id)?.booksCount === 0`.
- Após `handleUpdated(studio)`: `studios.find(s => s.id === studio.id)?.booksCount` é **preservado** do valor anterior (não vai a 0).
- Após `handleDeleted(id)`: `studios.find(s => s.id === id) === undefined`.

## Test fixtures (asserts mínimos)

```ts
test("retorna lista vazia quando initial é vazia", () => {
  const { result } = renderHook(() => useStudiosList([]));
  expect(result.current.studios).toEqual([]);
  expect(result.current.sortedStudios).toEqual([]);
  expect(result.current.isCreating).toBe(false);
  expect(result.current.studioToDelete).toBeNull();
});

test("sortedStudios ordena por createdAt desc", () => { /* ... */ });

test("handleNewClick alterna modo criação quando inativo", () => { /* ... */ });

test("handleCreated insere com booksCount=0 e desliga isCreating", () => { /* ... */ });

test("handleUpdated preserva booksCount existente", () => { /* ... */ });

test("handleRequestDelete abre dialog com o estúdio alvo", () => { /* ... */ });

test("handleDeleteDialogChange(false) limpa studioToDelete", () => { /* ... */ });

test("handleDeleted remove o estúdio do estado", () => { /* ... */ });
```

## Component contract (verificável por inspeção)

`studios-client.tsx` após refatoração:

- ✅ NÃO contém `useState`, `useMemo`, `useEffect`.
- ✅ Importa apenas `useStudiosList`, componentes UI/feature, e tipos de domínio.
- ✅ Reduz-se a: chamada `const { ... } = useStudiosList(initialStudios);` + JSX que consome o retorno.
- ✅ LOC esperado: ~40–55 (queda de ~50% em relação aos 108 atuais).
