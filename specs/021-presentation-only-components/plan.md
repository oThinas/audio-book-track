# Implementation Plan: Componentes Apenas de Renderização (Lógica em Hooks)

**Branch**: `021-presentation-only-components` | **Date**: 2026-04-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/021-presentation-only-components/spec.md`

## Summary

Refatoração arquitetural com três entregáveis encadeados:

1. **P1 — Implementação de referência (Estúdios)**: extrair toda lógica de estado/dados/mutações dos 5 componentes de `src/components/features/studios/` para hooks customizados co-localizados (`use-studios-list`, `use-studio-row`, `use-studio-new-row`, `use-delete-studio`). Componentes ficam reduzidos a JSX que consome o hook.
2. **P2 — Migração das 5 features remanescentes**: aplicar o mesmo padrão a `settings → auth → narrators → editors → books-chapters` (ordem crescente de complexidade), 1 PR por feature, sem retrabalho dos hooks anteriores.
3. **P3 — Enforcement humano-assistido**: emendar a constituição (Princípio VII e XII) para fixar critérios objetivos do que conta como "lógica" vs. "estado visual local"; atualizar `CLAUDE.md` com a regra detalhada e item dedicado no self-review checklist; lint formal **fora do escopo** (decisão Q2 das Clarifications).

A constituição vigente (v2.16.0) já estabelece em **Princípio VII** que "Lógica de estado e data fetching DEVEM residir em custom hooks ou Server Components — nunca inline em JSX" (l.527-530), mas critérios objetivos faltam — esta feature codifica os critérios e migra o código existente para conformidade. **Princípio XII** (l.728-729) já proíbe componentes >200 linhas; existem hoje 5 componentes acima desse limite (`book-edit-dialog` 481 LOC, `book-create-dialog` 380 LOC, `chapter-row-edit-mode` 302 LOC, `book-detail-client` 255 LOC, `studio-row` 234 LOC) que esta refatoração resolve por consequência.

Abordagem técnica: hooks co-localizados em `src/components/features/<feature>/hooks/` retornando objetos nomeados (`{ data, isLoading, callbacks... }`); testes unitários com `renderHook` (`@testing-library/react`); zero alterações em Server Components, primitivos `components/ui/**` e layout. Forms RHF mantêm `useForm()` no componente, com submit handler e mutações orquestradas em hook (`use<Action><Entity>Form`).

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Bun 1.2 (runtime + package manager + test runner)
**Primary Dependencies**: Next.js 16.2.1 (App Router + Turbopack), React 19.2.4, React Hook Form 7.72.1 + `@hookform/resolvers` 5.2.2, Zod 4.3.6, `@tanstack/react-table` 8.21.3, shadcn/ui 4.1.2, Tailwind CSS 4.2, `sonner` 2.0.7, `lucide-react`
**Storage**: N/A (refatoração não toca camada de dados — hooks consomem `/api/v1/**` existentes)
**Testing**: Vitest (unit + integration) com `@testing-library/react` (`renderHook`); Playwright (E2E). Convenção de test doubles: fakes manuais (classes ou `vi.fn()`) para módulos internos; `vi.mock()` apenas para módulos não-injetáveis (allowlist em `__tests__/unit/setup.ts`).
**Target Platform**: Web (browser moderno + Node/Bun no servidor). Mobile-first via Tailwind (Princípio VII).
**Project Type**: Web application (Next.js App Router monolito)
**Performance Goals**: Refatoração preserva comportamento — sem novas metas de performance além das já vigentes (LCP < 1s, Princípio VIII). Hooks NÃO podem introduzir re-renders adicionais perceptíveis (cobertura via testes unitários comparando contagem de re-renders quando crítico).
**Constraints**:
- Zero regressões nas suítes `bun run test:unit`, `bun run test:integration`, `bun run test:e2e` existentes (FR-007, SC-004).
- Cobertura ≥ 80% nos hooks novos/refatorados (FR-005, SC-003).
- Lint formal fora do escopo (Clarifications Q2).
- Server Components, `components/ui/**`, `components/layout/**` permanecem inalterados (FR-012).
**Scale/Scope**: 40 componentes em `src/components/features/**` (auditoria classifica cada um); 6 features afetadas (`studios` em P1; `settings`, `auth`, `narrators`, `editors`, `books`/`chapters` em P2); 0 mudanças em rotas, repositories, services, schemas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Avaliação dos princípios I–XVI da constituição v2.16.0 contra esta feature:

| Princípio | Aplica? | Status | Notas |
|---|---|---|---|
| I. Capítulo como Unidade | Sim | ✅ | Refatoração não toca lógica de domínio; capítulo continua como unidade central. Hooks novos não derivam estado de domínio dinamicamente. |
| II. Precisão Financeira | Sim | ✅ | Helper `lib/domain/earnings.ts` permanece intocado. Cálculos continuam puros e auditáveis. |
| III. Ciclo de Vida do Capítulo | Sim | ✅ | Lógica de transição (hoje em `chapter-row-edit-mode.tsx`, 302 LOC) sai para hook dedicado (`use-chapter-row-edit`); validações de transição permanecem no service backend. Refatoração preserva todas as guards. |
| IV. Simplicidade (YAGNI) | Sim | ✅ | A refatoração **reduz** complexidade percebida (componentes menores, lógica isolada). Não introduz abstrações especulativas. Hook único por componente é o padrão; só fragmentar quando há ganho concreto de reutilização. |
| V. TDD | Sim | ✅ | Hooks novos seguem RED → GREEN → IMPROVE com testes unitários (`renderHook`) escritos primeiro. Cobertura ≥ 80% (linhas + branches) por hook. |
| VI. Arquitetura Limpa Backend | Não | N/A | Feature é exclusivamente frontend. |
| VII. Frontend: Composição | Sim | ✅ **CORE** | Esta feature **codifica e cumpre** o princípio. Plano P3 amenda a redação para incluir critérios objetivos (estado visual vs. estado de domínio; quando dividir hooks). |
| VIII. Performance | Sim | ✅ | Hooks usam `useMemo`/`useCallback` quando há derivação cara; testes unitários medem re-renders em casos críticos. Server Components permanecem padrão. |
| IX. Design Tokens | Sim | ✅ | Refatoração não muda nada visual; tokens permanecem fonte da verdade. |
| X. API REST | Não | N/A | Sem novos endpoints; hooks consomem `/api/v1/**` existentes. |
| XI. PostgreSQL | Não | N/A | Sem mudanças de banco. |
| XII. Anti-Padrões | Sim | ✅ | Refatoração resolve por consequência o anti-padrão "componentes >200 linhas" em 5 arquivos. P3 adiciona explicitamente "lógica de domínio em componente client" e "fetch em componente client" como anti-padrões frontend (já parcialmente listados). |
| XIII. Métricas KPI | Não | N/A | Dashboard não é tocado nesta feature. |
| XIV. PDF do Livro | Não | N/A | Componente `book-pdf-popover` (185 LOC) é refatorado em P2 junto com books, mas a funcionalidade do PDF não muda. |
| XV. Skills Obrigatórias | Sim | ✅ | `/frontend-patterns` e `/frontend-design` consultadas durante `/speckit-plan` — reconciliação completa registrada em [research.md §R9](./research.md). `/docs` (Context7), `/tdd`, `/code-review`, `/simplify` serão consultadas durante implementação conforme aplicável. |
| XVI. Verificação Qualidade | Sim | ✅ | Fase final única (`bun run lint`/`test:unit`/`test:integration`/`test:e2e`/`build`) é executada antes do PR de cada feature migrada — não a cada task. |

**Gates: PASS.** Nenhuma violação. Esta feature **reforça** a constituição em vez de violá-la.

## Project Structure

### Documentation (this feature)

```text
specs/021-presentation-only-components/
├── plan.md                  # Este arquivo
├── spec.md                  # Especificação aprovada (com Clarifications)
├── research.md              # Phase 0: decisões técnicas (Context7, padrões)
├── data-model.md            # Phase 1: auditoria + estrutura canônica do hook (não há entidades de domínio novas)
├── contracts/               # Phase 1: assinaturas canônicas dos hooks de Estúdios (referência P1)
│   ├── use-studios-list.contract.md
│   ├── use-create-studio-form.contract.md
│   ├── use-studio-row.contract.md         # cobre useStudioRow + useUpdateStudioForm
│   └── use-delete-studio.contract.md
├── quickstart.md            # Phase 1: receita "como refatorar uma feature" para replicar o padrão
├── checklists/
│   └── requirements.md      # Spec quality checklist (já validado no /speckit-clarify)
└── tasks.md                 # Phase 2 output (gerado por /speckit-tasks)
```

### Source Code (repository root)

A refatoração opera sobre a estrutura existente. Mudanças concentradas em `src/components/features/**/`:

```text
src/
├── app/                                    # SEM MUDANÇAS (Server Components mantêm padrão)
│   ├── api/v1/...                          # SEM MUDANÇAS (rotas REST intocadas)
│   └── (authenticated)/...page.tsx         # SEM MUDANÇAS (páginas Server Component)
├── components/
│   ├── ui/                                 # SEM MUDANÇAS (primitivos shadcn/ui)
│   ├── layout/                             # SEM MUDANÇAS (PageContainer, etc.)
│   └── features/
│       ├── studios/                        # P1 — REFERÊNCIA
│       │   ├── studios-client.tsx          # REFATORAR: thin component que chama use-studios-list()
│       │   ├── studios-table.tsx           # REFATORAR: presentation-only
│       │   ├── studio-row.tsx              # REFATORAR: presentation-only (hoje 234 LOC > limite Princípio XII)
│       │   ├── studio-new-row.tsx          # REFATORAR: presentation-only
│       │   ├── delete-studio-dialog.tsx    # REFATORAR: presentation-only
│       │   └── hooks/                      # NOVO — hooks co-localizados
│       │       ├── use-studios-list.ts
│       │       ├── use-studio-row.ts
│       │       ├── use-studio-new-row.ts
│       │       └── use-delete-studio.ts
│       ├── settings/                       # P2-1 (mais simples)
│       ├── auth/                           # P2-2
│       ├── narrators/                      # P2-3
│       ├── editors/                        # P2-4
│       └── books/ + chapters/              # P2-5 (mais complexa)
├── lib/
│   ├── hooks/                              # SEM MUDANÇAS (hooks reutilizáveis já existentes)
│   ├── domain/, services/, repositories/   # SEM MUDANÇAS
│   └── factories/, api/, db/               # SEM MUDANÇAS
└── styles/                                 # SEM MUDANÇAS

__tests__/
├── unit/
│   └── components/features/                # NOVO — testes dos hooks (renderHook)
│       ├── studios/
│       │   ├── use-studios-list.spec.ts
│       │   ├── use-studio-row.spec.ts
│       │   ├── use-studio-new-row.spec.ts
│       │   └── use-delete-studio.spec.ts
│       └── ... (idem para cada feature em P2)
├── integration/                            # SEM MUDANÇAS (testes existentes asseguram não-regressão)
└── e2e/                                    # SEM MUDANÇAS (oráculo de comportamento)

.specify/memory/constitution.md             # P3: emendar Princípio VII + XII (versão MINOR ou PATCH)
CLAUDE.md                                   # P3: adicionar regra na seção Arquitetura + item self-review
```

**Structure Decision**: Reaproveitamos a estrutura monolito Next.js existente. Único acréscimo estrutural: subpasta `hooks/` dentro de cada feature em `src/components/features/<feature>/hooks/`. Decisão tomada por:

1. **Co-localização**: hook + componente da mesma feature evoluem juntos; mover entre features fica explícito.
2. **Subpasta `hooks/` (vs. arquivos soltos na raiz da feature)**: separa visualmente apresentação de lógica dentro da própria feature, escalando para 4–8 hooks por feature sem poluir a listagem.
3. **`src/lib/hooks/` permanece** para hooks **reutilizáveis entre features** (`use-sidebar`, `use-mobile-menu`, `use-auto-save-preference`). Critério para promover: usado por ≥ 2 features.

## Complexity Tracking

> Não há violações de constituição que demandem justificativa.

A feature **resolve** complexidade existente (5 componentes >200 LOC, lógica de estado misturada com renderização) e **codifica** padrão já enunciado na constituição. Nenhuma nova abstração arquitetural é introduzida — apenas separação consistente de responsabilidades entre componente e hook, padrão já idiomático em React.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| (nenhuma) | — | — |

---

## Phase 0 — Outline & Research

**Output**: [research.md](./research.md)

Decisões técnicas pendentes resolvidas em Phase 0:

1. **Convenção de retorno do hook** — objeto nomeado vs. tupla; chaves canônicas para CRUD; padrão para mutações.
2. **Granularidade de hooks por feature** — 1 hook único vs. múltiplos co-localizados (1 por componente que precisa de lógica).
3. **Padrão de teste de hook** — `renderHook` do `@testing-library/react`, mock de `fetch` global vs. fakes injetados, asserts de re-render.
4. **Tratamento de RHF** — onde mora `useForm()`, como o hook recebe o `form`, como expõe `onSubmit`.
5. **Optimistic updates / refetch** — manter `router.refresh()` após mutação ou padronizar outro mecanismo.
6. **Naming dos hooks** — `use-<feature>-<scope>` (ex: `use-studios-list`, `use-studio-row`).
7. **Migração de state machine de capítulos** — hook único `use-chapter-row-edit` ou múltiplos.

Cada decisão registrada em `research.md` no formato `Decision / Rationale / Alternatives considered`.

## Phase 1 — Design & Contracts

**Outputs**:

- [data-model.md](./data-model.md) — auditoria componente-por-componente classificando os 41 arquivos em `src/components/features/**` (já conforme / migrar / fora do escopo) + estrutura canônica do hook (interface, retorno, ciclo de vida).
- [contracts/use-studios-list.contract.md](./contracts/use-studios-list.contract.md), [contracts/use-create-studio-form.contract.md](./contracts/use-create-studio-form.contract.md), [contracts/use-studio-row.contract.md](./contracts/use-studio-row.contract.md) (cobre `useStudioRow` + `useUpdateStudioForm`), [contracts/use-delete-studio.contract.md](./contracts/use-delete-studio.contract.md) — assinaturas canônicas (input, output, side-effects, invariantes) dos hooks da feature de referência (Estúdios). Servem como contrato testável (testes assertam o shape exato) e exemplo replicável.
- [quickstart.md](./quickstart.md) — receita passo-a-passo "como refatorar uma feature" (10 passos: inventário → extração → testes → smoke → cleanup), reutilizada em cada PR de P2.
- Atualização do agent context (`CLAUDE.md`/`AGENTS.md` conforme detecção) via `.specify/scripts/bash/update-agent-context.sh claude`.

### Re-check Constitution Check post-design

Após gerar `data-model.md` + `contracts/` + `quickstart.md`, reavaliar:

- ✅ Princípio IV (YAGNI): contratos cobrem apenas Estúdios (referência); demais features herdam o padrão sem novos contratos artificialmente.
- ✅ Princípio V (TDD): cada contrato é a base do teste — testes assertam que o hook retorna exatamente o shape contratado.
- ✅ Princípio VII: contratos demonstram que a UI consome o hook e não conhece nada da camada de dados.

**Gates pós-design: PASS.**
