# Feature Specification: Global Error Handler

**Feature Branch**: `023-global-error-handler`
**Created**: 2026-05-06
**Status**: Draft
**Input**: User description: "Revisar mensagens de erro da API e do toast. Garantir que termos técnicos não sejam expostos e que as mensagens sejam claras. Ter um handler de erros global"

## Clarifications

### Session 2026-05-06

- Q: Zod validation messages — localization strategy (schemas-PT vs handler-translates vs hybrid)? → A: A — PT-BR messages live in each Zod schema; handler forwards `issue.message` as-is. Existing English defaults are migrated as part of this feature.
- Q: "Lookup-not-found" inside payload — 404 or 422? → A: A — URL-addressed resource missing → 404 (`{ENTITY}_NOT_FOUND`); foreign reference missing inside payload → 422 with a distinct code (e.g. `STUDIO_REFERENCE_INVALID`). One code per (status, semantics) pair.
- Q: Como impedir drift entre lista de códigos do servidor e catálogo do cliente? → A: B — único módulo compartilhado (`src/lib/api/error-codes.ts`) que exporta `{ codes, messages }`; servidor e cliente importam dele. Drift impossível por construção. Teste de unidade garante que toda classe de Error de domínio aponta para um code presente nesse módulo.
- Q: Correlation ID exposto via header de resposta? → A: A — `X-Request-Id` em **toda** resposta (sucesso e erro). UUID opaco, não vaza dado, permite triagem rápida via DevTools/curl. Skills `/api-design` e `/backend-patterns` não cobrem explicitamente; decisão é prática de indústria alinhada ao espírito de ambas (logs já correlacionam, header só facilita triagem manual).
- Q: Cliente — wrapper só para 401 ou para todos os erros? Sessão expirada via inline ou toast? → A: Wrapper `apiFetch` trata **todos** os erros (401 com redirect + toast warning, 422 retorna field errors ao hook, outros 4xx/5xx + falha de rede disparam toast PT-BR via catálogo compartilhado, sucesso passa direto). "Sessão expirou" é toast warning, não inline. Hooks deixam de chamar `toast.*` para erros de API por completo; apenas reagem a `kind: "field-errors"`. Escape hatch `suppressToastFor: code[]` para casos com UI customizada (ex.: `STUDIO_HAS_ACTIVE_BOOKS`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mensagens de erro claras e sem termos técnicos (Priority: P1)

Quando uma ação na interface (criar livro, atualizar capítulo, excluir estúdio, login etc.) falha, o usuário recebe uma mensagem em português brasileiro que descreve **o que aconteceu e o que pode ser feito**, sem expor detalhes técnicos como UUIDs, nomes de tabelas/colunas, mensagens em inglês, stack traces, fragmentos SQL, caminhos de arquivo ou nomes internos de erros (`BookNotFoundError`, `ChapterPaidLockedError`, etc.).

**Why this priority**: A operação atual mistura mensagens em inglês, IDs internos e jargão técnico em respostas de API e toasts. Esse ruído (a) confunde o usuário final do estúdio, (b) expõe detalhes de implementação e (c) gera retrabalho de tradução em cada feature nova. Sem essa correção, qualquer feature seguinte herda o mesmo problema.

**Independent Test**: Para cada cenário de erro previamente coberto pelos testes (validação Zod, conflito por nome/título duplicado, soft-delete bloqueado por capítulos ativos, transição de capítulo inválida, capítulo `paid` imutável, livro inexistente, sessão expirada, erro de rede, JSON inválido), inspecionar o `error.message` retornado e o toast renderizado. Cada texto DEVE estar em PT-BR, descrever a causa em linguagem de domínio (livro, capítulo, estúdio, narrador, editor) e NÃO conter: IDs, palavras em inglês de domínio (`Book`, `Chapter`, `studio`), nomes de classes de erro, fragmentos SQL, paths, ou termos como "soft-delete", "FK", "NULL", "constraint".

**Acceptance Scenarios**:

1. **Given** um livro com capítulo pago, **When** o usuário tenta alterar `pricePerHourCents` via PATCH, **Then** a resposta 409 carrega `error.message = "Este livro já possui um capítulo pago — o preço por hora não pode ser alterado."` e nenhum ID aparece no corpo.
2. **Given** dois livros existentes no mesmo estúdio com títulos diferentes, **When** o usuário renomeia um deles para o título do outro, **Then** o toast exibe `"Já existe um livro com este título neste estúdio."` sem expor o título conflitante nem IDs.
3. **Given** um estúdio com livros ativos, **When** o usuário tenta excluí-lo, **Then** o toast (warning) exibe `"Este estúdio possui livros com capítulos ativos e não pode ser excluído."` e a lista detalhada de livros bloqueantes é apresentada de forma estruturada (não concatenada na mensagem).
4. **Given** uma falha de rede ao salvar um formulário, **When** a requisição não chega ou retorna 5xx, **Then** o toast exibe `"Não foi possível concluir a operação. Tente novamente."` (ou variante específica do recurso) e o stack/erro original é registrado apenas no log do servidor.
5. **Given** um corpo JSON malformado em POST, **When** a API processa a requisição, **Then** retorna 422 com mensagem `"Os dados enviados são inválidos."` (sem expor que falhou no `JSON.parse`).

---

### User Story 2 - Handler global na camada de API (Priority: P1)

Em vez de cada rota da API repetir uma cadeia `try { … } catch (e) { if (e instanceof X) return …; if (e instanceof Y) return …; throw e; }`, existe **um único handler** que recebe a função do controller, executa, captura erros conhecidos do domínio, mapeia para o envelope `ApiErrorBody` correto e devolve a `NextResponse`. Erros não mapeados viram um 500 genérico **sem vazamento** e são registrados no logger estruturado do servidor.

**Why this priority**: Hoje a mesma lógica de mapeamento (instanceof + status + code + message) está duplicada em ~10 rotas, com inconsistências (algumas rotas reusam `error.message` em inglês, outras reescrevem em PT). Centralizar é pré-requisito para US1 ser sustentável: novos erros de domínio passam a ser registrados em um único catálogo.

**Independent Test**: Substituir cada `route.ts` para usar o handler global e remover `try/catch` locais. Os testes existentes em `__tests__/integration/api-error-responses.spec.ts` (assertNoLeak) DEVEM continuar passando. Adicionar um teste novo que injeta uma exceção arbitrária (`new Error("internal: select * from users where … failed")`) e verifica que a resposta é 500 com `error.code = "INTERNAL_ERROR"`, `error.message = "Erro interno. Tente novamente em instantes."` e que o logger recebeu a exceção original com nível `error`.

**Acceptance Scenarios**:

1. **Given** uma rota nova é criada usando o handler global, **When** o controller lança `BookNotFoundError`, **Then** o handler retorna 404 com `code = "BOOK_NOT_FOUND"` e `message` em PT-BR, sem que a rota precise importar a classe de erro nem chamar `notFoundResponse` manualmente.
2. **Given** o controller lança um erro arbitrário não mapeado (ex.: `TypeError`, `Error("anything")`), **When** o handler executa, **Then** a resposta tem status 500, `code = "INTERNAL_ERROR"`, `message = "Algo deu errado. Tente novamente em instantes."`, e o erro original é logado no servidor com `requestId` correlacionável (exposto via header `X-Request-Id`, nunca no corpo).
3. **Given** uma rota usa o handler global, **When** o request body não é JSON válido, **Then** o handler responde 422 com `code = "INVALID_BODY"` e mensagem genérica em PT-BR, sem que cada rota precise interceptar `request.json()` em try/catch.
4. **Given** uma sessão ausente/expirada, **When** o handler executa qualquer rota protegida, **Then** o middleware/handler retorna 401 com `code = "UNAUTHORIZED"` e mensagem PT-BR, sem que a rota duplique essa verificação.

---

### User Story 3 - Mapeamento centralizado API → toast no cliente (Priority: P2)

No cliente, existe **um único helper** (`mapApiErrorToToast` ou hook equivalente) que recebe a resposta de erro da API (status + `error.code` + `error.details`) e devolve a mensagem PT-BR pronta para `toast.error`/`toast.warning`. Hooks de feature deixam de fazer `body?.error?.message ?? "fallback"` (que poderia vazar mensagem da API) e passam a chamar o helper. Erros 422 com `details` continuam sendo aplicados como erros inline de campo via `form.setError`.

**Why this priority**: Hoje cada hook (`use-create-narrator-form`, `use-delete-studio`, `use-edit-book-form`, `use-chapter-row-edit`, etc.) decide manualmente se mostra a mensagem da API ou um fallback. Isso fragmenta a UX e permite que mensagens em inglês/técnicas escapem para o toast quando o backend ainda não foi corrigido. Um helper único garante que a melhoria em US1 valha para 100% das telas e simplifica futuras features.

**Independent Test**: Renderizar uma falha simulada para cada hook crítico (criar/editar/excluir estúdio, livro, capítulo, narrador, editor) e verificar que o texto do toast vem do mapeamento centralizado, nunca do campo `error.message` cru. Para um `error.code` desconhecido, o helper devolve mensagem genérica e o `error.message` da API NÃO aparece na UI.

**Acceptance Scenarios**:

1. **Given** a API responde 409 `STUDIO_HAS_ACTIVE_BOOKS` com `details.books = [...]`, **When** o helper é chamado, **Then** retorna mensagem PT-BR de warning e expõe `details.books` separadamente para a UI montar a lista (sem concatenar IDs na string).
2. **Given** a API responde 422 `VALIDATION_ERROR` com `details = [{ field, message }]`, **When** o helper é chamado, **Then** retorna `{ kind: "field-errors", fields }` para o hook aplicar `form.setError` por campo — nenhum toast é mostrado para validações field-level.
3. **Given** a API responde com um `error.code` que o helper não conhece, **When** o helper é chamado, **Then** retorna a mensagem genérica `"Não foi possível concluir a operação. Tente novamente."` e o código original é registrado no console do navegador para debugging (sem renderização visível).
4. **Given** ocorre um erro de rede (fetch rejeitado), **When** o helper é chamado, **Then** retorna `"Verifique sua conexão e tente novamente."` e a operação não exibe a mensagem do `Error` original.

---

### Edge Cases

- **Erros aninhados em transações**: quando `BookStatusRecomputeService` falha dentro de uma transação iniciada pela criação de capítulo, o usuário recebe a mensagem mais útil ao usuário final (a falha primária da operação solicitada), não o erro técnico da recomputação.
- **Múltiplos erros de validação Zod no mesmo request**: o handler retorna todos os `details[]` para que o hook aplique todos os erros de campo de uma vez; o toast NÃO duplica esses erros.
- **Resposta sem corpo JSON (204, 401 com cookie limpo)**: o helper de cliente não tenta parsear corpo vazio; toast só aparece quando faz sentido (401 mostra `"Sua sessão expirou. Faça login novamente."` e dispara redirecionamento).
- **Erro depois de toast otimista**: se a UI já renderizou um estado otimista e a API falha, o toast de erro convive com o rollback visual; nenhum `toast.success` adicional é disparado (constituição já proíbe).
- **Erro durante um redirect de servidor (Server Action / Server Component)**: o handler global cobre apenas rotas `/api/v1/**`; falhas em Server Components seguem o fluxo nativo do Next.js (`error.tsx`) com mensagem genérica PT-BR.
- **Logger ausente em ambiente de teste**: o handler aceita logger injetado; o default é o logger estruturado de produção, que pode ser substituído por um fake nos testes (Princípio: dependências por construtor).

## Requirements *(mandatory)*

### Functional Requirements

#### Mensagens (camada API + toast)

- **FR-001**: Toda mensagem de erro retornada em qualquer resposta `/api/v1/**` (campo `error.message`) DEVE estar em português brasileiro, em linguagem de domínio (livro, capítulo, estúdio, narrador, editor, sessão).
- **FR-002**: Nenhuma resposta de erro pode conter UUIDs, valores de chave primária, nomes de classes de erro (`BookNotFoundError`), fragmentos SQL (`select`, `insert`, `update`, `delete`, nomes de tabela/coluna), stack traces (`at <file>:line`), caminhos de arquivo (`/src/lib/...`), URIs de banco (`postgres://`), ou termos técnicos internos (`soft-delete`, `FK`, `constraint`, `null violation`).
- **FR-003**: Toda informação estruturada que apoia a mensagem (ex.: lista de livros bloqueantes em `STUDIO_HAS_ACTIVE_BOOKS`) DEVE ser exposta via `error.details` como dado estruturado, nunca concatenada em `error.message`.
- **FR-004**: Toast no cliente NUNCA exibe a string crua de `error.message` retornada pela API. Toda renderização de toast por erro de API passa **exclusivamente pelo wrapper `apiFetch`** (FR-013), que consulta o catálogo compartilhado `src/lib/api/error-codes.ts` (FR-012) e aplica a mensagem PT-BR conhecida ou fallback genérico.
- **FR-005**: Toasts de erro continuam usando `toast.error`/`toast.warning` (constituição proíbe `toast.success`); o wrapper escolhe a variante: `toast.warning` para 401 (sessão expirada) e para conflitos destrutivos com bloqueio (ex.: 409 `STUDIO_HAS_ACTIVE_BOOKS`); `toast.error` para 5xx, falhas de rede e demais 4xx genéricos.

#### Handler global da API

- **FR-006**: Existe um único helper `withApiErrorHandler` (ou nome equivalente) em `src/lib/api/` que recebe um handler de rota tipado e devolve outro handler. Toda rota `/api/v1/**` DEVE usar esse wrapper; uso direto de `try/catch` para mapear erros de domínio passa a ser anti-padrão.
- **FR-007**: O handler global mapeia cada erro conhecido do domínio (todas as classes em `src/lib/errors/*-errors.ts`) para um par fixo `(status, code, messagePt)`. O mapa é declarativo, em um único arquivo, e cobre 100% das classes existentes. Cada `code` aparece **uma única vez** no registry (uma combinação `(status, code)` é proibida em duas linhas) — coding violation detectável em teste de unidade do registry.
- **FR-007a**: A semântica de status segue uma regra única: erro relativo ao **recurso endereçado pela URL** ausente → **404** com código `{ENTITY}_NOT_FOUND` (ex.: `BOOK_NOT_FOUND`, `STUDIO_NOT_FOUND`, `CHAPTER_NOT_FOUND`); erro relativo a uma **referência externa** dentro do payload ausente → **422** com código distinto sufixado por `_REFERENCE_INVALID` (ex.: `STUDIO_REFERENCE_INVALID`, `NARRATOR_REFERENCE_INVALID`, `EDITOR_REFERENCE_INVALID`). Os **nomes das classes de Error de domínio** ficam alinhados com seus codes: `BookStudioNotFoundError` é renomeada para `StudioReferenceInvalidError`; quaisquer classes futuras nessa categoria seguem o padrão `{Entity}ReferenceInvalidError`. Clientes e testes que dependiam do nome de classe ou do code antigo são atualizados na mesma branch.
- **FR-008**: Para qualquer erro não mapeado, o handler responde 500 com `code = "INTERNAL_ERROR"` e mensagem genérica PT-BR, e registra a exceção original no logger estruturado com nível `error`. Um identificador de correlação (`requestId`, UUID v4) é gerado para cada request, persiste em todos os logs daquele request (incluindo o stack trace original) e é exposto na resposta via header `X-Request-Id`. O `requestId` **não** aparece no `error.message` nem em `error.details`; permanece exclusivamente no header e nos logs.
- **FR-008a**: O header `X-Request-Id` é setado em **toda** resposta de `/api/v1/**`, sucesso ou erro. Se a request chegar com `X-Request-Id` no cabeçalho de entrada (cenário de chamada interna ou retry instrumentado), o handler reaproveita o valor; caso contrário, gera um novo UUID v4. Em ambos os casos, o valor final é ecoado na resposta.
- **FR-009**: O handler global aplica também as verificações comuns de pré-controle de toda rota protegida: parsing seguro de JSON (422 `INVALID_BODY` em caso de JSON inválido), validação Zod (422 `VALIDATION_ERROR` com `details[]` por campo), checagem de sessão (401 `UNAUTHORIZED`). Cada rota declara o schema Zod e o handler cuida do resto.
- **FR-010**: Erros de validação Zod retornam status 422, `code = "VALIDATION_ERROR"`, `message` curta PT-BR ("Os dados enviados são inválidos."), e `details[]` com `{ field, message }` em PT-BR. As mensagens por campo são definidas **diretamente nos schemas Zod** em `src/lib/schemas/**` e em quaisquer schemas embutidos (`src/lib/domain/**` quando expostos via API); o handler global apenas encaminha `issue.message` sem transformação. Esta feature inclui a migração de toda mensagem Zod default em inglês para PT-BR explícito (auditável via grep por `z.string().min`/`max`/`email`/`url`/`regex` sem `, "..."`).
- **FR-011**: O handler global preserva a tipagem do contrato `ApiErrorBody` existente (`{ error: { code, message, details? } }`) — nenhum cliente/teste atual quebra por mudança de envelope.

#### Wrapper unificado de cliente (`apiFetch`)

- **FR-012**: Existe um **único módulo compartilhado** (`src/lib/api/error-codes.ts`) que exporta `errorCodes: Record<ErrorCode, ErrorCatalogEntry>` — onde `ErrorCode` é a união discriminada de todos os codes válidos e `ErrorCatalogEntry = { status, message, variant? }`. Tanto o registry server-side (FR-007) quanto o wrapper client-side (FR-013) importam **deste módulo**; não existem duas listas paralelas. Adicionar um novo erro de domínio = uma única edição neste arquivo.
- **FR-012a**: Um teste de unidade do módulo garante que (a) toda classe de Error de domínio em `src/lib/errors/*-errors.ts` está presente no registry server-side, (b) todo `code` exportado tem mensagem PT-BR não-vazia em `messages`, e (c) a união de `codes` é exaustiva (nenhum `code` órfão sem mensagem, nenhuma mensagem sem `code` correspondente). Esse teste roda no `bun run test:unit`.
- **FR-013**: Existe um wrapper único `apiFetch` em `src/lib/api/api-fetch.ts` (ou nome equivalente) que substitui chamadas diretas a `fetch` em hooks de feature. O wrapper retorna um envelope discriminado:
  - `{ ok: true, data }` para 2xx
  - `{ ok: false, kind: "session-expired" }` para 401 (após o wrapper já ter disparado toast warning + redirect)
  - `{ ok: false, kind: "field-errors", fields }` para 422 `VALIDATION_ERROR` (sem toast — hook aplica `form.setError`)
  - `{ ok: false, kind: "api-error", code, details? }` para demais 4xx/5xx (após o wrapper já ter disparado o toast PT-BR mapeado)
  - `{ ok: false, kind: "network" }` para falha de rede / fetch rejeitado (após o wrapper já ter disparado toast PT-BR genérico de conexão)
  
  **Após esta entrega, é proibido em hooks de feature**: chamadas diretas a `fetch` para `/api/v1/**`, `toast.error/.warning` motivado por erro de API, e leitura crua de `body?.error?.message`. Hooks reagem apenas a `kind: "field-errors"` (e, opcionalmente, a `kind: "api-error"` quando precisarem de UI customizada via `suppressToastFor`).
- **FR-014**: Para 422 `VALIDATION_ERROR`, o wrapper extrai `details[]` em formato `Record<fieldName, message>` e o hook chama `form.setError` por campo; nenhum toast é mostrado para validação field-level.
- **FR-015**: Para `code` desconhecido pelo catálogo (servidor introduziu um code novo antes do front estar atualizado), o wrapper renderiza toast com mensagem genérica PT-BR e registra `console.warn` com o code original; o teste de FR-012a impede que isso aconteça em PR limpo, mas o fallback existe para hot-fixes em produção.
- **FR-016**: Falhas de rede / `fetch` rejeitado / 5xx genérico (`code = "INTERNAL_ERROR"`) disparam pelo wrapper toasts dedicados em PT-BR ("Verifique sua conexão e tente novamente." vs "Algo deu errado. Tente novamente em instantes."), distinguindo intermitência de rede de falha do servidor.
- **FR-016a**: **Comportamento padrão** para qualquer erro server-side é dispatch de toast pelo wrapper — feedback visual imediato é obrigatório para que o usuário entenda o motivo da ação ter falhado. Erros que carregam `details` estruturados (ex.: `STUDIO_HAS_ACTIVE_BOOKS` com lista de livros bloqueantes) disparam o toast **e** retornam `details` ao hook para que a UI renderize informação adicional (modal, lista, etc.) **complementar** ao toast. O wrapper aceita uma opção `suppressToastFor: code[]` como **escape hatch raro** quando uma UI customizada substitui completamente o toast (ex.: dialog modal full-screen que já comunica o erro com clareza). Uso desta opção é exceção e exige justificativa em code review; o padrão é sempre toast + (opcional) UI complementar.
- **FR-016b**: O comportamento de 401 é específico: o wrapper dispara `toast.warning("Sua sessão expirou. Faça login novamente.")` **uma única vez por janela de tempo curta** (debounce de ~1s para evitar duplicação quando múltiplas requests falham em paralelo) e redireciona para `/login`. O hook recebe `kind: "session-expired"` apenas como informação para abortar fluxo otimista; nenhuma ação adicional é exigida.

#### Garantias transversais

- **FR-017**: O conjunto de testes de integração `api-error-responses.spec.ts` é estendido para cobrir TODAS as rotas `/api/v1/**` e TODAS as classes de erro de domínio, garantindo: (a) status correto, (b) `code` correto, (c) `message` em PT-BR, (d) ausência dos padrões de vazamento (regex de stack/SQL/path/UUID/inglês de domínio).
- **FR-018**: A camada de erros em `src/lib/errors/*-errors.ts` permanece em inglês no `Error.message` (uso interno, log do servidor, identificação por instanceof). A tradução PT-BR ocorre **apenas** no handler global (FR-007). Constructors de erros DEVEM ser refatorados para **não interpolar IDs nem dados dinâmicos** em `Error.message` — IDs e dado estruturado passam a viver em propriedades públicas da classe (`readonly id: string`, `readonly books: BlockingBookSummary[]`, etc.) e o handler extrai via `extractDetails` quando relevante. Mensagem do `Error.message` torna-se uma string estática descritiva (ex.: `"Book not found"`, `"Studio has active books"`).
- **FR-019**: Logs de servidor mantêm o erro original completo (mensagem em inglês + stack + contexto) — a sanitização aplica-se apenas à resposta HTTP, nunca ao log estruturado.
- **FR-020**: Refatoração não pode introduzir regressão funcional: todos os testes unit/integration/e2e atuais DEVEM continuar passando após a migração.

### Key Entities *(include if feature involves data)*

- **ApiErrorBody (existente)**: envelope JSON `{ error: { code, message, details? } }`. Permanece o contrato. `code` é uma `UPPER_SNAKE_CASE` string estável (consumido por testes e por front-end).
- **Domain Error (existente, em `src/lib/errors/`)**: classes que herdam de `Error`, com `name` específico. Mantêm mensagem em inglês para log interno; perdem a responsabilidade de carregar texto user-facing em PT-BR.
- **Error Catalog (novo, compartilhado server+client)**: `errorCodes: Record<ErrorCode, ErrorCatalogEntry>` em `src/lib/api/error-codes.ts`. Fonte única de `code → (status, message PT-BR, variant?)`. Importado pelo registry server e pelo wrapper cliente.
- **Error Registry (novo, server)**: array declarativo `ReadonlyArray<{ errorClass, code, extractDetails? }>` que mapeia cada classe de Error de domínio para um code do catálogo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das respostas de erro de `/api/v1/**` (todos os status 4xx e 5xx) passam por testes automatizados que validam: (a) ausência dos padrões de vazamento (FR-002), (b) `error.message` em PT-BR e (c) `code` presente em catálogo conhecido. Cobertura medida via teste cross-route automatizado (sem rota em allowlist).
- **SC-002**: Após a refatoração, o número de blocos `try { … } catch (error: unknown) { if (error instanceof X) … }` em `src/app/api/**` é **zero** (excluído o próprio handler global). Verificação via grep simples no CI ou checklist no `/code-review`.
- **SC-003**: Após a refatoração, ocorrências de `fetch(` apontando para `/api/v1/**` em `src/components/features/**` são **zero** (todas substituídas por `apiFetch`); ocorrências de `toast.error(...)` ou `toast.warning(...)` em hooks/componentes de feature motivadas por erro de API são **zero**. Verificável via grep simples no CI ou checklist em `/code-review`.
- **SC-004** *(propriedade de design — verificável em feature subsequente)*: Para um pull request hipotético introduzindo um erro de domínio novo, o desenvolvedor adiciona **uma única entrada** no catálogo (`error-codes.ts`) e **uma única entrada** no registry (`error-registry.ts`); nenhuma alteração em rotas existentes ou no wrapper de cliente é necessária. Não é verificável por teste automatizado nesta feature; será observada na primeira feature de domínio que adicionar um Error class novo após o merge.
- **SC-005**: Em testes e2e existentes (criação/edição/exclusão de estúdio, livro, capítulo, narrador, editor; login com credenciais inválidas), os textos exibidos ao usuário são todos em PT-BR e não contêm IDs/inglês — verificado por asserts adicionados (ou regex global no teste de smoke) em pelo menos um cenário por entidade.
- **SC-006**: Tempo de resposta de rotas com erro mapeado não regride mais de 5% comparado à baseline anterior. Verificado por benchmark micro-comparativo (50 invocações de uma rota representativa antes e depois) executado em fase final, com resultado documentado no PR. O design (handler é mapeamento O(1) + lookup em registry) prevê regressão desprezível; a meta é capturar regressões inesperadas (ex.: AsyncLocalStorage overhead acima do esperado).

## Assumptions

- O usuário final do sistema fala português brasileiro; nenhum requisito de i18n para outros idiomas está em escopo.
- O contrato `ApiErrorBody` definido em `src/lib/api/error-response.ts` permanece como envelope canônico. Nenhuma mudança de shape é introduzida; apenas a origem das strings muda (catálogo central, não constructor de Error).
- O handler global cobre **apenas** rotas em `/api/v1/**`. Server Components, Server Actions e o handler de auth (`/api/auth/**`) seguem fluxo nativo do Next.js / better-auth e ficam fora desta feature.
- Logging estruturado do servidor já existe (ou é fácil substituir por um logger fake nos testes); se não existir, a implementação introduz um adapter mínimo (`console.error` em produção, fake injetado em teste) e o log estruturado completo fica para uma feature futura — esta entrega exige apenas que o erro original seja persistido server-side, em qualquer formato, antes de retornar 500.
- Mensagens PT-BR já existentes em rotas (ex.: `studios/[id]/route.ts` com `"Estúdio não encontrado"`) servem de baseline para o catálogo central; não há reescrita criativa, apenas consolidação.
- Erros lançados por bibliotecas externas (Drizzle, better-auth, Zod) que escapam do controller também são capturados pelo "fallback" 500 do handler global; mapeamento específico para erros de Drizzle (ex.: violação de unique constraint vinda do banco) **não é escopo** desta feature — o domínio já valida unicidade antes de chegar ao banco. Casos remanescentes caem no 500 genérico.
- A refatoração ocorre em uma única branch e será mergeada como uma unidade; não há suporte para "metade dos endpoints novo handler, metade antigo" em produção.
