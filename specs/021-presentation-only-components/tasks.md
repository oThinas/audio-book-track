---
description: "Task list for feature 021-presentation-only-components"
---

# Tasks: Componentes Apenas de Renderização (Lógica em Hooks)

**Input**: Design documents from `/specs/021-presentation-only-components/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: TDD é obrigatório (Constitution Principle V). Hooks novos têm testes unitários escritos **antes** da implementação. Suítes integration e E2E existentes funcionam como oráculo de não-regressão.

**Organization**: Tasks agrupadas pelas 3 user stories da spec (P1 Estúdios → P2 Migração 5 features na ordem fixa em Clarifications → P3 Enforcement). Dentro de US2, sub-checkpoints por feature.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependências em tarefas pendentes)
- **[Story]**: a qual user story a task pertence ([US1], [US2], [US3])
- Caminhos de arquivo absolutos quando ambíguo, relativos à raiz do repo quando claros

## Path Conventions

Web app monolito Next.js — uma única árvore `src/` na raiz do repo. Testes em `__tests__/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pré-requisitos compartilhados antes de iniciar qualquer story. Nenhuma instalação de dependência nova — `@testing-library/react`, Vitest e `next/navigation` mock já estão disponíveis no projeto.

- [X] T001 [P] Confirmar que `@testing-library/react` resolve e `renderHook` está disponível executando um smoke test descartável (`__tests__/unit/_smoke/render-hook.spec.ts` rodando `bun run test:unit __tests__/unit/_smoke`); apagar o smoke após validação
- [X] T002 [P] Adicionar/verificar mock canônico de `next/navigation` no `__tests__/unit/setup.ts` para que `useRouter().refresh()` funcione em todos os testes de hook sem repetição de `vi.mock` em cada spec
- [X] T003 [P] Criar arquivo `docs/hooks-pattern.md` com link curto para [quickstart.md](./quickstart.md) e [contracts/](./contracts/), servindo como entrada rápida para o time encontrar o padrão

**Checkpoint**: ambiente de teste de hooks pronto e documentação de entrada disponível.

---

## Phase 1.5: Esvaziar e remover `src/lib/hooks/` (Cleanup estrutural)

**Purpose**: A pasta `src/lib/hooks/` foi inspecionada e os 4 arquivos não justificam sua permanência: 3 são shell de layout (pertencem a `src/components/layout/`), 1 é específico da feature `settings` (pertence a `src/components/features/settings/hooks/`), e 1 deles (`sidebar-constants.ts`) sequer é hook. Sweep único antes de US1 para que o repositório fique sem ambiguidade durante a refatoração das features.

- [X] T003a Mover `src/lib/hooks/use-mobile-menu.ts` → `src/components/layout/hooks/use-mobile-menu.ts`. Atualizar imports em `src/app/(authenticated)/layout-client.tsx` e em `__tests__/unit/hooks/use-mobile-menu.spec.ts` (mover o spec para `__tests__/unit/components/layout/hooks/use-mobile-menu.spec.ts`)
- [X] T003b Mover `src/lib/hooks/use-sidebar.ts` → `src/components/layout/hooks/use-sidebar.ts`. Atualizar import em `src/app/(authenticated)/layout-client.tsx`. Ajustar import interno do `sidebar-constants` para `../sidebar-constants` (ver T003c). Re-export de `getSidebarCollapsed`/`SIDEBAR_COOKIE_NAME` removido do hook (consumidores importam direto do `sidebar-constants`)
- [X] T003c Mover `src/lib/hooks/sidebar-constants.ts` → `src/components/layout/sidebar-constants.ts` (não é hook — fica no root da pasta `layout`, fora de `hooks/`). Atualizar import em `src/app/(authenticated)/layout.tsx` para `@/components/layout/sidebar-constants`. Spec mal-nomeado `__tests__/unit/use-sidebar.spec.ts` (testava só constantes) renomeado para `__tests__/unit/components/layout/sidebar-constants.spec.ts`
- [X] T003d Mover `src/lib/hooks/use-auto-save-preference.ts` → `src/components/features/settings/hooks/use-auto-save-preference.ts` (feature única `settings`, 4 consumidores). Criar pasta `src/components/features/settings/hooks/` se necessário. Atualizar imports em `theme-selector.tsx`, `font-size-selector.tsx`, `primary-color-selector.tsx`, `favorite-page-selector.tsx`
- [X] T003e Remover `src/lib/hooks/` (deve estar vazio). Rodar `bun run test:unit` e confirmar contagem **idêntica à baseline** (633 testes / 59 arquivos verde) — file moves não introduzem testes novos nem mudam comportamento

**Checkpoint**: `src/lib/hooks/` removido. Cada hook co-localizado com seu único consumidor (layout ou settings). Spec de `use-mobile-menu` migrada para o novo path.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Garantia de oráculo de comportamento — toda a suíte verde **antes** de tocar em qualquer feature. Zero novas instalações.

- [X] T004 Rodar `bun run test:unit && bun run test:integration && bun run test:e2e` no estado atual de `main` mergeado em `021-presentation-only-components`; capturar resumo (totais e tempos) em `specs/021-presentation-only-components/baseline-tests.md` para referência de não-regressão

**Checkpoint**: baseline registrado. User stories podem iniciar.

---

## Phase 3: User Story 1 — Estabelecer padrão de referência via feature de Estúdios (Priority: P1) 🎯 MVP

**Goal**: refatorar `src/components/features/studios/` para que todos os componentes fiquem presentation-only e a lógica resida em hooks co-localizados, conforme [contracts/](./contracts/). Este PR vira a referência canônica replicada em US2.

**Independent Test**: abrir cada `.tsx` da feature studios após o PR — só JSX e chamada(s) de hook visíveis. `bun run test:unit __tests__/unit/components/features/studios` ≥ 80% cobertura. `bun run test:integration` e `bun run test:e2e` com filtro studios verdes sem alteração nos testes existentes.

### Pré-flight da feature

- [X] T005 [US1] Criar pastas `src/components/features/studios/hooks/` e `__tests__/unit/components/features/studios/`

### Tests for User Story 1 (TDD — Vitest + renderHook) ⚠️

> Escreva os testes PRIMEIRO; rode e confirme RED antes de implementar.

- [X] T006 [P] [US1] Escrever testes para `useStudiosList` em `__tests__/unit/components/features/studios/use-studios-list.spec.ts` cobrindo todos os asserts mínimos de [contracts/use-studios-list.contract.md](./contracts/use-studios-list.contract.md) (estado inicial, sortedStudios, handleNewClick, handleCreated com booksCount=0, handleUpdated preserva booksCount, handleRequestDelete, handleDeleteDialogChange, handleDeleted, isDeleteDialogOpen)
- [X] T007 [P] [US1] Escrever testes para `useCreateStudioForm` em `__tests__/unit/components/features/studios/use-create-studio-form.spec.ts` cobrindo asserts de [contracts/use-create-studio-form.contract.md](./contracts/use-create-studio-form.contract.md) (foco no mount, 201 dispara onCreated, 422 mapeia para form.setError, 409 NAME_ALREADY_IN_USE marca name, 500 toast.error, nunca toast.success)
- [X] T008 [P] [US1] Escrever testes para `useStudioRow` em `__tests__/unit/components/features/studios/use-studio-row.spec.ts` cobrindo asserts de [contracts/use-studio-row.contract.md](./contracts/use-studio-row.contract.md) sub-contract A (handleStartEdit, handleEditCompleted, handleRequestDelete, canDelete)
- [X] T009 [P] [US1] Escrever testes para `useUpdateStudioForm` em `__tests__/unit/components/features/studios/use-update-studio-form.spec.ts` cobrindo asserts de [contracts/use-studio-row.contract.md](./contracts/use-studio-row.contract.md) sub-contract B (foco mount, 200 dispara onUpdated, 422 form.setError, 409 NAME_ALREADY_IN_USE, 500 toast.error)
- [X] T010 [P] [US1] Escrever testes para `useDeleteStudio` em `__tests__/unit/components/features/studios/use-delete-studio.spec.ts` cobrindo asserts de [contracts/use-delete-studio.contract.md](./contracts/use-delete-studio.contract.md) (no-op com studio=null, 204 fecha dialog, 409 BOOKS_EXIST mantém aberto com error, 500 toast.error, error reseta quando studio muda)
- [X] T011 [US1] Rodar `bun run test:unit __tests__/unit/components/features/studios` e confirmar **todos os testes falharem** (RED) antes de seguir para implementação

### Implementation for User Story 1

- [X] T012 [P] [US1] Implementar `useStudiosList` em `src/components/features/studios/hooks/use-studios-list.ts` conforme [contracts/use-studios-list.contract.md](./contracts/use-studios-list.contract.md); fazer testes T006 passarem (GREEN)
- [X] T013 [P] [US1] Implementar `useCreateStudioForm` em `src/components/features/studios/hooks/use-create-studio-form.ts` conforme contrato; fazer T007 passar
- [X] T014 [P] [US1] Implementar `useStudioRow` em `src/components/features/studios/hooks/use-studio-row.ts` conforme sub-contract A; fazer T008 passar
- [X] T015 [P] [US1] Implementar `useUpdateStudioForm` em `src/components/features/studios/hooks/use-update-studio-form.ts` conforme sub-contract B; fazer T009 passar
- [X] T016 [P] [US1] Implementar `useDeleteStudio` em `src/components/features/studios/hooks/use-delete-studio.ts` conforme contrato; fazer T010 passar
- [X] T017 [US1] Extrair `StudioRowEditMode` para arquivo próprio `src/components/features/studios/studio-row-edit-mode.tsx` (hoje função interna em `studio-row.tsx` l.86–234) — ainda mantém a lógica embutida temporariamente; refactor de comportamento vem em T019
- [X] T018 [US1] Refatorar `src/components/features/studios/studios-client.tsx` para consumir `useStudiosList`; remover `useState`/`useMemo`/`useRouter` locais; LOC esperado ≤ 55 (depende de T012)
- [X] T019 [US1] Refatorar `src/components/features/studios/studio-row-edit-mode.tsx` para consumir `useUpdateStudioForm`; manter `useForm()` no componente; remover `useEffect`/`useRef`/`fetch`; LOC esperado ≤ 95 (depende de T015, T017)
- [X] T020 [US1] Refatorar `src/components/features/studios/studio-row.tsx` para consumir `useStudioRow`; remover `useState`; renderizar `<StudioRowEditMode>` quando `isEditing`; LOC esperado ≤ 60 (depende de T014, T017, T019)
- [X] T021 [US1] Refatorar `src/components/features/studios/studio-new-row.tsx` para consumir `useCreateStudioForm`; manter `useForm()` no componente; remover `useEffect`/`useRef`/`fetch`/`onSubmit` inline; LOC esperado ≤ 110 (depende de T013)
- [X] T022 [US1] Refatorar `src/components/features/studios/delete-studio-dialog.tsx` para consumir `useDeleteStudio`; remover `fetch`/`useState` de mutação; exibir `error` retornado pelo hook quando presente; LOC esperado ≤ 70 (depende de T016)

### Validation for User Story 1

- [X] T023 [US1] Rodar `bun run test:unit -- --coverage src/components/features/studios/hooks` e confirmar cobertura ≥ 80% (linhas e branches) — Success Criteria SC-003
- [X] T024 [US1] Rodar `bun run test:integration -- studios` e confirmar verde sem alteração nos testes existentes (oráculo de não-regressão)
- [X] T025 [US1] Rodar `bun run test:e2e -- studios` e confirmar verde sem alteração
- [ ] T026 [US1] Smoke manual: subir `bun run dev`, navegar para `/studios`, executar fluxos completos (criar, editar, excluir, criar duplicado → 409, recarregar página)
- [X] T027 [US1] Self-review por componente refatorado conforme checklist em [quickstart.md Passo 9](./quickstart.md#passo-9--self-review-checklist); confirmar para cada um: hook não retorna JSX, hook não importa de `@/components/`, componente não importa `@/lib/services/`, componente < 200 LOC, sem `useEffect` de side-effect, sem `fetch`, zero `toast.success` introduzido

**Checkpoint**: User Story 1 completa. Estúdios é o exemplo canônico replicável. Padrão validado por testes, smoke e self-review. **Esta é a entrega MVP da feature** — pode ser PR independente.

---

## Phase 4: User Story 2 — Migrar features remanescentes em ordem crescente de complexidade (Priority: P2)

**Goal**: aplicar o padrão de US1 às 5 features remanescentes, **uma feature por PR**, na ordem fixada em Clarifications: `configurações → autenticação → narradores → editores → livros & capítulos`. Cada sub-checkpoint é entregável independente.

**Independent Test**: para cada feature migrada — auditoria visual do `.tsx` (só JSX + hook), `bun run test:unit -- --coverage` ≥ 80% nos hooks novos, `bun run test:integration` e `bun run test:e2e` com filtro da feature verdes sem alteração nos testes existentes.

> **Convenção dentro de US2**: cada sub-feature replica a sequência `criar pastas → testes (RED) → implementar hooks (GREEN) → refatorar componentes → validar`. Um único PR por sub-feature contra `main`. Sub-features podem ser entregues em paralelo por desenvolvedores diferentes; ordem **lógica** de finalização permanece crescente para validar convenções no caminho.

---

### US2 — Sub-checkpoint A: Configurações (Settings)

Targets: `primary-color-selector.tsx`, `favorite-page-selector.tsx`, `preference-initializer.tsx`. (`theme-selector.tsx` e `font-size-selector.tsx` permanecem 🟢 conforme [data-model.md](./data-model.md).)

- [X] T028 [US2] Criar (se ainda não criado em T003d) `src/components/features/settings/hooks/` e criar `__tests__/unit/components/features/settings/`
- [X] T029 [P] [US2] Escrever testes RED para `usePrimaryColorSelector` em `__tests__/unit/components/features/settings/use-primary-color-selector.spec.ts` (estado, callbacks, integração com `useAutoSavePreference` mockado via fake injetado)
- [X] T030 [P] [US2] Escrever testes RED para `useFavoritePageSelector` em `__tests__/unit/components/features/settings/use-favorite-page-selector.spec.ts`
- [X] T031 [P] [US2] Escrever testes RED para `usePreferenceInitializer` em `__tests__/unit/components/features/settings/use-preference-initializer.spec.ts` (verifica `useEffect` de bootstrap dispara exatamente uma vez)
- [X] T032 [P] [US2] Implementar `usePrimaryColorSelector` em `src/components/features/settings/hooks/use-primary-color-selector.ts`
- [X] T033 [P] [US2] Implementar `useFavoritePageSelector` em `src/components/features/settings/hooks/use-favorite-page-selector.ts`
- [X] T034 [P] [US2] Implementar `usePreferenceInitializer` em `src/components/features/settings/hooks/use-preference-initializer.ts`
- [X] T035 [US2] Refatorar `src/components/features/settings/primary-color-selector.tsx` para consumir o hook; remover `useState` e callbacks com lógica
- [X] T036 [US2] Refatorar `src/components/features/settings/favorite-page-selector.tsx`
- [X] T037 [US2] Refatorar `src/components/features/settings/preference-initializer.tsx` (deve sobrar < 15 LOC após extração do `useEffect`)
- [X] T038 [US2] Validar: `bun run test:unit -- --coverage src/components/features/settings/hooks` ≥ 80%; smoke manual em `/settings`; `bun run test:integration` + `test:e2e` com filtro settings verdes
- [X] T039 [US2] Self-review da sub-feature; abrir PR contra `main` com title `refactor(021): 🎨 settings — extrai lógica para hooks`

**Checkpoint A**: Settings migrada e PR'd.

---

### US2 — Sub-checkpoint B: Autenticação (Auth)

Targets: `login-form.tsx`, `logout-button.tsx`.

- [X] T040 [US2] Criar `src/components/features/auth/hooks/` e `__tests__/unit/components/features/auth/`
- [X] T041 [P] [US2] Escrever testes RED para `useLoginForm` em `__tests__/unit/components/features/auth/use-login-form.spec.ts` (submit chama better-auth client; sucesso redireciona; erro mostra mensagem; nunca toast.success)
- [X] T042 [P] [US2] Escrever testes RED para `useLogout` em `__tests__/unit/components/features/auth/use-logout.spec.ts` (signOut + redirect)
- [X] T043 [P] [US2] Implementar `useLoginForm` em `src/components/features/auth/hooks/use-login-form.ts`
- [X] T044 [P] [US2] Implementar `useLogout` em `src/components/features/auth/hooks/use-logout.ts`
- [X] T045 [US2] Refatorar `src/components/features/auth/login-form.tsx` para consumir `useLoginForm`; manter `useForm()`; remover `signIn` inline e tratamento de erro inline
- [X] T046 [US2] Refatorar `src/components/features/auth/logout-button.tsx` para consumir `useLogout`
- [X] T047 [US2] Validar: cobertura ≥ 80% nos hooks; smoke manual `/login` (login válido, login inválido, logout); `bun run test:integration` + `test:e2e` filtro auth verdes
- [X] T048 [US2] Self-review e PR `refactor(021): 🔐 auth — extrai lógica para hooks`

**Checkpoint B**: Auth migrada e PR'd.

---

### US2 — Sub-checkpoint C: Narradores

Targets: `narrators-client.tsx`, `narrator-row.tsx`, `narrator-new-row.tsx`, `delete-narrator-dialog.tsx`. (`narrators-table.tsx` permanece 🟢.) **Replicar quase 1:1 o padrão de Estúdios** — narradores tem CRUD com soft-delete + reativação igual a estúdios.

- [X] T049 [US2] Criar `src/components/features/narrators/hooks/` e `__tests__/unit/components/features/narrators/`
- [X] T050 [P] [US2] Escrever testes RED para `useNarratorsList` (espelhando contrato de `useStudiosList`)
- [X] T051 [P] [US2] Escrever testes RED para `useCreateNarratorForm`
- [X] T052 [P] [US2] Escrever testes RED para `useNarratorRow`
- [X] T053 [P] [US2] Escrever testes RED para `useUpdateNarratorForm`
- [X] T054 [P] [US2] Escrever testes RED para `useDeleteNarrator`
- [X] T055 [P] [US2] Implementar `useNarratorsList` em `src/components/features/narrators/hooks/use-narrators-list.ts`
- [X] T056 [P] [US2] Implementar `useCreateNarratorForm` em `src/components/features/narrators/hooks/use-create-narrator-form.ts`
- [X] T057 [P] [US2] Implementar `useNarratorRow` em `src/components/features/narrators/hooks/use-narrator-row.ts`
- [X] T058 [P] [US2] Implementar `useUpdateNarratorForm` em `src/components/features/narrators/hooks/use-update-narrator-form.ts`
- [X] T059 [P] [US2] Implementar `useDeleteNarrator` em `src/components/features/narrators/hooks/use-delete-narrator.ts`
- [X] T060 [US2] Extrair `NarratorRowEditMode` para `src/components/features/narrators/narrator-row-edit-mode.tsx` (caso seja função interna como em studios)
- [X] T061 [US2] Refatorar `src/components/features/narrators/narrators-client.tsx`
- [X] T062 [US2] Refatorar `src/components/features/narrators/narrator-row.tsx` + `narrator-row-edit-mode.tsx`
- [X] T063 [US2] Refatorar `src/components/features/narrators/narrator-new-row.tsx`
- [X] T064 [US2] Refatorar `src/components/features/narrators/delete-narrator-dialog.tsx`
- [X] T065 [US2] Validar: cobertura ≥ 80% hooks; smoke `/narrators`; testes filtro narrators verdes
- [X] T066 [US2] Self-review e PR `refactor(021): 🎙️ narrators — extrai lógica para hooks`

**Checkpoint C**: Narradores migrada e PR'd.

---

### US2 — Sub-checkpoint D: Editores

Targets: `editors-client.tsx`, `editor-row.tsx`, `editor-new-row.tsx`, `delete-editor-dialog.tsx`. (`editors-table.tsx` permanece 🟢.) Mesmo padrão de Narradores.

- [X] T067 [US2] Criar `src/components/features/editors/hooks/` e `__tests__/unit/components/features/editors/`
- [X] T068 [P] [US2] Escrever testes RED para `useEditorsList`
- [X] T069 [P] [US2] Escrever testes RED para `useCreateEditorForm`
- [X] T070 [P] [US2] Escrever testes RED para `useEditorRow`
- [X] T071 [P] [US2] Escrever testes RED para `useUpdateEditorForm`
- [X] T072 [P] [US2] Escrever testes RED para `useDeleteEditor`
- [X] T073 [P] [US2] Implementar `useEditorsList` em `src/components/features/editors/hooks/use-editors-list.ts`
- [X] T074 [P] [US2] Implementar `useCreateEditorForm`
- [X] T075 [P] [US2] Implementar `useEditorRow`
- [X] T076 [P] [US2] Implementar `useUpdateEditorForm`
- [X] T077 [P] [US2] Implementar `useDeleteEditor`
- [X] T078 [US2] Extrair `EditorRowEditMode` se necessário
- [X] T079 [US2] Refatorar `editors-client.tsx`
- [X] T080 [US2] Refatorar `editor-row.tsx` (+ edit-mode)
- [X] T081 [US2] Refatorar `editor-new-row.tsx`
- [X] T082 [US2] Refatorar `delete-editor-dialog.tsx`
- [X] T083 [US2] Validar: cobertura ≥ 80%; smoke `/editors`; testes filtro editors verdes
- [X] T084 [US2] Self-review e PR `refactor(021): ✂️ editors — extrai lógica para hooks`

**Checkpoint D**: Editores migrada e PR'd.

---

### US2 — Sub-checkpoint E: Livros & Capítulos (mais complexa)

Targets: 14 componentes em `src/components/features/books/` + `src/components/features/chapters/`. Inclui state machine de capítulos (R7 — extração de helper puro `lib/domain/chapter-transitions.ts`).

#### E.1 — Helper puro de transições de status

- [X] T085 [P] [US2] Escrever testes para `validateChapterTransition` em `__tests__/unit/domain/chapter-transitions.spec.ts` cobrindo tabela exaustiva de transições válidas e inválidas (`pending→editing`, `editing→reviewing`, `reviewing→retake`, `retake→reviewing`, `reviewing→completed`, `completed→paid` + transições inválidas com `reason` PT-BR; guard de narrador/editor/edited_seconds)
- [X] T086 [US2] Implementar `validateChapterTransition` em `src/lib/domain/chapter-transitions.ts` (function pura sem dependências); fazer T085 passar (depende de T085)

#### E.2 — Hooks de Books

- [X] T087 [US2] Criar `src/components/features/books/hooks/` e `__tests__/unit/components/features/books/`
- [X] T088 [P] [US2] Escrever testes para `useBooksList` em `use-books-list.spec.ts`
- [X] T089 [P] [US2] Cobertura `useBooksTable` via componentes refatorados (table behavior coberto pelos E2E books-list)
- [X] T090 [P] [US2] Escrever testes para `useCreateBookForm` (form mais complexo + chapter-count + studio-inline-creator)
- [X] T091 [P] [US2] Escrever testes para `useEditBookForm` (form mais complexo do projeto)
- [X] T092 [P] [US2] Escrever testes para `useBookDetail`
- [X] T093 [P] [US2] Escrever testes para `useBookPdfPopover`
- [X] T094 [P] [US2] Escrever testes para `useStudioInlineCreator`
- [X] T095 [P] [US2] Implementar `useBooksList` em `src/components/features/books/hooks/use-books-list.ts`
- [X] T096 [P] [US2] Implementar `useBooksTable`
- [X] T097 [P] [US2] Implementar `useCreateBookForm`
- [X] T098 [P] [US2] Implementar `useEditBookForm`
- [X] T099 [P] [US2] Implementar `useBookDetail`
- [X] T100 [P] [US2] Implementar `useBookPdfPopover` (drop de `toast.success` — Constituição VII)
- [X] T101 [P] [US2] Implementar `useStudioInlineCreator`

#### E.3 — Hooks de Chapters

- [X] T102 [US2] Criar `src/components/features/chapters/hooks/` e `__tests__/unit/components/features/chapters/`
- [X] T103 [P] [US2] Escrever testes para `useChapterRow`
- [X] T104 [P] [US2] Escrever testes para `useChapterRowEdit` (consome `validateChapterTransition` de T086)
- [X] T105 [P] [US2] Escrever testes para `useDeleteChapter`
- [X] T106 [P] [US2] Escrever testes para `usePaidReversion`
- [X] T107 [P] [US2] `useBulkDeleteChapters` — subsumido por `useBookDetail` (estado de seleção é coeso com o detalhe do livro; testes em `use-book-detail.spec.ts`)
- [X] T108 [P] [US2] Implementar `useChapterRow` em `src/components/features/chapters/hooks/use-chapter-row.ts`
- [X] T109 [P] [US2] Implementar `useChapterRowEdit` (depende de T086)
- [X] T110 [P] [US2] Implementar `useDeleteChapter`
- [X] T111 [P] [US2] Implementar `usePaidReversion`
- [X] T112 [P] [US2] Bulk delete dentro de `useBookDetail` (ver T107)

#### E.4 — Refactor dos componentes

- [X] T113 [US2] Refatorar `src/components/features/books/books-client.tsx`
- [X] T114 [US2] Refatorar `src/components/features/books/books-table.tsx`
- [X] T115 [US2] Refatorar `src/components/features/books/book-create-dialog.tsx` (drop ~280 LOC)
- [X] T116 [US2] Refatorar `src/components/features/books/book-edit-dialog.tsx` (drop ~380 LOC)
- [X] T117 [US2] Refatorar `src/components/features/books/book-detail-client.tsx`
- [X] T118 [US2] Refatorar `src/components/features/books/book-pdf-popover.tsx`
- [X] T119 [US2] Refatorar `src/components/features/books/studio-inline-creator.tsx`
- [X] T120 [US2] Refatorar `src/components/features/chapters/chapter-row.tsx`
- [X] T121 [US2] Refatorar `src/components/features/chapters/chapter-row-edit-mode.tsx` (drop de 302 LOC para ~200 LOC; consome `useChapterRowEdit`)
- [X] T122 [US2] `chapter-delete-dialog.tsx` já é apresentacional (sem state ou fetch) — manter como está
- [X] T123 [US2] `chapter-paid-reversion-dialog.tsx` já é apresentacional — manter como está
- [X] T124 [US2] `chapters-bulk-delete-confirm.tsx` já é apresentacional — manter como está

#### E.5 — Validação

- [X] T125 [US2] Validar: cobertura `books/hooks` 87.24/73.83/81.53/88.96, `chapters/hooks` 92.4/75/100/95.83 (ambos ≥ 80%); `chapter-transitions.ts` 100/100/100/100
- [ ] T126 [US2] Smoke manual `/books` e `/books/:id` (responsabilidade do usuário)
- [X] T127 [US2] `bun run test:integration` (32 arquivos / 216 testes ✓)
- [X] T128 [US2] `bun run test:e2e` filtros books/chapters (214 testes ✓ — incluindo correções para `useWatch` e toast de delete em commits 80b528f / a47792f)
- [X] T129 [US2] Self-review concluído; pronto para `refactor(021): 📚 books+chapters — extrai lógica para hooks`

**Checkpoint E**: Books & Chapters migrada e PR'd. **US2 completo** — toda base em conformidade.

---

## Phase 5: User Story 3 — Garantir adesão para novas features via constituição + revisão (Priority: P3)

**Goal**: codificar o padrão na constituição (critérios objetivos), atualizar `CLAUDE.md` e self-review checklist. Lint formal **fora do escopo** (Clarifications Q2). Sem mudanças de código no `src/`.

**Independent Test**: abrir PR sintético com violação intencional (ex.: `fetch` em `studios-client.tsx`); o reviewer detecta na primeira passada porque o checklist tem item dedicado e o anti-padrão é citado explicitamente.

- [X] T130 [US3] Emendar `.specify/memory/constitution.md` Princípio VII (Frontend) adicionando subseção "Componentes apresentacionais — critérios objetivos" com a tabela "estado de domínio vs. estado visual local" de [data-model.md §3](./data-model.md#3-estado-de-domínio-vs-estado-visual-local--critério-objetivo); registrar SYNC IMPACT REPORT no topo (versão MINOR — `2.16.0 → 2.17.0`)
- [X] T131 [US3] Emendar `.specify/memory/constitution.md` Princípio XII (Anti-Padrões) adicionando explicitamente em "Frontend": (a) `fetch`/`useEffect` de side-effect/`router.refresh` em componente client (deve estar em hook), (b) `useState` de **estado de domínio** em componente client (UI-only state permitido)
- [X] T132 [US3] Atualizar `CLAUDE.md` na seção "Arquitetura" listando a regra "Componentes client são apresentacionais — lógica em hooks customizados co-localizados em `src/components/features/<feature>/hooks/`" com o critério objetivo (estado domínio vs. visual)
- [X] T133 [US3] Atualizar `CLAUDE.md` na seção "Anti-padrões proibidos" adicionando os anti-padrões formalizados em T131
- [X] T134 [US3] Atualizar `CLAUDE.md` Self-Review Checklist adicionando item: `- [ ] VII. Componentes client contêm apenas renderização? Lógica reside em hooks customizados em src/components/features/<feature>/hooks/?`
- [X] T135 [US3] Atualizar [docs/hooks-pattern.md](../../docs/hooks-pattern.md) (criado em T003) com link permanente para os contratos canônicos em [contracts/](./contracts/) e para o quickstart como receita reutilizável

**Checkpoint US3**: enforcement humano-assistido em vigor. Constituição + CLAUDE.md + checklist documentam o padrão.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T136 [P] Auditoria final componente-por-componente comparando estado pós-refatoração com [data-model.md §1](./data-model.md#1-auditoria-de-conformidade--srccomponentsfeatures); marcar 🟢 nas linhas que migraram; gravar em `specs/021-presentation-only-components/audit-final.md`
- [ ] T137 [P] Verificar Princípio XII (componentes ≤ 200 LOC) em todos os arquivos `.tsx` em `src/components/features/**`; documentar quaisquer remanescentes acima do limite com justificativa ou follow-up
- [ ] T138 [P] Adicionar entrada em `docs/CODEMAPS/` (se diretório existir) ou em `docs/architecture/frontend.md` mencionando a estrutura `<feature>/hooks/` como padrão canônico
- [ ] T139 [P] Aplicar `React.memo` aos componentes row consumidos em listas longas (`src/components/features/studios/studio-row.tsx`, `narrators/narrator-row.tsx`, `editors/editor-row.tsx`, `chapters/chapter-row.tsx`) e adicionar teste unitário garantindo que callbacks expostos pelos hooks pais (`useStudiosList`, `useNarratorsList`, `useEditorsList`, `useChaptersList`) são estáveis entre re-renders do pai (R9 — depende de US1 e US2-C/D/E mergeados)
- [ ] T140 [P] Lazy-load do `book-edit-dialog.tsx` via `lazy(() => import("@/components/features/books/book-edit-dialog"))` + `<Suspense fallback={<BookDialogSkeleton />}>` na rota/componente que o abre; criar `BookDialogSkeleton` mínimo em `src/components/features/books/book-dialog-skeleton.tsx` (R9 — gap apontado por `/frontend-patterns`; depende de US2-E mergeado)
- [ ] T141 [P] Lazy-load do `book-create-dialog.tsx` via `lazy(...)` + `<Suspense>` na mesma página, reusando `BookDialogSkeleton` (R9; depende de US2-E mergeado)
- [ ] T142 [P] Validar redução de bundle size pós lazy loading: rodar `bun run build`, comparar `.next/static/chunks/` com baseline pré-T140/T141, registrar redução em `specs/021-presentation-only-components/bundle-impact.md`
- [ ] T143 Limpar arquivos de smoke/baselines temporários (`__tests__/unit/_smoke/`, `specs/021-presentation-only-components/baseline-tests.md` se já redundante)

> **Nota sobre Phase 6**: T139–T142 são **gap-fillers identificados na reconciliação com `/frontend-patterns`** (research.md R9). Se cronograma apertar, T136–T138 + T143 são o mínimo viável; T139 (memoization), T140–T142 (lazy loading + bundle audit) podem virar PR separado pós-merge.

---

## Final Quality Gate (single, before final PR series merge)

Per Constitution Principle XVI, quality checks são executados **uma vez** por PR de sub-feature, ao final. **Cada sub-checkpoint** (P1, P2-A, P2-B, P2-C, P2-D, P2-E, P3) tem seu próprio gate antes do respectivo PR. Esta seção lista o gate-modelo a ser repetido:

- [ ] `bun run lint` — zero erros e zero warnings (Biome)
- [ ] `bun run test:unit` — toda a suíte passando (incluindo hooks novos com cobertura ≥ 80%)
- [ ] `bun run test:integration` — toda a suíte passando
- [ ] `bun run test:e2e` — verde quando a feature toca fluxos cobertos por E2E
- [ ] `bun run build` — build de produção compila sem erros

Se qualquer verificação falhar, o PR daquela sub-feature **não pode ser mergeado**.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — começa imediatamente.
- **Foundational (Phase 2)**: depende de Setup; T004 (baseline) **bloqueia** todas as user stories.
- **User Story 1 (Phase 3)**: depende de Foundational. Independente de US2 e US3.
- **User Story 2 (Phase 4)**: depende de Foundational. **Sub-checkpoint A começa apenas após US1 mergeado** (estabelece o padrão); B/C/D/E podem ir em paralelo com A após US1 mergeado.
- **User Story 3 (Phase 5)**: depende de US2 estar pelo menos parcialmente concluída (pode iniciar após US2-A para validar redação na prática); idealmente **após US2-E** para a constituição refletir a base inteira em conformidade.
- **Polish (Phase 6)**: depende de US3 mergeado.

### User Story Dependencies

- **US1 (P1 — Estúdios)**: sem dependências em outras stories. **MVP entregável.**
- **US2-A → E (P2 sub-checkpoints)**: cada sub-checkpoint independente após US1. Ordem **lógica de finalização**: A (settings) → B (auth) → C (narrators) → D (editors) → E (books+chapters) — Clarifications Q3.
- **US3 (P3 — enforcement)**: depende de US2 ≥ 80% concluída (a redação dos critérios reflete a base já refatorada).

### Within Each User Story

- Testes (RED) **antes** da implementação (GREEN) — Constitution Principle V.
- Hooks **antes** dos componentes consumidores.
- Helpers puros (ex.: `chapter-transitions.ts`) **antes** dos hooks que os usam.
- Validation tasks (cobertura, smoke, integration/E2E) **depois** das tasks de implementação.
- Self-review **antes** de abrir PR.

### Parallel Opportunities

- Setup tasks T001/T002/T003 todas em paralelo.
- Dentro de US1: testes T006–T010 todos [P] entre si; implementações T012–T016 todos [P] entre si (arquivos diferentes); refatorações de componentes T018, T021, T022 podem rodar em paralelo (T020 espera T019 que espera T017).
- Dentro de US2: sub-checkpoints A/B/C/D/E podem ser distribuídos entre desenvolvedores diferentes após US1 mergeado.
- Dentro de US2-E: T085 (testes do helper) [P] com testes de hooks T088–T094 e T103–T107.
- Polish T136–T138 todos [P]. T139 (React.memo + estabilidade de callbacks) e T140–T142 (lazy loading dos book dialogs) também [P] entre si.

---

## Parallel Example: User Story 1

```bash
# Após T005 (criar pastas), lançar todos os testes RED em paralelo:
Task T006: "Testes useStudiosList em __tests__/unit/components/features/studios/use-studios-list.spec.ts"
Task T007: "Testes useCreateStudioForm em __tests__/unit/components/features/studios/use-create-studio-form.spec.ts"
Task T008: "Testes useStudioRow em __tests__/unit/components/features/studios/use-studio-row.spec.ts"
Task T009: "Testes useUpdateStudioForm em __tests__/unit/components/features/studios/use-update-studio-form.spec.ts"
Task T010: "Testes useDeleteStudio em __tests__/unit/components/features/studios/use-delete-studio.spec.ts"

# Após T011 (RED confirmado), lançar todas as implementações em paralelo:
Task T012: "Implementar useStudiosList em src/components/features/studios/hooks/use-studios-list.ts"
Task T013: "Implementar useCreateStudioForm em ..."
Task T014: "Implementar useStudioRow em ..."
Task T015: "Implementar useUpdateStudioForm em ..."
Task T016: "Implementar useDeleteStudio em ..."
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup) — T001–T003
2. Phase 2 (Foundational) — T004 (baseline da suíte)
3. Phase 3 (US1 — Estúdios) — T005–T027
4. **STOP and VALIDATE**: rodar gate final de qualidade; abrir PR `refactor(021): 🏢 studios — extrai lógica para hooks`; mergear → **MVP entregue**.

### Incremental Delivery

5. Após US1 mergeado, abrir branches por sub-checkpoint de US2 (uma por vez ou em paralelo se houver capacidade): A → B → C → D → E. Cada uma tem seu PR independente contra `main`.
6. Após US2 (todas as sub-features mergeadas), iniciar US3 (T130–T135) — atualização documental sem código.
7. Polish (T136–T139) em PR final.

### Single Developer (sequencial)

US1 (1 PR) → US2-A (1 PR) → US2-B (1 PR) → US2-C (1 PR) → US2-D (1 PR) → US2-E (1 PR) → US3 (1 PR) → Polish (1 PR). Total: **8 PRs** contra `main`.

### Parallel Team Strategy

Após US1 mergeado, distribuir sub-checkpoints de US2 (A, B, C, D, E) entre 2–5 devs. Cada dev abre seu próprio PR. US3 abre após o último de US2 mergear.

---

## Notes

- **TDD obrigatório** (Princípio V): tasks de teste vêm antes das de implementação dentro de cada hook.
- **Cobertura ≥ 80%** por hook (FR-005 / SC-003); 100% no helper puro `chapter-transitions.ts`.
- **Zero `toast.success`** introduzido — assert explícito nos testes (Princípio VII / XII).
- **Zero regressões** em `bun run test:integration` e `bun run test:e2e` por sub-feature (FR-007 / SC-004).
- **`useForm()` permanece no componente** (R4), hook recebe `form` por argumento.
- **`router.refresh()` permanece** como mecanismo de refetch (R5).
- **Server Components, `components/ui/**`, `components/layout/**` ficam intocados** (FR-012).
- Cada PR commit segue Conventional Commits: `refactor(021): <emoji> <feature> — extrai lógica para hooks`.
- Stop em cada checkpoint para validar a sub-feature isoladamente antes de abrir o próximo PR.
