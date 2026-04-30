# Contract: `useStudioRow` + `useUpdateStudioForm`

**Files**:
- `src/components/features/studios/hooks/use-studio-row.ts`
- `src/components/features/studios/hooks/use-update-studio-form.ts`

**Consumers**:
- `studio-row.tsx` (modo leitura) → `useStudioRow`
- `StudioRowEditMode` (componente interno; ou extraído como `studio-row-edit-mode.tsx`) → `useUpdateStudioForm`

**Replaces logic from**: `studio-row.tsx` (l. 26 `useState` + l. 86–234 `StudioRowEditMode` com `useRef`, `useEffect`, `useForm`, `onSubmit`, status handling).

---

## Sub-contract A: `useStudioRow`

### Signature

```ts
import type { Studio } from "@/lib/domain/studio";
import type { StudioListItem } from "@/lib/repositories/studio-repository";

export interface UseStudioRowArgs {
  readonly studio: StudioListItem;
  readonly onUpdated?: (studio: Studio) => void;
  readonly onRequestDelete?: (studio: Studio) => void;
}

export interface UseStudioRowReturn {
  // State
  readonly isEditing: boolean;

  // Callbacks
  readonly handleStartEdit: () => void;
  readonly handleCancelEdit: () => void;
  readonly handleEditCompleted: (updated: Studio) => void;
  readonly handleRequestDelete: () => void;
  readonly canDelete: boolean;
}

export function useStudioRow(args: UseStudioRowArgs): UseStudioRowReturn;
```

### State / callbacks

| Field/Callback | Behavior |
|---|---|
| `isEditing` | `true` ↔ row está em modo edição inline. |
| `handleStartEdit` | `setIsEditing(true)`. |
| `handleCancelEdit` | `setIsEditing(false)`. |
| `handleEditCompleted` | Chama `onUpdated?.(updated)` e `setIsEditing(false)`. Cobre o caso de sucesso da mutação. |
| `handleRequestDelete` | Chama `onRequestDelete?.(args.studio)` (passa o studio cru). |
| `canDelete` | `onRequestDelete !== undefined`. Componente usa para `disabled` no botão. |

### Invariants

- `canDelete === (onRequestDelete !== undefined)`.
- Após `handleEditCompleted(updated)`: `isEditing === false`.

### Test fixtures

```ts
test("inicia em modo leitura", () => { /* isEditing === false */ });
test("handleStartEdit liga modo edição", () => { /* ... */ });
test("handleEditCompleted desliga modo e propaga onUpdated", () => { /* ... */ });
test("canDelete reflete presença de onRequestDelete", () => { /* ... */ });
test("handleRequestDelete propaga o studio para onRequestDelete", () => { /* ... */ });
```

---

## Sub-contract B: `useUpdateStudioForm`

### Signature

```ts
import type { RefObject } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { Studio, StudioFormValues } from "@/lib/domain/studio";

export interface UseUpdateStudioFormArgs {
  readonly studioId: string;
  readonly form: UseFormReturn<StudioFormValues>;
  readonly onUpdated: (studio: Studio) => void;
}

export interface UseUpdateStudioFormReturn {
  readonly onSubmit: (values: StudioFormValues) => Promise<void>;
  readonly isSubmitting: boolean;
  readonly firstFieldRef: RefObject<HTMLInputElement | null>;
}

export function useUpdateStudioForm(
  args: UseUpdateStudioFormArgs,
): UseUpdateStudioFormReturn;
```

### Side effects

- `useEffect` interno foca `firstFieldRef.current` no mount.
- `fetch("/api/v1/studios/:id", { method: "PUT", body: JSON.stringify(values) })`.
- Em `200`: chama `onUpdated(body.data)`.
- Em `422`: `form.setError(field, { message })` por detail.
- Em `409` `NAME_ALREADY_IN_USE`: `form.setError("name", { message: "Nome já cadastrado" })`.
- Em outros status: `toast.error("Não foi possível salvar o estúdio. Tente novamente.")`.
- **Não** chama `toast.success`.

### Invariants

- `onSubmit` nunca lança.
- Após sucesso, `onUpdated` é chamado com o `Studio` retornado pelo backend (não com os `values` de entrada — o backend é a fonte da verdade após a mutação).

### Test fixtures

```ts
test("foca firstFieldRef no mount", () => { /* ... */ });
test("em 200, chama onUpdated com data e nunca toast.success", async () => { /* ... */ });
test("em 422, faz form.setError por detail.field", async () => { /* ... */ });
test("em 409 NAME_ALREADY_IN_USE, marca name com mensagem PT-BR", async () => { /* ... */ });
test("em 500, dispara toast.error", async () => { /* ... */ });
```

---

## Component contract (verificável por inspeção)

`studio-row.tsx` após refatoração:

- ✅ Componente leitura: importa `useStudioRow`, recebe `{ isEditing, handleStartEdit, handleEditCompleted, handleCancelEdit, handleRequestDelete, canDelete }`.
- ✅ Quando `isEditing`, delega para `<StudioRowEditMode>` (subcomponente).
- ✅ NÃO contém `useState`, `useRef`, `useEffect`, `fetch`, `useForm`, `onSubmit`.
- ✅ LOC esperado leitura: ~50.

`studio-row-edit-mode.tsx` (extraído como arquivo próprio durante a refatoração):

- ✅ Mantém `useForm(...)` e `<Controller>`.
- ✅ NÃO contém `fetch`, `useEffect`, `useRef`.
- ✅ Importa `useUpdateStudioForm`.
- ✅ LOC esperado: ~80–95.

**Nota estrutural**: `StudioRowEditMode` está hoje como função interna em `studio-row.tsx`. Durante a refatoração, ele deve ser **extraído para `studio-row-edit-mode.tsx`** próprio para manter `studio-row.tsx` < 100 LOC e respeitar Princípio XII (componentes < 200 LOC).
