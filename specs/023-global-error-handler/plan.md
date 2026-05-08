# Implementation Plan: Global Error Handler

**Branch**: `023-global-error-handler` | **Date**: 2026-05-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/023-global-error-handler/spec.md`

## Summary

Consolidate todas as superfícies de erro do sistema em três módulos compartilhados:

1. **Catálogo único** (`src/lib/api/error-codes.ts`) com a união discriminada de `code` e o `Record<code, messagePt>`. Importado por servidor **e** cliente — fonte única de verdade.
2. **Handler global de rota** (`withApiErrorHandler`) que envolve cada `route.ts`, mapeia exceções de domínio para `(status, code)` via registry declarativo, sanitiza erros desconhecidos para 500 genérico, gera/ecoa `X-Request-Id`, e remove a duplicação de `try/catch instanceof` espalhada hoje em ~10 rotas.
3. **Wrapper de cliente** (`apiFetch`) que substitui chamadas diretas a `fetch` em hooks de feature. Trata 401 (toast warning + redirect), 422 (devolve field-errors ao hook), demais 4xx/5xx (toast PT-BR via catálogo) e falha de rede (toast genérico de conexão) **automaticamente**. Hooks deixam de chamar `toast.error/.warning` para erros de API; reagem apenas a `kind: "field-errors"`.

Mensagens Zod migram para PT-BR diretamente nos schemas (sem camada de tradução). Classes de erro de domínio permanecem com `Error.message` em inglês (uso interno + log) — a tradução PT-BR vive somente no catálogo. Lookup-not-found segue regra única: 404 quando o recurso da URL não existe; 422 com `_REFERENCE_INVALID` quando uma FK em payload aponta para registro inexistente.

Resultado mensurável: zero `try/catch instanceof` em `src/app/api/**`, zero `fetch(/api/v1/**)` em `src/components/features/**`, zero `toast.error(body?.error?.message …)`, e todas as respostas de erro auditadas por teste cross-route que verifica ausência de stack/SQL/path/UUID/inglês de domínio.

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Bun 1.2 (runtime + package manager + test runner)
**Primary Dependencies**: Next.js 16.2.1 (App Router + Turbopack), React 19.2.4, Drizzle ORM 0.45.2, Zod 4.3.6, better-auth 1.5.6, sonner 2.0.7 (toasts), shadcn/ui 4.1.2, Tailwind CSS 4.2
**Storage**: PostgreSQL via Drizzle — **sem mudanças de schema** nesta feature (catálogo é apenas código TS)
**Testing**: Vitest (unit + integration) com transaction rollback; Playwright (E2E) com schema-per-worker
**Target Platform**: Web (Next.js full-stack — Server Components + Client Components + API Routes)
**Project Type**: Web application (Next.js full-stack, single repo)
**Performance Goals**: < 5% regressão em latência de rotas com erro mapeado (SC-006); o handler é só mapeamento sem custo material
**Constraints**:
- Contrato `ApiErrorBody = { error: { code, message, details? } }` preservado (zero mudança de envelope)
- Zero leak de stack/SQL/path/UUID/inglês de domínio em qualquer resposta `/api/v1/**`
- Single-locale PT-BR (sem i18n)
- Refatoração mergeada como unidade — sem flag de migração gradual
**Scale/Scope**:
- ~10 rotas em `/api/v1/**` (books, chapters, studios, narrators, editors, user-preferences)
- ~25 classes de erro de domínio em `src/lib/errors/*-errors.ts`
- ~20 hooks em `src/components/features/**/hooks/*.ts` que tratam erros de API
- ~10 schemas Zod em `src/lib/schemas/**` e `src/lib/domain/**` que precisam de migração para mensagens PT-BR

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Avaliação contra os 16 princípios da [constituição](../../.specify/memory/constitution.md) (resumo inline em [CLAUDE.md](../../CLAUDE.md)):

| # | Princípio | Status | Notas |
|---|-----------|--------|-------|
| I | Capítulo como Unidade | N/A | Feature não toca lógica de capítulo. |
| II | Precisão Financeira | N/A | Nenhum cálculo monetário alterado. |
| III | Ciclo de Vida do Capítulo | N/A | Status não muda; apenas a string user-facing das exceções `Chapter*` é traduzida via catálogo. |
| IV | Simplicidade (YAGNI) | ✅ Pass | Apenas três módulos novos (catálogo, handler, wrapper). Nenhum framework ou abstração extra. |
| V | TDD + Cobertura ≥ 80% | ✅ Pass | Testes obrigatórios: unit do catálogo (FR-012a), unit do handler (FR-007), integration cross-route (FR-017), unit do `apiFetch`. Implementação segue RED → GREEN. |
| VI | Arquitetura Limpa Backend | ✅ Pass | Handler vive em `src/lib/api/` (camada de helpers HTTP); domain errors permanecem em `src/lib/errors/`; services intocados; controllers ficam mais magros. |
| VII | Frontend Atomicidade + Hooks | ✅ Pass | `apiFetch` é utilitário em `src/lib/api/`; hooks de feature continuam co-localizados; o wrapper **reduz** lógica em hooks (fortalece o princípio). Toast policy (proíbe `toast.success`) preservada. |
| VIII | Performance | ✅ Pass | SC-006 garante < 5% regressão. Handler é mapeamento O(1) por status; wrapper adiciona uma camada de função no fluxo de fetch. |
| IX | Design Tokens | N/A | Sem mudanças visuais. |
| X | Padrões de API REST | ✅ Pass | Q2 codifica regra única para 404 vs 422. Envelope preservado. Validação Zod em todas as rotas. Status codes corretos. |
| XI | PostgreSQL | N/A | Sem migrations. |
| XII | Anti-padrões Proibidos | ✅ Pass | Feature **expulsa** anti-padrões existentes (toast com `error.message` cru, `try/catch` repetido por rota, fetch direto em hook). Reforça o princípio. |
| XIII | KPIs do Dashboard | N/A | Sem dashboard envolvido. |
| XIV | PDF do Livro | N/A | |
| XV | Ferramentas/Skills | ✅ Pass | Context7 MCP consultado para Zod 4 (issues + custom messages); `/api-design` e `/backend-patterns` consultados durante clarification. Sem nova lib externa. |
| XVI | Qualidade de Código + Verificação | ✅ Pass | `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`, `bun run build` — todos rodam na fase final antes do PR (CLAUDE.md). |

**Resultado**: Zero violações. Nenhuma entrada em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/023-global-error-handler/
├── plan.md                  # This file (/speckit-plan command output)
├── research.md              # Phase 0 output (/speckit-plan command)
├── data-model.md            # Phase 1 output (/speckit-plan command)
├── quickstart.md            # Phase 1 output (/speckit-plan command)
├── contracts/               # Phase 1 output (/speckit-plan command)
│   ├── error-envelope.md    # ApiErrorBody contract (preserved)
│   ├── error-codes.md       # Code catalog spec (server + client)
│   └── api-fetch.md         # Client wrapper return-type contract
├── checklists/
│   └── requirements.md      # Existing
└── tasks.md                 # Phase 2 output (/speckit-tasks - NOT created here)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── api/
│   │   ├── error-codes.ts           # NEW — single shared catalog (codes + messages)
│   │   ├── error-registry.ts        # NEW — server-side ErrorClass → (status, code) map
│   │   ├── with-error-handler.ts    # NEW — withApiErrorHandler wrapper for routes
│   │   ├── api-fetch.ts             # NEW — client wrapper apiFetch + ApiResult<T>
│   │   ├── request-id.ts            # NEW — request-id generation/echo helpers
│   │   ├── responses.ts             # UPDATED — slimmer; helpers consumed by withApiErrorHandler
│   │   ├── error-response.ts        # UNCHANGED — ApiErrorBody type preserved
│   │   └── headers.ts               # UPDATED — X-Request-Id header support
│   ├── errors/
│   │   └── *-errors.ts              # UPDATED — drop UI-text concerns; static Error.message; rename BookStudioNotFoundError → StudioReferenceInvalidError; expor IDs/dados via propriedades públicas
│   ├── schemas/                     # UPDATED — PT-BR messages embedded in Zod schemas
│   │   ├── book.ts
│   │   ├── chapter.ts
│   │   └── ...
│   ├── domain/                      # UPDATED — same migration where schemas live in domain/
│   └── logger/                      # NEW (minimal) — server-side structured logger adapter
│       └── server-logger.ts
└── app/
    └── api/
        └── v1/
            └── **/route.ts          # REFACTORED — wrap exports with withApiErrorHandler

src/components/features/
└── **/hooks/*.ts                    # REFACTORED — fetch → apiFetch; remove manual error handling

__tests__/
├── unit/
│   └── api/
│       ├── error-codes.spec.ts          # NEW — catalog exhaustiveness (FR-012a)
│       ├── error-registry.spec.ts       # NEW — registry exhaustiveness (FR-007)
│       ├── with-error-handler.spec.ts   # NEW — handler behavior incl. unmapped → 500
│       ├── api-fetch.spec.ts            # NEW — wrapper return-type cases
│       └── request-id.spec.ts           # NEW — generation + echo behavior
├── integration/
│   └── api-error-responses.spec.ts      # EXTENDED — cross-route leak audit (FR-017) + verifica que toda classe Error de domínio dispara o code esperado em rota real (consolidado em uma única spec)
└── e2e/
    └── error-toasts.spec.ts             # NEW — selected flows assert PT-BR toast text without leak
```

**Structure Decision**: Single Next.js full-stack project (existing layout). Three new modules in `src/lib/api/`, surgical updates to existing `src/lib/errors/` and `src/lib/schemas/`, mass-refactor across `src/app/api/v1/**` and `src/components/features/**/hooks/**`. Nenhuma nova pasta top-level; estrutura existente acomoda tudo.

## Phase 0: Outline & Research

Sem `NEEDS CLARIFICATION` (todos os 5 ambíguos foram resolvidos em `/speckit-clarify`). Phase 0 documenta as decisões técnicas concretas — ver [research.md](./research.md).

## Phase 1: Design & Contracts

**Prerequisites**: research.md complete

Outputs:

1. **[data-model.md](./data-model.md)** — entidades de erro: `DomainError`, `ApiErrorBody`, `ApiResult<T>`, `ErrorRegistryEntry`, `ErrorCode` (union), `ClientErrorMessages` (record).

2. **[contracts/](./contracts/)** — três arquivos:
   - `error-envelope.md` — formato de `error.message`, `error.code`, `error.details`, e header `X-Request-Id`.
   - `error-codes.md` — lista exaustiva de `code`s, status HTTP correspondente, mensagem PT-BR e variante de toast.
   - `api-fetch.md` — assinatura de `apiFetch<T>` e formato discriminado de `ApiResult<T>`. Comportamento padrão: toast em todo erro server-side; `details` retornados em paralelo para UI complementar.

3. **[quickstart.md](./quickstart.md)** — receita curta para devs que vão adicionar uma nova rota ou um novo erro de domínio.

4. **Agent context update** — `CLAUDE.md` recebe entrada nas seções "Active Technologies" e "Recent Changes" apontando para este plan e os módulos centrais novos (entre os marcadores `<!-- SPECKIT START -->` … `<!-- SPECKIT END -->` se existirem).

### Re-evaluation post-design

A re-avaliação dos 16 princípios após a Phase 1 mantém o mesmo resultado da tabela acima (zero violações). Os contratos não introduzem novos riscos.

## Complexity Tracking

> **Não preencher** — Constitution Check passou sem violações. Nenhuma justificativa de exceção necessária.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _(vazio)_ | _(vazio)_ | _(vazio)_ |
