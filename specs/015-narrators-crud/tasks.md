---

description: "Task list for CRUD de Narradores"
---

# Tasks: CRUD de Narradores

**Input**: Design documents from `/specs/015-narrators-crud/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Obrigatórios (TDD — Princípio V da constituição). Todos os testes DEVEM ser escritos ANTES da implementação e DEVEM falhar antes de serem satisfeitos pelo código de produção.

**Organization**: Tasks agrupadas por user story para permitir implementação e validação independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências incompletas)
- **[Story]**: Mapeia task para user story (US1, US2, US3, US4)
- Todos os caminhos são absolutos ou relativos ao repo root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Instalação de dependências e adição de primitivos UI

- [X] T001 Instalar `@tanstack/react-table` como dependência runtime via `bun add @tanstack/react-table`
- [X] T002 Adicionar componentes shadcn/ui (table, scroll-area, alert-dialog, form, dialog) via `bunx --bun shadcn@latest add table scroll-area alert-dialog form dialog`

**Quality Gate**: Rodar `bun run lint` e `bun run build` — fase não avança com erros/warnings.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, domínio, repository, service e tokens visuais que TODAS as user stories dependem.

**⚠️ CRITICAL**: Nenhuma user story pode começar até esta fase estar completa.

### Banco de Dados

- [X] T003 Adicionar tabela `narrator` em `src/lib/db/schema.ts` (campos id, name, email, createdAt, updatedAt + unique index em email, conforme data-model.md)
- [X] T004 Gerar e aplicar migration com `bunx drizzle-kit generate` + `bun run db:migrate` (arquivo esperado `drizzle/0XXX_narrator_initial.sql`)

### Domínio e Contratos

- [X] T005 [P] Criar classes de erro `NarratorEmailAlreadyInUseError` e `NarratorNotFoundError` em `src/lib/errors/narrator-errors.ts`
- [X] T006 [P] Criar interface `Narrator`, schemas Zod (`narratorFormSchema`, `createNarratorSchema`, `updateNarratorSchema`) e types inferidos em `src/lib/domain/narrator.ts`
- [X] T007 [P] Criar interface `NarratorRepository` em `src/lib/domain/narrator-repository.ts` (métodos findAll, findById, findByEmail, create, update, delete)

### Infraestrutura de Testes

- [X] T008 [P] Criar fake `InMemoryNarratorRepository` em `__tests__/repositories/in-memory-narrator-repository.ts` (implementa NarratorRepository em memória, lança `NarratorEmailAlreadyInUseError` em duplicata)
- [X] T009 [P] Escrever testes unitários dos schemas Zod em `__tests__/unit/domain/narrator-schema.test.ts` (validação de nome min/max, email válido/inválido, trim, lowercase)

### Repository (TDD)

- [X] T010 Escrever testes de integração em `__tests__/integration/repositories/drizzle-narrator-repository.test.ts` cobrindo: create, findAll, findById, findByEmail, update, delete, unique violation → `NarratorEmailAlreadyInUseError`, update/delete em id inexistente → `NarratorNotFoundError` (testes DEVEM falhar antes da implementação)
- [X] T011 Implementar `DrizzleNarratorRepository` em `src/lib/repositories/drizzle/drizzle-narrator-repository.ts` satisfazendo todos os testes de T010 (capturar pg error 23505 para unique_violation; selects explícitos, sem SELECT *)

### Service (TDD)

- [X] T012 Escrever testes unitários em `__tests__/unit/services/narrator-service.test.ts` usando `InMemoryNarratorRepository` (testes DEVEM falhar antes da implementação)
- [X] T013 Implementar `NarratorService` em `src/lib/services/narrator-service.ts` (métodos list, create, update, delete — orquestram repository, sem SQL/HTTP direto)

### Composition Root

- [X] T014 Criar factory `createNarratorService()` em `src/lib/factories/narrator.ts` (instancia `DrizzleNarratorRepository` e `NarratorService`)

### API Response Helpers

- [X] T015 [P] Adicionar helpers `notFoundResponse(code, message)` e `conflictResponse(code, message)` em `src/lib/api/responses.ts` (seguir padrão dos existentes `unauthorizedResponse` e `validationErrorResponse`)

### Design Tokens

- [X] T016 [P] Adicionar override `--destructive` para `html[data-primary-color="red"]` (light + dark) em `src/app/globals.css` (valores OKLCH conforme research.md: `oklch(0.42 0.20 12)` light, `oklch(0.55 0.22 8)` dark)

**Checkpoint**: Fundação pronta — qualquer user story pode começar em paralelo.

**Quality Gate**: Rodar `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run build` — fase não avança com erros/warnings.

---

## Phase 3: User Story 1 - Listar narradores existentes (Priority: P1) 🎯 MVP

**Goal**: Produtor acessa `/narrators` e visualiza tabela sortable com todos os narradores cadastrados; vê estado vazio quando não há registros; tabela envolvida em ScrollArea.

**Independent Test**: Com 3 narradores seed no DB, acessar `/narrators` deve exibir 3 linhas. Remover todos, acessar, deve exibir estado vazio. Clicar em cabeçalho "Nome" alterna sort ascendente/descendente.

### Tests for User Story 1 ⚠️

> **NOTE**: Testes escritos PRIMEIRO, DEVEM falhar antes da implementação.

- [X] T017 [P] [US1] Escrever teste unitário do route handler GET em `__tests__/unit/api/narrators-list.test.ts` (cenários: 401 sem sessão, 200 lista vazia `{ data: [] }`, 200 com items ordenados por createdAt ASC)
- [X] T018 [P] [US1] Escrever teste E2E em `__tests__/e2e/narrators-list.spec.ts` (cenários: seed + listagem, estado vazio, sort por nome ASC/DESC, sort por e-mail, ScrollArea presente; usar helper `loginAsTestUser` de `__tests__/e2e/helpers/auth.ts`)

### Implementation for User Story 1

- [X] T019 [US1] Criar route handler GET em `src/app/api/v1/narrators/route.ts` (usa `auth.api.getSession`, `createNarratorService`, retorna `{ data: Narrator[] }` com 200 e `Cache-Control: no-store` no header — Princípio VIII)
- [X] T020 [P] [US1] Criar componente visual `NarratorRow` em `src/app/(authenticated)/narrators/_components/narrator-row.tsx` (view mode: exibe name, email, ícones Edit/Trash placeholders — sem lógica de ação ainda; usa Button ghost + lucide icons)
- [X] T021 [US1] Criar componente `NarratorsTable` em `src/app/(authenticated)/narrators/_components/narrators-table.tsx` (TanStack Table com sortable columns "Nome" e "E-mail", envolvido em `ScrollArea`, usa shadcn `Table`, renderiza `NarratorRow` por linha, empty state quando `data.length === 0`)
- [X] T022 [US1] Criar client wrapper `NarratorsClient` em `src/app/(authenticated)/narrators/_components/narrators-client.tsx` (`"use client"`, recebe `initialNarrators: Narrator[]` via props, gerencia state local da tabela, renderiza header da página com título/descrição/botão "+ Novo Narrador" renderizado mas `disabled` nesta fase — handler real entra em T028)
- [X] T023 [US1] Criar Server Component `page.tsx` em `src/app/(authenticated)/narrators/page.tsx` (async, chama `createNarratorService().list()`, passa para `NarratorsClient` via prop; envolve em `PageContainer`, `PageHeader`, `PageTitle`, `PageDescription`)

**Checkpoint**: US1 totalmente funcional — listagem, sort e estado vazio funcionam. Ícones de ação ainda não executam nada.

**Quality Gate**: Rodar `bun run lint`, `bun run test:unit`, `bun run test:e2e`, `bun run build` — todos passam sem erros/warnings.

---

## Phase 4: User Story 2 - Criar novo narrador (Priority: P1)

**Goal**: Produtor clica "+ Novo Narrador", preenche nome e e-mail, confirma → registro criado; cancela → linha descartada.

**Independent Test**: Abrir `/narrators`, clicar "+ Novo Narrador", preencher dados válidos, clicar "Confirmar" → nova linha aparece na tabela e persiste após refresh. Testar validações (nome curto, e-mail inválido, e-mail duplicado) e cancelamento.

### Tests for User Story 2 ⚠️

- [X] T024 [P] [US2] Escrever teste unitário do route handler POST em `__tests__/unit/api/narrators-create.test.ts` (cenários: 401 sem sessão, 422 body inválido com `details`, 409 `EMAIL_ALREADY_IN_USE`, 201 com `Location: /api/v1/narrators/:id` e `{ data: Narrator }`)
- [X] T025 [P] [US2] Escrever teste E2E em `__tests__/e2e/narrators-create.spec.ts` (happy path, cancelar descarta linha, validação inline de nome e e-mail, e-mail duplicado mostra erro)

### Implementation for User Story 2

- [X] T026 [US2] Adicionar route handler POST em `src/app/api/v1/narrators/route.ts` (valida com `createNarratorSchema`, chama `service.create`, retorna 201 + `Location: /api/v1/narrators/${id}` + `Cache-Control: no-store`; captura `NarratorEmailAlreadyInUseError` → 409)
- [X] T027 [P] [US2] Criar componente `NarratorNewRow` em `src/app/(authenticated)/narrators/_components/narrator-new-row.tsx` (`useForm` com `zodResolver(narratorFormSchema)`, inputs "Nome" e "E-mail", botões Cancelar/Confirmar; onSubmit chama POST via fetch, em sucesso chama `onCreated(narrator)` callback prop; **em erro de rede/servidor: NÃO fechar a linha, NÃO chamar onCreated, exibir `toast.error(...)` do sonner e manter os valores preenchidos para o usuário tentar novamente**; em 422 exibir mensagens de validação inline; em 409 exibir erro no campo e-mail)
- [X] T028 [US2] Integrar fluxo de criação em `NarratorsClient` — remover `disabled` do botão "+ Novo Narrador"; state `isCreating: boolean`; renderizar `NarratorNewRow` acima da tabela quando `isCreating === true`. **Handler do botão**: (a) se `isCreating === false`, seta `isCreating = true` e renderiza a linha; (b) se `isCreating === true` (linha pendente já existe), **NÃO adiciona outra linha nem fecha a pendente** — apenas chama `focus()` no primeiro input (`name`) da linha pendente via `ref` ou `document.getElementById`. Callback `onCreated` adiciona narrador ao state local, seta `isCreating = false` e chama `router.refresh()`. Callback `onCancelled` do NarratorNewRow seta `isCreating = false`.

**Checkpoint**: US1 + US2 funcionam. Usuário já pode listar e criar narradores.

**Quality Gate**: `bun run lint`, `bun run test:unit`, `bun run test:e2e`, `bun run build` passam.

---

## Phase 5: User Story 3 - Editar narrador existente (Priority: P2)

**Goal**: Produtor clica ícone Editar em uma linha, altera campos, confirma ou cancela (restaura valores originais).

**Independent Test**: Editar um narrador existente, alterar nome, confirmar → valor atualizado persiste após refresh. Reentrar, alterar, cancelar → valor original restaurado. Testar validações e e-mail duplicado.

### Tests for User Story 3 ⚠️

- [X] T029 [P] [US3] Escrever teste unitário do route handler PATCH em `__tests__/unit/api/narrators-update.test.ts` (cenários: 401, 404 `NARRATOR_NOT_FOUND`, 422 body inválido, 409 `EMAIL_ALREADY_IN_USE`, 200 update parcial apenas name, 200 update de ambos campos)
- [X] T030 [P] [US3] Escrever teste E2E em `__tests__/e2e/narrators-update.spec.ts` (happy path, cancelar restaura valores, validação inline, e-mail duplicado mostra erro)

### Implementation for User Story 3

- [X] T031 [US3] Criar route handler PATCH em `src/app/api/v1/narrators/[id]/route.ts` (valida `updateNarratorSchema`, chama `service.update`, trata `NarratorNotFoundError` → 404, `NarratorEmailAlreadyInUseError` → 409, retorna `{ data: Narrator }` com 200 e `Cache-Control: no-store`)
- [X] T032 [US3] Adicionar modo edit a `NarratorRow` em `src/app/(authenticated)/narrators/_components/narrator-row.tsx` (state `isEditing`, `useForm` com defaultValues do narrador, ícone Edit alterna para modo edit, inputs substituem textos, botões Cancel/Confirm substituem ícones Edit/Trash; cancel → `form.reset(originalValues)` + sair edit; confirm → PATCH + callback `onUpdated(narrator)` no sucesso; **em erro de rede/servidor: NÃO sair do modo edit, NÃO chamar onUpdated, exibir `toast.error(...)` do sonner e manter os valores editados para o usuário tentar novamente**; em 422 exibir mensagens inline; em 409 exibir erro no campo e-mail; em 404 mostrar toast "narrador não existe mais" e sair do edit)
- [X] T033 [US3] Integrar callback `onUpdated` em `NarratorsTable` / `NarratorsClient` (atualiza narrador no state local + `router.refresh()`)

**Checkpoint**: US1 + US2 + US3 funcionam. Ícone Excluir ainda é placeholder.

**Quality Gate**: `bun run lint`, `bun run test:unit`, `bun run test:e2e`, `bun run build` passam.

---

## Phase 6: User Story 4 - Excluir narrador (Priority: P2)

**Goal**: Produtor clica ícone Excluir → modal de confirmação aparece → confirma remove registro; cancela fecha modal sem efeito.

**Independent Test**: Excluir narrador via modal "Excluir" → linha desaparece, registro removido do DB. Pressionar ESC ou clicar "Cancelar" → modal fecha, nada muda. Verificar que ícone trash usa `--destructive` (distinto de primary em todas as 5 cores).

### Tests for User Story 4 ⚠️

- [X] T034 [P] [US4] Escrever teste unitário do route handler DELETE em `__tests__/unit/api/narrators-delete.test.ts` (cenários: 401, 404 `NARRATOR_NOT_FOUND`, 204 sucesso sem body)
- [X] T035 [P] [US4] Escrever teste E2E em `__tests__/e2e/narrators-delete.spec.ts` (happy path, cancelar no modal, ESC fecha modal, título do modal menciona nome do narrador)

### Implementation for User Story 4

- [X] T036 [US4] Criar route handler DELETE em `src/app/api/v1/narrators/[id]/route.ts` (chama `service.delete`, trata `NarratorNotFoundError` → 404, retorna 204 sem body com `Cache-Control: no-store` no header; nota: constraint `NARRATOR_HAS_ACTIVE_CHAPTERS` fica diferida — ver research.md e contracts/narrators-api.md)
- [X] T037 [P] [US4] Criar componente `DeleteNarratorDialog` em `src/app/(authenticated)/narrators/_components/delete-narrator-dialog.tsx` (usa `AlertDialog` shadcn, recebe `narrator`, `open`, `onOpenChange`, `onConfirmed` props; título menciona nome do narrador; `AlertDialogAction` com `variant="destructive"`; em confirm chama DELETE via fetch, em sucesso chama `onConfirmed(narrator.id)` e fecha modal; **em erro de rede/servidor: NÃO fechar o modal, NÃO chamar onConfirmed, exibir `toast.error(...)` do sonner; em 404 fechar modal e chamar onConfirmed mesmo assim (registro já não existe)**)
- [X] T038 [US4] Integrar `DeleteNarratorDialog` em `NarratorRow`/`NarratorsClient` (state `narratorToDelete: Narrator | null`; ícone Trash seta o estado e abre modal; callback `onConfirmed` remove do state local + `router.refresh()`)

**Checkpoint**: CRUD completo funcional. Todas as 4 user stories passam nos testes E2E.

**Quality Gate**: `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`, `bun run build` passam sem erros/warnings.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validação de qualidade, acessibilidade, temas, cores primárias, operações simultâneas, tamanhos de fonte e responsividade.

- [ ] T039 [P] Adicionar teste de acessibilidade no E2E (usar `@axe-core/playwright` em `__tests__/e2e/narrators-accessibility.spec.ts` — zero violations na página `/narrators` e no modal de exclusão)
- [ ] T040 [P] Adicionar teste E2E de tema escuro em `__tests__/e2e/narrators-dark-mode.spec.ts` (verifica que tabela, modal e inputs funcionam em modo dark)
- [ ] T041 [P] Adicionar teste E2E variando cor primária em `__tests__/e2e/narrators-primary-colors.spec.ts` (iterar pelas 5 variantes blue/orange/green/red/amber e verificar que o ícone/botão destructive continua visualmente distinto — screenshot assertion ou verificação de token CSS `--destructive` via `getComputedStyle`; para variante `red` assertar que `--destructive` ≠ `--primary` via computed styles)
- [ ] T042 [P] Adicionar teste E2E de operações simultâneas em `__tests__/e2e/narrators-concurrent-ops.spec.ts` (FR-011: abrir 2 linhas em modo edit + clicar "+ Novo Narrador" + verificar que todas coexistem; alterar uma sem afetar as outras; confirmar uma sem fechar as demais)
- [ ] T043 [P] Adicionar teste E2E de tamanhos de fonte em `__tests__/e2e/narrators-font-size.spec.ts` (SC-006: iterar pelas 3 opções small/medium/large via `/settings`, voltar para `/narrators` e validar que tabela, modal e inputs não quebram o layout; ScrollArea funciona em todas)
- [ ] T044 [P] Adicionar teste E2E responsivo em `__tests__/e2e/narrators-responsive.spec.ts` (Princípio VII mobile first: validar `/narrators` em viewports 375px, 768px, 1440px; tabela, header e botão "+ Novo Narrador" permanecem funcionais e sem overflow horizontal)
- [ ] T045 Adicionar entrada no sidebar/navegação (verificar se `/narrators` já está em `NAV_ITEMS` — caso contrário, adicionar ícone e label em `src/components/layout/sidebar-nav-items.ts` ou equivalente)
- [ ] T046 Executar manualmente `quickstart.md` do começo ao fim (11 passos) e documentar qualquer desvio
- [ ] T047 Quality gate final: rodar `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`, `bun run build` — todos passam sem erros/warnings

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — pode começar imediatamente
- **Foundational (Phase 2)**: Depende de Phase 1 — BLOQUEIA todas as user stories
- **US1 (Phase 3)**: Depende de Foundational — MVP
- **US2 (Phase 4)**: Depende de Foundational + US1 (integra `NewNarratorRow` em `NarratorsClient`)
- **US3 (Phase 5)**: Depende de Foundational + US1 (modifica `NarratorRow` criado em US1)
- **US4 (Phase 6)**: Depende de Foundational + US1 (wire-up no ícone Trash de `NarratorRow`)
- **Polish (Phase 7)**: Depende de todas as user stories desejadas

### User Story Dependencies

- **US1 (P1, MVP)**: Nenhuma dependência em outras stories — independente
- **US2 (P1)**: Compartilha `NarratorsClient` com US1 — pode desenvolver após US1 estar merged
- **US3 (P2)**: Compartilha `NarratorRow` com US1 — pode desenvolver após US1 estar merged
- **US4 (P2)**: Reutiliza `NarratorRow` de US1 (trash icon) — pode desenvolver em paralelo com US3 se for cuidadoso com merge conflicts

### Within Each User Story

- Testes (unit + E2E) escritos e FALHANDO **antes** da implementação
- Models/Schemas/Interfaces antes de repositories (quando aplicável)
- Route handlers antes de UI (UI depende do endpoint funcionando)
- Component atômico antes de composição

### Parallel Opportunities

- Setup: T001 sequencial, T002 é comando único (tudo junto)
- Foundational: T005, T006, T007 [P] (arquivos diferentes); T008, T009 [P]; T015, T016 [P]
- US1: T017, T018 [P] (testes em arquivos diferentes); T020 [P] com T019
- US2: T024, T025 [P]; T027 [P] com T026
- US3: T029, T030 [P]
- US4: T034, T035 [P]; T037 [P] com T036
- Polish: T039, T040, T041, T042, T043, T044 [P] (todos em arquivos E2E distintos)

---

## Parallel Example: User Story 1

```bash
# Testes paralelos para US1:
Task: "Unit test GET handler em __tests__/unit/api/narrators-list.test.ts"
Task: "E2E test listing em __tests__/e2e/narrators-list.spec.ts"

# Implementações com paralelismo parcial (diferentes arquivos):
Task: "GET route handler em src/app/api/v1/narrators/route.ts"
Task: "NarratorRow component em src/app/(authenticated)/narrators/_components/narrator-row.tsx"
# (NarratorsTable, NarratorsClient, page.tsx são sequenciais — cada um consome o anterior)
```

---

## Implementation Strategy

### MVP First (apenas User Story 1)

1. Completar Phase 1 (Setup)
2. Completar Phase 2 (Foundational) — CRÍTICO
3. Completar Phase 3 (US1)
4. **STOP e VALIDAR**: acessar `/narrators`, verificar listagem, sort, empty state, ScrollArea
5. Merge + deploy como MVP

### Incremental Delivery

1. Setup + Foundational → base pronta
2. US1 → Listagem funcional → MVP
3. US2 → Criação funcional → incremento 2
4. US3 → Edição funcional → incremento 3
5. US4 → Exclusão funcional → incremento 4
6. Polish → feature completa

### Parallel Team Strategy

Com múltiplos devs (opcional):

1. Time completa Setup + Foundational juntos
2. Após Foundational:
   - Dev A: US1 (MVP, tem prioridade)
3. Após US1 merged:
   - Dev A: US3 (edição)
   - Dev B: US2 (criação)
   - Dev C: US4 (exclusão)
4. Polish feito em conjunto

---

## Notes

- Constituição exige TDD rigoroso (Princípio V) — **nenhum código de produção antes de um teste falhando**.
- `vi.mock()` é proibido para módulos internos — usar `InMemoryNarratorRepository` (fake via DI) e `vi.fn()` tipados.
- `vi.mock()` permitido apenas para allowlist (`next/headers`, `next/navigation`, `@/lib/db`, `@/lib/env`).
- Componentes UI são puramente visuais — lógica de estado fica em `NarratorsClient`, lógica de form em hooks do RHF dentro de `NarratorRow` / `NarratorNewRow`.
- `router.refresh()` (Next.js) após mutations garante resync com servidor sem precisar reimplementar cache.
- Commits convencionais via `/conventional-commits` após cada grupo lógico de tasks.
- Ao finalizar: `/finish-task` para abrir PR contra `main`.
- A constraint `NARRATOR_HAS_ACTIVE_CHAPTERS` (FR-010) fica diferida — documentada em `futuras-features.md` para implementação junto ao CRUD de Capítulos.
