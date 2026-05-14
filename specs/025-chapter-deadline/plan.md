# Implementation Plan: Data Limite por Capítulo

**Branch**: `025-chapter-deadline` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/025-chapter-deadline/spec.md`

## Summary

Adicionar prazo opcional (`deadline`, tipo `date`) por capítulo, com:

- Coluna fixa "Prazo" na tabela de `/books/:id` exibindo `DD/MM/YYYY` (pt-BR) + tooltip relativo ("em N dias" / "atrasado há N dias"); destaque vermelho + ícone para atrasados (status ∈ {pending, editing, reviewing, retake} AND deadline < hoje em `America/Sao_Paulo`).
- Edição via shadcn `Calendar` em `Popover` dentro do modo edição já existente da linha. Campo travado quando capítulo em `paid` (estende `PAID_LOCKED_FIELDS`).
- Filtro único toggle **"Foco da semana"** em `/books/:id`, com estado em URL (`?focus=week`): mostra `(atrasados) ∪ (deadline ∈ [seg, dom] da semana civil corrente)` restrito a status ativos (pending/editing/reviewing/retake). Capítulos sem prazo, `completed` e `paid` ficam ocultos sob o filtro.
- Badge "Foco da semana · N" como **célula da nova coluna "Foco"** na tabela `/books` (posicionada entre "Capítulos" e "Status"), exibida quando N > 0; calculada server-side via `LEFT JOIN + GROUP BY` em single query (estende `listSummaries()` do `BookRepository`).
- Migration nullable sem backfill. Sem auditoria, sem bulk-set, sem dashboard, sem notificações.

Stack: Next.js 16 App Router + Drizzle ORM (PostgreSQL `date` type) + Zod + React Hook Form + shadcn/ui + date-fns para cálculos de semana civil/relativos com locale pt-BR e timezone fixo `America/Sao_Paulo`. Catálogo de erros centralizado (feature 023) recebe novos códigos.

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Bun 1.2 (runtime + package manager + test runner).
**Primary Dependencies**: Next.js 16.2.1 (App Router + Turbopack), React 19.2.4, Drizzle ORM 0.45.2, `drizzle-kit` 0.31.10, Zod 4.3.6, better-auth 1.5.6, React Hook Form 7.72.1 + `@hookform/resolvers` 5.2.2, `@tanstack/react-table` 8.21.3, shadcn/ui 4.1.2, Tailwind CSS 4.2, `sonner` 2.0.7, `lucide-react`. **Novas dependências**: `date-fns` 4.x + `date-fns-tz` 3.x (cálculo de semana civil em fuso fixo) e `react-day-picker` 9.x (transitividade do `shadcn` Calendar).
**Storage**: PostgreSQL 16+, coluna nova `chapter.deadline` (`date` nullable). Migration via `drizzle-kit generate` + `migrate`.
**Testing**: Vitest 4 (unit + integration via `BEGIN/ROLLBACK` no banco `audiobook_track_test`) + Playwright (E2E com schema-per-worker).
**Target Platform**: Web app (Next.js server + browser; Vercel-style deployment).
**Project Type**: Web application — backend (rotas /api/v1/**) + frontend (App Router + RSC) em monorepo único `src/`.
**Performance Goals**: Listagem `/books` com badge "Foco da semana" < 200 ms p95 server-side para 100 livros × 50 capítulos (SC-008). Render da tabela de `/books/:id` < 100 ms após data carregada.
**Constraints**: Timezone fixo de produto `America/Sao_Paulo` (não usar `process.env.TZ` ou locale do servidor). Semana civil = segunda a domingo. Validação `deadline` ≤ hoje + 10 anos. Sem N+1 nas queries agregadas.
**Scale/Scope**: Produção atual ~ dezenas de livros, centenas de capítulos. Spec dimensionada para ordens de magnitude acima (centenas de livros, milhares de capítulos) sem reestruturação.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Avaliado contra os 16 princípios da [constitution.md](../../.specify/memory/constitution.md):

| # | Princípio | Aderência | Notas |
|---|---|---|---|
| I | Capítulo como unidade de trabalho | ✅ | `deadline` mora no capítulo. Sem campo no livro. |
| II | Precisão financeira | ✅ | `deadline` é **operacional**, não entra no cálculo `round(edited_seconds × price/3600)`. Por decisão de produto (Q5), entra em `PAID_LOCKED_FIELDS` por coerência com a regra "paid é ponto de imutabilidade". Documentado nas Assumptions da spec. |
| III | Integridade do ciclo de vida do capítulo | ✅ | Nenhuma transição de status muda. Status são consumidos apenas como leitura no filtro/destaque. |
| IV | Simplicidade (YAGNI) | ✅ | Removidos do escopo: bulk-set, dashboard, auditoria, notificações, filtro por intervalo, override de prazo no livro, herança de prazo. |
| V | TDD obrigatório | ✅ | Plano de testes detalhado abaixo cobrindo unit + integration + E2E, com fixtures dedicadas. Cobertura ≥ 80%. |
| VI | Arquitetura limpa no backend | ✅ | Mudanças por camada respeitadas: schema → domain → ports → adapters → service → factory → route. Sem SQL fora de repositórios. |
| VII | Frontend: composição, atomicidade, mobile-first | ✅ | UI primitivo: `Calendar` em `Popover` via shadcn (a adicionar). Lógica em hook (`use-chapters-deadline-edit`, `use-focus-week-filter`); componentes só renderizam. Sem `useState` de domínio em client component. |
| VIII | Performance | ✅ | Badge calculado em single query. Filtro client-side em lista já carregada (sem refetch). |
| IX | Design tokens | ✅ | Cor de risco via `text-destructive`/equivalente; sem cores hardcoded. Dark mode coberto por tokens. |
| X | Padrões de API REST | ✅ | Sem novos endpoints — extensões dos existentes. Erros padronizados via catálogo (feature 023). |
| XI | PostgreSQL e banco | ✅ | Coluna `date` nullable + índice parcial `WHERE deadline IS NOT NULL` (para filtros de semana/atrasados). Migration via `generate` + `migrate`. |
| XII | Anti-padrões proibidos | ✅ | Nenhum: sem `any`, sem `console.log`, sem mutação, sem `useEffect` para derivar estado, sem `fetch` em client component, sem `_components/` dentro de `app/`. |
| XIII | Métricas e KPIs do dashboard | ✅ | Dashboard fora de escopo (Q24). Sem violação. |
| XIV | Visualização de PDF do livro | ✅ | Não tocado. |
| XV | Ferramentas e skills obrigatórias | ✅ | Context7 MCP consultado para `react-day-picker`/`date-fns-tz`/`drizzle date type` antes de codar. `design.pen` consultado para tratamento visual do prazo na tabela. |
| XVI | Qualidade e verificação | ✅ | Fase final = `bun run lint && test:unit && test:integration && test:e2e && build`. |

**Resultado do gate**: PASS sem ressalvas. Item II tem nota explicativa pública na spec (Assumptions). Nenhuma violação justificada na seção Complexity Tracking — não foi preenchida.

## Project Structure

### Documentation (this feature)

```text
specs/025-chapter-deadline/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões técnicas e libs
├── data-model.md        # Phase 1 — schema, domínio, índices
├── quickstart.md        # Phase 1 — walkthrough de uso e teste
├── contracts/
│   ├── api-chapter-update.md       # PATCH /api/v1/chapters/:id (extensão)
│   ├── api-books-list.md           # GET /api/v1/books (extensão: focusThisWeekCount)
│   ├── ui-deadline-cell.md         # Coluna "Prazo" na tabela
│   ├── ui-deadline-editor.md       # Calendar em Popover no modo edição
│   ├── ui-focus-week-filter.md     # Toggle + comportamento + URL state
│   └── ui-focus-week-badge.md      # Coluna "Foco" + badge na tabela /books
├── checklists/
│   └── requirements.md  # Já criado em /speckit-specify
└── tasks.md             # Phase 2 (gerado por /speckit-tasks)
```

### Source Code (repository root)

Mudanças incrementais no projeto existente — sem reorganização estrutural.

```text
src/
├── app/
│   ├── (authenticated)/
│   │   ├── books/                          # Lista — atualizar card pra exibir badge
│   │   │   ├── page.tsx
│   │   │   └── [id]/                       # Detalhe — coluna, filtro, edição
│   │   │       └── page.tsx
│   │   └── ...
│   └── api/v1/
│       ├── books/route.ts                  # Estende GET (campo derivado focusThisWeekCount)
│       └── chapters/[id]/route.ts          # Estende PATCH (campo deadline + projeção)
├── lib/
│   ├── api/error-codes/chapter.ts          # +CHAPTER_DEADLINE_INVALID, +DEADLINE_TOO_FAR
│   ├── db/schema/chapter.ts                # +coluna deadline + índice parcial
│   ├── domain/
│   │   ├── chapter.ts                      # +deadline no tipo + PAID_LOCKED_FIELDS estendido
│   │   ├── chapter-deadline.ts             # NOVO: helpers puros (isOverdue, weekRange, classify)
│   │   └── timezone.ts                     # NOVO ou estendido: AMERICA_SP_TZ const + helpers (today, weekRange)
│   ├── repositories/
│   │   ├── chapter-repository.ts           # +deadline em Insert/Update inputs
│   │   ├── book-repository.ts              # +focusThisWeekCount em BookSummary
│   │   └── drizzle/
│   │       ├── drizzle-chapter-repository.ts
│   │       └── drizzle-book-repository.ts  # listSummaries: +LEFT JOIN agregado para focus count
│   ├── schemas/chapter.ts                  # +deadline no updateChapterSchema (Zod)
│   ├── services/chapter-service.ts         # +deadline em UpdateChapterServiceInput + PAID_LOCKED_FIELDS
│   ├── url/focus-param.ts                  # NOVO: parse/serialize ?focus=week
│   └── utils/format-date.ts                # NOVO: formatDeadline + formatRelativeDeadline (pt-BR)
├── components/
│   ├── ui/calendar.tsx                     # NOVO via `bunx --bun shadcn@latest add calendar`
│   └── features/
│       ├── books/
│       │   ├── book-focus-week-badge.tsx   # NOVO: badge "Foco da semana · N" (consumida na célula)
│       │   └── books-table.tsx             # +nova coluna "Foco" entre "Capítulos" e "Status"
│       └── chapters/
│           ├── chapter-deadline-cell.tsx                # NOVO: coluna pintada/tooltip
│           ├── chapter-row-edit-mode.tsx                # +campo deadline (DatePicker)
│           ├── chapter-deadline-picker.tsx              # NOVO: <Popover><Calendar/></Popover> com "Limpar"
│           ├── chapter-focus-week-toggle.tsx            # NOVO: toggle visual + label
│           ├── chapters-table.tsx                       # +coluna; aplica filtro
│           └── hooks/
│               ├── use-chapters-deadline-edit.ts       # NOVO: estado/mutação do prazo dentro do row edit
│               └── use-focus-week-filter.ts            # NOVO: lê URL ?focus, deriva lista filtrada

__tests__/
├── unit/
│   ├── lib/domain/chapter-deadline.spec.ts
│   ├── lib/domain/timezone.spec.ts
│   ├── lib/url/focus-param.spec.ts
│   ├── lib/utils/format-date.spec.ts
│   └── components/features/chapters/hooks/use-focus-week-filter.spec.tsx
├── integration/
│   ├── repositories/drizzle-chapter-deadline.spec.ts        # CRUD do campo
│   ├── repositories/drizzle-book-focus-count.spec.ts        # agregação correta
│   └── services/chapter-service-deadline.spec.ts            # paid lock + validação
└── e2e/
    └── chapter-deadline.spec.ts                              # smoke: definir prazo, ver atrasado, filtrar, ver badge

drizzle/migrations/
└── 0007_chapter_deadline.sql                                 # +coluna +índice parcial (gerado por drizzle-kit)
```

**Structure Decision**: Mantida a estrutura do projeto — não há justificativa para introduzir subprojeto, monorepo ou serviço separado. A feature é uma extensão pontual do domínio existente (`chapter`) e seu adapter de UI já consolidado.

## Complexity Tracking

> Não há violações da constituição. Seção vazia intencionalmente.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| — | — | — |
