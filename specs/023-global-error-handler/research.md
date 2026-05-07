# Research: Global Error Handler

**Branch**: `023-global-error-handler` | **Date**: 2026-05-06

Phase 0 documenta as decisões técnicas concretas. Como todos os 5 itens de `/speckit-clarify` foram resolvidos antes de chegar aqui, esta seção registra o **fechamento** dessas decisões mais decisões secundárias derivadas, não há `NEEDS CLARIFICATION` aberto.

---

## D-01: Catálogo compartilhado server + client

**Decision**: Um único módulo `src/lib/api/error-codes.ts` exporta:

```ts
export const errorCodes = {
  UNAUTHORIZED: { status: 401, message: "Sua sessão expirou. Faça login novamente." },
  VALIDATION_ERROR: { status: 422, message: "Os dados enviados são inválidos." },
  INVALID_BODY: { status: 422, message: "Os dados enviados são inválidos." },
  INTERNAL_ERROR: { status: 500, message: "Algo deu errado. Tente novamente em instantes." },
  NETWORK_ERROR: { status: 0, message: "Verifique sua conexão e tente novamente." },
  // domain
  BOOK_NOT_FOUND: { status: 404, message: "Livro não encontrado." },
  // … etc
} as const;

export type ErrorCode = keyof typeof errorCodes;
```

`status: 0` é um sentinel para erros que nunca chegam a ter resposta HTTP (ex.: falha de rede); o cliente trata como caso especial.

**Rationale**: Q3 (clarification) — drift entre listas separadas é a falha silenciosa mais cara nesta feature. Estrutura flat `Record<code, {status, message}>` é trivial, type-safe, e remove qualquer ambiguidade de "qual `status` casa com qual `code`".

**Alternatives considered**:
- **Dois arquivos + teste comparador** (Q3 opção A) — funciona, mas duplica manutenção e exige um teste extra para detectar drift. O custo do teste é maior do que o custo do módulo único.
- **Codegen do servidor para o cliente** (Q3 opção C) — over-engineering para o tamanho do projeto; adicionaria build step, hook de CI, e ainda assim não resolveria edição manual proibida sem mais infraestrutura.

---

## D-02: Onde mora o registry server-side

**Decision**: `src/lib/api/error-registry.ts` exporta:

```ts
type ErrorRegistryEntry = {
  readonly errorClass: new (...args: any[]) => Error;
  readonly code: ErrorCode;
  readonly extractDetails?: (error: Error) => unknown;
};

export const errorRegistry: ReadonlyArray<ErrorRegistryEntry> = [
  { errorClass: BookNotFoundError, code: "BOOK_NOT_FOUND" },
  { errorClass: BookTitleAlreadyInUseError, code: "TITLE_ALREADY_IN_USE" },
  { errorClass: StudioHasActiveBooksError, code: "STUDIO_HAS_ACTIVE_BOOKS",
    extractDetails: (e) => ({ books: (e as StudioHasActiveBooksError).books }) },
  // … todas as classes
];
```

`extractDetails` é opcional e existe para os poucos casos que carregam dado estruturado (`books` em `StudioHasActiveBooksError`, etc.). O catálogo de `code` em D-01 já contém o `status` e a `message`; o registry só liga classe → code.

**Rationale**: Manter `code` e `message` no catálogo (D-01) e separar o map de classes mantém uma responsabilidade por arquivo. Permite teste unitário do registry sem precisar importar o catálogo.

**Alternatives considered**:
- **Map ao invés de Array** — Map de classes não é serializável e requer mutação (`new Map().set(...)`); Array constante é mais idiomático em TS e imutável.
- **Decorator em cada classe de erro** — invasivo, não funciona para classes que vêm de bibliotecas, e exige config TS extra.

---

## D-03: Forma do `withApiErrorHandler`

**Decision**: HOF que recebe um handler tipado e retorna outro handler:

```ts
type RouteHandler<TParams = unknown> = (
  request: Request,
  context: { params?: TParams; session: Session },
) => Promise<NextResponse>;

export function withApiErrorHandler<TParams = unknown>(
  handler: RouteHandler<TParams>,
  options?: { requireAuth?: boolean /* default true */ },
): NextRouteHandler<TParams>;
```

O wrapper:
1. Gera/ecoa `X-Request-Id`.
2. Resolve sessão (se `requireAuth: true`, default) e responde 401 ao faltar.
3. Faz `try { await handler(req, ctx) } catch (e)`:
   - `instanceof ZodError` → 422 `VALIDATION_ERROR` com `details[]`.
   - `SyntaxError` em `request.json()` → 422 `INVALID_BODY` (capturado por wrapper around the call ou pela rota chamando `parseBody(request)` helper).
   - Procura no `errorRegistry` por `errorClass` que case (`error instanceof entry.errorClass`); aplica `code` + `extractDetails`, deriva `status` e `message` do catálogo.
   - Não casou → log estruturado com stack + `requestId` + 500 `INTERNAL_ERROR` genérico.
4. Garante `X-Request-Id` no header de resposta independente do caminho de saída.

**Rationale**: Centraliza tudo numa única função; rotas escrevem só o caminho feliz. Suporta `requireAuth: false` para `/api/health` e similares (sem sessão).

**Alternatives considered**:
- **Next.js middleware** (`middleware.ts`) — não tem acesso ao corpo parseado nem à sessão facilmente, e roda fora do contexto de tipagem do route handler. Misturaria responsabilidades.
- **`try/catch` em cada rota com helper compartilhado** (status quo melhorado) — não elimina duplicação; cada rota ainda repetiria boilerplate.

---

## D-04: Mensagens Zod PT-BR — onde escrever

**Decision** (Q1 da clarification): Cada chamada Zod recebe a mensagem PT-BR no segundo argumento:

```ts
z.string().min(1, "Nome é obrigatório.").max(120, "Nome deve ter no máximo 120 caracteres.")
z.string().email("Informe um e-mail válido.")
z.number().int("Informe um número inteiro.").positive("Informe um valor positivo.")
```

Para tipos básicos (`z.string()` sem refino), usar `errorMap` do schema raiz em `src/lib/schemas/_zod-error-map.ts` que traduz mensagens default do Zod (ex.: `"Required"` → `"Campo obrigatório."`, `"Invalid input"` → `"Valor inválido."`).

**Rationale**: Co-localizar mensagens com a regra de validação é a leitura mais natural do schema. Um `errorMap` global pega os defaults remanescentes sem exigir que cada `z.string()` repita `"Campo obrigatório."`.

**Alternatives considered**:
- **Tradução no handler** (Q1 opção B) — duplica a API de mensagens do Zod e gera "two-way trip" para algo que o Zod já permite.
- **Híbrido** (Q1 opção C) — a regra "schema vence se tiver mensagem, fallback no handler" é correta, mas o `errorMap` global do Zod já entrega esse comportamento sem código extra.

---

## D-05: Distinção 404 vs 422 para foreign references

**Decision** (Q2 da clarification):

| Cenário | Status | Code |
|---------|--------|------|
| `GET /api/v1/books/{id}` com `id` inexistente | 404 | `BOOK_NOT_FOUND` |
| `POST /api/v1/books { studioId: "<inexistente>" }` | 422 | `STUDIO_REFERENCE_INVALID` |
| `PATCH /api/v1/chapters/{id} { narratorId: "<inexistente>" }` | 422 | `NARRATOR_REFERENCE_INVALID` |

Renomeações de classes (alinhamento nome ↔ code, FR-007a atualizado):
- `BookStudioNotFoundError` → **renomeada para `StudioReferenceInvalidError`** e movida para `studio-errors.ts`. Mapeia para `STUDIO_REFERENCE_INVALID`.
- `BookInlineStudioInvalidError` → mantém o nome (sem code novo); mapeia para `INLINE_STUDIO_INVALID` (semântica distinta — payload mal formado, não FK ausente).
- Classes futuras nessa categoria seguem o padrão `{Entity}ReferenceInvalidError` ↔ `{ENTITY}_REFERENCE_INVALID`.

Adicionalmente, todos os constructors de erros existentes são refatorados para FR-018:
- `Error.message` torna-se string **estática** (ex.: `"Book not found"` em vez de `` `Book not found: ${id}` ``).
- IDs e dados dinâmicos passam para propriedades públicas da classe.
- `extractDetails` no registry pesca essas propriedades quando relevante para `error.details`.

**Rationale**: Q2 — REST semantics: 404 para recurso da URL, 422 para dado inválido em payload.

**Alternatives considered**:
- Tudo 404 (Q2 opção B) — pratica errada de "404-everything"; clientes não distinguem ausência de URL vs payload.
- Tudo 422 (Q2 opção C) — quebra `GET /resource/:id`, que é canônico 404.

---

## D-06: Logger estruturado mínimo

**Decision**: `src/lib/logger/server-logger.ts` exporta:

```ts
export interface ServerLogger {
  error(message: string, context: Record<string, unknown>): void;
  warn(message: string, context: Record<string, unknown>): void;
  info(message: string, context: Record<string, unknown>): void;
}

export const serverLogger: ServerLogger = {
  error: (msg, ctx) => console.error(JSON.stringify({ level: "error", msg, ...ctx })),
  warn:  (msg, ctx) => console.warn(JSON.stringify({ level: "warn",  msg, ...ctx })),
  info:  (msg, ctx) => console.info(JSON.stringify({ level: "info",  msg, ...ctx })),
};
```

Em testes, injeta-se um fake (`{ error: vi.fn(), … }`) via parâmetro do `withApiErrorHandler({ logger })`.

**Rationale**: `console.*` com JSON é estruturado o bastante para Vercel/Cloud Run/Datadog ingestion. Não introduz dependência (Pino, Winston) prematura. Trocável por construção quando a feature de logging dedicada chegar.

**Alternatives considered**:
- **Pino** — útil, mas adiciona ~80kb e API extra para lidar com log levels de child loggers; YAGNI agora.
- **Sem logger, só `console.error`** — funciona, mas perde estrutura e correlação por `requestId` em queries de log.

---

## D-07: Geração e propagação do `X-Request-Id`

**Decision**: `crypto.randomUUID()` (disponível em Node.js 20+ e em runtime Edge). Propagação via `AsyncLocalStorage`:

```ts
import { AsyncLocalStorage } from "node:async_hooks";

export const requestContext = new AsyncLocalStorage<{ requestId: string }>();
```

`withApiErrorHandler` envolve o handler em `requestContext.run({ requestId }, () => handler(...))`. O logger lê `requestContext.getStore()?.requestId` automaticamente.

**Rationale**: Permite que qualquer ponto da call stack — incluindo services profundos — logue com `requestId` sem prop drilling. `AsyncLocalStorage` é estável no Node 20+ e no runtime Node.js do Vercel; **não disponível em runtime Edge**, mas as rotas `/api/v1/**` desta feature rodam em Node.js (default do Next 16 App Router para rotas com Drizzle).

**Alternatives considered**:
- **Passar `requestId` por parâmetro** — invasivo; obrigaria todo service a aceitar o ID.
- **Header parsing manual em cada rota** — exige boilerplate; o handler global já é o ponto natural.

---

## D-08: Implementação de `apiFetch` no cliente

**Decision**: Função pura que envolve `fetch`:

```ts
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "session-expired" }
  | { ok: false; kind: "field-errors"; fields: Record<string, string> }
  | { ok: false; kind: "api-error"; code: ErrorCode; details?: unknown }
  | { ok: false; kind: "network" };

export async function apiFetch<T>(
  url: string,
  init?: RequestInit & { suppressToastFor?: ReadonlyArray<ErrorCode> },
): Promise<ApiResult<T>>;
```

Comportamentos:
- **2xx** → `{ ok: true, data }` (parse JSON; 204 → `data: null`).
- **401** → debounce (~1s, `WeakRef` shared) → `toast.warning(messages.UNAUTHORIZED)` + `router.replace("/login")` → retorna `{ ok: false, kind: "session-expired" }`.
- **422 + `code === "VALIDATION_ERROR"`** → constrói `fields: Record<field, message>` a partir de `details[]` → retorna `{ ok: false, kind: "field-errors", fields }` (sem toast).
- **Outros 4xx/5xx** → `code` recebido. **Comportamento padrão: sempre dispara toast** (variant lido do catálogo: `warning` para erros bloqueantes destrutivos, `error` para os demais) com `messages[code] ?? messages.INTERNAL_ERROR`. `details` (quando presente) é retornado **junto** para que o hook renderize UI complementar ao toast. `suppressToastFor` é escape hatch raro para casos onde a UI substitui completamente o toast. Retorna `{ ok: false, kind: "api-error", code, details }`.
- **Fetch rejeitado / network** → `toast.error(messages.NETWORK_ERROR)` → `{ ok: false, kind: "network" }`.
- **Code desconhecido pelo catálogo** → `console.warn("apiFetch: unknown code", code)` + toast com `messages.INTERNAL_ERROR`. Retorna como `api-error` com o code original.

`router.replace` vem de `useRouter` do Next; como `apiFetch` é função, usar uma **Singleton de navegação** registrada em `src/components/features/auth/navigation-singleton.ts` que o `RootLayout` ou um provider de cliente registra ao montar:

```ts
let navigate: ((path: string) => void) | null = null;
export function registerNavigator(fn: (path: string) => void) { navigate = fn; }
export function navigateTo(path: string) { navigate?.(path); }
```

**Rationale**: `apiFetch` precisa rodar fora do contexto de hook (pode ser chamada de dentro de hooks, mas a função em si é utility). O singleton de navegação é o padrão estabelecido em apps Next que usam fetch wrappers fora de hooks (sonner já faz isso para `<Toaster />`).

**Alternatives considered**:
- **Hook `useApiFetch`** — força hooks a chamarem outro hook; não funciona em utilities ou para hooks condicionais.
- **`window.location.href = "/login"`** — funciona mas perde estado de cliente do Next (hard reload). `router.replace` preserva estado.

---

## D-09: Detalhamento da regra anti-leak

**Decision**: Regex patterns auditados em `__tests__/integration/api-error-responses.spec.ts` (extensão de FR-017):

```ts
const LEAK_PATTERNS = [
  /Error:/,                  // class names
  /\bat \//, /^\s+at /m,     // stack frames
  /sql:/i, /select |insert |update |delete from/i,  // SQL fragments
  /postgres:\/\//i,          // connection URIs
  /\/[A-Za-z_\-]+\/[A-Za-z_\-]+\.(ts|tsx|js)/,  // file paths
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/,  // UUIDs
  /\b(Book|Chapter|Studio|Narrator|Editor)\b/,  // English domain names
  /soft-delete|FK|constraint|null violation/i,  // technical jargon
] as const;
```

Aplicado a **todas** as respostas de erro de **todas** as rotas (`/api/v1/**`) via teste data-driven que enumera o `errorRegistry`.

**Rationale**: SC-001 exige "100% das respostas de erro passam por testes que validam ausência de leak". Lista exaustiva no teste é a forma mais simples de cumprir.

**Alternatives considered**:
- **Sanitização runtime no handler** (regex stripping) — frágil, esconde bugs em vez de prevenir.
- **Type-level proibition** — TS não consegue enforçar conteúdo de string em runtime.

---

## D-10: Backwards-compat de codes existentes

**Decision**: Os codes já consumidos por testes e pelo cliente atual permanecem:

| Code atual | Mantido? | Notas |
|------------|----------|-------|
| `UNAUTHORIZED` | Sim | |
| `VALIDATION_ERROR` | Sim | |
| `BOOK_NOT_FOUND`, `STUDIO_NOT_FOUND`, `CHAPTER_NOT_FOUND`, `NARRATOR_NOT_FOUND`, `EDITOR_NOT_FOUND` | Sim | 404 |
| `NAME_ALREADY_IN_USE`, `TITLE_ALREADY_IN_USE`, `EMAIL_ALREADY_IN_USE` | Sim | 409 |
| `STUDIO_HAS_ACTIVE_BOOKS`, `NARRATOR_LINKED_TO_ACTIVE_CHAPTERS`, `EDITOR_LINKED_TO_ACTIVE_CHAPTERS` | Sim | 409 |
| `STUDIO_NOT_FOUND` (no contexto de payload de criação de livro, hoje 422) | **Renomeado para `STUDIO_REFERENCE_INVALID`** | Q2; testes que asseveravam o code antigo nesse contexto são atualizados |
| `INLINE_STUDIO_INVALID` | Sim | |
| `BOOK_PAID_PRICE_LOCKED`, `BOOK_PAID_STUDIO_LOCKED`, `BOOK_CANNOT_REDUCE_CHAPTERS` | Sim | 409 / 422 conforme registry |
| `CHAPTER_PAID_LOCKED`, `CHAPTER_INVALID_TRANSITION`, `CHAPTER_NARRATOR_REQUIRED`, `CHAPTER_EDITOR_OR_SECONDS_REQUIRED`, `CHAPTER_REVERSION_CONFIRMATION_REQUIRED`, `CHAPTERS_NOT_IN_BOOK`, `CHAPTER_NUMBER_ALREADY_IN_USE` | Sim | 409 / 422 |
| `INVALID_BODY` | **Novo** | substitui o atual `VALIDATION_ERROR` para JSON malformado (mais claro) |
| `INTERNAL_ERROR` | **Novo** | 500 genérico antes só era stack escapado |
| `NETWORK_ERROR` | **Novo** | client-only, sentinel `status: 0` |

**Rationale**: Quebrar codes existentes força mudanças em testes/clientes; manter quando possível reduz superfície da migração.

**Alternatives considered**:
- **Reset total de codes** — limpeza, mas custo de migração alto sem ganho funcional.

---

## D-11: Ordem de migração (sequenciamento técnico)

**Decision**:

1. **Foundation** — criar `error-codes.ts`, `error-registry.ts` com codes/classes existentes; criar `with-error-handler.ts` e `api-fetch.ts`. Sem mudar nenhuma rota ainda.
2. **Tests-first** — escrever os testes unit do catálogo/registry/handler/wrapper, mais a extensão do `api-error-responses.spec.ts` cross-route. Eles falham (RED).
3. **Server migration** — refatorar rotas `/api/v1/**` uma por uma para usar `withApiErrorHandler`; a cada rota, os testes correspondentes ficam GREEN.
4. **Zod messages** — migrar mensagens dos schemas Zod para PT-BR; adicionar `errorMap` global.
5. **Client migration** — refatorar hooks de feature para usar `apiFetch`; ajustar testes E2E que dependiam de strings antigas.
6. **Final pass** — fase final de qualidade (`bun run lint`, todos os testes, `bun run build`).

**Rationale**: Tests-first cumpre Princípio V; a sequência permite que cada rota seja migrada e validada isoladamente, evitando uma mega-mudança intratável de revisar.

**Alternatives considered**:
- **Migrar tudo num commit gigante** — viola o spírito do TDD e dificulta code-review.

---

## Itens NÃO investigados (out-of-scope desta feature)

Documentado em `Assumptions` da spec; reproduzido aqui para visibilidade:

- Mapeamento específico para erros de Drizzle (unique constraint vinda do banco) — caem no fallback 500.
- Cobertura de Server Components / Server Actions / `/api/auth/**` — fora de escopo.
- Logger estruturado completo (Pino, Winston, OTel) — fica para feature futura; D-06 entrega o mínimo.
- i18n para outros idiomas — fora de escopo.
