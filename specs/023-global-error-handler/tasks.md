---

description: "Task list for feature 023-global-error-handler"
---

# Tasks: Global Error Handler

**Input**: Design documents from `/specs/023-global-error-handler/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)
**Tests**: TDD obrigatório (Princípio V — tests-first, ≥80% cobertura). Toda task de implementação tem task de teste correspondente RED antes.

**Organization**: Tasks são agrupadas por user story para permitir implementação e validação independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: Qual user story (US1, US2, US3) — ou nenhum para Setup/Foundational/Polish
- Inclui caminhos absolutos relativos à raiz do repo

## Path Conventions

Single Next.js project (existing layout):
- `src/lib/api/` — handler, wrapper, catálogo, registry
- `src/lib/errors/` — classes de domínio
- `src/lib/schemas/` + `src/lib/domain/` — Zod schemas
- `src/lib/logger/` — logger mínimo (novo)
- `src/app/api/v1/**/route.ts` — controllers
- `src/components/features/**/hooks/*.ts` — hooks de feature
- `__tests__/unit/`, `__tests__/integration/`, `__tests__/e2e/` — testes

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialização sem dependência de domínio.

- [X] T001 Verificar baseline de testes existentes rodando `bun run test:unit && bun run test:integration && bun run test:e2e` para garantir suite verde antes de começar (registrar contagem de specs no PR). **Baseline (2026-05-07)**: unit 91 files / 875 tests, integration 32 files / 216 tests, e2e 214 tests — todos verdes.
- [X] T002 [P] Validar que o runtime de produção (Node 20+ via Vercel/Next.js) suporta `crypto.randomUUID()` e `AsyncLocalStorage`. Conferir `package.json#engines`, `next.config.js`/`vercel.json` para forçar `nodejs` runtime nas rotas afetadas; ajustar se necessário. **Resultado**: Node 25.9.0 local; nenhum `export const runtime = "edge"` em `src/app/api/**` (default = Node runtime); `next.config.ts` sem override; sem `vercel.json` (Vercel default Node 20+). Nenhum ajuste necessário.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Módulos compartilhados (catálogo, logger, request-id, navegação) que bloqueiam US1/US2/US3. Sem mexer em rotas nem hooks ainda.

**⚠️ CRITICAL**: Nenhum trabalho de US pode começar antes deste bloco fechar.

### Catálogo compartilhado e logger

- [ ] T003 [P] Criar `__tests__/unit/api/error-codes.spec.ts` (RED) com asserções: (a) toda chave do catálogo é `UPPER_SNAKE_CASE`, (b) toda `message` é não-vazia e PT-BR (regex `[À-ÿ]` ou ausência de palavras inglês de domínio), (c) `status` ∈ `{0, 401, 404, 409, 422, 500}`, (d) `variant` ∈ `{undefined, "error", "warning"}`, (e) catálogo cobre exaustivamente o tipo `ErrorCode` (compile-time via `Record<ErrorCode, …>`).
- [ ] T004 Criar `src/lib/api/error-codes.ts` com a união `ErrorCode` (32 codes — ver [data-model.md](./data-model.md#errorcode-union)) e `errorCodes: Record<ErrorCode, ErrorCatalogEntry>` com `status`/`message` PT-BR/`variant` conforme [contracts/error-codes.md](./contracts/error-codes.md). T003 deve ficar GREEN.
- [ ] T005 [P] Criar `src/lib/logger/server-logger.ts` exportando `serverLogger: ServerLogger` (interface `error/warn/info(msg, ctx)`) que serializa JSON via `console.error/warn/info`.
- [ ] T006 [P] Criar `__tests__/unit/logger/server-logger.spec.ts` (RED) com asserções: cada método produz JSON com `level`, `msg`, e mistura de `ctx`. Usar `vi.spyOn(console, "error" /* … */)` para captura.

### Request ID e contexto de execução

- [ ] T007 [P] Criar `__tests__/unit/api/request-id.spec.ts` (RED): (a) `generateRequestId()` retorna UUID v4 (regex), (b) `extractOrCreateRequestId(headers)` ecoa `X-Request-Id` válido vindo do header de entrada e gera novo quando ausente/inválido.
- [ ] T008 Criar `src/lib/api/request-id.ts` com `generateRequestId()` e `extractOrCreateRequestId(headers: Headers): string`. T007 GREEN.
- [ ] T009 [P] Criar `src/lib/api/request-context.ts` exportando `requestContext: AsyncLocalStorage<{ requestId: string }>` e helper `getCurrentRequestId(): string | null`.
- [ ] T010 [P] Criar `__tests__/unit/api/request-context.spec.ts` (RED) que envolve uma função em `requestContext.run({ requestId: "abc" }, fn)` e verifica que `getCurrentRequestId()` dentro de `fn` retorna `"abc"`.

### Headers helper update

- [ ] T011 [P] Atualizar `src/lib/api/headers.ts` adicionando export `requestIdHeader(id: string): Record<string, string>` que retorna `{ "X-Request-Id": id }`. Manter `NO_STORE_HEADERS` intacto.

### Navigation singleton (cliente)

- [ ] T012 [P] Criar `__tests__/unit/api/navigation-singleton.spec.ts` (RED): (a) `registerNavigator(fn)` armazena fn, (b) `navigateToLogin()` invoca a fn registrada com `"/login"`, (c) sem fn registrada cai em fallback `window.location.replace`.
- [ ] T013 Criar `src/components/features/auth/navigation-singleton.ts` com `registerNavigator(fn: (path: string) => void): void` + `navigateToLogin(): void`. T012 GREEN.
- [ ] T014 Criar `src/components/features/auth/navigation-provider.tsx` (`"use client"`) que registra `router.replace` no singleton via `useEffect`. (Co-localizado com o singleton em `auth/`; sem nova pasta top-level.)
- [ ] T015 Montar `<NavigationProvider />` em `src/app/layout.tsx` (ou no provider raiz autenticado existente) sem afetar Server Components.

**Checkpoint**: Catálogo, logger, request-id e singleton de navegação prontos. US1/US2/US3 podem iniciar.

---

## Phase 3: User Story 2 - Handler global na camada de API (Priority: P1)

> **Nota**: US2 vai antes de US1 porque o handler **lê** o catálogo e disponibiliza a tradução PT-BR via mapeamento; refatorar mensagens (US1) sem o handler levaria a duplicação de trabalho.

**Goal**: Substituir `try/catch instanceof` em todas as rotas `/api/v1/**` por `withApiErrorHandler`. Erros desconhecidos viram 500 genérico com log estruturado e `X-Request-Id`.

**Independent Test**: A suíte `__tests__/integration/api-error-responses.spec.ts` estendida cobre cada combinação `(rota, classe de Error de domínio)` e verifica `(status, code, message PT-BR, ausência de leak)`. Injeção de exceção arbitrária em qualquer rota produz 500 com `INTERNAL_ERROR` e log capturado.

### Tests (RED)

- [ ] T016 [P] [US2] Criar `__tests__/unit/api/error-registry.spec.ts` (RED): (a) toda classe exportada de `src/lib/errors/*-errors.ts` aparece **exatamente uma vez** em `errorRegistry`, (b) todo `code` referenciado no registry existe em `errorCodes`, (c) `extractDetails`, quando definido, é função.
- [ ] T017 [P] [US2] Criar `__tests__/unit/api/with-error-handler.spec.ts` (RED) cobrindo:
  - sucesso: handler retorna `NextResponse` 200 com `X-Request-Id` ecoado/gerado.
  - 401: handler com `requireAuth: true` (default) retorna 401 `UNAUTHORIZED` quando `getSession` retorna `null`.
  - 422 Zod: handler relança `ZodError` → wrapper retorna 422 `VALIDATION_ERROR` com `details[]`.
  - 422 INVALID_BODY: handler que faz `request.json()` em payload inválido → wrapper captura `SyntaxError` → 422 `INVALID_BODY`.
  - registry hit: handler lança `BookNotFoundError` → wrapper retorna 404 `BOOK_NOT_FOUND` PT-BR.
  - extractDetails: handler lança `StudioHasActiveBooksError` → wrapper inclui `details.books`.
  - 500 fallback: handler lança `new Error("internal: select * from users")` → wrapper retorna 500 `INTERNAL_ERROR` PT-BR; logger fake recebe a exceção original com stack e `requestId`; nenhum dos LEAK_PATTERNS aparece no body.
  - `X-Request-Id`: presente em todas as variações acima; ecoa header de entrada quando válido.
- [ ] T018 [P] [US2] Estender `__tests__/integration/api-error-responses.spec.ts` (RED) para iterar **todas** as rotas `/api/v1/**` e **todas** as classes de erro mapeáveis, asserindo `LEAK_PATTERNS` ampliado (incluindo UUID, inglês de domínio, jargão técnico — ver [research.md D-09](./research.md)). Adicionar fixtures factory para acionar cada `errorClass` real do registry via service real (não mock).

### Implementation

- [ ] T019 [US2] Criar `src/lib/api/error-registry.ts` com `errorRegistry: ReadonlyArray<ErrorRegistryEntry>` populado conforme [data-model.md](./data-model.md#errorregistryentry-server-side). T016 GREEN.
- [ ] T020 [US2] Criar `src/lib/api/with-error-handler.ts` exportando `withApiErrorHandler<TParams>(handler, options?)`. Comportamento conforme [research.md D-03](./research.md). Aceita `logger`, `getSession`, `headersFn` injetáveis (default real, fakes em teste). T017 GREEN.
- [ ] T021 [US2] Atualizar `src/lib/api/responses.ts` para exportar somente helpers que ainda fazem sentido como utilitários puros (e.g. `jsonOk`, `jsonCreated`); marcar `unauthorizedResponse`/`validationErrorResponse` como **deprecated** com JSDoc apontando para o handler global. Não remover ainda — rotas legadas usam até T022..T031.
- [ ] T022 [US2] Migrar `src/app/api/v1/books/route.ts` para `withApiErrorHandler`. Remover `try/catch instanceof Book*Error`; lançamentos vêm dos services intocados. Usar `request.json()` direto (sem try) — wrapper trata `SyntaxError`. Schema `createBookSchema.parse(...)` (não `safeParse`).
- [ ] T023 [US2] Migrar `src/app/api/v1/books/[id]/route.ts` (`PATCH`, `DELETE`) — remover try/catch; substituir uso de `BookStudioNotFoundError` pela classe renomeada `StudioReferenceInvalidError` (importada do mesmo arquivo de erros; ver T034b). Code emitido passa a ser `STUDIO_REFERENCE_INVALID` (Q2 / D-05).
- [ ] T024 [US2] Migrar `src/app/api/v1/books/[id]/chapters/bulk-delete/route.ts`.
- [ ] T025 [US2] Migrar `src/app/api/v1/chapters/[id]/route.ts`.
- [ ] T026 [US2] Migrar `src/app/api/v1/studios/route.ts`.
- [ ] T027 [US2] Migrar `src/app/api/v1/studios/[id]/route.ts`.
- [ ] T028 [US2] Migrar `src/app/api/v1/narrators/route.ts`.
- [ ] T029 [US2] Migrar `src/app/api/v1/narrators/[id]/route.ts`.
- [ ] T030 [US2] Migrar `src/app/api/v1/editors/route.ts`.
- [ ] T031 [US2] Migrar `src/app/api/v1/editors/[id]/route.ts`.
- [ ] T032 [US2] Migrar `src/app/api/v1/user-preferences/route.ts`.
- [ ] T033 [US2] Avaliar `src/app/api/health/route.ts`: envolver com `withApiErrorHandler({ requireAuth: false })` para ganhar `X-Request-Id` consistente; tratamento de erro mantém comportamento atual via fallback 500.
- [ ] T034 [US2] Renomear classes de erro para alinhamento com seus codes (FR-007a): `BookStudioNotFoundError` → `StudioReferenceInvalidError` (move para `src/lib/errors/studio-errors.ts`, junto com `StudioNotFoundError` e `StudioHasActiveBooksError`). Atualizar todos os imports/usos em `src/lib/services/**`, `src/app/api/**` e `__tests__/**`. Manter `name` da classe = nome do construtor (assignment via `this.name`).
- [ ] T034a [US2] Refatorar **todos os constructors** de classes em `src/lib/errors/*-errors.ts` para FR-018: `super(...)` recebe string **estática descritiva** (ex.: `"Book not found"`, `"Studio has active books"`), sem interpolação de IDs ou dados dinâmicos. IDs/dados continuam expostos como propriedades públicas (`readonly id: string`, `readonly books: BlockingBookSummary[]`, `readonly title: string`, etc.) — `extractDetails` no registry os pesca quando relevante. Testes unitários novos: `__tests__/unit/errors/error-classes.spec.ts` (RED → GREEN) verifica que `Error.message` de cada classe é estático (não muda quando construída com IDs diferentes).
- [ ] T034b [US2] Verificar grep `grep -rn "BookStudioNotFoundError" src/ __tests__/` retorna zero ocorrências (totalmente substituído por `StudioReferenceInvalidError`).
- [ ] T035 [US2] Verificar grep de auditoria: `grep -rn "instanceof.*Error" src/app/api/` deve retornar **zero** ocorrências; idem `grep -rn "try {" src/app/api/v1/`. Documentar contagem antes/depois no PR.

**Checkpoint**: Handler global cobre todas as rotas. T018 (integration leak audit) GREEN. Anti-padrão FR-006 eliminado. Constituição Princípio VI mantido.

---

## Phase 4: User Story 1 - Mensagens claras e sem termos técnicos (Priority: P1)

**Goal**: Toda string user-facing está em PT-BR e sem termos técnicos. Schemas Zod migrados. Toasts/respostas verificados ponta-a-ponta.

**Independent Test**: E2E `error-toasts.spec.ts` verifica texto exato em PT-BR para cada entidade. Integration test ampliado em T018 já cobre ausência de leak por construção.

### Tests (RED)

- [ ] T036 [P] [US1] Criar `__tests__/unit/schemas/zod-error-map.spec.ts` (RED) verificando que `errorMap` global traduz issues default (`required`, `invalid_type`, `too_small`, `too_big`, `invalid_string`, `invalid_email`) para mensagens PT-BR.
- [ ] T037 [P] [US1] Criar `__tests__/unit/schemas/messages-pt-br.spec.ts` (RED) que importa cada schema em `src/lib/schemas/**` e `src/lib/domain/**`, exercita `safeParse` com payloads inválidos representativos, e assere que cada `issue.message` está em PT-BR (regex anti-leak + presença de caractere acentuado ou palavra-chave PT). Cobre todos os schemas existentes.
- [ ] T038 [P] [US1] Criar `__tests__/e2e/error-toasts.spec.ts` (RED) cobrindo um cenário por entidade:
  - Studio: criar duplicado → toast `"Já existe um cadastro com esse nome."` (warning não, error).
  - Studio com livros ativos → toast warning `"Este estúdio possui livros com capítulos ativos…"`.
  - Livro: criar com título duplicado no mesmo estúdio → toast `"Já existe um livro com este título neste estúdio."`.
  - Capítulo: tentar mudar narrador em capítulo `paid` → toast `"Este capítulo já está pago…"`.
  - Narrador: deletar narrador com capítulos ativos → toast warning.
  - Editor: idem.
  - Login com credenciais inválidas → toast `"Credenciais inválidas. Verifique seu username e senha."`. **Nota**: rota `/api/auth/**` está fora do escopo de `apiFetch` (Assumption do spec); este cenário valida que o toast PT-BR existente em `use-login-form` continua funcionando após as mudanças (não-regressão), não cobertura nova.
  - Cada cenário valida (a) presença do texto exato, (b) ausência de IDs/inglês.

### Implementation

- [ ] T039 [P] [US1] Criar `src/lib/schemas/_zod-error-map.ts` exportando `ptBrZodErrorMap: z.ZodErrorMap` com mapeamentos default → PT-BR conforme [research.md D-04](./research.md). T036 GREEN.
- [ ] T040 [US1] Registrar `ptBrZodErrorMap` em ponto único: criar `src/lib/schemas/_zod-bootstrap.ts` que invoca `z.setErrorMap(ptBrZodErrorMap)` em side-effect de import. Importar este arquivo **uma única vez** em `src/lib/api/with-error-handler.ts` (top of file) — assim toda rota que usa o handler ativa o errorMap automaticamente. Em testes, importar também em `__tests__/unit/setup.ts` e `__tests__/integration/setup.ts`. T036/T037 baseline GREEN.
- [ ] T041 [P] [US1] Migrar `src/lib/schemas/book.ts`: adicionar mensagens PT-BR explícitas em todos `.min/.max/.email/.url/.regex/.refine`.
- [ ] T042 [P] [US1] Migrar `src/lib/domain/studio.ts` (`updateStudioSchema`, schemas relacionados) para mensagens PT-BR.
- [ ] T043 [P] [US1] Migrar schemas de narrator, editor, chapter (verificar `src/lib/schemas/**` e `src/lib/domain/**` e cobrir todos).
- [ ] T044 [P] [US1] Migrar schemas de user-preferences e auth se houver mensagens default em inglês.
- [ ] T045 [US1] Auditoria final: `grep -rn 'z\.\(string\|number\|boolean\)' src/lib/schemas/ src/lib/domain/ | grep -v ', \"' | grep -v "errorMap"` para encontrar regras sem mensagem explícita; cada acerto é avaliado caso a caso (errorMap cobre defaults; refinos específicos exigem mensagem). Documentar resultado.
- [ ] T046 [US1] Validar T037 GREEN (todos os schemas com mensagens PT-BR ou cobertos por errorMap).
- [ ] T047 [US1] Verificar T018 (cross-route leak audit) ainda GREEN após mudanças de schema.
- [ ] T048 [US1] Validar T038 E2E GREEN (toasts mostram PT-BR exato sem leak).

**Checkpoint**: Todas as mensagens user-facing em PT-BR e sem leak. Schemas Zod consistentes. Princípio X (REST patterns) reforçado.

---

## Phase 5: User Story 3 - Wrapper unificado de cliente (`apiFetch`) (Priority: P2)

**Goal**: Substituir `fetch` direto + `toast.error/.warning` em hooks por `apiFetch`. 401 redireciona globalmente; 422 devolve field-errors; demais erros disparam toast pelo wrapper.

**Independent Test**: `__tests__/unit/api/api-fetch.spec.ts` cobre cada caso da matriz de comportamento. E2E `error-toasts.spec.ts` (de T038) já valida o lado visual; novo cenário valida 401 → toast warning + redirect para `/login`.

### Tests (RED)

- [ ] T049 [P] [US3] Criar `__tests__/unit/api/api-fetch.spec.ts` (RED) com `vi.fn()` mocking `fetch` e `sonner` (`toast.error`/`toast.warning` spies). Cobrir cada linha da matriz em [contracts/api-fetch.md](./contracts/api-fetch.md):
  - 200/201 com JSON → `{ok: true, data}`.
  - 204 → `{ok: true, data: null}`.
  - 401 `UNAUTHORIZED` → toast warning + `navigateToLogin` chamado + `{kind: "session-expired"}`. Debounce: duas chamadas em paralelo (janela ≤ 1s, com `vi.useFakeTimers()`) disparam toast **uma vez**; chamadas espaçadas em > 1s disparam dois toasts.
  - 422 `VALIDATION_ERROR` com `details[]` → `{kind: "field-errors", fields: {field: message}}`, **sem** toast (validação é feedback inline via RHF).
  - 422 `INVALID_BODY` → toast.error + `{kind: "api-error", code: "INVALID_BODY"}`.
  - 409 `STUDIO_HAS_ACTIVE_BOOKS` (sem suppress) → toast.warning **e** `{kind: "api-error", code, details: { books: [...] }}` retornado para UI complementar.
  - 500 `INTERNAL_ERROR` → toast.error genérico + `{kind: "api-error"}`.
  - 5xx sem JSON parseável → toast.error + `{kind: "api-error", code: "INTERNAL_ERROR"}`.
  - Code desconhecido → `console.warn` + toast.error genérico.
  - `suppressToastFor: ["SOME_CODE"]` (caso raro de UI substituindo o toast) → resposta com mesmo code → **sem** toast disparado, `details` retornado intacto. Testar com um code de exemplo qualquer (não usar `STUDIO_HAS_ACTIVE_BOOKS` — esse mantém comportamento default).
  - Fetch rejeitado → toast.error + `{kind: "network"}`.
- [ ] T050 [P] [US3] Estender `__tests__/e2e/error-toasts.spec.ts` (de T038) com cenário 401: forçar expiração de sessão (deletar cookie via Playwright), executar PATCH em qualquer rota, verificar toast warning `"Sua sessão expirou…"` + URL final em `/login`.

### Implementation

- [ ] T051 [US3] Criar `src/lib/api/api-fetch.ts` exportando `apiFetch<T>(url, options?): Promise<ApiResult<T>>` conforme [contracts/api-fetch.md](./contracts/api-fetch.md) e [research.md D-08](./research.md). Inclui:
  - Helper interno `dispatchToast(code)` consultando `errorCodes[code]` (lê `variant` do catálogo) — sempre dispara para erro server-side, exceto 422 `VALIDATION_ERROR` (inline) e codes em `suppressToastFor` (escape hatch).
  - Debounce de 401: módulo-local `let pendingSessionToast = false` reset por `setTimeout(() => pendingSessionToast = false, 1000)` na primeira chamada que disparou toast.
  - Conversão de `details[]` para `Record<field, message>` para 422 `VALIDATION_ERROR`.
  - Para erros server-side com `details` estruturado (ex.: `STUDIO_HAS_ACTIVE_BOOKS` com `details.books`): dispara toast E retorna `details` no `ApiResult` para que o hook renderize UI complementar (modal/lista) **junto** ao toast.
  - Pega `X-Request-Id` da resposta para `console.warn` em codes desconhecidos.
  - T049 GREEN.
- [ ] T052 [P] [US3] Refatorar `src/components/features/studios/hooks/use-create-studio-form.ts` para `apiFetch`. Remover `toast.*`; manter apenas `form.setError` em `kind: "field-errors"`.
- [ ] T053 [P] [US3] Refatorar `src/components/features/studios/hooks/use-update-studio-form.ts`.
- [ ] T054 [P] [US3] Refatorar `src/components/features/studios/hooks/use-delete-studio.ts`. **Sem `suppressToastFor`** — comportamento padrão: toast warning é disparado pelo wrapper; o hook lê `result.details.books` e renderiza a lista de livros bloqueantes em UI complementar (dialog/popover já existente). Toast e UI coexistem.
- [ ] T055 [P] [US3] Refatorar `src/components/features/narrators/hooks/use-create-narrator-form.ts`.
- [ ] T056 [P] [US3] Refatorar `src/components/features/narrators/hooks/use-update-narrator-form.ts`.
- [ ] T057 [P] [US3] Refatorar `src/components/features/narrators/hooks/use-delete-narrator.ts`. Mesmo padrão de T054: toast warning automático + UI complementar com `result.details.books` (sem suppress).
- [ ] T058 [P] [US3] Refatorar `src/components/features/editors/hooks/use-create-editor-form.ts`.
- [ ] T059 [P] [US3] Refatorar `src/components/features/editors/hooks/use-update-editor-form.ts`.
- [ ] T060 [P] [US3] Refatorar `src/components/features/editors/hooks/use-delete-editor.ts`. Mesmo padrão de T054: toast warning automático + UI complementar com `result.details.books` (sem suppress).
- [ ] T061 [P] [US3] Refatorar `src/components/features/books/hooks/use-create-book-form.ts`.
- [ ] T062 [P] [US3] Refatorar `src/components/features/books/hooks/use-edit-book-form.ts`.
- [ ] T063 [P] [US3] Refatorar `src/components/features/books/hooks/use-studio-inline-creator.ts`.
- [ ] T064 [P] [US3] Refatorar `src/components/features/books/hooks/use-book-pdf-popover.ts`.
- [ ] T065 [P] [US3] Refatorar `src/components/features/books/hooks/use-book-detail.ts` (deletar capítulos em massa).
- [ ] T066 [P] [US3] Refatorar `src/components/features/chapters/hooks/use-chapter-row-edit.ts`.
- [ ] T067 [P] [US3] Refatorar `src/components/features/chapters/hooks/use-delete-chapter.ts`.
- [ ] T068 [P] [US3] Refatorar `src/components/features/auth/hooks/use-login-form.ts`. Tratamento especial: sucesso → navegar; falha 401 do better-auth não passa por `apiFetch` (rota `/api/auth/**` está fora de escopo); manter `toast.error` específico de credenciais inválidas via mecanismo do better-auth, mas remover qualquer leak de mensagem técnica da resposta.
- [ ] T069 [US3] Auditoria final via grep:
  - `grep -rn "fetch(" src/components/features/ | grep -v "apiFetch"` → zero hits para `/api/v1/**`.
  - `grep -rn "toast\.\(error\|warning\)" src/components/features/` → apenas em arquivos de auth/login (justificado) ou casos com `suppressToastFor`.
  - `grep -rn "body?.error?.message" src/components/features/` → zero.
- [ ] T070 [US3] Validar T049 GREEN, T050 (E2E 401 redirect) GREEN, T038 (E2E PT-BR toasts) ainda GREEN.

**Checkpoint**: Hooks de feature livres de tratamento manual de erro. Wrapper centraliza tudo. Constituição Princípio VII (componentes/hooks atomicidade) reforçado.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Limpeza, docs e fase final de qualidade antes do PR.

- [ ] T071 [P] Remover `unauthorizedResponse`/`validationErrorResponse`/`notFoundResponse`/`conflictResponse`/`unprocessableEntityResponse` de `src/lib/api/responses.ts` se não houver mais consumidor (verificar grep). Manter `NO_STORE_HEADERS` (em headers.ts) e qualquer helper de sucesso.
- [ ] T072 [P] Atualizar `docs/` se houver guia de criação de rota (ex.: `docs/api-routes.md`) para refletir o novo padrão `withApiErrorHandler`. Caso não exista, criar `docs/error-handling.md` apontando para [quickstart.md](./quickstart.md).
- [ ] T073 [P] Atualizar `CLAUDE.md` seção "Anti-padrões proibidos" adicionando: `try/catch instanceof` em rotas `/api/v1/**`, `fetch()` direto em hooks de feature, `toast.error(body?.error?.message …)`. Ver bloco existente em [CLAUDE.md](../../CLAUDE.md).
- [ ] T074 [P] Atualizar [docs/hooks-pattern.md](../../docs/hooks-pattern.md) com nota sobre `apiFetch` substituindo `fetch` direto.
- [ ] T074a [P] Benchmark micro-comparativo (SC-006): escolher uma rota representativa que retorna erro mapeado (ex.: `GET /api/v1/books/<id-inexistente>` → 404 `BOOK_NOT_FOUND`). Rodar 50 invocações **na branch `main`** (baseline) e 50 **na branch `023-global-error-handler`** após T070, em ambiente local idêntico. Documentar p50/p95 antes/depois no PR. Aceitar regressão ≤ 5%; se acima, investigar (provável overhead de `AsyncLocalStorage` ou alguma inicialização lazy mal-feita) antes de mergear.
- [ ] T075 Re-rodar a fase final completa de qualidade conforme CLAUDE.md "Verificação de qualidade":
  - `bun run lint` — zero erros e zero warnings.
  - `bun run test:unit` — verde, incluindo todos os testes novos (T003, T006, T007, T010, T012, T016, T017, T034a, T036, T037, T049).
  - `bun run test:integration` — verde, incluindo T018.
  - `bun run test:e2e` — verde, incluindo T038, T050.
  - `bun run build` — produção compila sem erros.
- [ ] T076 Auto-review contra checklist da constituição (CLAUDE.md "Self-Review"):
  - I a XVI marcados → pass.
  - Métricas SC-001..SC-006 atendidas (zero `try/catch instanceof` em rotas, zero `fetch(/api/v1/**)` em features, etc.).
- [ ] T077 Abrir PR via `/finish-task` apontando para `main`, com descrição linkando spec/plan/research/data-model/contracts/quickstart e a contagem antes/depois de anti-padrões eliminados.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001..T002 — sem dependências.
- **Foundational (Phase 2)**: T003..T015 — depende de Setup. **Bloqueia** US1/US2/US3.
- **US2 (Phase 3)**: T016..T035 — depende de Foundational. Vai antes de US1 por escolha estratégica (handler precisa do catálogo; refatorar mensagens primeiro duplicaria trabalho).
- **US1 (Phase 4)**: T036..T048 — depende de US2 (catálogo já populado, rotas usam handler).
- **US3 (Phase 5)**: T049..T070 — depende de US1 (mensagens PT-BR no lugar) **e** Foundational (singleton de navegação).
- **Polish (Phase 6)**: T071..T077 — depende de US1 + US2 + US3.

### Within each user story

- Tests (RED) → Implementation (GREEN) → Refactor (IMPROVE).
- Modules antes de rotas; rotas antes de hooks.
- Migração de rotas/hooks pode ser paralela entre arquivos diferentes (todas as `[P]`).

### Parallel Opportunities

- **Phase 2**: T003/T005/T006/T007/T009/T010/T011/T012 podem rodar em paralelo (arquivos independentes). T013/T014 dependem de T012; T015 depende de T014.
- **Phase 3 / US2**: T016/T017/T018 (testes RED) em paralelo. Após T019..T021, T022..T033 (migração de rotas) podem rodar em paralelo (arquivos diferentes). T034 (renomeação de classes) bloqueia T023 — rodar T034 antes da migração da rota de books-by-id, ou aceitar conflito em uma só rota e resolver junto. T034a (limpeza de constructors) é independente, pode rodar em paralelo com migração de rotas. T034b é grep de auditoria depois de T034. T035 depende de todas as migrações.
- **Phase 4 / US1**: T036..T038 em paralelo (testes RED). T041..T044 em paralelo (schemas distintos). T045..T048 sequenciais como auditoria.
- **Phase 5 / US3**: T049..T050 em paralelo (testes RED). T051 (apiFetch) bloqueia T052..T068. T052..T068 todos `[P]` entre si (hooks distintos).
- **Phase 6**: T071..T074 em paralelo. T074a (benchmark) precisa estar concluído antes de T077 (PR). T075..T077 sequenciais.

---

## Parallel Example — User Story 2 (após T019..T021 prontos)

```bash
# Migrar rotas em paralelo (cada developer/agent pega um arquivo):
Task: "Migrar src/app/api/v1/books/route.ts para withApiErrorHandler"
Task: "Migrar src/app/api/v1/books/[id]/route.ts para withApiErrorHandler"
Task: "Migrar src/app/api/v1/studios/route.ts para withApiErrorHandler"
Task: "Migrar src/app/api/v1/narrators/route.ts para withApiErrorHandler"
Task: "Migrar src/app/api/v1/editors/route.ts para withApiErrorHandler"
# (etc — T022..T033)
```

## Parallel Example — User Story 3 (após T051 pronto)

```bash
Task: "Refatorar use-create-studio-form para apiFetch"
Task: "Refatorar use-create-book-form para apiFetch"
Task: "Refatorar use-chapter-row-edit para apiFetch"
# (etc — T052..T068, todos [P])
```

---

## Implementation Strategy

### MVP-first (US2 → US1 → US3)

Esta feature é refatoração transversal — não há "MVP de uma story sem as outras" no sentido tradicional, porque:

- **US2 sem US1**: handler global pronto mas mensagens ainda parcialmente em inglês — fere FR-001/FR-002. Inaceitável intermediar release.
- **US1 sem US2**: schemas em PT-BR mas rotas ainda com `try/catch` repetido — fere SC-002. Aceitável como passo intermediário em PR único.
- **US3 sem US1+US2**: wrapper de cliente exibindo mensagens cruas da API — fere FR-004. Inaceitável.

A única ordem viável é **Foundational → US2 → US1 → US3 → Polish** numa única branch, mergeada como unidade (Assumption do spec). Não há split em PRs sequenciais.

### Sequenciamento dentro do PR

```
Setup → Foundational (catálogo populado) →
US2 RED tests → US2 implementation (handler + migração de rotas) → US2 GREEN →
US1 RED tests → US1 implementation (zod errorMap + migração de schemas) → US1 GREEN →
US3 RED tests → US3 implementation (apiFetch + migração de hooks) → US3 GREEN →
Polish → fase final de qualidade → /finish-task
```

### Rollback strategy

Se qualquer fase quebrar funcionalidade existente (especialmente E2E), reverter o último commit que migrou um arquivo, isolar o problema, e re-tentar. A granularidade `[P]` por arquivo facilita isolamento.

---

## Notes

- **TDD obrigatório** (Princípio V): cada implementação tem teste correspondente RED antes. Verificar com `bun run test:unit -- --reporter=verbose` que tests novos falham antes da implementação.
- **`[P]` = arquivos diferentes**, sem dependência. Tasks `[P]` podem rodar literalmente em paralelo se houver multi-agent setup; em fluxo single-agent, são "ordem indiferente".
- **Commit por task ou por grupo lógico** (e.g. todas as migrações de rotas em US2 podem virar 1-3 commits). Mensagens conventional commits (`refactor:`, `test:`, `feat:`).
- **Foco da fase final**: T075 é o único momento de rodar lint + suíte completa + build. CLAUDE.md proíbe rodar isso por task intermediária.
- **`/finish-task`** abre PR contra `main` (CLAUDE.md). Usar título conciso: `feat: global error handler + PT-BR toast/api messages`.
