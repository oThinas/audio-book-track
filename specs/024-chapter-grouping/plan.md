# Implementation Plan: Agrupamento de capítulos por editor/narrador/status

**Branch**: `024-chapter-grouping` | **Date**: 2026-05-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/024-chapter-grouping/spec.md`

## Summary

Adicionar **agrupamento multi-nível** à tabela de capítulos em `/books/:id`, permitindo o usuário compor uma hierarquia de até 3 dimensões — `narrator`, `editor`, `status` — via um controle multi-select. Cada linha-resumo mostra contagem de capítulos, soma de `editedSeconds` (formatada), ganho total em BRL e breakdown por status. O estado do agrupamento é sincronizado com `?groupBy=...` na URL. Capítulos sem narrador/editor caem em um bucket "Sem atribuição" sempre no fim do seu nível. A coluna de ganho na linha-resumo de grupos de **narrador** é gated por uma feature flag (`SHOW_EARNINGS_IN_NARRATOR_GROUPS`, default `true`).

**Abordagem técnica** (de [research.md](./research.md)):

1. **Pré-requisito (M0)**: Migrar `chapters-table.tsx` para TanStack Table v8 (`@tanstack/react-table@^8.21.3`, já instalado). Hoje a tabela renderiza rows diretamente sem TanStack; o resto do projeto (books/narrators/editors/studios tables) já usa o padrão.
2. **Render hybrid (M5–M6)**: TanStack drives state (grouping, expansion, sorting); folhas continuam renderizadas por `<ChapterRow>` existente (preserva modos view/edit, dialog de delete, selection mode). Group rows renderizadas por novo `<ChapterGroupRow>`.
3. **Agregações** (M1): Built-in `sum` para `editedSeconds`; customs `sumCentsRounded` (ganho, arredondamento por capítulo seguindo Princípio II) e `countByStatus` (breakdown). Tudo em `lib/domain/chapter-aggregation.ts`.
4. **URL state** (M2): Hook `useChaptersGroupingState` com `useSearchParams` + `router.replace(..., { scroll: false })`. Parser whitelist com fallback silencioso para flat.
5. **Bucket "Sem atribuição"** (M6): Sentinel `"__unassigned__"` no `accessorFn` + custom `sortingFn` que empurra sempre para o fim.
6. **Sort de header dentro do grupo** (M6): `getSortedRowModel` ativo; colunas agrupáveis usam `sortingFn` custom (não respondem a click); colunas folha respondem normalmente.
7. **Feature flag** (M3): `src/lib/config/feature-flags.ts`, novo arquivo, constante `as const`. Aplicada na renderização do `aggregatedCell` de `earnings` apenas para nível `narrator`.

Nenhuma mudança em schema PostgreSQL, em `lib/services/`, em `lib/repositories/`, em rotas `/api/v1/**`, nem em validação Zod. **Feature 100% apresentacional.**

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Bun 1.2 (runtime + package manager + test runner)
**Primary Dependencies**:
- Next.js 16.2.1 (App Router + Turbopack), React 19.2.4
- `@tanstack/react-table` 8.21.3 (já instalado)
- shadcn/ui 4.1.2 (DropdownMenu, Button, Table, ScrollArea), Tailwind CSS 4.2
- `lucide-react` (ChevronDown, ChevronRight, ChevronUp)

**Storage**: N/A (feature puramente apresentacional; sem migration, sem mudança de schema)

**Testing**:
- Unit: Vitest (`bun run test:unit`)
- Integration: Vitest + Postgres (`bun run test:integration`) — não usado nesta feature
- E2E: Playwright (`bun run test:e2e`)

**Target Platform**: Web (Next.js App Router em dev/prod), modo claro e escuro obrigatórios

**Project Type**: Web application (Next.js App Router), feature em `src/components/features/chapters/`

**Performance Goals**:
- Trocar agrupamento atualiza a tabela em **< 300 ms** percebidos (SC-005) para livros com ≤ 500 capítulos
- Load inicial com `?groupBy=...` aplicado em **< 2 s** após render da rota (SC-002)
- Nenhum fetch adicional ao trocar agrupamento (cliente-side puro)

**Constraints**:
- Mobile-first (Princípio VII): controle e tabela funcionam em < 640px
- Dark mode obrigatório (tokens semânticos Tailwind)
- Cobertura mínima 80% no diff; 100% nas funções de cálculo de ganho (Princípio II)
- Toasts apenas para warnings/erros — feedback de sucesso vem da própria UI atualizada (toast.success proibido)
- Components em `src/components/features/chapters/` (jamais `_components/` dentro de `src/app/`)
- Lógica em hooks (`src/components/features/chapters/hooks/`); componentes só renderizam

**Scale/Scope**:
- Livros típicos: < 500 capítulos
- Hierarquia: até 3 níveis (`narrator → editor → status`)
- 1 nova rota? Não — apenas search param novo em `/books/:id`
- Componentes novos: 2 (`ChapterGroupingControl`, `ChapterGroupRow`) + 1 hook (`useChaptersGroupingState`)
- Arquivos de domain/utils novos: 2 (`chapter-aggregation.ts`, `feature-flags.ts`); 1 função adicionada a `lib/utils.ts` (`formatGroupedSeconds`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gates aplicáveis (feature apresentacional sem mudança de domínio/banco/API)

| Princípio | Aplicação nesta feature | Status |
|---|---|---|
| **I. Capítulo como Unidade** | Feature opera 100% no nível de capítulo; agregações somam capítulos (folhas) — nunca dão precedência a livro/estúdio | ✅ |
| **II. Precisão Financeira** | `sumCentsRounded` arredonda **por capítulo** antes de somar (`computeChapterEarningsCents` é a fonte da verdade). Conversão `cents → R$` só na apresentação. `float`/`double` proibidos — todos os tipos são `number` representando inteiro centavo. Sem precisão derivada dinamicamente | ✅ |
| **III. Ciclo de Vida** | Feature não altera transição de status. Status aparece apenas como dimensão de agrupamento e como breakdown — leitura, nunca escrita | ✅ |
| **IV. Simplicidade (YAGNI)** | Sem reordenação por drag/setas (clarify Q2); sem export CSV; sem filtros; sem persistência por usuário; reutiliza TanStack Table já no projeto. Único "extra" é a migração da `chapters-table` para TanStack — justificada porque elimina código manual e alinha com 4 outras tabelas | ✅ (com 1 entrada em Complexity Tracking) |
| **V. TDD** | Workflow: unit tests TDD em `chapter-aggregation.ts` e `parseGroupingParam` (100% nas agregações de ganho); E2E após renderização verde. Cobertura ≥ 80% no diff (target operacional, não fixo) | ✅ |
| **VI. Arquitetura Limpa Backend** | N/A — sem backend novo | ✅ |
| **VII. Frontend: Composição, Atomicidade, Mobile First** | Componentes em `src/components/features/chapters/` (NÃO em `_components/`). Lógica em hooks co-localizados. Componentes shadcn obrigatórios (DropdownMenu via `bunx --bun shadcn@latest add` se faltar). Mobile-first via Tailwind utilities + ScrollArea já presente. Dark mode via tokens semânticos. NUNCA `toast.success` | ✅ |
| **VIII. Performance Primeiro** | Sem fetch adicional. Memoização padrão TanStack. Bundle client cresce em ~3-5 KB (gz) — só shadcn DropdownMenu se ainda não estiver bundle | ✅ |
| **IX. Design Tokens** | Cores via `bg-background`/`text-foreground`/`text-muted-foreground`; padding via classes Tailwind padrão. NUNCA hex literal | ✅ |
| **X. API REST** | N/A — sem endpoint novo | ✅ |
| **XI. PostgreSQL** | N/A — sem schema/migration/query | ✅ |
| **XII. Anti-Padrões Proibidos** | Sem `any`; sem `console.log`; sem `fetch` em `"use client"` (toda lógica em hook); sem `useState` de domínio em componentes (estado mora no hook); sem HTML cru (`<button>`, `<input>`) — apenas `<Button>`, etc; sem elementos visuais hardcoded; sem `try/catch + instanceof XxxError` (não há rota); `useEffect` para fetch proibido — feature é client-derived sobre dados já carregados | ✅ |
| **XIII. KPIs/Métricas** | N/A | ✅ |
| **XIV. PDF do Livro** | N/A | ✅ |
| **XV. Skills Obrigatórias** | Plan usa `/frontend-patterns`, `/shadcn` (pedido do usuário), `/docs` Context7 (já consultado para TanStack Table v8 docs). Implementação usará `/tdd`, `/code-review`, `/simplify`, `/e2e`, `/conventional-commits`, `/finish-task` | ✅ |
| **XVI. Verificação Final** | Fase final antes do PR: `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`, `bun run build`. Durante fases intermediárias, apenas testes da mudança atual | ✅ |

**Gate inicial**: PASS (com 1 nota em Complexity Tracking — ver seção dedicada).

**Re-check pós-Phase 1**: artefatos `research.md`, `data-model.md`, `contracts/*.md`, `quickstart.md` reforçam o plano sem introduzir novos princípios em conflito. **Re-Gate**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/024-chapter-grouping/
├── plan.md                              # Este arquivo
├── research.md                          # Phase 0 — decisões técnicas
├── data-model.md                        # Phase 1 — tipos e estruturas
├── quickstart.md                        # Phase 1 — guia de implementação
├── contracts/
│   ├── url-state.md                     # Contrato do search param ?groupBy
│   ├── ui-grouping-control.md           # Contrato do componente de controle
│   └── ui-group-row.md                  # Contrato da row-resumo do grupo
├── checklists/
│   └── requirements.md                  # Checklist de qualidade do spec
└── tasks.md                             # Phase 2 — gerado por /speckit-tasks
```

### Source Code (repository root) — escopo da feature

```text
src/
├── app/
│   └── (authenticated)/books/[id]/page.tsx     # consome ?groupBy via Server Component → Client
├── components/
│   ├── ui/                                     # shadcn (DropdownMenu se faltar)
│   │   └── dropdown-menu.tsx                   # garantir presença (bunx --bun shadcn@latest add)
│   └── features/
│       ├── books/
│       │   ├── book-detail-client.tsx          # passa book para chapters-table
│       │   └── ...                             # sem mudança
│       └── chapters/
│           ├── chapters-table.tsx              # ★ refatorado para TanStack Table + grouping
│           ├── chapter-grouping-control.tsx    # ★ NOVO — DropdownMenu multi-select
│           ├── chapter-group-row.tsx           # ★ NOVO — linha-resumo do grupo
│           ├── chapter-row.tsx                 # sem mudança (mantém modos view/edit)
│           ├── chapter-row-edit-mode.tsx       # sem mudança
│           ├── chapter-delete-dialog.tsx       # sem mudança
│           ├── chapter-status-select.tsx       # sem mudança
│           ├── chapter-paid-reversion-dialog.tsx # sem mudança
│           ├── chapters-bulk-delete-bar.tsx    # sem mudança
│           ├── chapters-bulk-delete-confirm.tsx # sem mudança
│           └── hooks/
│               ├── use-chapter-row.ts          # sem mudança
│               ├── use-chapter-row-edit.ts     # sem mudança
│               ├── use-delete-chapter.ts       # sem mudança
│               ├── use-paid-reversion.ts       # sem mudança
│               ├── use-chapters-grouping-state.ts # ★ NOVO — URL <-> grouping
│               └── use-chapters-table.ts       # ★ NOVO — wraps useReactTable
└── lib/
    ├── config/
    │   └── feature-flags.ts                    # ★ NOVO — SHOW_EARNINGS_IN_NARRATOR_GROUPS
    ├── domain/
    │   ├── chapter.ts                          # adicionar helper chapterStatusLabel se faltar
    │   └── chapter-aggregation.ts              # ★ NOVO — sumCentsRounded, countByStatus, formatStatusBreakdown
    ├── url/
    │   └── grouping-param.ts                   # ★ NOVO — parseGroupingParam, serializeGroupingParam
    └── utils.ts                                # + formatGroupedSeconds

__tests__/
├── unit/
│   ├── lib/
│   │   └── domain/
│   │       └── chapter-aggregation.spec.ts     # ★ NOVO
│   ├── lib/
│   │   └── url/
│   │       └── parse-grouping-param.spec.ts    # ★ NOVO
│   └── components/
│       └── features/
│           └── chapters/
│               └── hooks/
│                   └── use-chapters-grouping-state.spec.tsx # ★ NOVO
└── e2e/
    └── chapters-grouping.spec.ts               # ★ NOVO (cobre Stories 1-5)
```

**Structure Decision**: Adesão estrita ao Princípio VII (feature components em `src/components/features/<feature>/`, hooks co-localizados em `hooks/`). Nada em `src/app/_components/`. Lib utilities em `src/lib/` particionados por papel (`config`, `domain`, e o `utils.ts` shared).

## Complexity Tracking

| Violation / Extra Scope | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **M0 — Migração de `chapters-table.tsx` para TanStack Table v8** (refatoração antes de adicionar agrupamento) | A spec exige agrupamento "via TanStack Table" (premissa explícita do usuário). O componente atual renderiza linhas diretamente sem TanStack. Sem migrar, teríamos que implementar grouping/sort/expand handwritten (centenas de linhas) ou usar TanStack só como motor de agregação enquanto a renderização permanece manual — quebra simetria com `books-table`, `narrators-table`, `editors-table`, `studios-table` que já seguem o padrão. | **Implementar grouping manualmente sobre JS puro**: rejeitado — duplica lib já no bundle, foge do padrão de 4 outras tabelas, perde sort headers nativos, multi-nível ficaria custoso. **Usar TanStack só pra computar grupos sem migrar renderização**: rejeitado — hack contra a lib, mais código de cola, perde simetria. A migração é refatoração pura (commit separado), sem mudança de UX, com todos os E2E atuais como rede de segurança. |

Nenhuma outra violação. Todos os demais princípios aplicáveis aderem sem ressalvas.
