---

description: "Task list for feature 026 — chapter titles, reordering, and extra-chapter templates"
---

# Tasks: Chapter titles, reordering, and extra-chapter templates

**Input**: Design documents from `/specs/026-chapter-titles-reordering/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED. TDD é mandatório pelo Princípio V da constituição. Toda task de implementação tem task de teste correspondente que DEVE falhar antes da implementação (RED → GREEN → REFACTOR).

**Organization**: Tasks são agrupadas por user story (US1, US2, US3) após uma fase Foundational obrigatória. Foundational é não-negociável: contém a migration, refatoração dos pontos que ainda usam `chapter.number`, helpers e tipos. Sem ela, nenhuma das três stories é implementável.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência entre si).
- **[Story]**: US1 / US2 / US3 para tasks de story; sem rótulo em Setup / Foundational / Polish.

## Path Conventions

Single-project web app (Next.js App Router): `src/`, `__tests__/`, `drizzle/migrations/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: instalar dependências novas e preparar terreno.

- [X] T001 Adicionar `@dnd-kit/core` ^6.x, `@dnd-kit/sortable` ^8.x, `@dnd-kit/utilities` ^3.x ao `package.json` via `bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` e atualizar `bun.lockb`.
- [X] T002 [P] Verificar via Context7 MCP a API atual de `@dnd-kit/sortable` (sensores keyboard + `verticalListSortingStrategy`) e registrar trechos canônicos como referência em `specs/026-chapter-titles-reordering/research.md` no item R-006 (apenas se a API diferir do documentado).
- [X] T003 [P] Consultar `design.pen` via `mcp__pencil__open_document` + `mcp__pencil__get_screenshot` para drag handle, botões ↑/↓ e dialog "+ Adicionar capítulo"; salvar referência visual interna (não persistir no repo).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: migration + camada de dados + helpers + refatoração dos call-sites de `chapter.number`. Após esta fase, todo capítulo existente continua funcionando exibindo `title="Capítulo N"` e `position=N-1`, e a base está pronta para as três histórias.

**⚠️ CRITICAL**: nenhuma user story pode começar antes de esta fase ficar verde (lint + test:unit + test:integration passando).

### Migration e schema

- [X] T004 Atualizar `src/lib/db/schema/chapter.ts`: remover coluna `number` e índice `chapter_book_number_unique`; adicionar `title: text` (NOT NULL), `position: integer` (NOT NULL); adicionar índice `chapter_book_position_idx (book_id, position)` e checks (`chapter_title_length`, `chapter_title_no_newline`, `chapter_position_nonnegative`). **Não** declarar o unique `(book_id, position)` aqui — será adicionado via SQL editado manualmente (DEFERRABLE).
- [X] T005 Atualizar `src/lib/db/schema/book.ts`: adicionar coluna `chaptersVersion: integer` (NOT NULL, default 0).
- [X] T006 Rodar `bun run db:generate` para gerar `drizzle/migrations/0008_chapter_title_position_book_version.sql`. **Editar o SQL gerado** para: (i) adicionar `title`/`position` como nullable inicialmente, fazer backfill (`title = 'Capítulo ' || number::text`, `position = row_number() over (partition by book_id order by number) - 1`), depois setar NOT NULL; (ii) adicionar `ALTER TABLE chapter ADD CONSTRAINT chapter_book_position_unique UNIQUE (book_id, position) DEFERRABLE INITIALLY DEFERRED;` (não usar `CREATE UNIQUE INDEX`); (iii) remover `number` e seus constraints; (iv) confirmar `book.chapters_version` com default 0. Conferir contra o SQL canônico em `research.md § R-008`.
- [X] T007 Aplicar migration: `bun run db:migrate` em ambiente local de desenvolvimento; verificar via `psql` que `\d+ chapter` mostra `title`, `position`, constraint DEFERRABLE, sem `number`.

### Domain types e helpers (TDD)

- [X] T008 [P] Escrever testes em `__tests__/unit/lib/domain/chapter-title.spec.ts` cobrindo `validateChapterTitle` (vazio → `empty`, > 100 chars → `too_long`, com `\n`/`\r` → `has_newline`, válido → `{ ok: true, value: trimmed }`, trim de espaços externos) e `normalizeChapterTitle` (trim). Os testes DEVEM falhar antes da implementação.
- [X] T009 [P] Escrever testes em `__tests__/unit/lib/domain/next-chapter-title.spec.ts` cobrindo lista vazia → `"Capítulo 1"`, sequência contígua → `"Capítulo {max+1}"`, mistura com templates ignorados, regex estrito (rejeita `"Capitulo 1"` sem acento, `"Capítulo  1"` com 2 espaços), número grande (`"Capítulo 9999"` → `"Capítulo 10000"`).
- [X] T010 [P] Escrever testes em `__tests__/unit/lib/domain/normalize-positions.spec.ts` para `densifyPositions`: lista vazia → `[]`, n=1 → `[{ id, position: 0 }]`, lista ordenada preserva ordem, positions são `0..N-1`, campos extras preservados pelo tipo genérico.
- [X] T011 Criar `src/lib/domain/chapter-title.ts` com `CHAPTER_TITLE_MAX = 100`, `normalizeChapterTitle`, `validateChapterTitle` conforme contrato em `data-model.md`. Rodar T008 — deve passar.
- [X] T012 [P] Criar `src/lib/domain/next-chapter-title.ts` conforme `contracts/lib-next-chapter-title.md`. Rodar T009 — deve passar.
- [X] T013 [P] Criar `src/lib/domain/normalize-positions.ts` conforme `contracts/lib-normalize-positions.md`. Rodar T010 — deve passar.
- [X] T014 [P] Criar `src/lib/domain/chapter-templates.ts` conforme `contracts/lib-chapter-templates.md` (constante `CHAPTER_TEMPLATES`, tipos `ChapterTemplateKey`, `CHAPTER_TEMPLATE_KEYS`).
- [X] T015 Atualizar `src/lib/domain/chapter.ts`: remover `number` do tipo `Chapter`, adicionar `title: string` e `position: number`; estender `PAID_LOCKED_FIELDS` para incluir `"title"`.
- [X] T016 Atualizar `src/lib/domain/book.ts`: adicionar `chaptersVersion: number` ao tipo `Book`.

### Error catalog (TDD)

- [X] T017 [P] Escrever testes em `__tests__/unit/lib/api/error-codes.spec.ts` (ou estender existente) garantindo: `CHAPTER_TITLE_INVALID` (422, mensagem PT-BR específica); `CHAPTER_POSITION_TARGET_INVALID` (422); `CHAPTERS_ORDER_MISMATCH` (422); `BOOK_CHAPTERS_VERSION_CONFLICT` (409); ausência de `CHAPTER_NUMBER_ALREADY_IN_USE`; nova mensagem de `CHAPTER_PAID_LOCKED` incluindo "título".
- [X] T018 Atualizar `src/lib/api/error-codes/chapter.ts`: remover `CHAPTER_NUMBER_ALREADY_IN_USE`; alterar mensagem de `CHAPTER_PAID_LOCKED` para incluir "título"; adicionar `CHAPTER_TITLE_INVALID`, `CHAPTER_POSITION_TARGET_INVALID`, `CHAPTERS_ORDER_MISMATCH` (todos conforme `research.md § R-010`).
- [X] T019 Atualizar `src/lib/api/error-codes/book.ts`: adicionar `BOOK_CHAPTERS_VERSION_CONFLICT` (409). Rodar T017 — deve passar.
- [X] T020 [P] Criar `src/lib/errors/chapter-errors.ts` (extensão): adicionar classe `ChapterTitleInvalidError extends DomainError` com code `CHAPTER_TITLE_INVALID`; classe `ChapterPositionTargetInvalidError` com code `CHAPTER_POSITION_TARGET_INVALID`; classe `ChaptersOrderMismatchError` com code `CHAPTERS_ORDER_MISMATCH`; remover `ChapterNumberAlreadyInUseError` se existir.
- [X] T021 [P] Criar `src/lib/errors/book-errors.ts` (extensão): adicionar classe `BookChaptersVersionConflictError` com code `BOOK_CHAPTERS_VERSION_CONFLICT`.

### Repository layer (integration TDD)

- [X] T022 [P] Escrever teste de integração em `__tests__/integration/repositories/drizzle-chapter-title-position.spec.ts`: inserir capítulos com `title` e `position`; verificar persistência; `listByBookId` retorna ordenado por `position ASC`; CHECK constraints rejeitam título > 100 chars, com `\n`, position negativa.
- [X] T023 Atualizar `src/lib/repositories/chapter-repository.ts` (interface/port): `InsertChapterRow` agora exige `title` e `position` no lugar de `number`; `UpdateChapterRow` aceita `title` e `position` opcionais. Adicionar método `reorder(bookId, pairs, tx?)` à interface.
- [X] T024 Atualizar `src/lib/repositories/drizzle/drizzle-chapter-repository.ts`: implementar insert com `title`/`position`; `listByBookId` usa `ORDER BY position ASC`; mapeamento de row Drizzle → Chapter inclui `title`/`position`. Rodar T022 — deve passar.
- [X] T025 [P] Escrever teste de integração em `__tests__/integration/repositories/drizzle-book-chapters-version.spec.ts`: `bumpChaptersVersion(bookId)` retorna `currentVersion + 1`; concorrência simples (duas chamadas seriais bumpam para `+1` e `+2`).
- [X] T026 Atualizar `src/lib/repositories/book-repository.ts` (interface): adicionar `bumpChaptersVersion(bookId, tx?)` retornando `Promise<number>`; `BookSummary` e `Book` retornam `chaptersVersion`.
- [X] T027 Atualizar `src/lib/repositories/drizzle/drizzle-book-repository.ts`: implementar `bumpChaptersVersion` (`UPDATE book SET chapters_version = chapters_version + 1 WHERE id = $1 RETURNING chapters_version`); incluir `chaptersVersion` em todos os SELECTs (sem `SELECT *`). Rodar T025 — deve passar.

### Service infra: bump version no recompute

- [X] T028 Atualizar `src/lib/services/book-status-recompute.ts`: renomear/estender para `recomputeBookStatusAndBumpVersion(bookId, deps, tx)` — faz `SELECT chapters` (já existente para status), calcula novo status, e executa `UPDATE book SET status = $1, chapters_version = chapters_version + 1 WHERE id = $2 RETURNING ...` em uma única instrução. Manter export do nome antigo como alias deprecated SOMENTE durante a fase de refactor (remover no Polish).

### Refatorar call-sites existentes (sem alterar comportamento ainda — só renomear)

- [X] T029 [P] Atualizar `src/lib/services/chapter-service.ts`: substituir referências a `chapter.number` por `chapter.title` em logs/mensagens (não há lógica que dependa de number neste arquivo hoje); atualizar `PAID_LOCKED_FIELDS` local para incluir `"title"`; usar `recomputeBookStatusAndBumpVersion` no lugar de `recomputeBookStatus` em `update`, `delete`, `bulkDelete`.
- [X] T030 Atualizar `src/lib/services/book-service.ts`: no método `create`, substituir geração `{ number: index + 1 }` por `{ title: nextChapterTitle(previousTitles), position: index }` usando `nextChapterTitle` + `densifyPositions`. Trocar `recomputeBookStatus` → `recomputeBookStatusAndBumpVersion`. **Não** mudar a interface do service ainda (manter assinatura atual; a estrutura `chapters: { numbered, extras }` chega em US3).
- [X] T031 [P] Atualizar `src/components/features/chapters/chapters-table.tsx`, `chapter-row.tsx`, `chapter-group-row.tsx`, `chapter-row-edit-mode.tsx`: trocar exibição de `chapter.number` por `chapter.title` (já preenchido pelo backfill); manter UI igual.
- [X] T032 [P] Atualizar `src/components/features/books/book-detail-client.tsx`, `book-create-dialog.tsx`, `book-edit-dialog.tsx`: substituir todas as referências a `chapter.number` em props/types pelo novo formato; nenhum comportamento muda nesta fase (UI continua com o campo numChapters no edit — removido em US3).
- [X] T033 [P] Atualizar `src/lib/services/book-service.ts` tipos `BookChapterDetail` para expor `title` e `position` no lugar de `number`. Atualizar consumers (`book-detail-client`, etc.) para usar os novos campos.
- [X] T034 [P] Atualizar testes existentes em `__tests__/integration/services/book-service*.spec.ts` e `chapter-service*.spec.ts` que assertam `number`: substituir por asserções de `title` e `position`. Sem alterar comportamento, apenas o nome dos campos verificados.
- [X] T035 [P] Atualizar testes existentes em `__tests__/integration/repositories/drizzle-chapter*.spec.ts` que inserem capítulos: passar `title` + `position` no lugar de `number`.
- [X] T036 Rodar `bun run test:unit && bun run test:integration` e garantir verde antes de avançar para qualquer user story. Resolver eventuais imports quebrados pela remoção de `number`.

### Schema Zod base (compartilhado por US1 e US3)

- [X] T037 [P] Escrever testes em `__tests__/unit/lib/schemas/chapter-title-base.spec.ts`: helper compartilhado `chapterTitleSchema` aplica trim, rejeita vazio, > 100 chars, `\n`/`\r`. (Helper a ser criado nos arquivos de schemas existentes — esta task é apenas o teste.)

**Checkpoint Foundational**: schema migrado, banco atualizado, todos os call-sites existentes refatorados, testes unit+integration verdes. Os capítulos legados aparecem como `Capítulo 1..N` na UI e o sistema funciona exatamente como antes. Nenhuma capacidade nova foi entregue ainda.

---

## Phase 3: User Story 1 — Título como identidade do capítulo (Priority: P1) 🎯 MVP

**Goal**: permitir que o operador edite o `title` de qualquer capítulo (não `paid`) via UI e API, com validação correta e respeitando `PAID_LOCKED_FIELDS`.

**Independent Test**: editar via UI o título de um capítulo de "Capítulo 1" para "Abertura", recarregar a página, ver "Abertura"; tentar editar título de um `paid` deve dar erro 409. Validado sem reorder e sem add-chapter.

### Tests for US1 (RED first)

- [X] T038 [P] [US1] Escrever teste unit em `__tests__/unit/lib/schemas/update-chapter.spec.ts` (estender existente): `title` aceita 1..100 chars; trim aplicado; rejeita vazio, > 100, com `\n`/`\r`; mensagens PT-BR conforme catálogo.
- [X] T039 [P] [US1] Escrever teste integration em `__tests__/integration/services/chapter-service-title.spec.ts`: `chapterService.update(id, { title: "Abertura" })` em capítulo `pending` atualiza e bumpa `chaptersVersion`; em capítulo `paid` lança `ChapterPaidLockedError`; title com `\n` lança `ChapterTitleInvalidError`; trim aplicado antes de persistir.
- [X] T040 [P] [US1] Escrever teste unit em `__tests__/unit/components/features/chapters/hooks/use-chapter-row-edit.spec.tsx` (estender): formulário aceita `title`; submit envia `title`; ZodError em vazio bloqueia submit; campo desabilitado quando `chapter.status === "paid"`.

### Implementation for US1

- [X] T041 [US1] Atualizar `src/lib/schemas/chapter.ts`: adicionar `chapterTitleSchema` (z.string trim → refine no length, newline, empty); incluir `title: chapterTitleSchema.optional()` em `updateChapterSchema`. Atualizar `UpdateChapterInput` por inferência. Rodar T038 — deve passar.
- [X] T042 [US1] Atualizar `UpdateChapterServiceInput` em `src/lib/services/chapter-service.ts` para aceitar `title?: string`; na execução, passar `title` ao `chapterRepo.update`; trim aplicado pelo schema antes de chegar. Rodar T039 — deve passar.
- [X] T043 [US1] Atualizar `src/app/api/v1/chapters/[id]/route.ts`: route handler PATCH já usa `withApiErrorHandler` + `updateChapterSchema`; verificar que `title` passa adiante. Incluir `chaptersVersion` no envelope de resposta. Atualizar testes da rota em `__tests__/integration/api/chapter-update.spec.ts` (se existir; criar se não).
- [X] T044 [US1] Atualizar `src/components/features/chapters/chapter-row-edit-mode.tsx`: adicionar `<Input>` para `title` no topo do form (ou em posição alinhada com o cabeçalho da tabela). Desabilitado quando `chapter.status === "paid"`. Mensagem inline de validação quando inválido.
- [X] T045 [US1] Atualizar `src/components/features/chapters/hooks/use-chapter-row-edit.ts`: adicionar campo `title` ao schema do form (Zod) reutilizando `chapterTitleSchema`; default = `chapter.title`; incluir `title` no payload do `apiFetch`. Rodar T040 — deve passar.
- [X] T046 [P] [US1] Atualizar `src/components/features/chapters/chapter-row.tsx` (modo leitura) para exibir `chapter.title` com truncate (`max-w-[40ch]` + `truncate`) e `<Tooltip>` se exceder.
- [X] T047 [P] [US1] Atualizar `src/components/features/chapters/chapter-group-row.tsx` (feature 024): linhas dentro de grupos exibem `title` (em vez de `Capítulo {number}`); ordenação dentro do grupo passa a ser por `position` ASC.
- [X] T048 [P] [US1] Escrever E2E em `__tests__/e2e/chapter-title-edit.spec.ts`: login, navegar a `/books/<id>`, entrar em modo edição de uma linha, alterar título para "Abertura", salvar, verificar persistência após reload; verificar bloqueio em capítulo `paid`.

**Checkpoint US1**: operador consegue renomear capítulos via UI e API, com bloqueio em `paid`. Toda a tabela, agrupamentos e foco da semana exibem `title`. MVP entregável.

---

## Phase 4: User Story 2 — Reordenar capítulos (Priority: P2)

**Goal**: permitir que o operador reordene capítulos via drag-and-drop **ou** botões ↑/↓ em qualquer status (inclusive `paid`), com atomicidade e detecção de conflito concorrente.

**Independent Test**: arrastar capítulo da posição 3 para a posição 0, recarregar, ver a nova ordem persistida; teclado equivalente; conflito 409 simulável; nenhum dado financeiro alterado.

### Tests for US2 (RED first)

- [X] T049 [P] [US2] Escrever teste unit em `__tests__/unit/lib/schemas/reorder-chapters.spec.ts`: `reorderChaptersSchema` aceita array de uuids sem duplicatas; rejeita vazio, com duplicatas, com itens não-uuid; `expectedVersion` inteiro não-negativo obrigatório.
- [X] T050 [P] [US2] Escrever teste integration em `__tests__/integration/repositories/drizzle-chapter-reorder.spec.ts`: `chapterRepo.reorder(bookId, pairs, tx)` aplica todas as positions em uma transação; DEFERRABLE permite permutações; densidade `0..N-1` preservada; teste com 50 itens.
- [X] T051 [P] [US2] Escrever teste integration em `__tests__/integration/services/chapter-service-reorder.spec.ts`: `reorder(bookId, orderedIds, expectedVersion)` atualiza posições, bumpa `chaptersVersion`, retorna `{ chaptersVersion: newValue }`; com `expectedVersion` desatualizada → `BookChaptersVersionConflictError`; com `orderedIds` faltando capítulos do livro → `ChaptersOrderMismatchError`; livro com capítulo `paid` permite reorder; campos do capítulo `paid` permanecem inalterados (snapshot before/after).
- [X] T052 [P] [US2] Escrever teste unit em `__tests__/unit/components/features/chapters/hooks/use-chapters-reorder.spec.tsx`: hook aplica nova ordem otimisticamente; em sucesso atualiza `chaptersVersion` local; em erro 409 reverte e mostra toast (`apiFetch` mockado); `moveBy(id, delta)` faz o equivalente de drag.

### Implementation for US2

- [X] T053 [US2] Adicionar `reorderChaptersSchema` em `src/lib/schemas/chapter.ts` conforme `data-model.md`. Rodar T049 — deve passar.
- [X] T054 [US2] Implementar `ChapterRepository.reorder(bookId, pairs, tx)` em `src/lib/repositories/drizzle/drizzle-chapter-repository.ts`: dentro de uma transação, executar `UPDATE chapter SET position = $1 WHERE id = $2 AND book_id = $3` para cada par. Rodar T050 — deve passar.
- [X] T055 [US2] Implementar `ChapterService.reorder(bookId, orderedIds, expectedVersion)` em `src/lib/services/chapter-service.ts`: lock `book` (`FOR UPDATE`), comparar `expectedVersion` com `chapters_version` corrente (→ `BookChaptersVersionConflictError` se diferente), comparar conjunto de IDs com `listByBookId(bookId, tx)` (→ `ChaptersOrderMismatchError` se diferente), converter `orderedIds` em pares via `densifyPositions`, chamar `chapterRepo.reorder`, chamar `recomputeBookStatusAndBumpVersion`, retornar novo `chaptersVersion`. Rodar T051 — deve passar.
- [X] T056 [US2] Criar `src/app/api/v1/books/[id]/chapters/order/route.ts`: handler `PUT` envolvido em `withApiErrorHandler`, parseia body via `reorderChaptersSchema`, valida `params.id` via `bookIdParamsSchema`, chama `chapterService.reorder`, retorna 200 com `{ data: { chaptersVersion } }`. Conferir contrato em `contracts/api-chapters-order.md`.
- [X] T057 [US2] Criar `src/components/features/chapters/hooks/use-chapters-reorder.ts` conforme `contracts/ui-chapters-sortable-table.md`: gerencia estado da ordem (otimista); expõe `orderedChapters`, `apply(newOrderedIds)`, `moveBy(chapterId, delta)`; chama `apiFetch<{chaptersVersion}>` para `PUT /api/v1/books/:bookId/chapters/order`; em erro reverte e dispara toast via `apiFetch`. Rodar T052 — deve passar.
- [X] T058 [US2] Atualizar `src/components/features/chapters/chapters-table.tsx`: envolver as linhas em `<DndContext>` + `<SortableContext items={chapterIds} strategy={verticalListSortingStrategy}>`; passar `orderedChapters` do hook; tratar `onDragEnd` chamando `apply(newOrder)`. Manter `<DragOverlay>` para clone visual.
- [X] T059 [US2] Atualizar `src/components/features/chapters/chapter-row.tsx`: usar `useSortable({ id: chapter.id })`; adicionar drag handle (`<GripVertical />` de `lucide-react`) à esquerda; adicionar botões `<Button size="icon" variant="ghost">` para ↑ e ↓ chamando `useChaptersReorder().moveBy(chapter.id, ±1)`. Atributos `aria-label` PT-BR. Estados disabled nas extremidades.
- [X] T060 [P] [US2] Atualizar `src/components/features/chapters/hooks/use-chapters-table.ts`: integrar `useChaptersReorder` ao fluxo; expor `orderedChapters` para render; preservar lógica existente de agrupamento (feature 024) operando sobre `orderedChapters`.
- [ ] T061 [P] [US2] Escrever E2E em `__tests__/e2e/chapter-reorder.spec.ts`: cenário 3 (drag), cenário 4 (teclado: tab → space → setas → space), cenário 5 (botões em mobile via touch), cenário 6 (reorder com capítulo `paid` — invariantes preservadas após reload); cenário de conflito 409 forçando `expectedVersion` antigo via `request.fetch`.

**Checkpoint US2**: operador reordena capítulos por mouse, teclado e botões, em qualquer status. Conflito concorrente detectado. Dados financeiros intocados.

---

## Phase 5: User Story 3 — Adicionar capítulos (numerado / template / personalizado) (Priority: P3)

**Goal**: substituir o caminho implícito (`numChapters` no edit) por um botão "+ Adicionar capítulo" na página de detalhe; criar capítulos numerados, via template ou personalizados; criação de livro também aceita seção de extras.

**Independent Test**: clicar "+ Adicionar capítulo" no detalhe, escolher Prólogo (start) → capítulo aparece em `position=0`; criar livro novo com 5 numerados + Prólogo + Epílogo → 7 capítulos na ordem certa; campo `Capítulos` no diálogo de edição desapareceu.

### Tests for US3 (RED first)

- [ ] T062 [P] [US3] Escrever teste unit em `__tests__/unit/lib/schemas/create-chapter.spec.ts`: `createChapterSchema` aceita `position: "start" | "end" | { after: uuid }`; `title` reusa `chapterTitleSchema`; `expectedVersion` int não-negativo.
- [ ] T063 [P] [US3] Escrever teste unit em `__tests__/unit/lib/schemas/create-book.spec.ts` (estender): `createBookSchema` aceita `chapters: { numbered, extras }` discriminated union; rejeita `numbered + extras.length == 0`; aceita extras `template` e `custom`; rejeita campo `numChapters` legado.
- [ ] T064 [P] [US3] Escrever teste integration em `__tests__/integration/services/chapter-service-create.spec.ts`: `create(bookId, { title, position: "start", expectedVersion })` insere em position 0 e empurra demais em +1; `position: "end"` insere em `max+1`; `position: { after: id }` insere logo após o id alvo; `after` inválido → `ChapterPositionTargetInvalidError`; `expectedVersion` desatualizada → `BookChaptersVersionConflictError`; bumpa `chaptersVersion` no sucesso; recompute `book.status` em mesma transação.
- [ ] T065 [P] [US3] Escrever teste integration em `__tests__/integration/services/book-service-create-with-extras.spec.ts`: criar livro com `numbered=3`, extras `[start:Prologue, end:Epilogue]` → 5 capítulos na ordem `[Prólogo, Capítulo 1, Capítulo 2, Capítulo 3, Epílogo]` com positions densas; `numbered=0` + apenas extras → livro válido; ambos zero → 422; failure em qualquer parte → rollback total.
- [ ] T066 [P] [US3] Escrever teste unit em `__tests__/unit/components/features/chapters/hooks/use-add-chapter.spec.tsx`: hook valida title via Zod; submit chama `apiFetch<{chapter, chaptersVersion, bookStatus}>`; 409 dispara toast + revalida (callback fornecido); 422 mostra erro no form; preenche sugestão de título via `nextChapterTitle`.

### Implementation for US3 — backend

- [ ] T067 [US3] Adicionar `createChapterSchema` em `src/lib/schemas/chapter.ts` conforme `data-model.md` (discriminated union para position). Rodar T062 — deve passar.
- [ ] T068 [US3] Atualizar `src/lib/schemas/book.ts`: substituir `numChapters` por `chapters: { numbered, extras }` em `createBookSchema`; remover `numChapters` de `updateBookSchema` (configurar Zod em modo `strict` se necessário para rejeitar a key); usar `z.enum(CHAPTER_TEMPLATE_KEYS)` e `chapterTitleSchema` no discriminated union. Rodar T063 — deve passar.
- [ ] T069 [US3] Implementar `ChapterService.create(bookId, input)` em `src/lib/services/chapter-service.ts`: dentro de transação, lock `book` para `expectedVersion`, listar capítulos atuais, calcular `position` alvo (resolvendo `start`/`end`/`after`), inserir novo capítulo via `chapterRepo.insertMany([{ bookId, title, position, status: "pending" }])` e atualizar positions dos demais via `chapterRepo.reorder` para densificar, chamar `recomputeBookStatusAndBumpVersion`, retornar `{ chapter, bookStatus, chaptersVersion }`. Rodar T064 — deve passar.
- [ ] T070 [US3] Atualizar `BookService.create` em `src/lib/services/book-service.ts`: trocar input `numChapters` por `chapters: { numbered, extras }`; gerar lista atômica de capítulos (resolver template → `defaultTitle`; aplicar ordem `start` × `end`; densificar positions via `densifyPositions`); inserir todos via `chapterRepo.insertMany`; recomputar status (chapter_version já nasce 0). Rodar T065 — deve passar.
- [ ] T071 [US3] Atualizar `BookService.update`: remover toda lógica de `numChapters` (criação implícita de capítulos extras). PATCH agora só edita atributos do livro. Atualizar testes em `__tests__/integration/services/book-service-update.spec.ts` para cobrir.
- [ ] T072 [US3] Criar `src/app/api/v1/books/[id]/chapters/route.ts`: handler `POST` envolvido em `withApiErrorHandler`, parseia body via `createChapterSchema`, chama `chapterService.create`, retorna 201 com `{ data: { chapter, bookStatus, chaptersVersion } }`. Conferir contrato em `contracts/api-chapters-create.md`.
- [ ] T073 [US3] Atualizar `src/app/api/v1/books/route.ts` (POST) e `src/app/api/v1/books/[id]/route.ts` (PATCH) para o novo formato de body. Atualizar testes integration `__tests__/integration/api/book-create.spec.ts` e `book-update.spec.ts`.

### Implementation for US3 — frontend

- [ ] T074 [US3] Criar `src/components/features/chapters/hooks/use-add-chapter.ts` conforme `contracts/ui-add-chapter-dialog.md`: form com Zod (`createChapterSchema`-compatible), default title via `nextChapterTitle`, mutação via `apiFetch`. Em 409, chama `onConflict()` para revalidar e fecha dialog. Rodar T066 — deve passar.
- [ ] T075 [US3] Criar `src/components/features/chapters/add-chapter-dialog.tsx` conforme contrato: radio "tipo" (numerado / templates / personalizado), `<Input>` para título (pré-preenchido), radio "posição" (start / end / `<Select>` after-which), botão "Adicionar". Apenas JSX + chamada de hook.
- [ ] T076 [US3] Atualizar `src/components/features/books/book-detail-client.tsx`: adicionar botão `"+ Adicionar capítulo"` (texto PT-BR) acima ou ao lado da tabela; abre `<AddChapterDialog>` com `book` + `existingChapters`. Coordenar refetch após sucesso/conflito.
- [ ] T077 [US3] Criar `src/components/features/books/book-extras-input.tsx` conforme `contracts/ui-book-create-extras-section.md`: lista controlada de extras com botões para adicionar template ou personalizado + reorder local via ↑/↓; valida title em `custom`; teto 20 extras.
- [ ] T078 [US3] Atualizar `src/components/features/books/book-create-dialog.tsx`: adicionar seção "Capítulos extras" abaixo do `<ChapterCountInput>`; integrar `<BookExtrasInput>` via `<Controller name="extras">`; submit envia `{ chapters: { numbered, extras } }` no formato novo.
- [ ] T079 [US3] Atualizar `src/components/features/books/hooks/use-create-book-form.ts`: substituir campo `numChapters` por `chapters: { numbered, extras }`; schema Zod alinhado com `createBookSchema`; default `numbered=0, extras=[]` (form-level requirement de pelo menos um capítulo).
- [ ] T080 [US3] Atualizar `src/components/features/books/book-edit-dialog.tsx`: **remover** o bloco `<Field>` do `<ChapterCountInput name="numChapters">` e o `<p data-testid="book-edit-chapters-reduce-hint">` (linhas atuais ~282-316). Verificar que `<ChapterCountInput>` continua importado **somente** pelo create-dialog.
- [ ] T081 [US3] Atualizar `src/components/features/books/hooks/use-edit-book-form.ts`: remover campo `numChapters` do schema, do default e do payload de submit. Atualizar testes existentes para refletir.
- [ ] T082 [P] [US3] Escrever E2E em `__tests__/e2e/chapter-add-and-extras.spec.ts`: (a) cenário 2 do quickstart (adicionar Prólogo via dialog na página de detalhe); (b) cenário 9 (criar livro novo com 5 numerados + Prólogo + Apresentação + Epílogo, verificar ordem `[Apresentação, Prólogo, Capítulo 1..5, Epílogo]`); (c) confirmar que diálogo de edição **não** tem mais campo "Capítulos"; (d) cenário 10 (próximo Capítulo N).

**Checkpoint US3**: criação atômica de livros com extras funciona; botão "+ Adicionar capítulo" na página de detalhe substitui o caminho implícito; diálogo de edição enxuto. Todas as três stories entregues.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: limpeza pós-stories, cobertura final, documentação e verificação.

- [ ] T083 [P] Remover alias deprecated `recomputeBookStatus` introduzido em T028; atualizar todos os imports para `recomputeBookStatusAndBumpVersion`.
- [ ] T084 [P] Atualizar `CLAUDE.md` na seção "Recent Changes" (topo) com entrada `026-chapter-titles-reordering: ...` listando: nova modelagem `title`/`position`, remoção de `number`, `book.chapters_version`, novo botão "+ Adicionar capítulo", remoção do `numChapters` no edit, dependências novas `@dnd-kit/*`. Atualizar seção "Active Technologies" com a entrada das novas deps.
- [ ] T085 [P] Atualizar `docs/error-handling.md` se documentar códigos de capítulo (verificar e estender).
- [ ] T086 Rodar `bun run lint` — zero erros e zero warnings.
- [ ] T087 Rodar `bun run test:unit` — todos verdes; cobertura ≥ 80% geral, 100% nos helpers puros (`chapter-title`, `next-chapter-title`, `normalize-positions`).
- [ ] T088 Rodar `bun run test:integration` — todos verdes; cobertura repositório/service ≥ 85%.
- [ ] T089 Rodar `bun run test:e2e` — todos verdes; suíte completa schema-per-worker.
- [ ] T090 Rodar `bun run build` — produção compila sem erros nem warnings.
- [ ] T091 Executar manualmente os 10 cenários de `quickstart.md` em ambiente local; documentar quaisquer divergências como issue separado.
- [ ] T092 [P] Self-review checklist (CLAUDE.md §"Self-Review antes de qualquer entrega") aplicada à PR: marcar cada item I–XVI, anexar à descrição da PR.

**Checkpoint final**: feature pronta para PR contra `main`. `/finish-task` invocável.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 antes de qualquer task que use `@dnd-kit`. T002/T003 podem rodar em paralelo a T001.
- **Phase 2 (Foundational)**: depende de Phase 1. Bloqueia toda Phase 3+. Subordem interna:
  - T004 → T005 → T006 → T007 (schema → SQL → migrate)
  - T008-T010 (testes) em paralelo, depois T011-T013 (impl) em paralelo
  - T014 [P] (templates)
  - T015 → T016 (domain types)
  - T017 → T018 → T019 (catálogo de erros)
  - T020 → T021 (errors classes) [P]
  - T022 → T023 → T024 (repo chapter)
  - T025 → T026 → T027 (repo book)
  - T028 (service infra) — depende de T027
  - T029-T035 (refactor) — todos [P], dependem de T015-T028
  - T036 (gate verde) — sequencial, último da fase
  - T037 (schema base) — pode rodar em paralelo a T036, mas concorda com T041

- **Phase 3 (US1)**: depende de Phase 2 completa (T036 verde). Subordem interna:
  - T038-T040 [P] (testes RED)
  - T041 → T042 → T043 (schema → service → route)
  - T044-T047 (UI) — paralelizável após T042
  - T048 (E2E) — último

- **Phase 4 (US2)**: depende de Phase 2. Pode rodar em paralelo com Phase 3 se houver equipe. Subordem:
  - T049-T052 [P] (testes RED)
  - T053 → T054 → T055 (schema → repo → service)
  - T056 (route) depois de T055
  - T057 → T058 → T059 → T060 (hook → table → row → integração) sequencial
  - T061 (E2E) — último

- **Phase 5 (US3)**: depende de Phase 2. Pode rodar em paralelo com Phase 3 e 4. Subordem:
  - T062-T066 [P] (testes RED)
  - T067 → T068 (schemas) [P]
  - T069, T070, T071 (services) — paralelizáveis (arquivos diferentes), mas todos dependem dos schemas
  - T072, T073 (routes) [P]
  - T074 → T075 → T076 (hook → dialog → integração) sequencial
  - T077 → T078 → T079 (extras input → create dialog → form hook) sequencial
  - T080 → T081 (edit dialog cleanup) sequencial
  - T082 (E2E) — último

- **Phase 6 (Polish)**: depende de todas as user stories desejadas. T083 só após nenhum caller usar o alias. T086-T090 sequenciais (lint → unit → integration → e2e → build).

### Within Each User Story

- Testes (RED) ANTES de implementação (GREEN). Princípio V não-negociável.
- Schema/types/repository ANTES de service.
- Service ANTES de route.
- Hook ANTES de componente.
- E2E POR ÚLTIMO, valida ponta-a-ponta.

### Parallel Opportunities

- **Phase 1**: T002 + T003 em paralelo a T001.
- **Phase 2**: todos os testes (T008/T009/T010/T017/T022/T025/T037) podem ser escritos em paralelo. Após escritos, todas as impl marcadas [P] (T011/T012/T013/T014/T020/T021/T029/T031/T032/T033/T034/T035) em paralelo.
- **Phase 3**: T038/T039/T040 em paralelo (arquivos diferentes); T044/T046/T047 em paralelo após T045.
- **Phase 4**: T049/T050/T051/T052 em paralelo; T058/T060/T061 em paralelo após T057.
- **Phase 5**: T062/T063/T064/T065/T066 em paralelo; T067/T068 em paralelo; T072/T073 em paralelo; T078/T079 + T080/T081 em paralelo (cluster create vs cluster edit).
- **Phase 6**: T083/T084/T085/T092 em paralelo; T086-T090 sequenciais.

### Sequência sugerida com uma só pessoa

1. Phase 1 (3 tasks)
2. Phase 2 inteira (~34 tasks)
3. Phase 3 — entrega o MVP (US1)
4. Phase 4 — entrega reorder (US2)
5. Phase 5 — entrega add (US3)
6. Phase 6 — polish + PR

---

## Parallel Example: Foundational (Phase 2)

```bash
# Após T004→T005→T006→T007 (schema + migration aplicada), pode-se disparar em paralelo:
# Cluster A — testes RED puros (domain + schemas + errors)
Task: "Write tests in __tests__/unit/lib/domain/chapter-title.spec.ts"               # T008
Task: "Write tests in __tests__/unit/lib/domain/next-chapter-title.spec.ts"          # T009
Task: "Write tests in __tests__/unit/lib/domain/normalize-positions.spec.ts"         # T010
Task: "Write tests in __tests__/unit/lib/api/error-codes.spec.ts"                    # T017
Task: "Write tests in __tests__/unit/lib/schemas/chapter-title-base.spec.ts"         # T037

# Cluster B — testes RED de integration (repos)
Task: "Write integration test for drizzle-chapter-title-position"                    # T022
Task: "Write integration test for drizzle-book-chapters-version"                     # T025

# Após T011-T014 verdes, pode-se rodar em paralelo o cluster de refactor:
Task: "Refactor chapter-service.ts to use title + version-bumping recompute"         # T029
Task: "Refactor chapters-table, chapter-row, chapter-group-row to show title"        # T031
Task: "Refactor book-detail-client / book-create-dialog / book-edit-dialog typing"   # T032
Task: "Refactor BookChapterDetail types to use title/position"                       # T033
Task: "Refactor existing book/chapter service tests to assert title/position"        # T034
Task: "Refactor existing chapter repository tests to insert title/position"          # T035
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) — instalar deps, consultar Context7/design.pen.
2. Phase 2 (Foundational) — completa antes de tocar UI ou API.
3. Phase 3 (US1) — título editável + UI exibindo título.
4. **PARAR e VALIDAR**: cenários 1, 7 e 8 do `quickstart.md`.
5. Demo/deploy se desejado. Reorder e add ainda não existem; sistema funciona como hoje + título editável.

### Incremental Delivery

1. Setup + Foundational → fundação pronta (UI continua funcional, apenas exibindo título no lugar de número).
2. US1 (P1) → MVP da feature (entrega de valor já palpável).
3. US2 (P2) → ganho de produtividade na ordenação.
4. US3 (P3) → fluxo completo de criação simplificado; finaliza a feature.
5. Phase 6 → cleanup + verificação final + `/finish-task`.

### Parallel Team Strategy

Com 3 devs após Phase 2:

- Dev A: US1 inteira (T038-T048).
- Dev B: US2 inteira (T049-T061).
- Dev C: US3 inteira (T062-T082).

Integração natural — cada story toca arquivos diferentes (apenas `chapters-table.tsx` recebe contribuição de US2 e US1, com merge trivial). Phase 6 unificada no final.

---

## Notes

- [P] tasks = arquivos diferentes, sem dependência mútua.
- [Story] label conecta task à user story (US1/US2/US3); Setup/Foundational/Polish não têm story label.
- Cada user story deve ser independentemente entregável após Foundational completo.
- Verificar que testes falham antes de implementar (RED).
- Commitar a cada task ou grupo lógico (`feat(026):` para impl, `test(026):` para tests, `refactor(026):` para refactor, `chore(026):` para deps/migration).
- Parar em qualquer checkpoint para validar a story.
- Evitar: tasks vagas, conflitos de arquivo entre tasks [P], dependências cross-story que quebrem independência.
