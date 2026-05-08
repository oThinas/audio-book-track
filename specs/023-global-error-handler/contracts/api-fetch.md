# Contract: `apiFetch<T>` — Client Wrapper

**Branch**: `023-global-error-handler` | **Status**: stable

Wrapper único de cliente para chamadas a `/api/v1/**`. Substitui `fetch` direto em hooks de feature.

## Signature

```ts
import type { ErrorCode } from "@/lib/api/error-codes";

export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly kind: "session-expired" }
  | { readonly ok: false; readonly kind: "field-errors"; readonly fields: Readonly<Record<string, string>> }
  | { readonly ok: false; readonly kind: "api-error"; readonly code: ErrorCode; readonly details?: unknown }
  | { readonly ok: false; readonly kind: "network" };

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  readonly body?: unknown;                        // serialized via JSON.stringify if defined
  readonly suppressToastFor?: ReadonlyArray<ErrorCode>;
}

export function apiFetch<T = unknown>(url: string, options?: ApiFetchOptions): Promise<ApiResult<T>>;
```

## Behavior matrix

| HTTP outcome | Toast disparado pelo wrapper | Retorno |
|--------------|------------------------------|---------|
| 200 / 201 com JSON | — | `{ ok: true, data: T }` |
| 204 | — | `{ ok: true, data: null }` |
| 401 (`UNAUTHORIZED`) | `toast.warning("Sua sessão expirou. Faça login novamente.")` (debounce ~1s) **+** redirect para `/login` | `{ ok: false, kind: "session-expired" }` |
| 422 + `code === "VALIDATION_ERROR"` | — (validação fica inline) | `{ ok: false, kind: "field-errors", fields: { [field]: message } }` |
| 422 + `code === "INVALID_BODY"` | `toast.error(messages.INVALID_BODY)` | `{ ok: false, kind: "api-error", code: "INVALID_BODY" }` |
| 4xx/5xx outros, `code` no catálogo | `toast.error/.warning(messages[code])` (variant per catalog) | `{ ok: false, kind: "api-error", code, details? }` |
| 4xx/5xx com `code` desconhecido | `console.warn("apiFetch: unknown code", code)` + `toast.error(messages.INTERNAL_ERROR)` | `{ ok: false, kind: "api-error", code: <recebido>, details? }` |
| 5xx sem corpo JSON parseável | `toast.error(messages.INTERNAL_ERROR)` | `{ ok: false, kind: "api-error", code: "INTERNAL_ERROR" }` |
| Fetch rejeitado / `TypeError: Failed to fetch` | `toast.error(messages.NETWORK_ERROR)` | `{ ok: false, kind: "network" }` |

## Comportamento padrão: toast sempre + `details` para UI complementar

Erros server-side **sempre** disparam toast pelo wrapper (exceto 422 `VALIDATION_ERROR`, que é feedback inline via RHF). Quando o erro carrega `details` estruturado, o `result` retorna esses dados em paralelo para que o hook renderize UI complementar **junto** ao toast — não em vez dele.

```ts
const result = await apiFetch<void>(`/api/v1/studios/${id}`, { method: "DELETE" });

if (!result.ok) {
  if (result.kind === "api-error" && result.code === "STUDIO_HAS_ACTIVE_BOOKS") {
    // Toast warning JÁ foi disparado pelo wrapper.
    // Hook ainda renderiza a lista estruturada em UI complementar (dialog, popover, etc.):
    setBlockingBooks(result.details.books);
  }
  return;
}
```

## `suppressToastFor` (escape hatch raro)

Em casos onde a UI customizada **substitui completamente** o toast (ex.: dialog modal full-screen que já comunica o erro com clareza própria), o wrapper aceita `suppressToastFor: code[]` por chamada para evitar duplicação visual:

```ts
const result = await apiFetch<void>(`/api/v1/something/${id}`, {
  method: "DELETE",
  suppressToastFor: ["SOME_DEDICATED_MODAL_CODE"],
});

if (!result.ok && result.kind === "api-error" && result.code === "SOME_DEDICATED_MODAL_CODE") {
  // wrapper NÃO disparou toast; hook abre o dialog dedicado com result.details
  openDedicatedModal(result.details);
  return;
}
```

Regras:
- `suppressToastFor` afeta apenas `kind: "api-error"`.
- 401 (`session-expired`), 422 `VALIDATION_ERROR` (`field-errors`) e `network` **ignoram** essa opção.
- **Uso é exceção e exige justificativa em code review.** O padrão é toast + UI complementar (não substituição).

## Cabeçalhos enviados / recebidos

- Default `Content-Type: application/json` quando há `body` (objeto serializado via `JSON.stringify`).
- Default `Accept: application/json`.
- Cookies de sessão fluem normalmente (mesmo origin).
- O wrapper **lê** `X-Request-Id` da resposta apenas para logging em `console.warn` quando o `code` é desconhecido (facilita correlação com logs do servidor durante debug).

## Hook usage pattern

**Antes** (status quo a ser eliminado):

```ts
const onSubmit = async (data: FormData) => {
  setIsSubmitting(true);
  try {
    const res = await fetch("/api/v1/studios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      if (res.status === 422 && body?.error?.details) {
        for (const detail of body.error.details) {
          form.setError(detail.field, { message: detail.message });
        }
        return;
      }
      toast.error(body?.error?.message ?? "Não foi possível salvar o estúdio. Tente novamente.");
      return;
    }
    onCreated();
  } catch (e) {
    toast.error("Não foi possível salvar o estúdio. Tente novamente.");
  } finally {
    setIsSubmitting(false);
  }
};
```

**Depois** (target):

```ts
const onSubmit = async (data: FormData) => {
  setIsSubmitting(true);
  const result = await apiFetch<Studio>("/api/v1/studios", { method: "POST", body: data });
  setIsSubmitting(false);
  if (!result.ok) {
    if (result.kind === "field-errors") {
      for (const [field, message] of Object.entries(result.fields)) {
        form.setError(field as keyof FormData, { message });
      }
    }
    return; // demais kinds: wrapper já tratou (toast, redirect)
  }
  onCreated(result.data);
};
```

## Navigation singleton

`apiFetch` precisa redirecionar em 401, mas é função (não hook). Solução: singleton de navegação registrado pelo provider raiz do cliente.

```ts
// src/components/features/auth/navigation-singleton.ts
let navigate: ((path: string) => void) | null = null;

export function registerNavigator(fn: (path: string) => void): void {
  navigate = fn;
}

export function navigateToLogin(): void {
  if (navigate) navigate("/login");
  else if (typeof window !== "undefined") window.location.replace("/login");
}
```

```tsx
// src/components/providers/navigation-provider.tsx (client component, montado em RootLayout)
"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { registerNavigator } from "@/components/features/auth/navigation-singleton";

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    registerNavigator((path) => router.replace(path));
  }, [router]);
  return <>{children}</>;
}
```

## Testing surface

- `__tests__/unit/api/api-fetch.spec.ts`: cada caso da matriz acima com fetch mockado (`vi.fn`) + sonner mockado + navigator singleton spied.
- `__tests__/e2e/error-toasts.spec.ts`: pelo menos um cenário por entidade (estúdio/livro/capítulo/narrador/editor) verifica texto PT-BR exato no toast.
- E2E também valida 401 → toast warning → redirect para `/login` em fluxo único.

## Out-of-scope

- Retries automáticos, exponential backoff, request deduplication — fora desta feature.
- Cache de resposta (TanStack Query, SWR) — não é introduzido aqui; `apiFetch` é primitive de baixo nível.
- WebSockets / streams — `apiFetch` é só JSON request/response.
