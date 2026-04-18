---

description: "Task list for 018-editors-crud"
---

# Tasks: CRUD de Editores

**Input**: Design documents from `/specs/018-editors-crud/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/editors-api.md ✅, quickstart.md ✅

**Tests**: OBRIGATÓRIO por Princípio V da constituição (TDD). Cada task de teste é escrita para falhar antes da implementação correspondente.

**Organization**: Tasks agrupadas por user story (US1–US4) para permitir implementação e validação incremental. Phase 2 (Foundational) completa toda a stack backend antes das stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: US1, US2, US3, US4 (mapeia à user story da spec.md)

## Path Conventions

Monorepo Next.js em `src/` e testes em `__tests__/`. Paths absolutos no workspace `/Users/thiagomartins/dev/audio-book-track/`. Abreviações abaixo são relativas à raiz do repo.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificar que o ambiente de build/tests está saudável e que todos os primitivos shadcn/ui necessários já estão instalados.

- [X] T001 Verificar que os primitivos shadcn/ui necessários estão em `src/components/ui/`: `button`, `input`, `label`, `table`, `scroll-area`, `dialog`, `form`. Se algum faltar, rodar `bunx --bun shadcn@latest add <componente>`. Consultar `/shadcn` skill se houver dúvida.
- [X] T002 A rota `/editors` já está presente no menu lateral autenticado (validado pelo usuário) — nenhuma alteração de navegação necessária. `user_preference.favoritePage` já aceita `"editors"` ([src/lib/db/schema.ts](src/lib/db/schema.ts)). Consultar [src/app/(authenticated)/narrators/](src/app/(authenticated)/narrators/) para referência visual durante a implementação.
- [X] T003 Consultar `design.pen` via Pencil MCP (get_editor_state → batch_get patterns "editor", "editores") para confirmar paridade visual com `/narrators` ou identificar divergências. Registrar conclusão no próprio PR.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entregar a stack backend completa (schema → domain → repository → service → factory → errors → test helpers) antes de qualquer user story começar. Esta fase NÃO inclui rotas HTTP nem UI — apenas infra de domínio testada ponta a ponta contra banco real.

**⚠️ CRITICAL**: Nenhuma US pode começar antes desta fase fechar.

### Domínio e schema (ordem: schema → entidade → interfaces → erros)

- [X] T004 Adicionar tabela `editor` em [src/lib/db/schema.ts](src/lib/db/schema.ts) com `id` (PK text + `$defaultFn(crypto.randomUUID)`), `name` (text not null), `email` (text not null), `createdAt` e `updatedAt` (timestamptz com `defaultNow` e `$onUpdate`), mais dois `uniqueIndex`: `editor_name_unique` em `name` e `editor_email_unique` em `email`. Inserir logo após `narrator`. Referência: [data-model.md](specs/018-editors-crud/data-model.md).
- [X] T005 Gerar migração com `bun run db:generate` e aplicar com `bun run db:migrate`. Inspecionar o SQL gerado em `drizzle/000X_*.sql` — deve conter `CREATE TABLE "editor"` + os 2 `CREATE UNIQUE INDEX`. Atualizar `drizzle/meta/_journal.json` vem automaticamente.
- [X] T006 [P] Criar entidade e schemas Zod em [src/lib/domain/editor.ts](src/lib/domain/editor.ts): `interface Editor`, `editorFormSchema` (name trim 2–100, email trim 1–255 + `.email()`), `createEditorSchema`, `updateEditorSchema = editorFormSchema.partial()`, types inferidos. Referência: [data-model.md](specs/018-editors-crud/data-model.md) §Validações.
- [X] T007 [P] Criar interface `EditorRepository` em [src/lib/domain/editor-repository.ts](src/lib/domain/editor-repository.ts) com métodos `findAll`, `findById`, `findByName`, `findByEmail`, `create`, `update`, `delete`. Sem prefixo `I`. Arquivo separado da entidade (Princípio VI).
- [X] T008 [P] Criar classes de erro em [src/lib/errors/editor-errors.ts](src/lib/errors/editor-errors.ts): `EditorNameAlreadyInUseError`, `EditorEmailAlreadyInUseError`, `EditorNotFoundError`, espelhando o padrão de `narrator-errors.ts`.

### Testes unitários de domínio (RED)

- [X] T009 [P] Escrever [__tests__/unit/domain/editor-schema.test.ts](__tests__/unit/domain/editor-schema.test.ts) cobrindo: name válido (trim aplicado), name < 2 chars rejeitado, name > 100 chars rejeitado, email válido, email malformado rejeitado, email > 255 chars rejeitado, chaves extras descartadas no `parse`. Rodar `bun run test:unit __tests__/unit/domain/editor-schema.test.ts` — deve falhar se a entidade ainda não estiver exposta (ver T006).

### Repository (integration tests primeiro)

- [X] T010 [P] Escrever [__tests__/integration/repositories/drizzle-editor-repository.test.ts](__tests__/integration/repositories/drizzle-editor-repository.test.ts) cobrindo: `findAll` ordenado por `createdAt asc`, `findById` hit/miss, `findByName` e `findByEmail` hit/miss, `create` retornando Editor com timestamps, `create` com name duplicado → `EditorNameAlreadyInUseError`, `create` com email duplicado → `EditorEmailAlreadyInUseError`, `update` completo e parcial, `update` em id inexistente → `EditorNotFoundError`, `update` mantendo mesmo name/email (idempotência), `delete` happy path, `delete` em id inexistente → `EditorNotFoundError`. Usa setup BEGIN/ROLLBACK via `__tests__/integration/setup.ts`. Espelhar estrutura de `drizzle-narrator-repository.test.ts`.
- [X] T011 Implementar [src/lib/repositories/drizzle/drizzle-editor-repository.ts](src/lib/repositories/drizzle/drizzle-editor-repository.ts) com `DrizzleEditorRepository implements EditorRepository`: constantes `EDITOR_COLUMNS`, `POSTGRES_UNIQUE_VIOLATION = "23505"`, `EDITOR_NAME_CONSTRAINT`, `EDITOR_EMAIL_CONSTRAINT`; helper `getUniqueConstraintName(error)` (ver [research.md](specs/018-editors-crud/research.md) §R3); `create` e `update` com `try/catch` mapeando `constraint` → classe de erro correta. Rodar T010 de novo — deve passar.

### Service (unit tests primeiro, com in-memory repo)

- [X] T012 [P] Criar helper de teste [__tests__/repositories/in-memory-editor-repository.ts](__tests__/repositories/in-memory-editor-repository.ts) com `InMemoryEditorRepository implements EditorRepository`: linear scan em `findByName`/`findByEmail`, `create` e `update` com `trim` e `toLowerCase` defensivo + verificação de duplicidade contra as 2 constraints, lançando as classes de erro corretas. Ver [data-model.md](specs/018-editors-crud/data-model.md) §InMemoryEditorRepository.
- [X] T013 Escrever [__tests__/unit/services/editor-service.test.ts](__tests__/unit/services/editor-service.test.ts) com `InMemoryEditorRepository` injetado: `list()` delega, `create(input)` normaliza email (`"Carla@Studio.com"` → `"carla@studio.com"`) e aplica `trim` em name, `update(id, {email:"X@Y.com"})` normaliza antes do repo, `delete` delega, idempotência em update com mesmo valor. Rodar — falha (service ausente).
- [X] T014 Implementar [src/lib/services/editor-service.ts](src/lib/services/editor-service.ts) com `class EditorService` recebendo `EditorRepository` via construtor. `create` aplica `input.name.trim()` e `input.email.trim().toLowerCase()`. `update` idem condicionalmente. `list`, `delete` puros. Rodar T013 — passa.

### Composition root + test factory

- [X] T015 [P] Criar factory [src/lib/factories/editor.ts](src/lib/factories/editor.ts) com `export function createEditorService(): EditorService` que instancia `DrizzleEditorRepository(db)` e injeta no service. Espelhar [src/lib/factories/narrator.ts](src/lib/factories/narrator.ts).
- [X] T016 [P] Estender [__tests__/helpers/factories.ts](__tests__/helpers/factories.ts) com `createTestEditor(db, overrides?)` gerando defaults randomizados (`Editor ${suffix}`, `editor-${suffix}@test.local`) via `randomUUID().slice(0,8)`. Importar `editor` de `@/lib/db/schema`. Ver [research.md](specs/018-editors-crud/research.md) §R8.

**Checkpoint**: Backend pronto. `bun run test:integration __tests__/integration/repositories/drizzle-editor-repository.test.ts` e `bun run test:unit __tests__/unit/services/editor-service.test.ts` e `bun run test:unit __tests__/unit/domain/editor-schema.test.ts` verdes. Stories podem começar.

---

## Phase 3: User Story 1 - Listar editores existentes (Priority: P1) 🎯 MVP

**Goal**: Expor `/editors` (UI) e `GET /api/v1/editors` (API) para listar editores existentes com colunas Nome e E-mail e ordenação client-side. Estado vazio renderizado quando não houver registros.

**Independent Test**: Criar 2 editores via factory (`createTestEditor`), acessar `/editors` logado como admin, ver 2 linhas com nome e e-mail corretos; clicar em cabeçalho "Nome" para ordenar asc/desc; remover todos e confirmar empty state.

### Testes de US1 (RED) ⚠️

- [ ] T017 [P] [US1] Escrever [__tests__/unit/api/editors-list.test.ts](__tests__/unit/api/editors-list.test.ts) testando `handleEditorsList(deps)` com deps injetadas: 401 sem sessão, 200 com envelope `{ data: [] }` quando lista vazia, 200 com lista populada. Ver padrão em `narrators-list.test.ts`.
- [ ] T018 [P] [US1] Escrever [__tests__/e2e/editors-list.spec.ts](__tests__/e2e/editors-list.spec.ts): login admin → navega para `/editors` → assert header "Editores" → assert tabela vazia mostra empty state; depois criar 2 editores via factory, recarregar, assertir 2 linhas com name+email; clicar cabeçalho Nome → assertir ordem asc; clicar novamente → desc; clicar cabeçalho E-mail → assertir ordem por email.

### Implementação de US1

- [ ] T019 [US1] Criar handler `handleEditorsList(deps)` + `GET` wrapper em [src/app/api/v1/editors/route.ts](src/app/api/v1/editors/route.ts) espelhando `narrators/route.ts`: importar `auth.api.getSession`, `createEditorService`, `unauthorizedResponse`, `NO_STORE_HEADERS`. Ainda sem handler `POST` (virá em US2). Rodar T017 — passa.
- [ ] T020 [US1] Criar Server Component em [src/app/(authenticated)/editors/page.tsx](src/app/(authenticated)/editors/page.tsx) com `export const dynamic = "force-dynamic"`, chamando `createEditorService().list()` e passando para `<EditorsClient initialEditors={editors} />` dentro de `<PageContainer>`.
- [ ] T021 [US1] Criar [src/app/(authenticated)/editors/_components/editors-client.tsx](src/app/(authenticated)/editors/_components/editors-client.tsx) como client component mínimo: `"use client"`, estado `editors` iniciando com `initialEditors`, render de `<PageHeader><PageTitle>Editores</PageTitle><PageDescription>Gerenciar editores</PageDescription></PageHeader>` seguido por `<EditorsTable editors={editors} />`. Adicionar `<Toaster/>` se ainda não houver. Sem botão "+ Novo Editor" nesta fase (vem em US2).
- [ ] T022 [US1] Criar [src/app/(authenticated)/editors/_components/editors-table.tsx](src/app/(authenticated)/editors/_components/editors-table.tsx) com TanStack Table: colunas `name` e `email` (ambas sortable via `SortableHeader`), coluna de ações placeholder (ícone de editar e excluir ainda sem handler — fica visível mas inativo). Envolver em `<ScrollArea>`. Empty state com mensagem "Nenhum editor cadastrado." quando `editors.length === 0`.

**Checkpoint**: MVP entregue. Usuário consegue ver editores listados em `/editors` e via `GET /api/v1/editors`. Ordenação funcional. Empty state renderizado.

---

## Phase 4: User Story 2 - Criar novo editor (Priority: P1)

**Goal**: Permitir criação inline de editor via botão "+ Novo Editor" com validação de nome e e-mail, tratamento de duplicidade nos dois campos e feedback visual.

**Independent Test**: Acessar `/editors`, clicar em "+ Novo Editor" → linha editável aparece → preencher nome "Teste" e email "teste@x.com" → confirmar → linha vira view mode; tentar criar com mesmo nome → erro inline "Nome já cadastrado"; com mesmo email → erro inline "E-mail já cadastrado"; com email inválido → erro de validação.

### Testes de US2 (RED) ⚠️

- [ ] T024 [P] [US2] Escrever [__tests__/unit/api/editors-create.test.ts](__tests__/unit/api/editors-create.test.ts) testando `handleEditorsCreate(request, deps)`: 401 sem sessão, 422 com body inválido (name curto, email malformado), 201 com body válido (assertir `Location` header e payload no envelope), 409 NAME_ALREADY_IN_USE quando service lança `EditorNameAlreadyInUseError`, 409 EMAIL_ALREADY_IN_USE quando service lança `EditorEmailAlreadyInUseError`, chaves extras silenciosamente descartadas.
- [ ] T025 [P] [US2] Escrever [__tests__/e2e/editors-create.spec.ts](__tests__/e2e/editors-create.spec.ts) cobrindo fluxo completo: clicar botão → nova linha aparece → campos editáveis → confirmar cria registro → cancelar descarta linha → nome vazio mostra erro → email vazio mostra erro → email inválido mostra erro → nome duplicado mostra "Nome já cadastrado" no campo Nome → email duplicado (inclusive em capitalização diferente) mostra "E-mail já cadastrado" no campo E-mail.

### Implementação de US2

- [ ] T026 [US2] Adicionar `handleEditorsCreate(request, deps)` + `POST` wrapper em [src/app/api/v1/editors/route.ts](src/app/api/v1/editors/route.ts) espelhando narrator: parse via `createEditorSchema`, `validationErrorResponse` em falha, `service.create`, 201 com `Location: /api/v1/editors/${id}`, `catch` separado para `EditorNameAlreadyInUseError` (→ `conflictResponse("NAME_ALREADY_IN_USE", "Nome já cadastrado")`) e `EditorEmailAlreadyInUseError` (→ `conflictResponse("EMAIL_ALREADY_IN_USE", "E-mail já cadastrado")`). Rodar T024.
- [ ] T027 [US2] Criar [src/app/(authenticated)/editors/_components/editor-new-row.tsx](src/app/(authenticated)/editors/_components/editor-new-row.tsx): client component com React Hook Form + `@hookform/resolvers/zod` usando `createEditorSchema`. Inputs `name` e `email`. Botões Cancelar (descarta linha) e Confirmar (POST /api/v1/editors). Em 409 NAME → `form.setError("name", { message: "Nome já cadastrado" })`; em 409 EMAIL → `form.setError("email", { ... })`. Em sucesso, chamar callback `onCreated(editor)` que o `EditorsClient` usa para atualizar o estado. **Em erro inesperado / falha de rede (qualquer resposta não-2xx que não seja 409 tratado inline nem 422 com details), exibir toast de erro genérico via `sonner` (`toast.error(...)`). Sucesso NÃO dispara toast (FR-013).**
- [ ] T028 [US2] Atualizar [src/app/(authenticated)/editors/_components/editors-client.tsx](src/app/(authenticated)/editors/_components/editors-client.tsx) para adicionar botão "+ Novo Editor" no `PageHeader`, estado `isCreating`, render condicional de `<EditorNewRow>` no topo da tabela, callback `handleCreated` que faz `setEditors(prev => [newEditor, ...prev])` e `setIsCreating(false)`. Reaproveitar padrão de `NarratorsClient`.
- [ ] T029 [US2] Atualizar [src/app/(authenticated)/editors/_components/editors-table.tsx](src/app/(authenticated)/editors/_components/editors-table.tsx) para aceitar prop `newRow?: ReactNode` e renderizar no topo do `<tbody>` quando presente. Alternativa: `EditorsClient` insere `<EditorNewRow>` diretamente fora da tabela. Escolher o mesmo padrão adotado em Narrador.

**Checkpoint**: US1 + US2 funcionais. Usuário consegue listar e criar editores com validação completa.

---

## Phase 5: User Story 3 - Editar editor existente (Priority: P2)

**Goal**: Permitir edição inline de nome e e-mail via ícone "Editar" na linha; tratar duplicidade e idempotência.

**Independent Test**: Na tabela com editores existentes, clicar no ícone Editar de uma linha → inputs preenchidos com valores atuais → alterar nome, confirmar → persiste; cancelar → restaura; alterar para nome já usado → erro inline; alterar email mantendo só a capitalização (idempotente) → aceito.

### Testes de US3 (RED) ⚠️

- [ ] T031 [P] [US3] Escrever [__tests__/unit/api/editors-update.test.ts](__tests__/unit/api/editors-update.test.ts) testando `handleEditorsUpdate(request, deps, params)`: 401, 404 quando id inexistente, 422 body inválido, 200 com body parcial (apenas name, apenas email, ambos), 409 NAME_ALREADY_IN_USE, 409 EMAIL_ALREADY_IN_USE, idempotência em mesmo valor normalizado.
- [ ] T032 [P] [US3] Escrever [__tests__/e2e/editors-update.spec.ts](__tests__/e2e/editors-update.spec.ts) cobrindo: clicar Editar → inputs populados → alterar nome → confirmar → row atualiza; alterar apenas email → persiste; cancelar restaura; nome limpo → erro; email inválido → erro; nome já usado em outro → "Nome já cadastrado"; email já usado (inclusive case-insensitive) → "E-mail já cadastrado"; idempotente em mesmos valores.

### Implementação de US3

- [ ] T033 [US3] Criar `handleEditorsUpdate` + `PATCH` wrapper em [src/app/api/v1/editors/[id]/route.ts](src/app/api/v1/editors/[id]/route.ts) espelhando narrator `[id]/route.ts`: parse via `updateEditorSchema`, `service.update`, `catch` de `EditorNotFoundError` → `notFoundResponse("EDITOR_NOT_FOUND", "Editor não encontrado")`, catches separados para as duas `AlreadyInUseError`. Rodar T031.
- [ ] T034 [US3] Criar [src/app/(authenticated)/editors/_components/editor-row.tsx](src/app/(authenticated)/editors/_components/editor-row.tsx): client component com modos `view` e `edit`. View renderiza `<td>{editor.name}</td><td>{editor.email}</td>` + ícones Editar/Excluir. Edit renderiza React Hook Form com 2 inputs populados + botões Cancelar/Confirmar. Em 409 NAME → `setError("name", ...)`; em 409 EMAIL → `setError("email", ...)`. Em sucesso, callback `onUpdated(editor)` volta ao modo view. **Em erro inesperado / falha de rede (qualquer resposta não-2xx que não seja 409 tratado inline nem 422 com details), exibir toast de erro genérico via `sonner` (`toast.error(...)`). Sucesso NÃO dispara toast (FR-013).**
- [ ] T035 [US3] Atualizar [src/app/(authenticated)/editors/_components/editors-table.tsx](src/app/(authenticated)/editors/_components/editors-table.tsx) para usar `<EditorRow>` em cada linha passando `editor` e callbacks `onUpdated`, `onDeleteRequested` (ainda placeholder em US3, ativado em US4). Ícone Editar troca a linha para modo edit.
- [ ] T036 [US3] Atualizar [src/app/(authenticated)/editors/_components/editors-client.tsx](src/app/(authenticated)/editors/_components/editors-client.tsx) com callback `handleUpdated` que faz `setEditors(prev => prev.map(e => e.id === updated.id ? updated : e))`.

**Checkpoint**: US1 + US2 + US3 funcionais.

---

## Phase 6: User Story 4 - Excluir editor (Priority: P2)

**Goal**: Modal de confirmação antes de excluir, ícone destructive.

**Independent Test**: Clicar no ícone Excluir → modal aparece com pergunta específica → confirmar → registro removido; cancelar → nada acontece.

### Testes de US4 (RED) ⚠️

- [ ] T038 [P] [US4] Escrever [__tests__/unit/api/editors-delete.test.ts](__tests__/unit/api/editors-delete.test.ts) testando `handleEditorsDelete(deps, params)`: 401, 404 quando id inexistente, 204 em sucesso com `Cache-Control: no-store`.
- [ ] T039 [P] [US4] Escrever [__tests__/e2e/editors-delete.spec.ts](__tests__/e2e/editors-delete.spec.ts): clicar ícone Excluir → modal aparece → confirmar → row desaparece; cancelar fecha modal sem remover.

### Implementação de US4

- [ ] T040 [US4] Criar `handleEditorsDelete` + `DELETE` wrapper em [src/app/api/v1/editors/[id]/route.ts](src/app/api/v1/editors/[id]/route.ts) espelhando narrator: 204 em sucesso, `EditorNotFoundError` → `notFoundResponse("EDITOR_NOT_FOUND", ...)`. Rodar T038.
- [ ] T041 [US4] Criar [src/app/(authenticated)/editors/_components/delete-editor-dialog.tsx](src/app/(authenticated)/editors/_components/delete-editor-dialog.tsx) com shadcn `<Dialog>`: título, mensagem `"Tem certeza que deseja excluir o editor {nome}?"`, botões Cancelar e Excluir (classe `destructive`). Callback `onConfirm` dispara DELETE. Em sucesso, callback `onDeleted(id)` volta ao client. **Em erro de rede / resposta não-2xx, exibir toast de erro genérico via `sonner` (`toast.error(...)`); o modal permanece aberto para o usuário tentar novamente ou cancelar. Sucesso NÃO dispara toast (FR-013).**
- [ ] T042 [US4] Atualizar [src/app/(authenticated)/editors/_components/editors-client.tsx](src/app/(authenticated)/editors/_components/editors-client.tsx) com estado `editorToDelete: Editor | null`, handler `handleDeleteRequested(editor)` que abre o dialog, handler `handleDeleted(id)` que faz `setEditors(prev => prev.filter(e => e.id !== id))`.
- [ ] T043 [US4] Atualizar [src/app/(authenticated)/editors/_components/editor-row.tsx](src/app/(authenticated)/editors/_components/editor-row.tsx) para que o ícone Excluir (classe destructive) dispare `onDeleteRequested(editor)` quando clicado.

**Checkpoint**: CRUD completo funcional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Testes E2E transversais, seed dev, ajustes finais.

- [ ] T045 [P] Escrever [__tests__/e2e/editors-accessibility.spec.ts](__tests__/e2e/editors-accessibility.spec.ts) com `@axe-core/playwright`: zero violações serious/critical em `/editors` (view, create mode, edit mode, delete dialog). Espelhar `narrators-accessibility.spec.ts`.
- [ ] T046 [P] Escrever [__tests__/e2e/editors-responsive.spec.ts](__tests__/e2e/editors-responsive.spec.ts) cobrindo viewports 320, 640, 768, 1024, 1440. Assertir que tabela e linhas editáveis não quebram o layout.
- [ ] T047 [P] Escrever [__tests__/e2e/editors-font-size.spec.ts](__tests__/e2e/editors-font-size.spec.ts) testando small/medium/large via settings. Espelhar `narrators-font-size.spec.ts`.
- [ ] T048 [P] Escrever [__tests__/e2e/editors-dark-mode.spec.ts](__tests__/e2e/editors-dark-mode.spec.ts) alternando tema claro/escuro via settings (não tocar o DOM direto — regra do projeto). Espelhar `narrators-dark-mode.spec.ts`.
- [ ] T049 [P] Escrever [__tests__/e2e/editors-primary-colors.spec.ts](__tests__/e2e/editors-primary-colors.spec.ts) validando que o ícone/botão destructive mantém contraste visual em todas as 5 cores primárias (blue/orange/green/red/amber). Espelhar `narrators-primary-colors.spec.ts`.
- [ ] T050 [P] Escrever [__tests__/e2e/editors-concurrent-ops.spec.ts](__tests__/e2e/editors-concurrent-ops.spec.ts) cobrindo múltiplas operações simultâneas (criação em curso + edição em outra linha; duas edições simultâneas em linhas distintas). Espelhar `narrators-concurrent-ops.spec.ts`.
- [ ] T051 Atualizar [src/lib/db/seed.ts](src/lib/db/seed.ts) criando 2-3 editores de exemplo para dev (ex: "Alice Souza" / alice@studio.com, "Bruno Lima" / bruno@studio.com). **NÃO tocar** `src/lib/db/seed-test.ts`. Testar com `bun run db:seed`.
- [ ] T052 Rodar [quickstart.md](specs/018-editors-crud/quickstart.md) §4 (checklist manual de UI) no ambiente dev para validar paridade visual com Narrador, dark mode, font-size e responsividade. Registrar eventuais correções de layout como sub-tasks aqui.

---

## Final Quality Gate (single, before PR)

Per Constitution Principle XVI, quality checks NÃO são rodadas por fase — apenas aqui, antes de marcar a feature como pronta ou abrir o PR.

- [ ] T053 `bun run lint` — zero erros e zero warnings.
- [ ] T054 `bun run test:unit` — toda a suíte passando (inclui novos schema/service/api tests).
- [ ] T055 `bun run test:integration` — toda a suíte passando (inclui `drizzle-editor-repository.test.ts`).
- [ ] T056 `bun run test:e2e` — toda a suíte passando (inclui as 7 specs de editors-*).
- [ ] T057 `bun run build` — build de produção compila sem erros.
- [ ] T058 Executar checklist de Self-Review da Constituição (§Self-Review Obrigatório) no PR.
- [ ] T059 Abrir PR contra `main` via `/finish-task`.

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): sem dependência, pode começar de imediato.
- Phase 2 (Foundational): depende de Phase 1; **BLOQUEIA todas as user stories**.
- Phase 3 (US1 — List): depende de Phase 2.
- Phase 4 (US2 — Create): depende de Phase 2 e Phase 3 (reusa page + client).
- Phase 5 (US3 — Update): depende de Phase 2; idealmente após Phase 4 para evitar conflitos em `editors-client.tsx` e `editors-table.tsx`.
- Phase 6 (US4 — Delete): depende de Phase 2; após Phase 5 para encaixar ícone destructive no `editor-row.tsx`.
- Phase 7 (Polish): depende de US1–US4 completas.
- Final Quality Gate: depende de Phase 7.

### Intra-Phase Dependencies (Phase 2)

- T004 → T005 (schema antes de gerar migração).
- T004 → T006 (entidade Zod depende do schema).
- T006 → T007, T008 (interface e erros dependem do tipo `Editor`).
- T009 → T006 (teste falha até o arquivo existir).
- T010 → T011 (teste integration RED antes de implementar repo).
- T010 + T011 → T013 (service test pode rodar com in-memory sem esperar drizzle).
- T012 → T013 (in-memory repo antes do service test).
- T013 → T014 (service test RED antes de implementar service).
- T014 → T015 (factory depende do service).
- T016 independe do resto (paralelo).

### Parallel Opportunities

- T006, T007, T008 podem rodar em paralelo (arquivos diferentes, depois de T004/T005).
- T009, T010, T012 podem rodar em paralelo.
- T015, T016 em paralelo com T014.
- Em US1: T017 (unit) e T018 (E2E) em paralelo antes do código.
- Em US2: T024 e T025 em paralelo.
- Em US3: T031 e T032 em paralelo.
- Em US4: T038 e T039 em paralelo.
- Em Phase 7: T045–T050 todas em paralelo (arquivos distintos).

---

## Parallel Example: Phase 2 depois de T005

```bash
# Após T004 + T005 aplicados:
Task: "T006 Criar src/lib/domain/editor.ts"
Task: "T007 Criar src/lib/domain/editor-repository.ts"
Task: "T008 Criar src/lib/errors/editor-errors.ts"
Task: "T009 Escrever __tests__/unit/domain/editor-schema.test.ts"
Task: "T010 Escrever __tests__/integration/repositories/drizzle-editor-repository.test.ts"
Task: "T012 Criar __tests__/repositories/in-memory-editor-repository.ts"
Task: "T016 Estender __tests__/helpers/factories.ts com createTestEditor"
```

---

## Implementation Strategy

### MVP First (User Story 1 apenas)

1. Phase 1: Setup.
2. Phase 2: Foundational completo.
3. Phase 3: US1 — Listar editores.
4. **STOP e VALIDATE**: `/editors` exibe lista + empty state + ordenação.
5. Deploy/demo se quiser mostrar MVP — nesse momento ainda não há criação.

### Incremental Delivery

1. Setup + Foundational → backend pronto.
2. US1 → demo: listagem (MVP).
3. US2 → demo: criação.
4. US3 → demo: edição.
5. US4 → demo: exclusão.
6. Polish → demo final com paridade visual + dark mode + font-size + responsive.
7. Final Quality Gate → PR.

### Parallel Team Strategy

Com 1 desenvolvedor (padrão deste projeto), seguir ordem sequencial P1→P2→P3→P4 respeitando TDD dentro de cada fase. Com 2+ desenvolvedores:

- Dev A: US1 completa.
- Dev B: backend de US2 (T024, T026) em paralelo — mas a UI de US2 (T027–T029) precisa esperar US1 fechar para evitar conflito em `editors-client.tsx`.

---

## Notes

- [P] = arquivos diferentes, sem dependência pendente.
- Cada US entrega valor observável — listar (US1) > criar (US2) > editar (US3) > excluir (US4).
- Testes RED antes da implementação em TODAS as fases (Princípio V).
- `bun run test:*` e `bun run lint` e `bun run build` **só rodam no Final Quality Gate** (Princípio XVI). Durante o desenvolvimento, rodar apenas o arquivo de teste relevante.
- Commits frequentes via `/conventional-commits` com prefixos `feat:`, `test:`, `chore:`, `docs:` conforme a task.
- Não tocar `src/lib/db/seed-test.ts` — regra da constituição.
- Helpers de unique violation em `DrizzleEditorRepository` são duplicados em relação a `DrizzleNarratorRepository` por decisão explícita (YAGNI) — ver [research.md](specs/018-editors-crud/research.md) §R3.
