---
description: "Task list for feature 020-books-chapters-crud"
---

# Tasks: CRUD de Livros e Capítulos

**Input**: Design documents from `/specs/020-books-chapters-crud/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: TDD é obrigatório por Princípio V da constituição. Todas as fases incluem tarefas de teste (unit/integration/e2e) escritas **antes** da implementação correspondente.

**Organization**: Tarefas agrupadas por user story (da spec). Dentro de cada user story: testes primeiro → implementação. Foundational traz o plumbing compartilhado (schema, soft-delete plumbing, helpers puros) sem o qual nenhuma story pode começar.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivo diferente, sem dependência em tarefas incompletas).
- **[Story]**: Marca a user story (US1..US12); Setup e Foundational não têm.
- Sempre incluir o caminho exato dos arquivos afetados.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar o workspace — dependências e primitivos shadcn/ui que faltam.

- [X] T001 Auditar dependências em [package.json](../../package.json) e garantir que os primitivos shadcn/ui necessários para a feature estão instalados (`Dialog`, `AlertDialog`, `Popover`, `Checkbox`, `Command`, `Tooltip`). Se algum faltar, adicionar via `bunx --bun shadcn@latest add <component>`.

> ℹ️ As antigas T002 (factories `createTestBook`/`createTestChapter`) e T003 (in-memory repos de book/chapter) foram realocadas para dentro da Phase 2: T002 agora fica após T013 (schema + migrations aplicadas), e T003 após T019 (interfaces de repositório definidas). Isso alinha cada uma com a sua dependência real.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, domínio, helpers puros e plumbing de soft-delete. Nenhuma user story pode começar antes disso concluído.

**⚠️ CRITICAL**: Todas as stories dependem desta fase.

### Schema — refatoração arquivo-por-entidade (FR-052)

- [X] T004 Criar diretório [src/lib/db/schema/](../../src/lib/db/schema/) e mover o conteúdo de [src/lib/db/schema.ts](../../src/lib/db/schema.ts) para `src/lib/db/schema/auth.ts` (user, session, account, verification) e `src/lib/db/schema/user-preference.ts` (userPreference). Criar [src/lib/db/schema/index.ts](../../src/lib/db/schema/index.ts) como barrel (`export * from "./auth"` etc.). Manter as importações em [src/lib/db/index.ts](../../src/lib/db/index.ts) apontando para `./schema` (resolvido transparentemente para o novo `index.ts`).
- [X] T005 Mover a definição de `studio` para [src/lib/db/schema/studio.ts](../../src/lib/db/schema/studio.ts), adicionando a coluna `deletedAt: timestamp("deleted_at", { withTimezone: true })` (nullable). Substituir o índice único `studio_name_unique` por `studio_name_unique_active` (case-insensitive via `lower()`, parcial `WHERE deleted_at IS NULL`). Adicionar índice de apoio `studio_deleted_at_idx` parcial em `deleted_at IS NOT NULL`.
- [X] T006 [P] Mover `narrator` para [src/lib/db/schema/narrator.ts](../../src/lib/db/schema/narrator.ts) com as mesmas mudanças de T005 (coluna `deleted_at` + índice único parcial case-insensitive + índice de apoio).
- [X] T007 [P] Mover `editor` para [src/lib/db/schema/editor.ts](../../src/lib/db/schema/editor.ts) com as mesmas mudanças (preservar `editor_email_unique` como está).
- [X] T008 Criar [src/lib/db/schema/book.ts](../../src/lib/db/schema/book.ts) conforme [data-model.md §2](./data-model.md) (colunas + índices + checks). Garantir `references(() => studio.id, { onDelete: "restrict" })`.
- [X] T009 Criar [src/lib/db/schema/chapter.ts](../../src/lib/db/schema/chapter.ts) conforme [data-model.md §3](./data-model.md). Referências `book_id` (`cascade`), `narrator_id`/`editor_id` (`restrict`).
- [X] T010 Atualizar [src/lib/db/schema/index.ts](../../src/lib/db/schema/index.ts) exportando todas as entidades e acrescentar definições `relations()` em arquivo novo [src/lib/db/schema/relations.ts](../../src/lib/db/schema/relations.ts) conforme [data-model.md §7](./data-model.md) (`bookRelations`, `chapterRelations`).
- [X] T011 Remover [src/lib/db/schema.ts](../../src/lib/db/schema.ts) original (arquivo único legado) após garantir que `src/lib/db/index.ts` e demais consumidores resolvem para `./schema/index.ts`. Rodar `bun run lint` localmente só neste arquivo para confirmar resolução de imports (não é o gate final).
- [X] T012 Gerar migration com `bun run db:generate` (drizzle-kit generate) e revisar o SQL produzido em [src/lib/db/migrations/](../../src/lib/db/migrations/). Verificar: (a) `ALTER TABLE` aditivo para `deleted_at` em studio/narrator/editor; (b) DROP + CREATE do índice único substituído pelo case-insensitive parcial; (c) `CREATE TABLE book` e `CREATE TABLE chapter` com todos os constraints da `data-model.md`.
- [X] T013 Aplicar a migration em DEV e TEST: `bun run db:migrate` e `NODE_ENV=test bun run db:migrate`. Confirmar via `psql` que as tabelas e índices existem.
- [X] T002 [P] Adicionar factories de teste `createTestBook` e `createTestChapter` ao [__tests__/helpers/factories.ts](../../__tests__/helpers/factories.ts) seguindo o padrão dos testes existentes (aceitam `overrides` parciais; usam UUIDs; não tocam `seed-test.ts`). _(Realocada de Phase 1 — depende do schema `book`/`chapter` criado em T008/T009 e exportado pelo barrel em T010.)_

### Domínio — tipos, entidades, interfaces

- [X] T014 [P] Criar [src/lib/domain/book.ts](../../src/lib/domain/book.ts) com o tipo `Book` (POJO — `pricePerHourCents: number`), o enum compartilhado `BookStatus` (`"pending" | "editing" | "reviewing" | "retake" | "completed" | "paid"`) e helpers `formatCentsBRL(cents: number)` (formata centavos como `R$ X,XX`) e `formatSecondsAsHours(seconds: number)` (formata segundos como horas decimais para UI). Nenhum import de framework.
- [X] T014a [P] Criar [src/lib/domain/earnings.ts](../../src/lib/domain/earnings.ts) exportando `computeEarningsCents(editedSeconds: number, pricePerHourCents: number): number` — retorna `Math.round((editedSeconds * pricePerHourCents) / 3600)`. Função pura, 100% de cobertura exigida (Princípio II).
- [X] T015 [P] Criar [src/lib/domain/chapter.ts](../../src/lib/domain/chapter.ts) com o tipo `Chapter` (POJO — `editedSeconds: number`), re-exportando `ChapterStatus = BookStatus` (mesmos valores) e valor `PAID_LOCKED_FIELDS = ["narratorId", "editorId", "editedSeconds"] as const`.
- [X] T016 [P] Criar [src/lib/domain/book-status.ts](../../src/lib/domain/book-status.ts) exportando `computeBookStatus(chapters)` conforme [data-model.md §4](./data-model.md) — função pura, lança erro se `chapters.length === 0`.
- [X] T017 [P] Criar [src/lib/domain/chapter-state-machine.ts](../../src/lib/domain/chapter-state-machine.ts) exportando `isValidTransition(from, to, ctx)` com as regras do FR-025 (narrador obrigatório, editor + `editedSeconds > 0` obrigatórios, reversão `paid → completed` apenas com `confirmReversion`).
- [X] T018 [P] Criar [src/lib/repositories/book-repository.ts](../../src/lib/repositories/book-repository.ts) com a interface `BookRepository` (`listByUser`, `findById`, `insert`, `update`, `updateStatus`, `delete`).
- [X] T019 [P] Criar [src/lib/repositories/chapter-repository.ts](../../src/lib/repositories/chapter-repository.ts) com a interface `ChapterRepository` (`listByBookId`, `findById`, `insertMany`, `update`, `delete`, `deleteMany`, `countByBookId`, `maxNumeroByBookId`).
- [X] T003 [P] Criar [__tests__/repositories/in-memory-book-repository.ts](../../__tests__/repositories/in-memory-book-repository.ts) e [__tests__/repositories/in-memory-chapter-repository.ts](../../__tests__/repositories/in-memory-chapter-repository.ts) como fakes injetáveis (classes), seguindo o modelo de `in-memory-user-preference-repository.ts`. _(Realocada de Phase 1 — depende dos tipos de domínio T014/T015 e das interfaces `BookRepository`/`ChapterRepository` definidas em T018/T019.)_

### Unit tests — domínio puro (TDD: escrever ANTES do helper)

- [X] T020 [P] Criar [__tests__/unit/domain/book-status.spec.ts](../../__tests__/unit/domain/book-status.spec.ts) com table-driven tests cobrindo 100% da função `computeBookStatus`: (a) todos paid; (b) todos completed/paid com 1 completed; (c) algum reviewing/retake; (d) algum editing; (e) default pending; (f) erro quando lista vazia; (g) cenário US5.13 (após excluir `pending`, sobra `paid`); (h) cenário US5.14 (após adicionar `pending` a livro com 1 `paid`, resulta `pending`).
- [X] T021 [P] Criar [__tests__/unit/domain/chapter-state-machine.spec.ts](../../__tests__/unit/domain/chapter-state-machine.spec.ts) cobrindo 100% de `isValidTransition`: cada transição válida aceita, cada inválida rejeita, pré-condições (narrador, editor + `editedSeconds > 0`, confirmReversion) testadas.
- [X] T021a [P] Criar [__tests__/unit/domain/earnings.spec.ts](../../__tests__/unit/domain/earnings.spec.ts) cobrindo 100% de `computeEarningsCents`: (a) valores exatos (ex: `7200s × 7500cents / 3600 = 15000`), (b) arredondamento half-away-from-zero (`3601s × 7500 / 3600 = 7502` ≠ `7501`), (c) zero seconds retorna 0, (d) precisão preservada em somas de múltiplas linhas (auditabilidade Princípio II), (e) paridade de cálculo com a fórmula SQL documentada em data-model.md §8.

### Zod schemas

- [X] T022 [P] Criar [src/lib/schemas/book.ts](../../src/lib/schemas/book.ts) com `createBookSchema`, `updateBookSchema` e `bookIdParamsSchema` conforme [contracts/books.md](./contracts/books.md). Usar `trim()` em `title`, `z.number().int().min(1).max(999_999)` em `pricePerHourCents`, `refine` para `inlineStudioId`.
- [X] T023 [P] Criar [src/lib/schemas/chapter.ts](../../src/lib/schemas/chapter.ts) com `updateChapterSchema` e `bulkDeleteChaptersSchema` conforme [contracts/chapters.md](./contracts/chapters.md) e [contracts/books.md](./contracts/books.md). Campo `editedSeconds: z.number().int().min(0).max(3_600_000).optional()` e `confirmReversion: z.boolean().optional()`.

### Unit tests — Zod schemas

- [X] T024 [P] Criar [__tests__/unit/schemas/book-schema.spec.ts](../../__tests__/unit/schemas/book-schema.spec.ts) cobrindo: campos obrigatórios, trim, faixa `pricePerHourCents ∈ [1, 999999]`, faixa `numChapters`, `inlineStudioId ≠ studioId` rejeitado, strings não-inteiras em `pricePerHourCents` rejeitadas.
- [X] T025 [P] Criar [__tests__/unit/schemas/chapter-schema.spec.ts](../../__tests__/unit/schemas/chapter-schema.spec.ts): exige ≥ 1 campo, valida UUIDs, valida faixa `editedSeconds ∈ [0, 3_600_000]`, rejeita floats em `editedSeconds` (`z.number().int()`), aceita `confirmReversion`.

### Repositories Drizzle

- [X] T026 Criar [src/lib/repositories/drizzle/drizzle-book-repository.ts](../../src/lib/repositories/drizzle/drizzle-book-repository.ts) implementando `BookRepository`. Todas as queries selecionam colunas explícitas (proibido `SELECT *`). Operações multi-tabela recebem `tx` como parâmetro opcional (default `db`).
- [X] T027 Criar [src/lib/repositories/drizzle/drizzle-chapter-repository.ts](../../src/lib/repositories/drizzle/drizzle-chapter-repository.ts) implementando `ChapterRepository` com idem convenção de `tx`.
- [X] T028 [P] Atualizar [src/lib/repositories/drizzle/drizzle-studio-repository.ts](../../src/lib/repositories/drizzle/drizzle-studio-repository.ts) para: (a) filtrar `deleted_at IS NULL` em todos os `list`/`findByName` padrão; (b) adicionar `findByNameIncludingDeleted(name)` para a lógica de desarquive; (c) adicionar `softDelete(id, tx)` que seta `deleted_at = now()`; (d) adicionar `reactivate(id, overrides?, tx)` que seta `deleted_at = null` (+ eventuais overrides).
- [X] T029 [P] Atualizar [src/lib/repositories/drizzle/drizzle-narrator-repository.ts](../../src/lib/repositories/drizzle/drizzle-narrator-repository.ts) simétrico a T028.
- [X] T030 [P] Atualizar [src/lib/repositories/drizzle/drizzle-editor-repository.ts](../../src/lib/repositories/drizzle/drizzle-editor-repository.ts) simétrico a T028, preservando unicidade global de `email` (inclui soft-deleted).

### Services — book-status-recompute (usado por todos os demais services de mutação)

- [X] T031 Criar [src/lib/services/book-status-recompute.ts](../../src/lib/services/book-status-recompute.ts) exportando `recomputeBookStatus(bookId, deps, tx)` onde `deps = { bookRepo, chapterRepo }`. Lê capítulos do livro, chama `computeBookStatus`, grava via `bookRepo.updateStatus`.
- [X] T032 [P] Criar [__tests__/unit/services/book-status-recompute.spec.ts](../../__tests__/unit/services/book-status-recompute.spec.ts) usando os in-memory repos de T003: cenários US5.13 e US5.14 + caminho de erro (livro sem capítulos lança).

### Soft-delete + desarquive services (Foundational — precondição para US3, US10, US11)

- [X] T033 Atualizar [src/lib/services/studio-service.ts](../../src/lib/services/studio-service.ts): (a) `softDeleteStudio(id)` com pré-condição "sem livros com capítulos ativos" (placeholder — a query full vive em chapterRepo/bookRepo, pode inicialmente lançar `409 STUDIO_HAS_ACTIVE_BOOKS` stub que será preenchido em US10); (b) `createStudio(input)` reescrito para detectar colisão com soft-deleted e reativar (FR-046a); (c) todos os `list`/`findByName` já via T028 filtram soft-deleted.
- [X] T034 [P] Atualizar [src/lib/services/narrator-service.ts](../../src/lib/services/narrator-service.ts) simétrico a T033 (soft-delete + desarquive; pré-condição de US11 como stub a preencher depois).
- [X] T035 [P] Atualizar [src/lib/services/editor-service.ts](../../src/lib/services/editor-service.ts) simétrico a T033; preservar unicidade global de `email` (não compartilhada com regra de desarquive por nome).

### Factories

- [X] T036 [P] Criar [src/lib/factories/book.ts](../../src/lib/factories/book.ts) exportando `createBookService()` com dependências concretas (Drizzle repos + recomputeBookStatus).
- [X] T037 [P] Criar [src/lib/factories/chapter.ts](../../src/lib/factories/chapter.ts) exportando `createChapterService()`.

### Integration tests — soft-delete unificado (Foundational)

- [X] T038 Criar [__tests__/integration/soft-delete-unification.spec.ts](../../__tests__/integration/soft-delete-unification.spec.ts) cobrindo (via BEGIN/ROLLBACK): (a) soft-delete seta `deleted_at`; (b) listagem filtra soft-deleted; (c) desarquive-by-name reativa (`deleted_at = null`) e preserva campos originais; (d) `editor_email_unique` continua global. Rodar com `NODE_ENV=test bun run test:integration -- __tests__/integration/soft-delete-unification.spec.ts`.

**Checkpoint**: Foundation pronta. Schema, migrations, domínio, helpers, repos e services de soft-delete funcionando. Stories podem começar.

---

## Phase 3: User Story 1 — Listar livros cadastrados (Priority: P1) 🎯 MVP

**Goal**: Produtor acessa `/books` e vê listagem com busca, ordenação e dados agregados (capítulos concluídos/totais, ganho total, status).

**Independent Test**: Acessar `/books` com 3 livros seed → tabela renderiza, busca filtra por título/estúdio, click em linha navega para `/books/:id` (stub).

### Tests for US1 — TDD

- [X] T039 [P] [US1] Criar [__tests__/unit/services/book-service.list.spec.ts](../../__tests__/unit/services/book-service.list.spec.ts) cobrindo `listBooksForUser(userId)` com in-memory repos: retorna livros com `totalChapters`, `completedChapters`, `totalEarnings` corretos.
- [X] T040 [P] [US1] Criar [__tests__/integration/book-list.spec.ts](../../__tests__/integration/book-list.spec.ts) com DB real: criar 3 livros com capítulos em estados variados; validar que `GET /api/v1/books` retorna agregações corretas.
- [X] T041 [P] [US1] Criar [__tests__/e2e/books-list.spec.ts](../../__tests__/e2e/books-list.spec.ts) (Playwright): acessar `/books`, verificar tabela, busca filtrando por título/estúdio, ordenação ASC/DESC nas colunas ordenáveis, ausência da coluna "Ações".

### Implementation for US1

- [X] T042 [US1] Implementar `BookService.listForUser` em [src/lib/services/book-service.ts](../../src/lib/services/book-service.ts) (criar o arquivo se ainda não existe): agrega `totalChapters`, `completedChapters` e `totalEarnings` via query com `LEFT JOIN chapter` no repo ([contracts/books.md — GET /books](./contracts/books.md)).
- [X] T043 [US1] Implementar rota [src/app/api/v1/books/route.ts](../../src/app/api/v1/books/route.ts) com handler `GET` que chama `createBookService().listForUser(session.user.id)`. Envelope `{ data: [...] }`. Erros via helpers de [src/lib/api/responses.ts](../../src/lib/api/responses.ts).
- [X] T044 [P] [US1] Criar componente [src/components/features/books/books-table.tsx](../../src/components/features/books/books-table.tsx): client component recebendo `books`, renderiza `<Table>` do shadcn com colunas "Título", "Estúdio", "Capítulos" (`concluídos/totais`), "Status" (badge), "R$/hora", "Ganho total". Sem coluna "Ações". Linha `onClick` navega para `/books/[id]`.
- [X] T045 [P] [US1] Criar [src/components/features/books/books-client.tsx](../../src/components/features/books/books-client.tsx): client wrapper com barra de pesquisa (filtra por título OU nome do estúdio, case-insensitive), ordenação client-side via `useMemo`, estado do modal de criação (placeholder para US2).
- [X] T046 [US1] Criar [src/app/(authenticated)/books/page.tsx](../../src/app/(authenticated)/books/page.tsx) como Server Component: chama `GET /api/v1/books` server-side e passa `books` ao `<BooksClient>`. Usar `<PageContainer>`, `<PageHeader>`, `<PageTitle>`, `<PageDescription>` de [src/components/layout/page-container.tsx](../../src/components/layout/page-container.tsx).
- [X] T047 [US1] Atualizar [src/app/(authenticated)/layout-client.tsx](../../src/app/(authenticated)/layout-client.tsx) (ou config de rotas) para incluir "Livros" na navegação lateral, reutilizando o padrão já aplicado a Studios/Editors/Narrators. _(já presente em `src/lib/constants/navigation.ts`.)_
- [X] T048 [US1] Adicionar o estado vazio (tabela sem livros + CTA "+ Novo Livro") em `books-client.tsx` para o cenário sem dados. Botão inicialmente não abre o modal — será conectado em US2.

**Checkpoint**: US1 entregue — listagem funcional sem criação/detalhes. Rodar `bun run test:unit -- book-service.list` e o E2E de listagem.

---

## Phase 4: User Story 2 — Criar livro via modal (Priority: P1) 🎯 MVP

**Goal**: Produtor abre `/books`, clica "+ Novo Livro", preenche modal (Título, Estúdio, Valor/hora, Quantidade de capítulos), confirma. Livro + N capítulos em `pending` são criados atomicamente.

**Independent Test**: Em uma DB com estúdios existentes, clicar "+ Novo Livro", preencher todos os campos, confirmar; verificar que o livro aparece na listagem + N capítulos em `pending` persistidos.

### Tests for US2 — TDD

- [X] T049 [P] [US2] Criar [__tests__/unit/services/book-service.create.spec.ts](../../__tests__/unit/services/book-service.create.spec.ts): unit com in-memory repos — criar livro com N capítulos; falha por título duplicado no mesmo estúdio; recalcula `book.status = pending`.
- [X] T050 [P] [US2] Criar [__tests__/integration/book-create.spec.ts](../../__tests__/integration/book-create.spec.ts): DB real, transação atômica, `UNIQUE (lower(title), studio_id)` dispara `409 TITLE_ALREADY_IN_USE`, rollback em falha.
- [X] T051 [P] [US2] Criar [__tests__/e2e/books-create.spec.ts](../../__tests__/e2e/books-create.spec.ts): abrir modal, preencher todos os campos, confirmar, ver linha na tabela. Casos de validação (título vazio, valor fora da faixa, quantidade < 1).
- [X] T051a [P] [US2] Criar [__tests__/unit/components/book-create-dialog.spec.tsx](../../__tests__/unit/components/book-create-dialog.spec.tsx) (jsdom) cobrindo o pré-preenchimento de `pricePerHourCents` a partir do estúdio selecionado (requisito citado em [spec.md §Key Entities — Studio](./spec.md) e [019-studios-crud/quickstart.md](../019-studios-crud/quickstart.md#L54), mas omitido do task breakdown original de T054). Cenários: (a) campo "Valor/hora" vazio + selecionar estúdio com `defaultHourlyRateCents=8500` → campo passa a exibir `R$ 85,00`; (b) usuário digitou um valor manual → selecionar estúdio NÃO sobrescreve (respeita `isDirty` do RHF); (c) trocar de estúdio com campo ainda pristine → preço acompanha; (d) resetar form ao fechar dialog → próximo open volta ao comportamento pristine.

### Implementation for US2

- [X] T052 [US2] Implementar `BookService.create(input, userId)` em [src/lib/services/book-service.ts](../../src/lib/services/book-service.ts): transação Drizzle; insere `book`, gera N capítulos numerados 1..N em `pending`, chama `recomputeBookStatus` (resultado = `pending`); retorna `book` com `chapters`. Trata conflito `lower(title)+studio_id` como `409 TITLE_ALREADY_IN_USE`. Ignora `inlineStudioId` nesta fase (será ligado em US3).
- [X] T053 [US2] Implementar handler `POST` em [src/app/api/v1/books/route.ts](../../src/app/api/v1/books/route.ts) usando `createBookSchema` de T022. Retorna `201` com header `Location`. Mapear erros para helpers de `responses.ts`.
- [X] T054 [P] [US2] Criar componente [src/components/features/books/book-create-dialog.tsx](../../src/components/features/books/book-create-dialog.tsx): `<Dialog>` shadcn com campos (RHF + Zod resolver). O campo "Valor/hora" aceita entrada em reais (`R$ 75,00`) e converte para `pricePerHourCents` via `Math.round(value * 100)` antes de submeter. Seletor de estúdio implementado como combobox pesquisável (`<Popover>` + `<Command>` com `<CommandInput>` para busca por nome, `<CommandList>`/`<CommandGroup>`/`<CommandItem>` para as opções) listando estúdios ativos com `default_hourly_rate_cents` formatado em BRL (`÷ 100` + máscara), ordenados por nome ASC (FR-011). Escolha do Command sobre `<Select>` nativo se justifica porque este não tem campo de busca e a base de estúdios pode crescer. Nesta task, apenas a listagem + busca + seleção são ligadas — a ação "+ Novo Estúdio" ao final do `<CommandList>` (que abre o subformulário inline sem fechar o modal, FR-011a) é adicionada em T086/US3 para manter o escopo de US2 focado em criação com estúdios já existentes. Botão Confirmar fica `disabled` até o form estar válido.
- [X] T055 [P] [US2] Criar [src/components/features/books/chapter-count-input.tsx](../../src/components/features/books/chapter-count-input.tsx): input numérico com botões `-`/`+`, limites [1, 999], aceita só dígitos na digitação livre. Composto sobre `<Input>` + `<Button>` do shadcn. Propagar valor via `onChange`.
- [X] T056 [P] [US2] Criar input monetário cents-first para "Valor/hora". _Executado como migração do `MoneyInput` existente para API cents-first — elimina a necessidade do wrapper `PricePerHourInput`. Usar diretamente `<MoneyInput value={cents} onChange={(cents) => …} min={1} max={999_999} />`._
- [X] T057 [US2] Conectar o botão "+ Novo Livro" em [src/components/features/books/books-client.tsx](../../src/components/features/books/books-client.tsx) para abrir `<BookCreateDialog>`. Após sucesso do `POST /books`, fazer `router.refresh()` (Next.js App Router) para recarregar a lista.
- [x] T057a [US2] Em [src/components/features/books/book-create-dialog.tsx](../../src/components/features/books/book-create-dialog.tsx), pré-preencher `pricePerHourCents` com `studio.defaultHourlyRateCents` sempre que o usuário selecionar um estúdio E o campo "Valor/hora" ainda estiver pristine (`dirtyFields.pricePerHourCents` falso). Usar `watch("studioId")` + `setValue("pricePerHourCents", …, { shouldValidate: true, shouldDirty: false })`. NÃO sobrescrever um valor já digitado pelo usuário. Respeita a semântica de "sugestão" definida em [spec.md §Key Entities — Studio](./spec.md) e FR-054-era de 019.

**Checkpoint**: US2 entregue — produtor cria livros com estúdios existentes. Sem inline-create (US3) e sem detalhes (US4) ainda.

---

## Phase 5: User Story 4 — Detalhes do livro e listagem de capítulos (Priority: P1) 🎯 MVP

**Goal**: Ao clicar em uma linha de `/books`, navega para `/books/:id` com cabeçalho (título, estúdio, R$/hora, capítulos concluídos/totais, ganho total, status, botões), listagem de capítulos (nº, status, narrador, editor, horas, ações) e "Voltar".

**Independent Test**: Com um livro seed com 10 capítulos em estados variados, acessar a URL de detalhes → cabeçalho e tabela renderizam corretamente; botão Voltar retorna a `/books`.

### Tests for US4 — TDD

- [X] T058 [P] [US4] Criar [__tests__/unit/services/book-service.findById.spec.ts](../../__tests__/unit/services/book-service.findById.spec.ts): retorna book com chapters + estúdio (mesmo soft-deleted) + agregados.
- [X] T059 [P] [US4] Criar [__tests__/integration/book-detail.spec.ts](../../__tests__/integration/book-detail.spec.ts): `GET /api/v1/books/:id` retorna 200 com payload conforme contrato; 404 em ID inexistente.
- [X] T060 [P] [US4] Criar [__tests__/e2e/books-detail.spec.ts](../../__tests__/e2e/books-detail.spec.ts): click na linha, navegação, conteúdo do cabeçalho, botão Voltar.

### Implementation for US4

- [X] T061 [US4] Implementar `BookService.findByIdForUser(bookId, userId)` em [src/lib/services/book-service.ts](../../src/lib/services/book-service.ts): retorna `{ book, studio, chapters (com narrator/editor embutidos), totalEarnings, totalChapters, completedChapters }`.
- [X] T062 [US4] Implementar route handler `GET` em [src/app/api/v1/books/[id]/route.ts](../../src/app/api/v1/books/[id]/route.ts) chamando o service. 404 quando o livro não existe (conforme contrato).
- [X] T063 [P] [US4] Criar [src/components/features/books/book-header.tsx](../../src/components/features/books/book-header.tsx): cabeçalho com título, estúdio, R$/hora, capítulos, ganho total, status (badge). Botões "Ver PDF", "Editar livro", "Excluir capítulos" como placeholders (`disabled` ou `onClick` vazio) — serão ligados em US5..US9. Mobile-first.
- [X] T064 [P] [US4] Criar [src/components/features/chapters/chapters-table.tsx](../../src/components/features/chapters/chapters-table.tsx): tabela com colunas "Nº", "Status" (badge), "Narrador", "Editor", "Horas editadas", "Ações". Exibe ícones "Editar" e "Excluir" por linha (placeholders — handlers em US5/US6).
- [X] T065 [P] [US4] Criar [src/components/features/books/book-detail-client.tsx](../../src/components/features/books/book-detail-client.tsx): orquestrador que recebe `{ book, chapters }` e renderiza `<BookHeader>` + `<ChaptersTable>`. Estado inicial do "modo exclusão" e "modo edição" (ambos em false).
- [X] T066 [US4] Criar página [src/app/(authenticated)/books/[id]/page.tsx](../../src/app/(authenticated)/books/[id]/page.tsx) como Server Component: chama `GET /api/v1/books/:id`, renderiza `<PageContainer>` + `<BookDetailClient>`. Em 404 usa `notFound()` do Next.js (cai no `not-found.tsx` global).
- [X] T067 [US4] Adicionar botão/link "Voltar" no cabeçalho da página de detalhes usando `router.back()` ou `<Link href="/books">`.

**Checkpoint**: US4 entregue — produtor navega para detalhes, vê cabeçalho e lista de capítulos (somente leitura neste ponto).

---

## Phase 6: User Story 5 — Editar capítulo inline (Priority: P1) 🎯 MVP

**Goal**: Cada linha de capítulo tem 3 estados (view/edit/select). No estado `edit`, quatro campos editáveis: Narrador, Editor, Status (com máquina de estados), Horas editadas. Reversão `paid → completed` exige modal de confirmação dupla. `book.status` recomputado após toda mutação.

**Independent Test**: Editar um capítulo em `pending`, atribuir narrador e mudar para `editing` → persiste; tentar `editing → reviewing` sem editor/horas → validação falha; reverter `paid → completed` via modal → status volta e price/hour do livro destrava.

### Tests for US5 — TDD

- [X] T068 [P] [US5] Criar [__tests__/unit/services/chapter-service.update.spec.ts](../../__tests__/unit/services/chapter-service.update.spec.ts) cobrindo todas as transições (válidas e inválidas), `CHAPTER_PAID_LOCKED`, `REVERSION_CONFIRMATION_REQUIRED`, recomputação de `book.status` após cada update.
- [X] T069 [P] [US5] Criar [__tests__/integration/chapter-update.spec.ts](../../__tests__/integration/chapter-update.spec.ts): DB real, valida `PATCH /api/v1/chapters/:id` com cada transição (incluindo reversão `paid → completed` com e sem flag).
- [X] T070 [P] [US5] Criar [__tests__/integration/book-status-recompute.spec.ts](../../__tests__/integration/book-status-recompute.spec.ts) codificando explicitamente US5.13 e US5.14 como testes de integração (conforme FR-019 "testes de integração DEVEM validar...").
- [X] T071 [P] [US5] Criar [__tests__/e2e/chapters-edit-inline.spec.ts](../../__tests__/e2e/chapters-edit-inline.spec.ts): entrar em edit mode, editar narrador/status, confirmar, ver update + badge de status do livro mudando. Cenário de reversão `paid → completed` com modal. **Incluir cenário US5.15**: livro 100% `paid` → reverter todos → abrir "Editar livro" e confirmar que "Valor/hora" + "Estúdio" destravam (resolve U1 do analyze).

### Implementation for US5

- [X] T072 [US5] Implementar `ChapterService.update(chapterId, input, userId)` em [src/lib/services/chapter-service.ts](../../src/lib/services/chapter-service.ts): valida via `isValidTransition`, bloqueia mutações não-status em `paid` (`409 CHAPTER_PAID_LOCKED`), exige `confirmReversion: true` para `paid → completed` (`422 REVERSION_CONFIRMATION_REQUIRED`), tudo em transação com chamada final a `recomputeBookStatus`.
- [X] T073 [US5] Implementar route handler `PATCH` em [src/app/api/v1/chapters/[id]/route.ts](../../src/app/api/v1/chapters/[id]/route.ts) usando `updateChapterSchema`. Resposta inclui `meta.bookStatus` com o novo status recomputado.
- [X] T074 [P] [US5] Criar [src/components/features/chapters/chapter-row.tsx](../../src/components/features/chapters/chapter-row.tsx): componente da linha com estado local `"view" | "edit"` (modo select é passado por prop — US7). No `edit`: inputs/selects em-place, botões Cancelar/Confirmar substituem os ícones.
- [X] T075 [P] [US5] Criar [src/components/features/chapters/chapter-status-select.tsx](../../src/components/features/chapters/chapter-status-select.tsx): `<Select>` limitado às transições válidas a partir do `currentStatus` (derivado via `isValidTransition`). Se `currentStatus === 'paid'`, apenas `completed` disponível.
- [X] T076 [P] [US5] Criar [src/components/features/chapters/chapter-paid-reversion-dialog.tsx](../../src/components/features/chapters/chapter-paid-reversion-dialog.tsx): `<AlertDialog>` disparado quando o produtor confirma um `paid → completed`. Envia o PATCH com `confirmReversion: true` ao aceitar.
- [X] T077 [US5] Integrar `<ChapterRow>` em `<ChaptersTable>` (de T064) com callbacks de edição que chamam o endpoint PATCH. Após sucesso, aplicar `router.refresh()` para recarregar o cabeçalho (com novo `book.status`, ganho total e capítulos completados).
- [X] T078 [US5] Atualizar `<BookHeader>` (T063) para consumir o `book.status` recomputado — badge muda de cor/label. Verificar que "Editar livro" desbloqueia após reversão total de `paid`.

**Checkpoint**: MVP (US1+US2+US4+US5) concluído — produtor lista, cria, detalha e edita capítulos. Fluxo operacional básico pronto.

---

## Phase 7: User Story 3 — Criar estúdio inline + propagação transacional (Priority: P2)

**Goal**: Dentro do modal de criação de livro, seletor de estúdio tem "+ Novo Estúdio". Ao confirmar subformulário, estúdio é persistido com `default_hourly_rate_cents = 1` (valor mínimo). Ao confirmar o livro, o service propaga `book.price_per_hour_cents` → `studio.default_hourly_rate_cents` na mesma transação. Cancelar o modal deixa o estúdio persistido com rate placeholder + toast de alerta.

**Independent Test**: Criar estúdio inline, preencher valor/hora do livro = R$ 100,00, confirmar → em `/studios`, estúdio novo aparece com R$ 100,00. Cancelar em vez de confirmar → toast alerta "valor/hora muito baixo"; estúdio persiste com R$ 0,01.

### Tests for US3 — TDD

- [X] T079 [P] [US3] Criar [__tests__/unit/services/book-service.create-with-inline-studio.spec.ts](../../__tests__/unit/services/book-service.create-with-inline-studio.spec.ts): com `inlineStudioId` válido, propaga; com inválido, rejeita `INLINE_STUDIO_INVALID`.
- [X] T080 [P] [US3] Criar [__tests__/integration/book-create-inline-studio.spec.ts](../../__tests__/integration/book-create-inline-studio.spec.ts): DB real, fluxo completo `POST /studios { inline: true, defaultHourlyRateCents: 1 }` seguido de `POST /books { inlineStudioId, pricePerHourCents: 7500 }`; valida que `studio.default_hourly_rate_cents` virou `7500` na mesma transação. Guard anti-abuso: `inlineStudioId` com rate ≠ `1` rejeitado.
- [X] T081 [P] [US3] Criar [__tests__/e2e/books-create-inline-studio.spec.ts](../../__tests__/e2e/books-create-inline-studio.spec.ts): fluxo de UI completo (inline create → propagação → verificar em `/studios`). Cenário de cancelamento com toast.

### Implementation for US3

- [X] T082 [US3] Estender `BookService.create` (T052) em [src/lib/services/book-service.ts](../../src/lib/services/book-service.ts) para aceitar `inlineStudioId` opcional: valida existência, ownership (reuso da guarda auth de `PATCH /studios`) e `default_hourly_rate_cents === 1`; se válido, `UPDATE studio SET default_hourly_rate_cents = :pricePerHourCents WHERE id = :inlineStudioId` na mesma transação. Qualquer violação → `422 INLINE_STUDIO_INVALID`.
- [X] T083 [US3] Estender `StudioService.create` (T033) em [src/lib/services/studio-service.ts](../../src/lib/services/studio-service.ts) para aceitar flag `inline: true` no payload — força `default_hourly_rate_cents = 1` mesmo em reativação (sobrescreve valor histórico) e retorna `meta.rateResetForInline: true` para o client exibir toast adicional.
- [X] T084 [US3] Atualizar route handler `POST /api/v1/studios` (em [src/app/api/v1/studios/route.ts](../../src/app/api/v1/studios/route.ts)) para aceitar e repassar `inline` no body; adicionar `reactivated` e `rateResetForInline` ao envelope `meta`.
- [X] T085 [P] [US3] Criar [src/components/features/books/studio-inline-creator.tsx](../../src/components/features/books/studio-inline-creator.tsx): subformulário compacto usado dentro do seletor de estúdio. Campo "Nome" (obrigatório). Botão "Criar" faz `POST /studios { name, defaultHourlyRateCents: 1, inline: true }`, recebe `{ data, meta }`, passa o `studio.id` para o pai.
- [X] T086 [US3] Estender [src/components/features/books/book-create-dialog.tsx](../../src/components/features/books/book-create-dialog.tsx) (T054) para incluir "+ Novo Estúdio" como `<CommandItem>` destacado ao final do `<CommandList>` do combobox (satisfaz FR-011a). Gerencia `inlineStudioId` em estado e envia no `POST /books`. No cancelamento do modal, se houver `inlineStudioId` gravado (estúdio já persistido), mostra toast de atenção conforme FR-014. Se `meta.rateResetForInline === true`, toast adicional é exibido conforme clarificação Q4.

**Checkpoint**: US3 entregue — criação inline de estúdio com propagação transacional + toasts de alerta.

---

## Phase 8: User Story 6 — Excluir capítulo individualmente (Priority: P2)

**Goal**: Ícone "Excluir" por linha abre modal de confirmação; ao confirmar, capítulo é removido. Se é o último capítulo não-`paid` e não há `paid`, livro é excluído em cascata (header `X-Book-Deleted: true`) e produtor é redirecionado para `/books`.

**Independent Test**: Excluir capítulo comum → reduz contagem. Excluir o último capítulo de um livro sem `paid` → livro é deletado, produtor redirecionado.

### Tests for US6 — TDD

- [X] T087 [P] [US6] Criar [__tests__/unit/services/chapter-service.delete.spec.ts](../../__tests__/unit/services/chapter-service.delete.spec.ts): bloqueia `CHAPTER_PAID_LOCKED`; recomputa `book.status`; cascade-delete do livro quando last não-`paid` e sem `paid`.
- [X] T088 [P] [US6] Criar [__tests__/integration/chapter-delete.spec.ts](../../__tests__/integration/chapter-delete.spec.ts): DB real, cascade-delete atômico, header `X-Book-Deleted: true`.
- [X] T089 [P] [US6] Criar [__tests__/e2e/chapter-delete-single.spec.ts](../../__tests__/e2e/chapter-delete-single.spec.ts): modal de confirmação, contagem reduz, cenário de cascade-delete (último capítulo → redirect).

### Implementation for US6

- [X] T090 [US6] Implementar `ChapterService.delete(chapterId, userId)` em [src/lib/services/chapter-service.ts](../../src/lib/services/chapter-service.ts): transação; valida não-`paid`; `DELETE FROM chapter`; `COUNT` restante; se zero, `DELETE FROM book`; senão `recomputeBookStatus`.
- [X] T091 [US6] Implementar route handler `DELETE` em [src/app/api/v1/chapters/[id]/route.ts](../../src/app/api/v1/chapters/[id]/route.ts): `204` com header `X-Book-Deleted: true` quando aplicável.
- [X] T092 [P] [US6] Criar [src/components/features/chapters/chapter-delete-dialog.tsx](../../src/components/features/chapters/chapter-delete-dialog.tsx): `<AlertDialog>` de confirmação com copy ("Excluir capítulo X? Esta ação não pode ser desfeita").
- [X] T093 [US6] Integrar ícone "Excluir" em `<ChapterRow>` (T074) para abrir o dialog e disparar o DELETE. Ao receber `X-Book-Deleted: true`, redirecionar para `/books` com toast "Último capítulo removido — livro excluído".

**Checkpoint**: US6 entregue.

---

## Phase 9: User Story 7 — Modo de exclusão em lote (Priority: P2)

**Goal**: Botão "Excluir capítulos" no cabeçalho ativa modo de exclusão: barra superior sticky com contador, checkboxes por linha (capítulos `paid` desabilitados), "Confirmar" dispara modal final. Ao aceitar, exclusão atômica; se sobraram apenas `paid` ou zero, livro é preservado ou excluído conforme regra. Ícones por linha e botão "Editar livro" são **ocultados** (não apenas desabilitados).

**Independent Test**: Entrar no modo, marcar 3 capítulos, confirmar → 3 removidos, `book.status` recomputado. Marcar todos (`select all`) com 1 `paid` → só não-`paid` selecionam. Confirmar → livro permanece com 1 `paid`.

### Tests for US7 — TDD

- [X] T094 [P] [US7] Criar [__tests__/unit/services/chapter-service.bulk-delete.spec.ts](../../__tests__/unit/services/chapter-service.bulk-delete.spec.ts): bloqueia atomicamente se qualquer ID é `paid`, recomputa `book.status`, cascade-delete do livro quando aplicável.
- [X] T095 [P] [US7] Criar [__tests__/integration/chapter-bulk-delete.spec.ts](../../__tests__/integration/chapter-bulk-delete.spec.ts): DB real, `POST /api/v1/books/:id/chapters/bulk-delete`, cenário com `paid` preservado e sem `paid` com cascade-delete do livro.
- [X] T096 [P] [US7] Criar [__tests__/e2e/chapters-bulk-delete.spec.ts](../../__tests__/e2e/chapters-bulk-delete.spec.ts): ativa o modo, checkboxes, ícones ocultos, barra sticky, modal final, resultado.

### Implementation for US7

- [X] T097 [US7] Implementar `ChapterService.bulkDelete(bookId, chapterIds, userId)` em [src/lib/services/chapter-service.ts](../../src/lib/services/chapter-service.ts): valida ownership e ausência de `paid`, executa `DELETE ... WHERE id IN (...)` em transação, aplica cascade-delete do livro quando apropriado, recomputa `book.status` caso contrário.
- [X] T098 [US7] Implementar route handler `POST` em [src/app/api/v1/books/[id]/chapters/bulk-delete/route.ts](../../src/app/api/v1/books/[id]/chapters/bulk-delete/route.ts) com `bulkDeleteChaptersSchema`. Retorna `204` com `X-Book-Deleted: true` quando aplicável.
- [X] T099 [P] [US7] Criar [src/components/features/chapters/chapters-bulk-delete-bar.tsx](../../src/components/features/chapters/chapters-bulk-delete-bar.tsx): barra sticky top com contador "N capítulos selecionados", botão "Confirmar" (disabled se N=0), botão "Cancelar". Usa tokens de cor semânticos (destructive).
- [X] T100 [US7] Estender [src/components/features/books/book-detail-client.tsx](../../src/components/features/books/book-detail-client.tsx) (T065) com estado `isSelectionMode: boolean`. Quando `true`: (a) renderizar `<ChaptersBulkDeleteBar>`; (b) ocultar ícones/botão "Editar livro" via className condicional; (c) passar `isSelectionMode` para `<ChaptersTable>` que passa para `<ChapterRow>`.
- [X] T101 [US7] Estender `<ChaptersTable>` (T064) e `<ChapterRow>` (T074) para receber `isSelectionMode`. Quando `true`: renderizar `<Checkbox>` em vez do `RowActions`. Capítulos `paid` ficam com checkbox `disabled`. Checkbox no header seleciona todos os não-`paid`.
- [X] T102 [US7] Adicionar modal final de confirmação em [src/components/features/chapters/chapters-bulk-delete-confirm.tsx](../../src/components/features/chapters/chapters-bulk-delete-confirm.tsx): `<AlertDialog>` com contagem, aviso "capítulos `paid` são preservados", botão "Excluir". Ao aceitar, chama `POST .../bulk-delete`; ao receber `X-Book-Deleted: true`, redireciona para `/books` com toast.

**Checkpoint**: US7 entregue.

---

## Phase 10: User Story 8 — Editar livro + aumentar capítulos (Priority: P2)

**Goal**: Botão "Editar livro" no cabeçalho abre modal com campos pré-preenchidos. `price_per_hour_cents` desabilitado se ≥ 1 capítulo `paid`. `studio` idem. Quantidade de capítulos não aceita redução (dica orientando a usar exclusão). Ao aumentar de X para Y, Y-X novos capítulos em `pending` são criados atomicamente, numerados após `MAX(number)`.

**Independent Test**: Editar título → persiste. Tentar reduzir quantidade → dica aparece. Aumentar quantidade → novos capítulos aparecem com números sequenciais após o maior atual.

### Tests for US8 — TDD

- [X] T103 [P] [US8] Criar [__tests__/unit/services/book-service.update.spec.ts](../../__tests__/unit/services/book-service.update.spec.ts): aumenta capítulos, bloqueios de price/studio com `paid`, regra de numeração após `MAX(number)+1`.
- [X] T104 [P] [US8] Criar [__tests__/integration/book-update.spec.ts](../../__tests__/integration/book-update.spec.ts): DB real, `PATCH /api/v1/books/:id`, atomicidade de aumento de capítulos, conflict `TITLE_ALREADY_IN_USE`.
- [X] T105 [P] [US8] Criar [__tests__/e2e/book-edit.spec.ts](../../__tests__/e2e/book-edit.spec.ts): modal pré-preenchido, dica de redução, aumento visível na lista, bloqueios com capítulo paid.

### Implementation for US8

- [X] T106 [US8] Implementar `BookService.update(bookId, input, userId)` em [src/lib/services/book-service.ts](../../src/lib/services/book-service.ts): valida bloqueios (`BOOK_PAID_PRICE_LOCKED`, `BOOK_PAID_STUDIO_LOCKED`, `CANNOT_REDUCE_CHAPTERS`, `TITLE_ALREADY_IN_USE`), cria delta de capítulos em transação, recomputa `book.status`.
- [X] T107 [US8] Implementar route handler `PATCH` em [src/app/api/v1/books/[id]/route.ts](../../src/app/api/v1/books/[id]/route.ts) com `updateBookSchema`.
- [X] T108 [P] [US8] Criar [src/components/features/books/book-edit-dialog.tsx](../../src/components/features/books/book-edit-dialog.tsx): modal similar ao de criação, pré-preenchido. `price_per_hour_cents` (campo "Valor/hora", input em reais convertido para centavos) e `studio` ficam `disabled` com tooltip explicativo quando há capítulo paid (lê da prop `hasPaidChapter` derivada do livro). `chapter-count-input` com min atual; ao tentar reduzir, exibir dica inline "Para reduzir, use 'Excluir capítulos'".
- [X] T109 [US8] Conectar o botão "Editar livro" no `<BookHeader>` (T063) para abrir `<BookEditDialog>`. Após sucesso, `router.refresh()` e toast de sucesso.

**Checkpoint**: US8 entregue.

---

## Phase 11: User Story 10 — Bloquear exclusão de estúdio com livros ativos (Priority: P2)

**Goal**: Em `/studios`, ao tentar excluir estúdio com ≥ 1 livro com capítulo ativo → `409 STUDIO_HAS_ACTIVE_BOOKS`. Caso todos os capítulos dos livros do estúdio estejam em `completed`/`paid`, soft-delete é aceito. Desarquive automático ao recriar com mesmo nome já está em Foundational (T033).

**Independent Test**: Criar estúdio → criar livro com capítulo `pending` → tentar excluir estúdio → erro. Mover todos para `completed` → excluir → soft-delete aceito; estúdio some de `/studios` mas o livro histórico continua exibindo-o.

### Tests for US10 — TDD

- [X] T110 [P] [US10] Criar [__tests__/unit/services/studio-service.soft-delete-precondition.spec.ts](../../__tests__/unit/services/studio-service.soft-delete-precondition.spec.ts): precondição `STUDIO_HAS_ACTIVE_BOOKS` com in-memory repos.
- [X] T111 [P] [US10] Criar [__tests__/integration/studio-soft-delete.spec.ts](../../__tests__/integration/studio-soft-delete.spec.ts): DB real, precondição bloqueia com detalhes (nomes de livros), aceitação soft-deleta; livro histórico continua resolvendo estúdio.
- [X] T112 [P] [US10] Criar [__tests__/e2e/studio-delete-with-active-books.spec.ts](../../__tests__/e2e/studio-delete-with-active-books.spec.ts): cenário completo de bloqueio + soft-delete + desarquive.

### Implementation for US10

- [X] T113 [US10] Preencher a pré-condição `STUDIO_HAS_ACTIVE_BOOKS` no `StudioService.softDeleteStudio` (T033) com a query real (LEFT JOIN book+chapter) — conforme [contracts/studios-delta.md](./contracts/studios-delta.md). Retornar `details: { books: [...] }` no payload de erro. _Implementação: helper `createGetActiveBooks()` em [src/lib/factories/studio.ts](../../src/lib/factories/studio.ts) + erro `StudioHasActiveBooksError.books` em [src/lib/errors/studio-errors.ts](../../src/lib/errors/studio-errors.ts)._
- [X] T114 [US10] Atualizar route handler `DELETE /api/v1/studios/:id` ([src/app/api/v1/studios/[id]/route.ts](../../src/app/api/v1/studios/[id]/route.ts)) para consumir o novo erro e mapear para `409 STUDIO_HAS_ACTIVE_BOOKS` com detalhes. _Agora chama `service.softDelete()` (não `service.delete()`), injetando deps via `createStudioSoftDeleteDeps()`._
- [X] T115 [P] [US10] Atualizar [src/components/features/studios/delete-studio-dialog.tsx](../../src/components/features/studios/delete-studio-dialog.tsx) (a UI de exclusão fica no dialog, não na tabela) para: (a) exibir toast explicativo quando o DELETE falhar com `409 STUDIO_HAS_ACTIVE_BOOKS` (listar livros/nomes); (b) refletir lista sem soft-deleted após sucesso (já garantido pelo `router.refresh()` existente).

**Checkpoint**: US10 entregue.

---

## Phase 12: User Story 11 — Bloquear exclusão de narrador/editor com capítulos ativos (Priority: P2)

**Goal**: Simétrica a US10 para `/narrators` e `/editors`. Bloqueia se vinculado a ≥ 1 capítulo cujo livro tem capítulo ativo. Desarquive automático também em T034/T035.

**Independent Test**: Atribuir narrador a capítulo em `editing` → excluir narrador → erro. Após concluir todos os capítulos → excluir → soft-delete aceito.

### Tests for US11 — TDD

- [X] T116 [P] [US11] Criar [__tests__/unit/services/narrator-service.soft-delete-precondition.spec.ts](../../__tests__/unit/services/narrator-service.soft-delete-precondition.spec.ts).
- [X] T117 [P] [US11] Criar [__tests__/unit/services/editor-service.soft-delete-precondition.spec.ts](../../__tests__/unit/services/editor-service.soft-delete-precondition.spec.ts).
- [X] T118 [P] [US11] Criar [__tests__/integration/narrator-editor-soft-delete.spec.ts](../../__tests__/integration/narrator-editor-soft-delete.spec.ts): DB real, precondições e aceitação, preservação histórica.
- [X] T119 [P] [US11] Criar [__tests__/e2e/narrator-editor-delete.spec.ts](../../__tests__/e2e/narrator-editor-delete.spec.ts): fluxos em ambas as telas.

### Implementation for US11

- [X] T120 [US11] Preencher precondições em `NarratorService.softDelete` (T034) e `EditorService.softDelete` (T035) com as queries reais conforme [contracts/narrators-delta.md](./contracts/narrators-delta.md) e [contracts/editors-delta.md](./contracts/editors-delta.md). _Implementação: helpers `createGetActiveBooksForNarrator` / `createGetActiveBooksForEditor` em [src/lib/factories/narrator.ts](../../src/lib/factories/narrator.ts) e [src/lib/factories/editor.ts](../../src/lib/factories/editor.ts) usando `alias(chapter)` + `EXISTS` subquery; erros agora carregam `books: BlockingBookSummary[]`._
- [X] T121 [US11] Atualizar route handlers `DELETE` em [src/app/api/v1/narrators/[id]/route.ts](../../src/app/api/v1/narrators/[id]/route.ts) e [src/app/api/v1/editors/[id]/route.ts](../../src/app/api/v1/editors/[id]/route.ts) para os novos erros `409 NARRATOR_LINKED_TO_ACTIVE_CHAPTERS` / `409 EDITOR_LINKED_TO_ACTIVE_CHAPTERS` com detalhes. _Agora chamam `service.softDelete()` (não `service.delete()`), injetando deps via `createNarratorSoftDeleteDeps()` / `createEditorSoftDeleteDeps()`._
- [X] T122 [P] [US11] Atualizar [src/components/features/narrators/delete-narrator-dialog.tsx](../../src/components/features/narrators/delete-narrator-dialog.tsx) e [src/components/features/editors/delete-editor-dialog.tsx](../../src/components/features/editors/delete-editor-dialog.tsx) (a UI de exclusão fica no dialog, não na tabela) para exibir toast explicativo em caso de erro `409`, listando os livros bloqueando.

**Checkpoint**: US11 entregue.

---

## Phase 13: User Story 9 — PDF do livro (popover) (Priority: P3)

**Goal**: Botão "Ver PDF" no cabeçalho abre `<Popover>` com input de URL + botão Salvar. Validação `http://` ou `https://`. Se já salva, botão "Abrir em nova guia" vira visível e abre `target="_blank"` com `rel="noopener noreferrer"`. Salvar vazio remove URL.

**Independent Test**: Abrir popover em livro sem PDF → salvar URL válida → recarregar → URL persistida; botão "Abrir em nova guia" aparece. URL inválida → validação rejeita.

### Tests for US9 — TDD

- [ ] T123 [P] [US9] Criar [__tests__/unit/services/book-service.update-pdf.spec.ts](../../__tests__/unit/services/book-service.update-pdf.spec.ts): valida regex, aceita null para remover.
- [ ] T124 [P] [US9] Criar [__tests__/integration/book-pdf-url.spec.ts](../../__tests__/integration/book-pdf-url.spec.ts): DB real, PATCH com `pdfUrl` válido/inválido/null.
- [ ] T125 [P] [US9] Criar [__tests__/e2e/book-pdf.spec.ts](../../__tests__/e2e/book-pdf.spec.ts): popover, salvar, remover, abrir em nova guia.

### Implementation for US9

- [ ] T126 [US9] Estender `BookService.update` (T106) em [src/lib/services/book-service.ts](../../src/lib/services/book-service.ts) para aceitar `pdfUrl` nulável no `updateBookSchema`. Validação de formato via Zod + CHECK no banco.
- [ ] T127 [P] [US9] Criar [src/components/features/books/book-pdf-popover.tsx](../../src/components/features/books/book-pdf-popover.tsx): `<Popover>` shadcn com `<Input>` (URL), botão Salvar (disabled se inválido), botão "Abrir em nova guia" (renderizado só se `pdfUrl` persistido, usa `<a target="_blank" rel="noopener noreferrer">`).
- [ ] T128 [US9] Conectar botão "Ver PDF" em `<BookHeader>` (T063) para abrir o popover. Após salvar, `router.refresh()`.

**Checkpoint**: US9 entregue.

---

## Phase 14: User Story 12 — Colunas derivadas nas listagens existentes (Priority: P3)

**Goal**: Adicionar coluna "Livros" em `/studios`, "Capítulos" em `/narrators` e `/editors`. Calculadas server-side via `COUNT` agregado. Ordenáveis.

**Independent Test**: Criar 3 livros no mesmo estúdio → `/studios` mostra "3" na coluna Livros. Atribuir narrador a 5 capítulos → `/narrators` mostra "5".

### Tests for US12 — TDD

- [ ] T129 [P] [US12] Criar [__tests__/integration/studios-books-count.spec.ts](../../__tests__/integration/studios-books-count.spec.ts): `GET /api/v1/studios` retorna `booksCount` correto.
- [ ] T130 [P] [US12] Criar [__tests__/integration/narrators-editors-chapters-count.spec.ts](../../__tests__/integration/narrators-editors-chapters-count.spec.ts): `GET /api/v1/narrators` e `/editors` retornam `chaptersCount` correto.
- [ ] T131 [P] [US12] Criar [__tests__/e2e/derived-columns.spec.ts](../../__tests__/e2e/derived-columns.spec.ts): cenários visuais + ordenação nas três listagens.

### Implementation for US12

- [ ] T132 [US12] Atualizar `StudioService.listForUser` em [src/lib/services/studio-service.ts](../../src/lib/services/studio-service.ts) e seu repo (T028) para agregar `booksCount` via `LEFT JOIN book GROUP BY studio.id`. Garantir performance com índice `book_studio_id_idx` já criado em T008.
- [ ] T133 [US12] Atualizar `NarratorService.listForUser` e `EditorService.listForUser` (T034/T035) + seus repos (T029/T030) para agregar `chaptersCount`.
- [ ] T134 [P] [US12] Estender [src/components/features/studios/studios-table.tsx](../../src/components/features/studios/studios-table.tsx) com coluna "Livros" ordenável.
- [ ] T135 [P] [US12] Estender [src/components/features/narrators/narrators-table.tsx](../../src/components/features/narrators/narrators-table.tsx) com coluna "Capítulos" ordenável.
- [ ] T136 [P] [US12] Estender [src/components/features/editors/editors-table.tsx](../../src/components/features/editors/editors-table.tsx) com coluna "Capítulos" ordenável.

**Checkpoint**: US12 entregue — todas as features funcionais.

---

## Phase 15: Polish & Cross-Cutting Concerns

**Purpose**: Limpeza, acessibilidade, dark mode, documentação.

- [ ] T137 [P] Revisar todos os novos componentes para garantir suporte a dark mode via tokens semânticos (`bg-background`, `text-foreground`, `border-border` etc.). Nenhuma cor hardcoded.
- [ ] T138 [P] Testar manualmente os 4 cenários críticos de validação descritos em [quickstart.md §5](./quickstart.md) no navegador, incluindo dark mode em breakpoints mobile (< 640px) e desktop.
- [ ] T139 [P] Adicionar verificação de a11y básica nos novos modais/popovers (focus trap, ARIA labels, navegação por teclado) — validado via axe em testes e2e selecionados.
- [ ] T140 Atualizar [CLAUDE.md](../../CLAUDE.md) se aparecerem novas convenções que mereçam documentação compartilhada (ex: padrão de soft-delete/desarquive, padrão de recomputação transacional).
- [ ] T141 Executar auto-review de acordo com o checklist do [plan.md §Self-Review](./plan.md) e adicionar `self-review.md` ao feature directory (seguindo o padrão da feature 019).
- [ ] T142 [P] Consolidar o checklist [checklists/requirements.md](./checklists/requirements.md) marcando todos os itens validados após implementação.
- [ ] T142a [P] Rodar `bun run test:unit -- --coverage` e validar que a cobertura de [src/lib/domain/book-status.ts](../../src/lib/domain/book-status.ts) e [src/lib/domain/chapter-state-machine.ts](../../src/lib/domain/chapter-state-machine.ts) é **100%** (SC-010); cobertura geral dos arquivos da feature ≥ 80%. Se menor, preencher gaps antes do Final Gate.
- [ ] T142b [P] Adicionar ao spec E2E de `/studios` (novo arquivo [__tests__/e2e/derived-columns-perf.spec.ts](../../__tests__/e2e/derived-columns-perf.spec.ts) **ou** estender [__tests__/e2e/derived-columns.spec.ts](../../__tests__/e2e/derived-columns.spec.ts)) uma validação rudimentar de SC-011: seed 50 estúdios × 10 livros cada, medir tempo de `GET /api/v1/studios` via `performance.now()` e falhar se o overhead do `COUNT` exceder 100ms versus uma requisição sem join. Documentar o número real em [quickstart.md §5](./quickstart.md).
- [ ] T142c [P] Adicionar em [__tests__/integration/api-error-responses.spec.ts](../../__tests__/integration/api-error-responses.spec.ts) (novo) três asserts de regressão para FR-017: disparar um erro 422/409/500 em rotas desta feature e confirmar que o corpo **não contém** nenhum dos padrões `Error:`, `at /`, `    at `, `sql:`, ou `postgres://` — garantindo que stack traces e mensagens SQL não vazam.

---

## Final Quality Gate (single, before PR)

Por Princípio XVI, rodar **uma única vez** antes do PR:

- [ ] T143 `bun run lint` — zero erros e zero warnings do Biome.
- [ ] T144 `bun run test:unit` — toda a suíte passando.
- [ ] T145 `bun run test:integration` — toda a suíte passando.
- [ ] T146 `bun run test:e2e` — toda a suíte (E2E é afetado por múltiplos fluxos desta feature).
- [ ] T147 `bun run build` — build de produção compila sem erros.
- [ ] T148 Abrir PR contra `main` via `/finish-task` ou `gh pr create`.

Se qualquer verificação falhar, a feature não está pronta — corrigir antes de prosseguir.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: sem dependências — pode começar imediatamente.
- **Phase 2 (Foundational)**: depende de Phase 1. **Bloqueia todas as user stories**.
- **Phase 3 (US1 — Listar livros)**: depende de Phase 2.
- **Phase 4 (US2 — Criar livro)**: depende de Phase 2 (pode começar em paralelo com Phase 3).
- **Phase 5 (US4 — Detalhes)**: depende de Phase 2 (pode começar em paralelo com Phase 3/4, mas o E2E depende da navegação criada em Phase 3).
- **Phase 6 (US5 — Editar capítulo)**: depende de Phase 5 (precisa da tela de detalhes).
- **Phase 7 (US3 — Inline studio)**: depende de Phase 4 (precisa do modal de criação de livro).
- **Phase 8 (US6 — Excluir capítulo individual)**: depende de Phase 5 (precisa da tabela).
- **Phase 9 (US7 — Exclusão em lote)**: depende de Phase 5 (precisa da tabela). Pode ser paralela a Phase 8.
- **Phase 10 (US8 — Editar livro)**: depende de Phase 5 (precisa do cabeçalho). Pode ser paralela a Phases 8/9.
- **Phase 11 (US10)**: depende apenas de Phase 2 (foundational).
- **Phase 12 (US11)**: depende apenas de Phase 2. Paralela a Phase 11.
- **Phase 13 (US9 — PDF)**: depende de Phase 5 (precisa do cabeçalho).
- **Phase 14 (US12 — Colunas derivadas)**: depende de Phase 2 e da existência de livros/capítulos (Phases 4/5).
- **Phase 15 (Polish)**: depende de todas as stories que se deseja entregar.
- **Final Gate**: última coisa a rodar antes do PR.

### Parallel Opportunities

- Dentro da Foundational, T005/T006/T007 são paralelas (arquivos distintos); T014–T025 paralelizáveis por terem arquivos distintos.
- Unit tests (`[P]`) podem ser escritos em paralelo com in-memory fakes.
- Implementações de repositórios e services dentro de uma story que tocam arquivos distintos são paralelas.
- Com mais de um desenvolvedor: depois da Foundational, US1+US2+US4 podem avançar em paralelo, e depois US3+US5+US6+US7+US8 dividem-se entre pares.

### Within Each User Story

- TDD: testes sempre **antes** da implementação — devem falhar primeiro.
- Ordem dentro da story: domain → repositório → service → rota → UI → E2E.

---

## Parallel Example: User Story 1

```bash
# Testes em paralelo (diferentes arquivos, sem dependências):
Task: "Criar __tests__/unit/services/book-service.list.spec.ts"
Task: "Criar __tests__/integration/book-list.spec.ts"
Task: "Criar __tests__/e2e/books-list.spec.ts"

# Após testes, implementação em paralelo quando possível:
Task: "Criar src/components/features/books/books-table.tsx"
Task: "Criar src/components/features/books/books-client.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US4 + US5)

1. Completar Phase 1 (Setup) + Phase 2 (Foundational).
2. Entregar Phase 3 (US1 — listar) + Phase 4 (US2 — criar) + Phase 5 (US4 — detalhes) + Phase 6 (US5 — editar capítulo).
3. **PAUSAR E VALIDAR**: produtor já consegue criar livros, ver detalhes e editar capítulos individualmente — loop operacional básico completo.
4. Deploy/demo se pronto.

### Incremental Delivery (P2 e P3)

1. Adicionar Phase 7 (US3 — inline studio) — acelera criação.
2. Adicionar Phases 8+9 (US6 + US7 — exclusões) — permite correção.
3. Adicionar Phase 10 (US8 — editar livro).
4. Adicionar Phases 11+12 (US10+US11 — soft-delete constraints) — maturidade.
5. Adicionar Phase 13 (US9 — PDF).
6. Adicionar Phase 14 (US12 — colunas derivadas).
7. Rodar Phase 15 (polish) + Final Gate.

### Parallel Team Strategy

Com 2 devs após Foundational:

- Dev A: US1 → US4 → US5 → US8 → US9.
- Dev B: US2 → US3 → US6 → US7 → US12.
- US10 e US11 (independings, backend-heavy): ficam para quem terminar antes; paralelizáveis.

---

## Notes

- Todas as mutações multi-tabela DEVEM estar em transação (Princípio XI).
- `recomputeBookStatus` é invocado **sempre** na mesma transação após qualquer mudança em capítulo (criar, editar, excluir, bulk-delete, aumentar capítulos).
- KPI 4 ("Minutagem média por capítulo" — Princípio XIII v2.13.0) é calculado on-read a partir de `AVG(chapter.edited_seconds) / 60` nos capítulos com status ∈ {`reviewing`, `retake`, `completed`, `paid`}. Nenhum campo dedicado é necessário — a feature 020 já coleta `edited_seconds` em US5 e é suficiente para alimentar o KPI em feature futura.
- `paid` **não é terminal absoluto**: reversão `paid → completed` é a única exceção, exigindo flag `confirmReversion: true` no backend + `<AlertDialog>` na UI.
- Soft-delete unificado (estúdio, narrador, editor): o UI NUNCA hard-deleta. Hard-delete fica para manutenção manual em banco.
- Desarquive automático por colisão de nome é implementado nos `*-Service.create()`: ao detectar soft-deleted, reativa em vez de retornar 409 — resposta `200 OK` com `meta.reactivated: true`.
- Princípio XV: antes de usar APIs específicas de lib (Drizzle transactions, RHF, shadcn Dialog/AlertDialog/Popover), consultar Context7 MCP.
- Qualidade: rodar apenas os testes da mudança atual durante a implementação; gate completo só na Phase 15/Final.
