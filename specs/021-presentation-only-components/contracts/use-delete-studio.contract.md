# Contract: `useDeleteStudio`

**File**: `src/components/features/studios/hooks/use-delete-studio.ts`
**Consumer**: `src/components/features/studios/delete-studio-dialog.tsx`
**Replaces logic from**: `delete-studio-dialog.tsx` — chamadas `fetch` ao confirmar delete + tratamento de erros + propagação de sucesso.

---

## Signature

```ts
import type { Studio } from "@/lib/domain/studio";

export interface UseDeleteStudioArgs {
  readonly studio: Studio | null;
  readonly onConfirmed: (id: string) => void;
  readonly onOpenChange: (open: boolean) => void;
}

export interface UseDeleteStudioReturn {
  readonly isDeleting: boolean;
  readonly error: string | null;
  readonly handleConfirm: () => Promise<void>;
  readonly handleCancel: () => void;
}

export function useDeleteStudio(args: UseDeleteStudioArgs): UseDeleteStudioReturn;
```

## Inputs

| Param | Type | Notes |
|---|---|---|
| `studio` | `Studio \| null` | Estúdio alvo — `null` quando dialog fechado. Hook não dispara fetch quando `null`. |
| `onConfirmed` | `(id: string) => void` | Callback do pai (`studios-client` via `useStudiosList.handleDeleted`) — atualiza a lista. |
| `onOpenChange` | `(open: boolean) => void` | Callback do pai para fechar o dialog. Hook chama `onOpenChange(false)` em sucesso e em cancelamento. |

## Output details

| Field | Behavior |
|---|---|
| `isDeleting` | `true` enquanto o fetch DELETE está em voo. |
| `error` | Mensagem PT-BR para exibição no dialog quando algo falha (ex.: 409 com `BOOKS_EXIST`). `null` em estado limpo. |
| `handleConfirm` | Dispara `DELETE /api/v1/studios/:id`. Em sucesso: `onConfirmed(studio.id)` + `onOpenChange(false)`. Em 409 com motivo conhecido: define `error` e mantém dialog aberto. Em erro genérico: `toast.error(...)` e fecha dialog. |
| `handleCancel` | `onOpenChange(false)` — limpa `error` interno se aplicável. |

## Side effects

- `fetch("/api/v1/studios/:id", { method: "DELETE" })`.
- Em `204` (No Content): chama `onConfirmed(studio.id)` e `onOpenChange(false)`.
- Em `409` com `body.error.code === "BOOKS_EXIST"` (ou equivalente do projeto): define `error = "Estúdio possui livros e não pode ser excluído."`. Mantém dialog aberto. **Não** fecha automaticamente.
- Em outros status: `toast.error("Não foi possível excluir o estúdio. Tente novamente.")` e fecha dialog.
- **Nunca** chama `toast.success` ou variantes verdes (Princípio VII / XII).

## Invariants

- Se `studio === null`: `handleConfirm` é no-op (early return). Garante que dialog "vazio" não dispara DELETE acidental.
- `isDeleting` é `false` antes de `handleConfirm` e após resolução (sucesso ou erro).
- `error` é resetado para `null` quando `studio` muda (alvo trocou) ou quando dialog reabre.

## Test fixtures (asserts mínimos)

```ts
describe("useDeleteStudio", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  test("handleConfirm é no-op quando studio é null", async () => { /* fetch nunca chamado */ });

  test("em 204, chama onConfirmed(id) e onOpenChange(false)", async () => { /* ... */ });

  test("em 409 BOOKS_EXIST, define error PT-BR e mantém dialog aberto", async () => {
    // expect(result.current.error).toContain("livros");
    // expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  test("em 500, dispara toast.error e fecha dialog", async () => { /* ... */ });

  test("nunca chama toast.success", async () => { /* asserção sobre o módulo `sonner` */ });

  test("error é resetado quando studio muda", () => { /* rerender com novo studio */ });
});
```

## Component contract (verificável por inspeção)

`delete-studio-dialog.tsx` após refatoração:

- ✅ NÃO contém `fetch`, `useState` (exceto se houver estado puramente visual restante do shadcn Dialog).
- ✅ Importa `useDeleteStudio`, recebe `{ isDeleting, error, handleConfirm, handleCancel }`.
- ✅ JSX renderiza `<AlertDialog>` (ou equivalente shadcn) com mensagem dinâmica baseada em `studio.name` e exibe `error` quando presente.
- ✅ LOC esperado: ~55–70 (queda em relação aos 104 atuais).
