# AudioBook Track — Instruções para Claude

> A constituição completa do projeto está em [.specify/memory/constitution.md](.specify/memory/constitution.md).
> Este arquivo contém as regras mais críticas inline para garantir adesão imediata.
> **Em caso de conflito, a constituição prevalece.**

---

## Regras Não-Negociáveis

### Domínio

- **Capítulo é a unidade central** — atribuição, cálculo de ganho e status operam sempre no nível do capítulo, nunca no livro ou estúdio.
- **Preço/hora é imutável quando o livro está `paid`** — vinculado ao livro, nunca ao estúdio; não pode ser recalculado retroativamente após esse status.
- **Representação integer-only** para valores monetários e duração financeira:
  - Monetário: **`integer` em centavos** com sufixo `_cents` — `book.price_per_hour_cents`, `studio.default_hourly_rate_cents`. `numeric(10,2)` é legado; `float`/`double` são proibidos.
  - Duração que alimenta cálculo de ganho: **`integer` em segundos** com sufixo `_seconds` — `chapter.edited_seconds`. Conversão para horas/minutos ocorre apenas na UI.
- **Fórmula de ganho**: `round(chapter.edited_seconds × book.price_per_hour_cents / 3600)` → **valor em centavos**. Determinística, auditável, sem derivação dinâmica. Arredondamento half-away-from-zero; conversão para reais (÷ 100) e formatação BRL ficam na camada de apresentação. Nomes de campos/colunas/enum em **inglês** no código; labels de UI em português.
- **Ciclo de vida do capítulo** (valor no DB / rótulo em UI): `pending` (Pendente) → `editing` (Em edição) → `reviewing` (Em revisão) → [`retake` (Retake)] → `completed` (Concluído) → `paid` (Pago). Nenhuma etapa obrigatória pode ser pulada.
  - `editing` exige narrador atribuído.
  - `reviewing` exige editor + `edited_seconds > 0` registrados.
  - `retake` é opcional — ativado somente por reprovação em `reviewing`; retorna a `reviewing`.
  - `completed` exige revisão aprovada.
  - `paid` torna os dados financeiros imutáveis e desabilita edição do livro.
- **Capítulo marcado como `paid` não pode ter dados financeiros alterados.**

### Arquitetura

- **Camadas obrigatórias** (dependências de fora para dentro):
  ```
  app/api/          → Controllers (HTTP apenas, sem lógica de negócio)
  lib/factories/    → Composition Root (instanciam services com deps concretas)
  lib/services/     → Use Cases (orquestração, sem SQL/HTTP direto)
  lib/repositories/ → Ports (interfaces) na raiz + adapters concretos em subpastas (drizzle/, …)
  lib/domain/       → Entidades, value objects, enums e regras de negócio puras (SEM interfaces de persistência)
  lib/api/          → Helpers de resposta HTTP reutilizáveis (responses.ts)
  ```
- **Injeção de dependência via construtor** — nunca instanciar dependências dentro de uma classe.
- **Factories obrigatórias** — controllers NUNCA instanciam repos/services diretamente; usam `lib/factories/` com funções `create<Service>()`.
- **Respostas de erro padronizadas** — usar helpers de `lib/api/responses.ts` (ex: `unauthorizedResponse`, `validationErrorResponse`).
- **Interfaces em arquivos separados** — nunca co-localizadas com implementações ou tipos de domínio.
- **Sem prefixo `I` em interfaces** — usar `UserPreferenceRepository`, não `IUserPreferenceRepository`.
- **Interfaces de repositório (ports) vivem em `src/lib/repositories/<entidade>-repository.ts`** (raiz da pasta). **NUNCA** em `src/lib/domain/` — a camada de domínio fica livre de preocupações de persistência.
- **Repositories concretos prefixados com o adaptador** — ex: `DrizzleUserPreferenceRepository` implementa `UserPreferenceRepository`, morando em `src/lib/repositories/drizzle/`.
- **shadcn/ui é a biblioteca de componentes padrão** — usar `bunx --bun shadcn@latest add <component>` antes de construir primitivos do zero. A flag `--bun` é obrigatória com Bun runtime.
- **Componentes UI (`components/ui/`)** são shadcn/ui primitivos, puramente visuais: sem `useState` de negócio, sem `fetch`.
- **Componentes client são apenas de renderização** — JSX + chamada de hook. Toda lógica (state machine, mutações, derivações de servidor, side-effects, navegação) DEVE residir em hooks customizados co-localizados em `src/components/features/<feature>/hooks/use-<scope>.ts`. Critério objetivo: estado de domínio (lista, alvo de dialog, `isSubmitting`/`error`) → hook; estado puramente visual (open/close de Popover, hover, foco, input não-validado) → componente. Ver Princípio VII da constituição e [docs/hooks-pattern.md](docs/hooks-pattern.md).
- **Componentes de feature DEVEM residir em `src/components/features/<feature>/`** e ser importados via alias `@/components/features/<feature>/...`. Pastas `_components/` (ou qualquer variante colocada dentro de `src/app/`) são **PROIBIDAS**, mesmo quando o componente é usado por uma única rota.
- **NUNCA usar elementos HTML crus** (`<button>`, `<input>`, `<select>`, etc.) quando existe componente equivalente em `components/ui/`. Usar `<Button>`, `<Input>`, `<Select>`, etc.
- **Páginas autenticadas DEVEM usar componentes de layout** — `<PageContainer>`, `<PageHeader>`, `<PageTitle>`, `<PageDescription>` de `components/layout/page-container.tsx`.
- **Dark mode obrigatório** — todo componente DEVE funcionar em modo claro e escuro. Usar tokens semânticos do Tailwind (`bg-background`, `text-foreground`). NUNCA cores hardcoded que não se adaptam ao tema.
- **Toasts apenas para warnings/erros** — `toast.success(...)` (e equivalentes verde+checkmark) são **proibidos**. O feedback de sucesso DEVE vir da própria efetivação da ação na UI (item entrando/saindo da lista, dialog fechando, redirecionamento, status atualizado). Exceção: ações sem efeito visível imediato (envio em background, exportação enfileirada) podem usar toast **neutro informativo** curto, nunca verde de sucesso. Ações destrutivas concluídas preferem `toast.warning(...)` ou undo discreto.
- **Arquivo `design.pen`** — consultar via Pencil MCP antes de construir qualquer tela nova como referência visual.
- **`use client` apenas quando necessário** — Server Components são o padrão.
- **Data fetching** usa Server Components com `async/await`; `useEffect` para fetch é proibido.

### Banco de dados

- **Valores financeiros**: **`integer` em centavos** (preferido, sufixo `_cents`) OU `numeric(10,2)` (legado). `float`/`double` são proibidos.
- **Durações que alimentam cálculo financeiro**: `integer` em segundos, sufixo `_seconds`.
- **Todo foreign key deve ter índice** correspondente.
- **`SELECT *` é proibido** em código de produção.
- **Transações obrigatórias** para operações que afetam múltiplas tabelas. Usar `SavepointUnitOfWork` para encapsular o `BEGIN/COMMIT` no service (ex: `BookService.create({ inline })` cria estúdio + livro + capítulos atomicamente; deletar capítulo + recomputar `book.status` é uma única transação).
- **Migrations devem ser reversíveis.**
- **Drizzle ORM**: usar `generate` + `migrate` — `drizzle-kit push` é proibido.
- **Soft-delete unificado**: entidades soft-deletáveis (`studio`, `narrator`, `editor`) usam coluna `deleted_at` (nullable, `withTimezone`) com **índice único parcial** `WHERE deleted_at IS NULL` + índice de apoio em `deleted_at IS NOT NULL`. Listagens filtram `deleted_at IS NULL`. **Sem `ON DELETE SET NULL`** em FKs — todas usam `RESTRICT` + soft-delete; nenhum órfão jamais é criado.
- **Desarquive automático por colisão de nome**: criar uma entidade soft-deletável com nome igual ao de um registro arquivado **reativa o registro original** (mesmo `id`) em vez de criar um novo. O service emite o flag `reactivated: true` no envelope e a UI mostra um toast de "desarquivado". `default_hourly_rate_cents` permanece **histórico** no desarquive normal, mas é resetado para o valor recém-fornecido **apenas** quando a criação vem de um livro inline (`{ inline: true }` + propagação de `price_per_hour_cents`).
- **`book.status` é cache materializado** — recomputado por `BookStatusRecomputeService` na **mesma transação** de qualquer mutação de capítulo (create/update/delete/bulk-delete). A fonte da verdade permanece o capítulo (Princípio I). Nunca atualizar `book.status` diretamente fora desse serviço.
- **Derived columns por listagem**: quando uma listagem precisa exibir contagens (ex: `/studios` com `booksCount`, `/narrators` e `/editors` com `chaptersCount`), usar `findAllWithCounts()` no repository (single query com `LEFT JOIN + GROUP BY`). Não criar rota separada `/counts`. Tipos `*ListItem` extendem a entidade com o campo derivado, mantendo o tipo base (`Studio`, `Narrator`, `Editor`) inalterado.

### API REST

- URLs em plural, kebab-case: `/api/v1/books/:id/chapters`
- Status codes corretos: `201` para POST, `204` para DELETE, `422` para dados inválidos, `409` para conflito de estado.
- **Nunca retornar `200` com `{ success: false }`.**
- Input validado com **Zod** em todas as rotas.
- Stack traces e mensagens de SQL **nunca** aparecem em respostas de erro.

### Anti-padrões proibidos

- `any` em TypeScript sem comentário justificando.
- Segredos hardcoded — usar variáveis de ambiente.
- `console.log` em produção — usar structured logger.
- `useEffect` para derivar estado — usar `useMemo`.
- `fetch`, `useEffect` de side-effect ou `router.refresh()` em componente client (`"use client"`) — DEVEM viver em hook co-localizado em `src/components/features/<feature>/hooks/`. Componente client só renderiza JSX e chama o hook.
- `useState` de **estado de domínio** (lista de entidades, alvo de dialog, status de mutação) em componente client — DEVE ir para o hook. Somente estado puramente visual (open/close de Popover, hover, foco, input não-validado) é permitido inline.
- Valores visuais hardcoded (cores, espaçamentos) fora de design tokens.
- Elementos HTML crus (`<button>`, `<input>`, etc.) quando existe componente em `components/ui/`.
- Pasta `_components/` (ou similar) dentro de `src/app/` — componentes de feature DEVEM ficar em `src/components/features/<feature>/`.
- Página autenticada sem `<PageContainer>` e componentes de layout.
- Ignorar dark mode — cores que não se adaptam ao tema.
- `toast.success(...)` (ou equivalente verde + checkmark genérico) para confirmar ações concluídas — feedback de sucesso vem da própria UI; toasts ficam reservados a warnings e erros.
- Lógica de negócio em controllers.
- SQL direto fora de repositories.
- Swallow silencioso de erros: `catch (e) {}`.
- Mutação de objetos recebidos como parâmetro — sempre retornar novo objeto.
- `drizzle-kit push` — usar `generate` + `migrate` para manter journal sincronizado.
- `try/catch` + `instanceof XxxError` em rota `/api/v1/**` — usar `withApiErrorHandler` ([src/lib/api/with-error-handler.ts](src/lib/api/with-error-handler.ts)). Service lança `DomainError`; o wrapper resolve session, captura `ZodError`/`SyntaxError`/`DomainError` e mapeia para o envelope PT-BR via `errorCodes`. Detalhes em [docs/error-handling.md](docs/error-handling.md).
- `fetch(...)` direto em hook de feature contra `/api/v1/**` — usar **`apiFetch<T>`** ([src/lib/api/api-fetch.ts](src/lib/api/api-fetch.ts)) que retorna `ApiResult<T>` discriminado, dispara toast por variant do catálogo, redireciona em 401, e expõe `result.headers` para metadata.
- `toast.error(body?.error?.message ?? "...")` em hook — `apiFetch` já consulta `errorCodes[code]` e dispara toast com a mensagem PT-BR do catálogo. Hook só faz `form.setError(field, ...)` em `kind: "field-errors"` ou em `api-error` com code específico.
- `Error.message` com interpolação de IDs/dados dinâmicos em subclasse de `DomainError` — `super(...)` recebe string **estática descritiva** (FR-018); IDs/dados saem por propriedades públicas e `getDetails()` quando precisarem chegar à UI.
- Mensagens de schema Zod com jargão de campo (`studioId`, `narratorId`, `editorId`, `chapterId`, `editedSeconds`) — user vê isso. Usar rótulos PT-BR (`Estúdio`, `Narrador`, `Editor`, `Capítulo`, `Tempo editado`).
- Helpers legados de resposta (`unauthorizedResponse`, `validationErrorResponse`, `notFoundResponse`, `conflictResponse`, `unprocessableEntityResponse`) — removidos. Toda rota nova passa pelo `withApiErrorHandler`.

---

## TDD (obrigatório)

1. Escreva o teste primeiro (RED).
2. Implemente o mínimo para passar (GREEN).
3. Refatore (IMPROVE).
4. Cobertura mínima: **80%** geral; **100%** para lógica de cálculo de ganho.

---

## Nova entidade de domínio: factory, não seed

Adicionar uma entidade nova (ex: `book`, `chapter`) **NUNCA** toca `src/lib/db/seed-test.ts`. Esse arquivo existe apenas para criar o admin e é a única linha estável entre execuções de teste.

Para prover dados novos em testes:

1. Criar uma factory em `__tests__/helpers/factories.ts` (ex: `createTestBook(db, overrides)`).
2. Chamar a factory no `beforeEach` ou no próprio teste.
3. Confiar no auto-reset do fixture E2E (truncate seletivo) ou no `BEGIN/ROLLBACK` do setup integration para limpar entre testes.

Regra: se você está alterando `seed-test.ts` fora de uma feature que refaz o admin, pare e repense — provavelmente você quer uma factory.

---

## Regras de Classificação de Testes

### Unit (`__tests__/unit/`)

Testa **uma única unidade** (função, classe, módulo) **isolada** de dependências externas.

| Critério | Regra |
|----------|-------|
| Dependências externas | **Todas mockadas** (DB, HTTP, filesystem, crypto) |
| Banco de dados | **Proibido** — nenhuma conexão real |
| Setup file | Nenhum (não usa `setup.ts` de integration) |
| Velocidade | < 50ms por teste |
| O que testar | Schemas Zod, funções puras, validações, state machines, config assertions, middleware com deps mockadas |

**Regra de ouro:** Se o teste usa `vi.mock()` para isolar a unidade → é unit test.

### Integration (`__tests__/integration/`)

Testa a **interação entre 2+ componentes reais**, especialmente com banco de dados.

| Critério | Regra |
|----------|-------|
| Dependências externas | **Pelo menos uma real** (DB, crypto lib, auth lib) |
| Banco de dados | **Real** (PostgreSQL via transaction rollback) |
| Setup file | Usa `__tests__/integration/setup.ts` |
| Isolamento | Transaction rollback automático entre testes |
| O que testar | CRUD no banco, password hashing + persistência, sessões reais, regras de negócio que tocam o DB, cascade deletes, constraints |

**Regra de ouro:** Se o teste precisa de DB real ou integra múltiplos módulos sem mock → é integration test.

### E2E (`__tests__/e2e/`)

Testa **fluxos completos do usuário** pela interface, sem mocks.

| Critério | Regra |
|----------|-------|
| Ferramenta | **Playwright** (browser real) |
| Mocks | **Nenhum** — tudo real (app rodando, DB, auth) |
| Servidor | App Next.js rodando (dev ou build) |
| O que testar | Login completo no browser, navegação protegida, formulários, feedback visual, fluxos críticos ponta-a-ponta |

**Regra de ouro:** Se o teste simula ações de um usuário real no browser → é E2E test.

### Decisão rápida

```
O teste usa vi.mock(), fakes injetados ou testa função pura?  → Unit
O teste conecta no banco ou integra módulos?                  → Integration
O teste abre browser e simula usuário?                        → E2E
```

### Convenção de Test Doubles

#### Quando usar fakes manuais (injeção de dependência)

Para módulos internos do projeto (`@/lib/`, `@/app/`, etc.), **não usar `vi.mock()`**. Em vez disso:

1. **Repository fake (classe)**: Quando um service depende de uma interface de repository via construtor.
   - Modelo: `__tests__/repositories/in-memory-user-preference-repository.ts` → `UserPreferenceService`
2. **Fake de função (`vi.fn()`)**: Quando um módulo aceita dependência como parâmetro de função.
   - Modelo: `__tests__/unit/db/health-check.spec.ts` → `checkDatabaseHealth(ping)`
   - Modelo: `__tests__/unit/api/health.spec.ts` → `handleHealthCheck(deps)`
   - Modelo: `__tests__/unit/db/instrumentation.spec.ts` → `runStartupHealthCheck(deps)`

#### Quando `vi.mock()` é aceitável (allowlist)

`vi.mock()` é permitido **apenas** para módulos que não são injetáveis por design:

| Módulo | Categoria |
|--------|-----------|
| `next/headers` | Framework externo (Next.js) |
| `next/navigation` | Framework externo (Next.js) |
| `@axe-core/playwright` | Biblioteca externa |
| `better-auth/cookies` | Biblioteca externa |
| `@/lib/env` | Infraestrutura de ambiente (singleton) |
| `@/lib/db` | Infraestrutura de I/O (singleton PostgreSQL) |

Os mocks globais de `@/lib/db` e `@/lib/env` ficam em `__tests__/unit/setup.ts`.

#### `vi.fn()` é livre

`vi.fn()` pode ser usado livremente para criar fakes tipados — não exige classes hand-written para funções simples. Exemplo:

```
const checkConnection = vi.fn().mockResolvedValue({ healthy: true });
```

### Isolamento de testes (integration e E2E)

- **Banco de teste separado**: `audiobook_track_test`. `TEST_DATABASE_URL` é obrigatória quando `NODE_ENV=test` (validado via `superRefine` no schema Zod de env). `DATABASE_URL` NUNCA aponta para essa base.
- **Integration — BEGIN/ROLLBACK**: cada teste roda em transação iniciada em `beforeEach`, desfeita em `afterEach`. Nenhum dado persiste entre testes.
- **E2E — schema-per-worker**: cada worker do Playwright recebe `e2e_w{i}_{uuid8}`. Migrations aplicadas via CLI customizado que reescreve `"public"."..."` → `"<schema>"."..."` e mantém journal em `<schema>.__drizzle_migrations`.
- **E2E — servidor por worker**: `next start` em `BASE_E2E_PORT + workerIndex`, `.next/` compartilhado via `next build` único cacheado (`globalSetup`). `next dev --turbopack` por worker é PROIBIDO.
- **E2E — reset entre testes**: `TRUNCATE ... RESTART IDENTITY CASCADE` preservando `user`/`account`/`session`/`__drizzle_migrations`. Admin seed fica de pé durante todo o worker.
- **`E2E_TEST_MODE=1`**: flag lido por request para desligar rate limit e habilitar signup no `auth/server.ts`. Usar em vez de `NODE_ENV === "test"` (incompatível com `next start` que exige `production`).
- **Schemas órfãos**: identificados por `COMMENT ON SCHEMA` com timestamp ISO. Limpeza por `globalSetup` do Playwright e `bun run db:test:clean-orphans`.
- **`src/lib/env/schema.ts` separado de `index.ts`**: permite importar o schema puro sem acionar mock global de `@/lib/env` em unit tests.

Referência detalhada com diagramas e troubleshooting: [docs/testing-strategy.md](docs/testing-strategy.md).

---

## Skills obrigatórias

**Workflow:** `/speckit-specify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`, `/speckit-analyze`, `/conventional-commits`, `/finish-task`, `/tdd`, `/code-review`, `/simplify`, `/e2e`

**Referência:** `/shadcn`, `/docs` (Context7 MCP), `/api-design`, `/backend-patterns`, `/postgres-patterns`, `/frontend-patterns`, `/frontend-design`, `/vercel-composition-patterns`, `/ui-ux-pro-max`

- **Context7 MCP obrigatório** — antes de usar qualquer API de lib (Next.js, React, Drizzle, Zod, shadcn, Tailwind, Playwright, etc.), consultar docs via Context7 (`resolve-library-id` + `query-docs`).

---

## Verificação de qualidade (fase final única, não por fase)

Durante fases intermediárias, rodar apenas os testes diretamente
relacionados à mudança atual (ex: o arquivo de teste do TDD).
Não rodar `bun run lint`, `bun run build` ou a suíte completa a cada
task — isso é ruído desproporcional.

**Fase final (obrigatória antes do PR / `/finish-task`):**

- `bun run lint` — zero erros e zero warnings
- `bun run test:unit`
- `bun run test:integration`
- `bun run test:e2e` (quando a mudança afeta fluxos E2E)
- `bun run build` — produção compila sem erros

**Regra permanente — SEMPRE usar scripts do `package.json`, nunca comandos diretos:**

- `bun run lint` (não `bunx biome check .`)
- `bun run test:unit` (não `bun vitest run __tests__/unit/`)
- `bun run test:integration` (não `bun vitest run __tests__/integration/`)
- `bun run test:e2e` (não `bunx playwright test`)
- `bun run build` (não `next build`)

---

## Branch principal

- A branch principal é `main`.
- Todos os PRs DEVEM ser abertos contra `main`.

---

## Self-Review antes de qualquer entrega

```
- [ ] I.    Operações no nível do capítulo?
- [ ] II.   Cálculos financeiros determinísticos e auditáveis?
- [ ] III.  Transições de status validadas, com data e responsável?
- [ ] IV.   Complexidade justificada por requisito concreto?
- [ ] V.    Testes escritos ANTES da implementação, cobertura ≥ 80%?
- [ ] VI.   Lógica de negócio no Service/Domain, não no Controller?
- [ ] VII.  Componentes UI puramente visuais? Usando components/ui/ (não HTML cru)?
- [ ] VII.  Componentes client contêm apenas renderização? Lógica reside em hooks customizados em src/components/features/<feature>/hooks/?
- [ ] VII.  PageContainer e layout components em páginas autenticadas?
- [ ] VII.  Dark mode funciona em todos os componentes novos?
- [ ] VIII. Sem peso desnecessário no bundle do cliente?
- [ ] IX.   Valores visuais via design tokens (sem hardcode)?
- [ ] X.    Endpoints REST corretos (URL, método, status, envelope, Zod)?
- [ ] XI.   Sem SELECT *? Foreign keys com índice? Monetário em `integer` cents (preferido) ou `numeric(10,2)` (legado)? Durações de cálculo em `integer` segundos?
- [ ] XII.  Nenhum anti-padrão proibido presente?
- [ ] XV.   Context7 MCP consultado? design.pen referenciado para telas?
- [ ] XVI.  Fase final de verificação executada (lint + testes + build) antes do PR?
```

---

## Modelo de domínio (resumo)

| Entidade   | Pertence a | Campo crítico                        |
|------------|------------|--------------------------------------|
| Estúdio    | —          | nome                                 |
| Livro      | Estúdio    | `price_per_hour_cents` (imutável quando `paid`), `pdf_url` (opcional) |
| Capítulo   | Livro      | `status`, `narrator_id`, `editor_id`, `edited_seconds` |
| Narrador   | —          | `name` único (case-sensitive, após `trim`); responsável pela gravação dos capítulos |
| Editor     | —          | recebe pagamento por horas em capítulos atribuídos |

Sem entidades órfãs: capítulo sem livro ou livro sem estúdio são inválidos.

---

## Workflow de desenvolvimento

1. Feature começa com `spec.md` aprovada (`/speckit-specify`).
2. `plan.md` com decisões de arquitetura antes de codar (`/speckit-plan`). Consultar `design.pen` via Pencil MCP.
3. Consultar docs de libs via Context7 MCP antes de implementar.
4. TDD (ver acima) — usar `/tdd`.
5. Verificação de qualidade em fase final única (antes do PR): `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e` (quando aplicável), `bun run build`. Durante fases intermediárias, rodar apenas os testes da mudança atual.
6. Code review verificando conformidade com os Princípios I–XVI (`/code-review`).
7. Commits convencionais: `feat:`, `fix:`, `refactor:`, `test:`, `docs:` (`/conventional-commits`).
8. Finalização: `/finish-task` para criar PR contra `main`.

Qualquer mudança no modelo financeiro (preço, horas, responsáveis) requer **revisão dupla** antes do merge.

**Idioma dos artefatos**: Nos artefatos do speckit, títulos e textos em negrito dos templates permanecem em **inglês**; o conteúdo descritivo (placeholders preenchidos) DEVE ser em **português brasileiro**. Termos técnicos em inglês podem ser mantidos. Commits e branches permanecem em inglês.


## Recent Changes
- 031-route-loading-skeletons: Added TypeScript 5.9.3 sobre Bun 1.2 (runtime + package manager + test runner) + Next.js 16.2.1 (App Router, convenção `loading.tsx`), React 19.2.4, shadcn/ui (primitivos `Skeleton`, `Button`, `Input`, `Card`), Tailwind CSS 4.2 (variant `motion-reduce:`), lucide-react (ícones `Plus`/`Search` da moldura). **Nenhuma dependência nova** (FR-006).
- 029-production-observability: Added `audit_log` (text id, sem FK em `user_id` por LGPD; 4 índices: parcial em `(user_id, created_at DESC)` onde `user_id` não é nulo, composto em `(entity_type, entity_id, created_at DESC)`, B-tree em `request_id` e BRIN em `created_at`). Catálogo `AUDIT_ACTIONS` com 25 valores. `AuditService.recordWithin(tx, …)` grava na mesma transação da mutação; `record(…)` é best-effort para callbacks de auth. Domain services (studio/book/chapter/narrator/editor) recebem `auditService` + `uow` opcionais; factories de produção injetam ambos. Better-auth `databaseHooks` gravam `auth.signup`/`auth.login.success`/`auth.logout`. `RequestContextStore` ganha `userId`; `serverLogger` injeta `request_id`+`user_id` em todo log. `withApiErrorHandler` envolve handler com `withRequestLogging` (1 log JSON `api.request` por request, `slow=true` quando `duration_ms > 3000`). `/api/health` agora devolve `uptime_seconds`/`app_version`/`checks.database.latency_ms`. `POST /api/cron/purge-audit-log` (autenticado com `crypto.timingSafeEqual` contra `CRON_SECRET ≥ 32 chars`) apaga `> 90` dias; `vercel.json` registra cron `0 3 * * *`. `@sentry/nextjs` 10 instalado com `sampleRate=1.0`/`tracesSampleRate=0`/release=`APP_VERSION`; `withSentryConfig` ativado quando `SENTRY_DSN/ORG/PROJECT` presentes. `DomainError`/`ZodError`/`SyntaxError` filtrados antes do envio. Env schema exige `SENTRY_DSN` e `CRON_SECRET` em production fora do build phase. Docs: [docs/deploy.md](docs/deploy.md) (runbook de deploy), [docs/observability.md](docs/observability.md) (runbook do operador).
- 026-chapter-titles-reordering: Substituído `chapter.number` por `chapter.title` (`text NOT NULL`, max 100, sem `\n`/`\r`, em `PAID_LOCKED_FIELDS`) + `chapter.position` (`integer NOT NULL`, denso `0..N-1`, UNIQUE `(book_id, position)` DEFERRABLE INITIALLY DEFERRED, fora de `PAID_LOCKED_FIELDS`). Novo `book.chapters_version` (`integer NOT NULL DEFAULT 0`) bumpado em toda mutação de capítulo via `recomputeBookStatusAndBumpVersion` na mesma transação. Reorder via híbrido drag-and-drop (`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`) + botões ↑/↓ visíveis em cada linha; endpoint declarativo `PUT /api/v1/books/:bookId/chapters/order` com `expectedVersion` para conflito 409 (`BOOK_CHAPTERS_VERSION_CONFLICT`). Botão `"+ Adicionar capítulo"` na página de detalhe substitui o caminho implícito (`numChapters` no edit) — diálogo com seletor de tipo (numerado / template `Prólogo`/`Epílogo`/`Apresentação` / personalizado) e posição (`no início`/`no fim`/`depois de…`). Criação de livro aceita `chapters: { numbered, extras }` (discriminated union), `numChapters` legado proibido por `strictObject`. Novas libs: `@dnd-kit/core` 6.x, `@dnd-kit/sortable` 8.x, `@dnd-kit/utilities` 3.x.

## Active Technologies
- TypeScript 5.9.3 sobre Bun 1.2 (runtime + package manager + test runner) + Next.js 16.2.1 (App Router, convenção `loading.tsx`), React 19.2.4, shadcn/ui (primitivos `Skeleton`, `Button`, `Input`, `Card`), Tailwind CSS 4.2 (variant `motion-reduce:`), lucide-react (ícones `Plus`/`Search` da moldura). **Nenhuma dependência nova** (FR-006). (031-route-loading-skeletons)
- N/A — feature puramente de apresentação; nenhuma mudança de schema, repository ou service. (031-route-loading-skeletons)

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/033-double-click-row-edit/plan.md
<!-- SPECKIT END -->
