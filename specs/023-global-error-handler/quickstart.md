# Quickstart: Global Error Handler

**Branch**: `023-global-error-handler` | **Date**: 2026-05-06

Receita curta para devs depois que esta feature for mergeada. Cobre os três fluxos mais comuns: criar uma rota nova, adicionar um erro de domínio novo, e consumir uma rota num hook.

---

## 1. Criar uma rota `/api/v1/**`

```ts
// src/app/api/v1/widgets/route.ts
import { withApiErrorHandler } from "@/lib/api/with-error-handler";
import { createWidgetSchema } from "@/lib/schemas/widget";
import { createWidgetService } from "@/lib/factories/widget";
import { NextResponse } from "next/server";
import { NO_STORE_HEADERS } from "@/lib/api/headers";

export const GET = withApiErrorHandler(async (_request, { session }) => {
  const widgets = await createWidgetService().list();
  return NextResponse.json({ data: widgets }, { headers: NO_STORE_HEADERS });
});

export const POST = withApiErrorHandler(async (request, { session }) => {
  const body = createWidgetSchema.parse(await request.json());
  const widget = await createWidgetService().create(body);
  return NextResponse.json(
    { data: widget },
    { status: 201, headers: { ...NO_STORE_HEADERS, Location: `/api/v1/widgets/${widget.id}` } },
  );
});
```

**Quem cuida do quê**:

| Concern | Responsável |
|---------|-------------|
| Sessão (401 `UNAUTHORIZED`) | `withApiErrorHandler` |
| `request.json()` malformado (422 `INVALID_BODY`) | `withApiErrorHandler` (capturando `SyntaxError`) |
| `ZodError` do `.parse()` (422 `VALIDATION_ERROR`) | `withApiErrorHandler` |
| Erro de domínio (`WidgetNotFoundError`, etc.) | `withApiErrorHandler` via `errorRegistry` |
| Erro inesperado (500 `INTERNAL_ERROR`) | `withApiErrorHandler` (com log estruturado) |
| `X-Request-Id` em todas as respostas | `withApiErrorHandler` |

**Não faça**:

```ts
// ❌ try/catch instanceof — anti-padrão
export async function POST(request: Request) {
  try { /* … */ }
  catch (e) {
    if (e instanceof WidgetNotFoundError) return notFoundResponse(...);
    throw e;
  }
}
```

---

## 2. Adicionar um novo erro de domínio

**Passo 1** — Criar a classe (mesmo padrão atual):

```ts
// src/lib/errors/widget-errors.ts
export class WidgetQuotaExceededError extends Error {
  constructor(readonly quota: number) {
    super(`Widget quota exceeded: ${quota}`);  // mensagem em inglês — log interno apenas
    this.name = "WidgetQuotaExceededError";
  }
}
```

**Passo 2** — Adicionar `code` no catálogo:

```ts
// src/lib/api/error-codes.ts
export const errorCodes = {
  // …
  WIDGET_QUOTA_EXCEEDED: { status: 429, message: "Limite de widgets atingido. Reduza a quantidade ou aguarde a próxima janela." },
} as const;
```

**Passo 3** — Mapear classe → code no registry:

```ts
// src/lib/api/error-registry.ts
import { WidgetQuotaExceededError } from "@/lib/errors/widget-errors";

export const errorRegistry = [
  // …
  { errorClass: WidgetQuotaExceededError, code: "WIDGET_QUOTA_EXCEEDED" },
] as const;
```

**Passo 4** — Lançar normalmente do service:

```ts
if (currentCount >= MAX_WIDGETS) {
  throw new WidgetQuotaExceededError(MAX_WIDGETS);
}
```

**Pronto**. O handler global captura, mapeia, responde 429 com mensagem PT-BR, e o cliente já mostra toast correspondente automaticamente. Os testes unitários `error-codes.spec.ts` e `error-registry.spec.ts` falham se você esquecer dos passos 2 ou 3.

---

## 3. Consumir uma rota num hook

```ts
// src/components/features/widgets/hooks/use-create-widget-form.ts
"use client";
import { useForm } from "react-hook-form";
import { apiFetch } from "@/lib/api/api-fetch";

export function useCreateWidgetForm() {
  const form = useForm<CreateWidgetInput>();

  const onSubmit = form.handleSubmit(async (data) => {
    const result = await apiFetch<Widget>("/api/v1/widgets", { method: "POST", body: data });

    if (!result.ok) {
      if (result.kind === "field-errors") {
        for (const [field, message] of Object.entries(result.fields)) {
          form.setError(field as keyof CreateWidgetInput, { message });
        }
      }
      // demais kinds: wrapper já mostrou toast / redirect
      return;
    }

    // sucesso
    onCreated(result.data);
    form.reset();
  });

  return { form, onSubmit };
}
```

**O que NÃO está mais no hook**:

- `try/catch` em torno de `fetch`
- `toast.error(...)` para erros de API
- `body?.error?.message ?? "fallback"`
- Iteração manual de `details[]` para campos genéricos (apenas o conversor `Record<field, message>` — ver `kind: "field-errors"`)

---

## 4. UI customizada para um code específico

Quando você quer mostrar um modal/lista estruturada além (ou em vez de) toast genérico:

```ts
const result = await apiFetch<void>(`/api/v1/studios/${id}`, {
  method: "DELETE",
  suppressToastFor: ["STUDIO_HAS_ACTIVE_BOOKS"],
});

if (!result.ok) {
  if (result.kind === "api-error" && result.code === "STUDIO_HAS_ACTIVE_BOOKS") {
    // wrapper NÃO disparou toast — você renderiza
    setBlockingBooks(result.details);
    setShowBlockedDialog(true);
    return;
  }
  return;
}
```

`suppressToastFor` é exceção, não regra. Em code review, espere uma pergunta: "por que não basta o toast?"

---

## 5. Migrar mensagens Zod para PT-BR

Schemas existentes ganham mensagens explícitas:

```ts
// antes
export const createWidgetSchema = z.object({
  name: z.string().min(1),
  size: z.number().int().positive(),
});

// depois
export const createWidgetSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório."),
  size: z.number().int("Informe um número inteiro.").positive("Informe um valor positivo."),
});
```

Para defaults remanescentes (`Required`, `Invalid input`), o `errorMap` global em `src/lib/schemas/_zod-error-map.ts` traduz automaticamente.

---

## 6. Verificação local antes do PR

Em sequência (não em loop por fase, conforme CLAUDE.md):

```bash
bun run lint
bun run test:unit
bun run test:integration
bun run test:e2e          # quando hooks ou rotas foram tocados
bun run build
```

Asserções específicas que esta feature adiciona:

- `__tests__/unit/api/error-codes.spec.ts` — catálogo é exaustivo e mensagens não vazam.
- `__tests__/unit/api/error-registry.spec.ts` — toda classe em `src/lib/errors/*-errors.ts` aparece exatamente uma vez.
- `__tests__/integration/api-error-responses.spec.ts` — cross-route leak audit.
- `__tests__/e2e/error-toasts.spec.ts` — texto PT-BR exato em toast por entidade.

---

## 7. Troubleshooting

**"Estou recebendo `INTERNAL_ERROR` em vez do code do meu erro de domínio"**
→ Você esqueceu de adicionar a classe ao `errorRegistry`. Rode `bun run test:unit __tests__/unit/api/error-registry.spec.ts`.

**"Toast não está aparecendo"**
→ Verifique se o componente raiz (RootLayout) tem `<Toaster />` montado (sonner) e `<NavigationProvider />` (para o redirect de 401 funcionar).

**"`X-Request-Id` aparece com valor estranho ('undefined' ou vazio)"**
→ A rota não foi envolvida em `withApiErrorHandler`. Toda rota nova **deve** usar o wrapper.

**"Quero saber qual o `requestId` da chamada que falhou"**
→ Abra DevTools → Network → resposta da chamada → header `X-Request-Id`. Cole no log search do servidor (Datadog/Vercel logs).
