# Contract: `useCreateStudioForm`

**File**: `src/components/features/studios/hooks/use-create-studio-form.ts`
**Consumer**: `src/components/features/studios/studio-new-row.tsx`
**Replaces logic from**: `studio-new-row.tsx` `useEffect`, `onSubmit`, status handling, `setError` calls.

> Padrão R4 (research.md): `useForm()` permanece **dentro** do componente; o hook recebe a instância do form e cuida do submit/mutation.

---

## Signature

```ts
import type { RefObject } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { Studio, StudioFormValues } from "@/lib/domain/studio";

export interface UseCreateStudioFormArgs {
  readonly form: UseFormReturn<StudioFormValues>;
  readonly onCreated: (studio: Studio) => void;
}

export interface UseCreateStudioFormReturn {
  readonly onSubmit: (values: StudioFormValues) => Promise<void>;
  readonly isSubmitting: boolean;
  readonly firstFieldRef: RefObject<HTMLInputElement | null>;
}

export function useCreateStudioForm(
  args: UseCreateStudioFormArgs,
): UseCreateStudioFormReturn;
```

## Inputs

| Param | Type | Notes |
|---|---|---|
| `args.form` | `UseFormReturn<StudioFormValues>` | Instância vinda do `useForm()` no componente. Hook usa `form.setError`, `form.formState.isSubmitting`. |
| `args.onCreated` | `(studio: Studio) => void` | Callback que o componente pai (`studios-client`) injeta para atualizar a lista após criação. |

## Output details

| Field | Type | Description |
|---|---|---|
| `onSubmit` | `(values: StudioFormValues) => Promise<void>` | Submit handler que faz `POST /api/v1/studios`, trata 201/422/409/erro genérico. |
| `isSubmitting` | `boolean` | Espelha `form.formState.isSubmitting` para conveniência (componente pode usar `form.formState.isSubmitting` diretamente, mas exposto aqui para legibilidade). |
| `firstFieldRef` | `RefObject<HTMLInputElement \| null>` | Ref do primeiro input. Hook usa `useEffect` interno para focar no mount. Componente atribui esse ref ao `<Input ref={...}>`. |

## Side effects

- `useEffect` (cleanup automático): no mount, foca `firstFieldRef.current`.
- `fetch("/api/v1/studios", { method: "POST", ... })` no submit.
- Em `201`: chama `onCreated(body.data)`.
- Em `422`: itera `body.error.details`; chama `form.setError(field, { message })` para cada campo conhecido (`name`, `defaultHourlyRateCents`).
- Em `409` com `body.error.code === "NAME_ALREADY_IN_USE"`: chama `form.setError("name", { message: "Nome já cadastrado" })`.
- Em qualquer outro status: `toast.error("Não foi possível salvar o estúdio. Tente novamente.")`.

## Invariants

- `onSubmit` **nunca** lança exceção — todos os erros viram `setError` (validação) ou `toast.error` (sistêmico).
- Após `201`: `onCreated` é chamado **antes** de qualquer outro side-effect (importante para sincronização de estado no pai).
- Tratamento de erro **não** chama `toast.success` nem variantes verdes (constituição Princípio VII / XII).
- Hook **não** faz `router.refresh()` — esse é responsabilidade do `useStudiosList.handleCreated` (separação de responsabilidades).

## Test fixtures (asserts mínimos)

```ts
describe("useCreateStudioForm", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  test("foca firstFieldRef no mount", () => { /* ... */ });

  test("em 201, chama onCreated com data e não chama toast.error", async () => { /* ... */ });

  test("em 422, mapeia detail.field para form.setError", async () => { /* ... */ });

  test("em 409 NAME_ALREADY_IN_USE, marca name com mensagem PT-BR", async () => { /* ... */ });

  test("em 500, dispara toast.error e não chama onCreated", async () => { /* ... */ });

  test("nunca chama toast.success", async () => { /* asserção sobre o módulo `sonner` */ });
});
```

## Component contract (verificável por inspeção)

`studio-new-row.tsx` após refatoração:

- ✅ Mantém `useForm(...)` e `<Controller>` para `MoneyInput` (R4).
- ✅ NÃO contém `fetch`, `useEffect`, `useRef`.
- ✅ Importa `useCreateStudioForm`, recebe `{ onSubmit, isSubmitting, firstFieldRef }`.
- ✅ Conecta `firstFieldRef` ao `<Input ref={...}>` via callback ref combinado com `register`.
- ✅ LOC esperado: ~90–110 (queda em relação aos 158 atuais).
