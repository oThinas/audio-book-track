# Error Handling — Catálogo PT-BR + Wrapper Global + apiFetch

> Entrada rápida. Para o contexto completo, abrir
> [`specs/023-global-error-handler/spec.md`](../specs/023-global-error-handler/spec.md),
> [`plan.md`](../specs/023-global-error-handler/plan.md),
> [`research.md`](../specs/023-global-error-handler/research.md) e
> [`contracts/`](../specs/023-global-error-handler/contracts).

## Em uma frase

Erros nascem como **subclasses de `DomainError`** com `code` declarado, são interceptados pelo
**`withApiErrorHandler`** que mapeia para o envelope `{ error: { code, message, details? } }` em
PT-BR via [catálogo compartilhado](../src/lib/api/error-codes/), e o cliente consome tudo via
**`apiFetch<T>`** que retorna `ApiResult<T>` discriminado e dispara toasts por variant do catálogo.

## Servidor — escrever uma rota nova

1. **Schema Zod com mensagens PT-BR**: usar `.min(...)`, `.max(...)`, `.regex(...)` com a mensagem
   no segundo argumento. Defaults restantes são cobertos pelo `customError` global registrado em
   [`src/lib/schemas/zod-bootstrap.ts`](../src/lib/schemas/zod-bootstrap.ts) (locale `pt` built-in
   do Zod 4 + override `"Campo obrigatório."` para `undefined`/`null`).

2. **Service lança `DomainError`** apropriado quando uma regra de negócio falha. Adicionar code
   novo: criar a entrada em `src/lib/api/error-codes/<entidade>.ts` (`status` + `message` PT-BR +
   opcional `variant: "warning"`) e a classe em `src/lib/errors/<entidade>-errors.ts` extendendo
   `DomainError` com `readonly code = "..."`. Exemplo:

   ```ts
   // src/lib/errors/book-errors.ts
   export class BookNotFoundError extends DomainError {
     readonly code = "BOOK_NOT_FOUND";
     constructor(public readonly id: string) {
       super("Book not found");
     }
   }
   ```

   Mensagem do `Error.message` é **estática descritiva** (FR-018). Dados dinâmicos (ID, título,
   etc.) ficam como propriedades públicas; quando precisar surfaçar para a UI, declarar
   `getDetails()` na própria classe — o wrapper anexa em `error.details`.

3. **Handler é função pura** com assinatura `(request, ctx, routeDeps?)` exportada para testes,
   embrulhada por `withApiErrorHandler` no export HTTP:

   ```ts
   export async function handleBooksList(
     _request: Request,
     _ctx: AuthenticatedContext<Record<string, never>>,
     routeDeps: BooksRouteDeps = defaultRouteDeps,
   ): Promise<NextResponse> {
     const data = await routeDeps.createService().list();
     return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
   }

   export const GET = withApiErrorHandler(handleBooksList);
   ```

   O wrapper resolve sessão (devolve 401 `UNAUTHORIZED` se ausente quando `requireAuth` ≠ false),
   gera/ecoa `X-Request-Id`, captura `ZodError` → 422 `VALIDATION_ERROR`, `SyntaxError` → 422
   `INVALID_BODY`, `DomainError` → status do catálogo + `details`, qualquer outro `Error` → 500
   `INTERNAL_ERROR` com log estruturado.

4. **Não escrever try/catch nem `instanceof`** dentro da rota. Não usar `unauthorizedResponse` ou
   `validationErrorResponse` (já removidos). Schemas usam `.parse()` (não `.safeParse()`) — o erro
   do Zod sobe naturalmente para o wrapper.

## Cliente — escrever um hook novo

Sempre via `apiFetch<T>(url, options?)`. Retorna `ApiResult<T>`:

```ts
type ApiResult<T> =
  | { ok: true; data: T; headers: Headers }
  | { ok: false; kind: "session-expired" }
  | { ok: false; kind: "field-errors"; fields: Readonly<Record<string, string>> }
  | { ok: false; kind: "api-error"; code: string; details?: unknown }
  | { ok: false; kind: "network" };
```

Pattern típico em form de criação:

```ts
const result = await apiFetch<{ data: Studio }>("/api/v1/studios", {
  method: "POST",
  body: values,
});

if (result.ok) {
  onCreated(result.data.data);
  return;
}

if (result.kind === "field-errors") {
  for (const [field, message] of Object.entries(result.fields)) {
    form.setError(field as keyof StudioFormValues, { message });
  }
  return;
}

if (result.kind === "api-error" && result.code === "NAME_ALREADY_IN_USE") {
  form.setError("name", { message: "Nome já cadastrado." });
}
// session-expired, network, demais api-error: wrapper já tratou (toast/redirect).
```

O hook **não dispara `toast.error`/`toast.warning`** para resposta de API — o wrapper consulta
`errorCodes[code].variant` e dispara o toast certo. Usa `toast.warning(...)` apenas para
warnings de UX local sem origem em resposta (ex.: estúdio inline criado mas não vinculado).

### `result.headers` para metadata

Endpoints que sinalizam efeito colateral via header (ex.: `X-Book-Deleted: true` em DELETE de
último capítulo) leem via `result.headers`:

```ts
const result = await apiFetch<null>(`/api/v1/chapters/${id}`, { method: "DELETE" });
if (!result.ok) return;
const bookDeleted = result.headers.get("X-Book-Deleted") === "true";
```

### `suppressToastFor` (escape hatch raro)

Quando uma UI customizada substitui completamente o toast padrão (modal full-screen dedicado,
por exemplo), o hook pode passar `suppressToastFor: ["SOME_CODE"]` na chamada. Padrão é toast
+ UI complementar coexistirem; suppress exige justificativa em code review.

## Anti-padrões proibidos

- `try { fetch(...) } catch { toast.error(...) }` em hook de feature — `apiFetch` já cobre.
- `body?.error?.message` em hook de feature — wrapper já transforma em `result` discriminado.
- `if (response.status === 422) { for (const detail of body.error.details ?? []) { ... } }` —
  `apiFetch` já entrega `kind: "field-errors"` com `fields: Record<field, message>`.
- `try { ... } catch (e) { if (e instanceof XxxError) ... }` em rota `/api/v1/**` —
  `withApiErrorHandler` interpreta `DomainError` automaticamente.
- `unauthorizedResponse()` / `validationErrorResponse()` — helpers removidos.
- `Error.message` com interpolação de IDs ou dados dinâmicos — `Error.message` é **estático**;
  dados saem por `getDetails()` ou propriedades públicas (FR-018).
- Mensagens do schema com jargão de campo (`studioId`, `narratorId`, etc.) — usar rótulos
  user-facing (`Estúdio`, `Narrador`).

## Auditorias permanentes

Os seguintes greps **devem** retornar zero hits no projeto. Quebrar = regressão arquitetural:

```sh
grep -rn "instanceof.*Error" src/app/api/             # rotas usam wrapper, não instanceof
grep -rn "try {" src/app/api/v1/                      # idem
grep -rn "fetch(" src/components/features/ | grep -v "apiFetch"   # hooks usam apiFetch
grep -rn "body?.error?.message" src/components/features/          # idem
```

A spec 023 cobre essas auditorias em testes (`__tests__/integration/api-error-responses.spec.ts`
para o lado servidor; specs unit dos hooks para o cliente).

## Quando reabrir essa decisão

- **Rota pública** (sem auth) — `withApiErrorHandler(handler, { requireAuth: false })` — exemplo
  em [`src/app/api/health/route.ts`](../src/app/api/health/route.ts).
- **Rota fora de `/api/v1/**`** — login/signup do better-auth (`/api/auth/**`) está fora de
  escopo do `apiFetch`/wrapper por design (Assumption do spec 023).
- **Cliente externo** futuro (mobile, SDK, integração) — o catálogo PT-BR continua adequado,
  mas pode justificar adicionar i18n (`en-US`, etc.) no envelope.