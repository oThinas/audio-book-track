# Implementation Plan: CRUD de Narradores

**Branch**: `015-narrators-crud` | **Date**: 2026-04-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-narrators-crud/spec.md`

## Summary

CRUD completo de Narradores com tabela editável inline. A página `/narrators` exibe uma tabela sortable (TanStack Table) envolvida em ScrollArea, com criação, edição e exclusão inline. Criação e edição usam linhas editáveis com React Hook Form + Zod; exclusão dispara um AlertDialog de confirmação. Backend segue Clean Architecture (domain → repository → service → factory → route handler) com Drizzle ORM sobre PostgreSQL. A constraint de "não excluir narrador vinculado a capítulos em andamento" fica pendente até o CRUD de Capítulos existir (nota em `futuras-features.md`). Cor destrutiva recebe override OKLCH quando a cor primária do usuário for vermelha, garantindo contraste visual.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (Bun runtime 1.x)
**Primary Dependencies**: Next.js 16.2.1 (App Router), React 19.2.4, Drizzle ORM 0.45.2, Zod 4.3.6, better-auth 1.5.6, React Hook Form 7.72.0 + `@hookform/resolvers` 5.2.2, shadcn/ui 4.1.2, `@tanstack/react-table` (nova dependência), Tailwind CSS 4.2, lucide-react 1.7.0, sonner 2.0.7
**Storage**: PostgreSQL via Drizzle ORM (nova tabela `narrator`)
**Testing**: Vitest 4.1.2 (unit + integration via transaction rollback), Playwright 1.59 (E2E), Testing Library 16.3, `@axe-core/playwright` para acessibilidade
**Target Platform**: Web (Next.js SSR + React Server Components); produção em Node 20+ via Vercel ou similar
**Project Type**: Web application (Next.js full-stack monorepo em `src/`)
**Performance Goals**: LCP < 1s; operação CRUD < 30s ponta-a-ponta (SC-001); tabela render < 100ms para até 100 registros
**Constraints**: Sem paginação (volume pequeno, dezenas de registros); ScrollArea permanente para acomodar font-size variável; single PostgreSQL connection pool existente
**Scale/Scope**: Dezenas de narradores; 1 página nova (`/narrators`), 1 tabela DB, 4 endpoints REST (GET list, POST create, PATCH update, DELETE), ~5 componentes novos, 1 componente de layout reutilizável

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Princípio I — Capítulo como Unidade de Trabalho**: ✅ Narrador é entidade de suporte; a unidade de trabalho (capítulo) é referenciada apenas na regra de exclusão (FR-010). Sem violação.

**Princípio II — Precisão Financeira**: ✅ Não há cálculo financeiro nesta feature. Narrador não armazena preço.

**Princípio III — Ciclo de Vida do Capítulo**: ✅ Narrador não tem ciclo de vida próprio; o status do livro associado ao capítulo determina a exclusão (implementação diferida).

**Princípio IV — Simplicidade (YAGNI)**: ✅ Sem paginação, sem filtros complexos, sem soft delete (hard delete com constraint). Constraint de capítulos fica diferida para quando a tabela existir.

**Princípio V — TDD**: ✅ Plano cobre unit (schemas Zod, service com fake repo), integration (Drizzle repo com transaction rollback), E2E (fluxo completo com Playwright). Testes primeiro.

**Princípio VI — Arquitetura Limpa Backend**: ✅ Camadas domain → repository → service → factory → route handler seguidas. Interface `NarratorRepository` em `lib/domain/`, implementação `DrizzleNarratorRepository` em `lib/repositories/drizzle/`, `NarratorService` em `lib/services/`, factory `createNarratorService()` em `lib/factories/`. Controllers finos usam helpers de `lib/api/responses.ts`.

**Princípio VII — Frontend: Composição e Mobile First**: ✅ Componentes compostos via shadcn/ui (Table, ScrollArea, AlertDialog, Button, Input, Label). Página usa `<PageContainer>`, `<PageHeader>`, `<PageTitle>`, `<PageDescription>`. Dark mode obrigatório via tokens. Mobile first (tabela com scroll horizontal se necessário em telas pequenas). Server Component para fetch inicial + Client Component para interatividade da tabela.

**Princípio VIII — Performance**: ✅ Server Component busca dados iniciais; Client Component apenas para tabela editável. Sem bibliotecas pesadas adicionais além de `@tanstack/react-table` (já necessária). Cache `no-store` nas APIs (dados mutáveis).

**Princípio IX — Design Tokens**: ✅ Todas as cores via tokens (`--primary`, `--destructive`, `--foreground`). Override do `--destructive` quando `data-primary-color="red"` é aplicado em `globals.css`, não hardcoded.

**Princípio X — Padrões REST**: ✅ URLs plural kebab-case (`/api/v1/narrators`, `/api/v1/narrators/:id`). Status: `200` GET/PATCH, `201` POST com `Location`, `204` DELETE, `422` validação, `409` duplicata, `401` sem auth. Envelope `{ data }` / `{ error: { code, message, details } }`. Zod em todas rotas.

**Princípio XI — PostgreSQL**: ✅ `text` para strings, `timestamptz` para datas. Constraint `unique` no email. Índice `idx_narrator_email` (suporta busca futura). Migration reversível via `drizzle-kit generate` + `drizzle-kit migrate`. `SELECT *` proibido — queries selecionam colunas explícitas.

**Princípio XII — Anti-padrões**: ✅ Sem `any`, sem segredos hardcoded, sem `console.log`, sem `useEffect` para derivar estado, sem HTML cru, sem cores hardcoded, sem `use client` desnecessário, sem componentes > 200 linhas (planejado via composição).

**Princípio XIII — Métricas**: ✅ N/A (feature não toca em dashboard/KPIs).

**Princípio XIV — PDF**: ✅ N/A (narrador não tem PDF associado).

**Princípio XV — Ferramentas**: ✅ Plano usa `/speckit.plan`; implementação usará `/tdd`, `/shadcn` (para adicionar table, scroll-area, alert-dialog, form, dialog), `/code-review`, `/e2e`, `/conventional-commits`, `/finish-task`. Context7 MCP consultado (shadcn/ui, React Hook Form, TanStack Table).

**Princípio XVI — Qualidade de Código**: ✅ Plano inclui gates: `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`, `bun run build` — todos DEVEM passar sem erros/warnings.

**Conclusão**: Sem violações. Sem entradas em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/015-narrators-crud/
├── plan.md                      # Este arquivo
├── research.md                  # Phase 0 output
├── data-model.md                # Phase 1 output
├── quickstart.md                # Phase 1 output
├── contracts/                   # Phase 1 output
│   └── narrators-api.md
├── checklists/
│   └── requirements.md          # Criado no /speckit.specify
└── tasks.md                     # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (authenticated)/
│   │   └── narrators/
│   │       ├── page.tsx                      # Server Component — busca narradores e renderiza client wrapper
│   │       └── _components/
│   │           ├── narrators-client.tsx      # Client wrapper — orquestra tabela + modals + toasts
│   │           ├── narrators-table.tsx       # TanStack Table + ScrollArea
│   │           ├── narrator-row.tsx          # Row com toggle view/edit mode (RHF)
│   │           ├── narrator-new-row.tsx      # Linha de criação (RHF)
│   │           └── delete-narrator-dialog.tsx # AlertDialog de confirmação
│   └── api/
│       └── v1/
│           └── narrators/
│               ├── route.ts                  # GET (list), POST (create)
│               └── [id]/
│                   └── route.ts              # PATCH (update), DELETE (delete)
├── lib/
│   ├── domain/
│   │   ├── narrator.ts                       # Entity type + Zod schemas (create, update)
│   │   └── narrator-repository.ts            # Interface
│   ├── repositories/
│   │   └── drizzle/
│   │       └── drizzle-narrator-repository.ts
│   ├── services/
│   │   └── narrator-service.ts
│   ├── factories/
│   │   └── narrator.ts                       # createNarratorService()
│   ├── errors/
│   │   └── narrator-errors.ts                # NarratorEmailAlreadyInUseError, NarratorNotFoundError
│   └── db/
│       └── schema.ts                         # + export const narrator = pgTable(...)
├── components/
│   └── ui/                                   # + novos: table, scroll-area, alert-dialog, form, dialog
└── app/
    └── globals.css                           # + override --destructive quando data-primary-color="red"

__tests__/
├── unit/
│   ├── domain/
│   │   └── narrator-schema.test.ts           # Zod schemas (create/update)
│   ├── services/
│   │   └── narrator-service.test.ts          # Service com in-memory fake repo
│   └── api/
│       └── narrators.test.ts                 # Route handlers com deps mockadas
├── integration/
│   └── repositories/
│       └── drizzle-narrator-repository.test.ts   # CRUD real no DB via transaction rollback
├── repositories/
│   └── in-memory-narrator-repository.ts      # Fake para testes unit
└── e2e/
    └── narrators.spec.ts                     # Fluxo completo: listar, criar, editar, excluir
```

**Structure Decision**: Estrutura segue o padrão Next.js App Router já estabelecido no projeto. Frontend e backend convivem em `src/` (full-stack monorepo). Rotas API versionadas (`/api/v1/...`). Componentes da página isolados em `_components/` (prefixo `_` evita Next.js roteamento). Testes espelham a estrutura do código, separados por categoria conforme constituição (Princípio V). Interface de repository em arquivo separado, sem prefixo `I`. Implementação Drizzle prefixada. Factory por domínio em `lib/factories/`.

## Complexity Tracking

> Constitution Check passou sem violações. Seção vazia.
