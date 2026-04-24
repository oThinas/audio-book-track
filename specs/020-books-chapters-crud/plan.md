# Implementation Plan: CRUD de Livros e Capítulos

**Branch**: `020-books-chapters-crud` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-books-chapters-crud/spec.md`

## Summary

Esta feature introduz o núcleo operacional do AudioBook Track: o CRUD completo de **Livros** e **Capítulos**. Enquanto as features anteriores (estúdios, narradores, editores) construíram o cadastro de entidades-suporte, esta é a primeira feature em que os artefatos centrais da produção (capítulo = unidade de trabalho, conforme Princípio I) ganham forma. Cobre: (i) listagem `/books` com barra de pesquisa, ordenação e status agregado; (ii) modal de criação de livro com criação inline de estúdio e propagação transacional de `price_per_hour → studio.default_hourly_rate`; (iii) tela de detalhes `/books/:id` com cabeçalho informativo, listagem de capítulos com edição inline e máquina de estados validada; (iv) edição de livro (aumentar capítulos, trocar estúdio, atualizar preço/hora quando não há capítulo `pago`); (v) exclusão em lote de capítulos (oculta affordances normais); (vi) popover "Ver PDF" que persiste `book.pdf_url` e abre em nova guia; (vii) constraints de exclusão via **soft-delete unificado** para estúdio, narrador e editor, com **desarquive automático por colisão de nome**; (viii) colunas derivadas "Livros" e "Capítulos" nas listagens existentes; (ix) refatoração do schema Drizzle em um arquivo por entidade.

Abordagem técnica: acrescentar as tabelas `book` e `chapter` e a coluna `deleted_at` às tabelas `studio`/`narrator`/`editor`, mantendo Clean Architecture (domain → repositories → services → factories → api). O status do livro (`book.status`) é um **cache materializado** recomputado pelo helper `recomputeBookStatus` a cada mutação de capítulo dentro da mesma transação. Todo fluxo que muta capítulos garante atomicidade via transação Drizzle. O frontend reutiliza o padrão shadcn/ui + composição já consolidado em `/studios`, `/editors`, `/narrators` — com adições específicas: novo modal de livro (`BookCreateDialog`), tela de detalhes (`app/(authenticated)/books/[id]/page.tsx`), edição inline de capítulo, modo de exclusão em lote, popover de PDF. Todas as novas telas seguem mobile-first e dark mode.

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Bun 1.2 (runtime + package manager + test runner)
**Primary Dependencies**: Next.js 16.2.1 (App Router + Turbopack), React 19.2.4, Drizzle ORM 0.45.2 + `drizzle-kit` 0.31.10, Zod 4.3.6, better-auth 1.5.6, React Hook Form 7.72.1 + `@hookform/resolvers` 5.2.2, `@tanstack/react-table` 8.21.3, shadcn/ui 4.1.2, Tailwind CSS 4.2, `sonner` 2.0.7 (toasts), `lucide-react` (ícones)
**Storage**: PostgreSQL (local Dockerized) via Drizzle ORM; migrations com `drizzle-kit generate` + `drizzle-kit migrate` (NUNCA `push`); `TEST_DATABASE_URL` separado para integration e E2E
**Testing**: Vitest para unit e integration (com fixtures `__tests__/integration/setup.ts` via `BEGIN/ROLLBACK`), Playwright para E2E (schema-per-worker em `audiobook_track_test`); factories em `__tests__/helpers/factories.ts`
**Target Platform**: Web (Next.js SSR/Server Components) — produto acessado via navegador desktop e mobile
**Project Type**: Web application (fullstack Next.js monorepo em `src/`)
**Performance Goals**: LCP < 1s (Princípio VIII); listagem `/books` com ≤ 500 livros em < 200ms de filtro/ordenação cliente (SC-005); transição de status de capítulo aplicada sem recarregar página em < 15s (SC-003); COUNT das colunas derivadas em `/studios`/`/narrators`/`/editors` adicionando < 100ms à leitura (SC-011)
**Constraints**: Pagamento (chapter `pago`) imutável exceto via reversão com dupla confirmação; `book.price_per_hour` bloqueado enquanto ≥ 1 capítulo `pago`; soft-delete unificado (nenhuma FK `ON DELETE SET NULL`); livro sempre tem ≥ 1 capítulo (invariante absoluta); preço monetário em `numeric(10,2)`; queries selecionam colunas explícitas (proibido `SELECT *`); toda FK com índice
**Scale/Scope**: Sistema de uso pessoal/pequeno time; ≤ 500 livros por produtor, ≤ 999 capítulos por livro, até dezenas de estúdios/narradores/editores

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-research gate (2026-04-23, pre-Phase 0)

| Princípio | Status | Observação |
|-----------|--------|------------|
| I. Capítulo como unidade de trabalho | ✅ PASS | Atribuições de narrador/editor, horas e status operam no capítulo. `book.status` é cache materializado — capítulo permanece fonte da verdade. |
| II. Precisão financeira | ⚠ DEVIATION (justificada) | FR-026 permite `pago → concluido` mediante dupla confirmação + flag `confirmReversion`. Não altera dados financeiros (horas/preço), apenas o status para corrigir "marcação errada de pago". Ver Complexity Tracking #1. |
| III. Integridade do ciclo de vida | ⚠ DEVIATION (justificada) | Constituição diz `pago` é terminal. Spec FR-025 adiciona `pago → concluido` explícito (único retrocesso permitido, com dupla confirmação). Ver Complexity Tracking #1. |
| IV. Simplicidade primeiro (YAGNI) | ✅ PASS | Nenhuma abstração especulativa. Todas as extensões de UI (modo de exclusão, reversão, desarquive) são requeridas por Stories P1/P2. |
| V. TDD | ✅ PASS (plano abaixo impõe) | `recomputeBookStatus`, máquina de estados e cálculo de ganho terão cobertura 100%. Cobertura geral ≥ 80% (SC-010). |
| VI. Clean Architecture | ✅ PASS | Novas entidades seguem o padrão existente: `domain/book.ts`, `domain/chapter.ts`, `domain/book-repository.ts`, `domain/chapter-repository.ts`, `repositories/drizzle/drizzle-book-repository.ts`, `services/book-service.ts`, `services/chapter-service.ts`, `factories/book.ts`, `factories/chapter.ts`, `api/v1/books/*`, `api/v1/chapters/*`. |
| VII. Frontend (composição, atomicidade, mobile first) | ✅ PASS | Novos componentes em `src/components/features/books/` e `src/components/features/chapters/`; NENHUM `_components/` dentro de `src/app/`; reuso intenso de primitivos shadcn/ui. Mobile first via Tailwind. |
| VIII. Performance | ✅ PASS | Server Components para páginas; `use client` só em modais/tabelas interativas. Sem peso desnecessário. COUNT em single query (FR-050/051). |
| IX. Design tokens | ✅ PASS | Sem valores visuais hardcoded. Usa tokens existentes + shadcn/ui. |
| X. Padrões REST | ✅ PASS | Endpoints plural kebab-case, status codes corretos, envelope `{ data }`/`{ error }`, Zod em toda entrada (FR-056). |
| XI. PostgreSQL | ✅ PASS | `numeric(10,2)` para preço, `numeric(5,2)` para horas, toda FK com índice, transações nas mutações multi-tabela, `drizzle-kit generate` + `migrate` (sem `push`). |
| XII. Anti-padrões proibidos | ✅ PASS | Sem `any`, sem `SELECT *`, sem `useEffect` para derivar estado, sem HTML cru, sem `_components/` em `src/app/`. |
| XIII. Métricas e KPIs | ⚠ DEVIATION (documentada) | KPI 4 "Média de duração por página" depende de `num_paginas`. Spec atual (FR-054/Q6) remove `num_paginas` do modelo. **Resolução adotada no plano** (ver Complexity Tracking #2): adicionar a coluna `num_paginas integer DEFAULT 0` a `chapter` **apenas no schema** (não exposta em UI desta feature), preservando a possibilidade de KPI 4 em feature futura sem conflitar com o escopo visual decidido na clarificação. |
| XIV. Visualização de PDF | ⚠ SCOPE-SPLIT (justificado) | Princípio XIV descreve viewer completo (lazy, paginação, zoom). Esta feature implementa **apenas a persistência** de `book.pdf_url` + link para nova guia (US9). O **viewer** permanece fora de escopo e será tratado em feature futura, sem bloquear esta entrega. Ver Complexity Tracking #3. |
| XV. Ferramentas e skills obrigatórias | ✅ PASS | `/speckit-specify` já executado; `/speckit-clarify` rodado com 11 pontos resolvidos; Pencil MCP será consultado para Node ID YeFYS antes de construir tela de detalhes; Context7 MCP consultado para cada lib antes de usar API. |
| XVI. Qualidade de código e verificação | ✅ PASS | Fase final única com `bun run lint` + `test:unit` + `test:integration` + `test:e2e` + `build` antes do PR. |

**Conclusão do gate**: 3 desvios documentados (II+III em conjunto, XIII, XIV), todos com justificativa explícita em Complexity Tracking. Nenhum desvio é adicional — todos derivam diretamente da spec + clarificações do produtor. Prosseguir para Phase 0.

### Post-design gate (2026-04-23, pós-Phase 1)

Re-executado após geração de `research.md`, `data-model.md`, `contracts/` e `quickstart.md`. Nenhum novo desvio introduzido. Decisões do design respeitam o soft-delete unificado, a invariante `book ≥ 1 capítulo`, a máquina de estados estendida com `pago → concluido` controlada e a refatoração de schema em arquivos por entidade. Status: ✅ PASS.

## Project Structure

### Documentation (this feature)

```text
specs/020-books-chapters-crud/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões técnicas consolidadas
├── data-model.md        # Phase 1 — modelo físico: book, chapter, deleted_at em studio/narrator/editor
├── quickstart.md        # Phase 1 — como rodar/validar a feature em DEV e em testes
├── contracts/           # Phase 1 — contratos de API (books, chapters, studios, narrators, editors)
│   ├── books.md
│   ├── chapters.md
│   ├── studios-delta.md
│   ├── narrators-delta.md
│   └── editors-delta.md
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec (preenchido em /speckit-clarify)
└── tasks.md             # Phase 2 — gerado por /speckit-tasks (NÃO por /speckit-plan)
```

### Source Code (repository root — Next.js App Router fullstack)

```text
src/
├── app/
│   ├── (authenticated)/
│   │   ├── books/
│   │   │   ├── page.tsx                         # Server Component: listagem + BooksClient
│   │   │   └── [id]/
│   │   │       └── page.tsx                     # Server Component: detalhe do livro + BookDetailClient
│   │   ├── studios/page.tsx                     # (existente) atualizado para coluna "Livros" + desarquive-on-collision + filtro deleted_at IS NULL
│   │   ├── narrators/page.tsx                   # (existente) atualizado com coluna "Capítulos" + desarquive-on-collision
│   │   └── editors/page.tsx                     # (existente) atualizado com coluna "Capítulos" + desarquive-on-collision
│   └── api/v1/
│       ├── books/
│       │   ├── route.ts                         # GET (lista) + POST (cria livro + capítulos + propaga rate)
│       │   └── [id]/
│       │       ├── route.ts                     # GET (single) + PATCH (edita + aumenta capítulos) + DELETE
│       │       └── chapters/
│       │           ├── route.ts                 # POST opcional (criar capítulo avulso via US8) se diferente de PATCH do livro
│       │           └── bulk-delete/route.ts     # POST bulk-delete
│       ├── chapters/
│       │   └── [id]/route.ts                    # PATCH (edita capítulo, inclui confirmReversion) + DELETE
│       ├── studios/ ...                         # (existente) atualizado: suporte a { reactivated: true } + filtro deleted_at
│       ├── narrators/ ...                       # (existente) idem
│       └── editors/ ...                         # (existente) idem
│
├── components/
│   ├── ui/                                      # shadcn primitivos — adicionar se faltar: Dialog, Popover, Checkbox, AlertDialog
│   ├── layout/page-container.tsx                # (existente)
│   └── features/
│       ├── books/
│       │   ├── books-table.tsx                  # listagem sem coluna de ações; row clickable
│       │   ├── books-client.tsx                 # wrapper com barra de pesquisa + ordenação + modal
│       │   ├── book-create-dialog.tsx           # modal de criação (inclui seletor inline de estúdio)
│       │   ├── book-edit-dialog.tsx             # modal de edição (título/estúdio/valor/hora/quantidade)
│       │   ├── book-header.tsx                  # cabeçalho da tela de detalhes
│       │   ├── book-pdf-popover.tsx             # popover "Ver PDF"
│       │   ├── studio-inline-creator.tsx        # subformulário dentro do book-create-dialog
│       │   └── books-detail-client.tsx          # orquestra cabeçalho + tabela + modo exclusão
│       └── chapters/
│           ├── chapters-table.tsx               # tabela com edição inline + checkboxes (select mode)
│           ├── chapter-row.tsx                  # linha com estados: view / edit / select
│           ├── chapter-status-select.tsx        # select limitado à transições válidas
│           ├── chapter-paid-reversion-dialog.tsx # modal de alerta "pago → concluído"
│           └── chapters-bulk-delete-bar.tsx     # barra superior com contador + confirm/cancel
│
├── lib/
│   ├── db/
│   │   ├── schema/                              # NOVO diretório (FR-052); refatora schema.ts em arquivos por entidade
│   │   │   ├── auth.ts                          # user, session, account, verification (movido)
│   │   │   ├── user-preference.ts               # (movido)
│   │   │   ├── studio.ts                        # + deleted_at
│   │   │   ├── narrator.ts                      # + deleted_at
│   │   │   ├── editor.ts                        # + deleted_at
│   │   │   ├── book.ts                          # NOVO
│   │   │   ├── chapter.ts                       # NOVO
│   │   │   └── index.ts                         # barrel re-exportando tudo
│   │   ├── index.ts                             # db client (imports de ./schema passam a apontar para ./schema/index)
│   │   └── migrate.ts                           # (existente)
│   ├── domain/
│   │   ├── book.ts                              # entidade POJO + business rules
│   │   ├── book-repository.ts                   # interface
│   │   ├── chapter.ts                           # entidade + ChapterStatus enum + isValidTransition()
│   │   ├── chapter-repository.ts                # interface
│   │   ├── book-status.ts                       # helper puro: computeBookStatus(chapters) → BookStatus
│   │   └── (existentes): studio.ts, narrator.ts, editor.ts — recebem ajuste leve se necessário (nenhuma quebra)
│   ├── repositories/drizzle/
│   │   ├── drizzle-book-repository.ts           # implementa BookRepository
│   │   ├── drizzle-chapter-repository.ts
│   │   └── (existentes com minor patches p/ filtrar deleted_at + reativação)
│   ├── services/
│   │   ├── book-service.ts                      # createBook (com createInlineStudio), updateBook, deleteBookCascade, increaseChapters, propagateRateFromBook
│   │   ├── chapter-service.ts                   # updateChapter (validates state machine), deleteChapter, bulkDeleteChapters, revertPaidChapter
│   │   ├── book-status-recompute.ts             # recomputeBookStatus(bookId, tx) — helper central invocado pelos services
│   │   ├── studio-service.ts                    # (existente) atualizado: softDeleteStudio + findActiveByName com desarquive
│   │   ├── narrator-service.ts                  # idem
│   │   └── editor-service.ts                    # idem
│   ├── factories/
│   │   ├── book.ts
│   │   ├── chapter.ts
│   │   └── (existentes atualizados se necessário)
│   ├── schemas/                                 # Zod schemas de validação de API input
│   │   ├── book.ts
│   │   └── chapter.ts
│   └── api/responses.ts                         # (existente) reusado
│
└── hooks/                                       # custom hooks para estado interativo (modo exclusão, seleção, debounced search)

__tests__/
├── unit/
│   ├── domain/
│   │   ├── book-status.spec.ts                  # computeBookStatus (regras de precedência)
│   │   └── chapter-state-machine.spec.ts        # isValidTransition + exigência de narrador/editor/horas
│   ├── services/
│   │   ├── book-service.spec.ts                 # com repos fakes
│   │   ├── chapter-service.spec.ts
│   │   └── book-status-recompute.spec.ts
│   └── schemas/
│       ├── book-schema.spec.ts
│       └── chapter-schema.spec.ts
├── repositories/
│   ├── in-memory-book-repository.ts             # fake para unit tests de service
│   └── in-memory-chapter-repository.ts
├── integration/
│   ├── book-crud.spec.ts                        # criar, editar, deletar (atomicidade)
│   ├── chapter-crud.spec.ts                     # state machine com DB real + recompute book.status
│   ├── soft-delete-unification.spec.ts          # estúdio/narrador/editor soft-delete + desarquive-by-name
│   └── book-status-recompute.spec.ts            # cenários exatos US5.13 e US5.14 (com DB real + transação)
├── e2e/
│   ├── books-create-flow.spec.ts                # criar livro via modal, estúdio inline, propagação
│   ├── books-detail.spec.ts                     # abrir detalhes, navegar, voltar
│   ├── chapters-edit-inline.spec.ts             # editar capítulo, transições válidas, modal de reversão pago → concluído
│   ├── chapters-bulk-delete.spec.ts             # modo exclusão, all-with-paid preserva, last chapter delete redireciona
│   ├── book-edit-increase.spec.ts               # aumentar capítulos em +N, bloqueio de redução, bloqueio de price_per_hour com pago
│   ├── book-pdf.spec.ts                         # popover salvar URL, abrir em nova guia, validação
│   └── soft-delete-unarchive.spec.ts            # excluir estúdio, recriar com mesmo nome → desarquive
└── helpers/
    └── factories.ts                             # adicionar createTestBook, createTestChapter
```

**Structure Decision**: Single project (Next.js fullstack monorepo em `src/`). A escolha é ditada pela constituição: Princípios VI (camadas backend em `src/lib/`), VII (componentes em `src/components/features/<feature>/`) e X/XI (rotas de API em `src/app/api/v1/`). Não há separação backend/frontend — Next.js App Router serve Server Components, Route Handlers e Client Components no mesmo projeto. A **novidade estrutural** é a divisão do schema Drizzle em `src/lib/db/schema/<entidade>.ts` (FR-052) que atende o pedido explícito do produtor e deixa os seis arquivos (`auth`, `user-preference`, `studio`, `narrator`, `editor`, `book`, `chapter`) pequenos e focados.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **#1 — Reversão `pago → concluido` com dupla confirmação** (Princípios II + III) | O produtor precisa corrigir erros operacionais (ex: marcou capítulo como `pago` por engano). Sem essa reversão, a única saída seria UPDATE manual no banco, o que é mais perigoso (sem trilha de UI/auditoria) e contradiz o princípio de manter operações no produto. A reversão preserva dados financeiros (horas, preço) — muda apenas o status. | "Bloquear 100% após `pago`" foi descartado porque o caso de "erro de marcação" é real e recorrente; forçar escape via banco cria risco operacional maior. "Permitir reversão livre" foi descartado porque remove o guard-rail — a dupla confirmação (`confirmReversion: true` no backend + modal em UI) mantém a reversão como ação consciente, explícita e auditável. |
| **#2 — Manter `chapter.num_paginas` no schema mesmo removendo da UI** (Princípio XIII) | Princípio XIII define `num_paginas` como campo obrigatório para o KPI 4 ("Média de duração por página"). A clarificação Q6 da spec removeu o campo da UI desta feature a pedido do produtor. Para preservar a possibilidade de KPI 4 em feature futura sem migração destrutiva, a coluna é mantida no schema com `DEFAULT 0` — invisível nesta feature, mas existente. | "Remover a coluna por completo" foi descartado porque criaria migração destrutiva para reintroduzir o campo depois (e perderia qualquer dado populado por script). "Expor na UI ainda que o produtor pediu para esconder" foi descartado porque contradiz a clarificação explícita Q6. A solução "schema sim, UI não" é mínima e não bloqueante. |
| **#3 — PDF apenas como persistência de URL + link** (Princípio XIV) | Princípio XIV descreve um PDF viewer completo (lazy, paginação, zoom). A spec US9/FR-042–045 entrega apenas a primeira metade (persistir `book.pdf_url` e abrir em nova guia). Construir o viewer completo nesta feature explode o escopo e adiciona dependências pesadas ao bundle antes de haver necessidade validada. | "Entregar o viewer completo agora" foi descartado por custo (dependência de PDF.js, UX de paginação/zoom, testes de accessibility) contra benefício atual (link em nova guia resolve 80% do uso). O viewer completo é feature de seguimento — esta entrega fornece a **URL estável** que ele consumirá. |

## Artefatos gerados (Phase 0 + Phase 1)

- ✅ `research.md` — decisões técnicas consolidadas para os 11 pontos da sessão de clarificação e os 3 desvios de Complexity Tracking.
- ✅ `data-model.md` — esquema físico PostgreSQL para `book`, `chapter`, ajustes em `studio/narrator/editor`; índices, constraints, enum types.
- ✅ `contracts/books.md`, `contracts/chapters.md`, `contracts/studios-delta.md`, `contracts/narrators-delta.md`, `contracts/editors-delta.md` — contratos REST (request, response, erros).
- ✅ `quickstart.md` — setup local, migrations, como rodar testes unit/integration/e2e da feature.
