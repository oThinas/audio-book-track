---

description: "Task list for feature 017-narrator-remove-email"
---

# Tasks: Remoção do campo e-mail de Narradores (com unicidade em `name`)

**Input**: Design documents from `/specs/017-narrator-remove-email/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/narrators-api.md, quickstart.md

**Tests**: Obrigatórios (Princípio V — TDD). Todos os testes afetados DEVEM ser atualizados ANTES da alteração do código de produção correspondente e DEVEM falhar contra o código legado antes da correção.

**Organization**: Feature refactor com **uma única user story (P1)**. Além de remover `email`, a feature **realoca** a constraint única do `email` para o `name`: muda DB (troca de índice), domain (erro renomeado), repository (`findByEmail` → `findByName`), API (`EMAIL_ALREADY_IN_USE` → `NAME_ALREADY_IN_USE`) e UI (mensagem de erro no campo nome).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[US1]**: Pertence à User Story 1 (única da feature)
- Todos os caminhos são absolutos a partir da raiz do repo

## Path Conventions

Projeto Next.js monorepo: código em `src/`, testes em `__tests__/`, migrações em `drizzle/`, docs em `docs/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Garantir ambiente limpo antes de começar.

- [X] T001 Verificar que a branch `017-narrator-remove-email` está checked out e não há mudanças pendentes não relacionadas: `git status && git branch --show-current`
- [X] T002 Confirmar estado do banco de dev: `psql audiobook_track -c '\d narrator'` — deve listar colunas `id`, `name`, `email`, `created_at`, `updated_at` e o índice `narrator_email_unique`
- [X] T003 Checar se já há duplicatas em `name` na base de dev (bloqueador para a migração): `psql audiobook_track -c "SELECT name, count(*) FROM narrator GROUP BY name HAVING count(*) > 1;"` — se houver linhas, deduplicar manualmente antes da T022

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Sem tasks — toda a infraestrutura necessária já existe.

_(Vazia.)_

**Checkpoint**: Avançar para US1.

---

## Phase 3: User Story 1 — Gerenciar narradores apenas pelo nome (Priority: P1) 🎯 MVP

**Goal**: Remover o campo `email`, realocar a unicidade do `email` para o `name` (constraint + erro de domínio + mapeamento API + mensagem na UI), mantendo criar/editar/excluir/listar funcionais apenas com `name`.

**Independent Test**: Seguir [quickstart.md](./quickstart.md) §4–5: acessar `/narrators`, verificar que a coluna/input de e-mail sumiu, criar narradores com nomes distintos, confirmar que nome duplicado é **bloqueado** com mensagem "Nome já cadastrado" (UI e API `409 NAME_ALREADY_IN_USE`), e que renomear para o próprio nome (idempotente) é aceito.

### Tests for User Story 1 — Atualizar PRIMEIRO (RED) ⚠️

> Atualizar **todos** os testes abaixo antes de qualquer alteração em código de produção. Rodar a suíte parcial para cada grupo e confirmar que falham contra o código atual (que ainda tem `email`). Isso garante que estamos guiando a mudança com teste.

#### Unit — domain & service

- [X] T004 [P] [US1] Atualizar `__tests__/unit/services/narrator-service.test.ts`: remover fixtures com `email`; ajustar `Narrator` fake para o shape `{ id, name, createdAt, updatedAt }`; substituir o caso de "unique email" por "unique name"; testes devem cobrir que `NarratorNameAlreadyInUseError` se propaga do repository fake para o chamador
- [X] T005 [P] [US1] Se houver `__tests__/unit/domain/narrator*.test.ts`, remover asserts sobre `email` nos schemas Zod; adicionar caso que comprova que payload `{ name, email }` é aceito mas `email` é descartado silenciosamente; nome é preservado com `trim` e sem lowercase

#### Unit — API handlers

- [X] T006 [P] [US1] Atualizar `__tests__/unit/api/narrators-create.test.ts`: payloads de POST sem `email`; substituir caso `409 EMAIL_ALREADY_IN_USE` por `409 NAME_ALREADY_IN_USE`; trocar import de `NarratorEmailAlreadyInUseError` por `NarratorNameAlreadyInUseError`; adicionar caso que confirma que POST com `email` extra responde 201 e objeto retornado não contém `email`
- [X] T007 [P] [US1] Atualizar `__tests__/unit/api/narrators-update.test.ts`: payloads de PATCH sem `email`; substituir caso `409 EMAIL_ALREADY_IN_USE` por `409 NAME_ALREADY_IN_USE`; adicionar caso de PATCH mantendo o mesmo `name` (idempotente) — NÃO deve retornar `409`; confirmar que PATCH com `email` extra é aceito e ignorado
- [X] T008 [P] [US1] Atualizar `__tests__/unit/api/narrators-list.test.ts`: fixtures e asserts sem `email`
- [X] T009 [P] [US1] Revisar `__tests__/unit/api/narrators-delete.test.ts` — deve estar inalterado; remover qualquer fixture colateral com `email`

#### Integration — Drizzle repository

- [X] T010 [P] [US1] Atualizar `__tests__/integration/repositories/drizzle-narrator-repository.test.ts`: substituir testes de `findByEmail` por testes de `findByName` (match exato, case-sensitive; retorna `null` para nome inexistente); substituir suite "email unique" por "name unique" (POST duplicado lança `NarratorNameAlreadyInUseError`, PATCH de um narrador para o nome de outro também); remover `email` dos inputs; adicionar teste que confirma PATCH para o próprio nome é no-op de conflito (não lança); adicionar teste que confirma que narrador com mesmo `name` mas capitalização diferente é aceito (case-sensitive)

#### E2E

- [X] T011 [P] [US1] Atualizar `__tests__/e2e/narrators-list.spec.ts`: remover asserts da coluna/header "E-mail"; remover locator `data-testid="narrator-email"`
- [X] T012 [P] [US1] Atualizar `__tests__/e2e/narrators-create.spec.ts`: remover passos de preenchimento do input de email; remover asserts de validação de email; adicionar assert de que a nova linha editável tem apenas o input `name`; **adicionar caso** de criação com nome duplicado → mensagem "Nome já cadastrado" é exibida no campo
- [X] T013 [P] [US1] Atualizar `__tests__/e2e/narrators-update.spec.ts`: remover alteração do campo email e assert de conflito 409 por email; **adicionar caso** de edição para nome já existente em outro narrador → mensagem "Nome já cadastrado"; **adicionar caso** de edição mantendo o mesmo nome → sucesso sem erro
- [X] T014 [P] [US1] Atualizar `__tests__/e2e/narrators-accessibility.spec.ts`: revisar labels/aria esperados (remover `narrator-new-email`, `narrator-edit-email-<id>`, label "E-mail"); manter labels do input `name`
- [X] T015 [P] [US1] Atualizar `__tests__/e2e/narrators-concurrent-ops.spec.ts`: remover fixtures e steps que usam `email`; se a suite testa dois produtores editando simultaneamente, substituir o campo alterado por `name`
- [X] T016 [P] [US1] Atualizar `__tests__/e2e/narrators-responsive.spec.ts`: revisar breakpoints de largura da tabela após remoção da coluna; ajustar asserts de layout se necessário
- [X] T017 [P] [US1] Atualizar `__tests__/e2e/narrators-font-size.spec.ts`: revisar layout da tabela nos 3 tamanhos de fonte após remoção da coluna
- [X] T018 [P] [US1] Revisar `__tests__/e2e/narrators-dark-mode.spec.ts`, `narrators-delete.spec.ts`, `narrators-primary-colors.spec.ts` — remover eventuais fixtures com email e confirmar que não há assert da coluna de email

#### Factories & in-memory repo (test helpers)

- [X] T019 [P] [US1] Atualizar `__tests__/repositories/in-memory-narrator-repository.ts`: substituir `findByEmail` por `findByName` (match exato, case-sensitive); remover normalização `.toLowerCase()`; aplicar apenas `.trim()` em `name` no `create`/`update`; substituir `NarratorEmailAlreadyInUseError` por `NarratorNameAlreadyInUseError` nos throws; garantir que PATCH para o próprio `name` não lança
- [X] T020 [P] [US1] Se `__tests__/helpers/factories.ts` tiver `createTestNarrator`, remover o parâmetro `email` e seu default. Se não houver, adicionar factory simples `createTestNarrator(db, { name }: { name?: string })` para facilitar testes de unicidade (nome default aleatório via `randomUUID().slice(0, 8)`)

**Checkpoint Tests-First**: rodar `bun run test:unit` + `bun run test:integration` + `bunx playwright test __tests__/e2e/narrators-*` — toda a suíte afetada DEVE ter falhas. Se algum teste novo passar sem mudança no código, provavelmente o assert não está apontado ao ponto certo.

### Implementation for User Story 1 — de dentro para fora (GREEN)

> Ordem canônica: schema DB → migração → domain → repository interface → erros → repository concreto → in-memory repo → service → API routes → UI → seed. Cada passo depende do anterior. Após cada camada, rodar os testes daquela camada.

#### 1. Schema DB e migração

- [X] T021 [US1] Editar `src/lib/db/schema.ts`: (a) remover a linha `email: text("email").notNull(),`; (b) **substituir** o callback de config `(table) => [uniqueIndex("narrator_email_unique").on(table.email)]` por `(table) => [uniqueIndex("narrator_name_unique").on(table.name)]`
- [X] T022 [US1] Gerar migração: `bun run db:generate` — confirmar que o arquivo novo em `drizzle/` contém `DROP INDEX "narrator_email_unique"`, `ALTER TABLE "narrator" DROP COLUMN "email"` e `CREATE UNIQUE INDEX "narrator_name_unique" ON "narrator" ("name")`
- [X] T023 [US1] Aplicar migração ao banco de dev: `bun run db:migrate`. Se houver erro de violação de unicidade ao criar o índice, voltar para T003 e deduplicar. Confirmar estado final com `psql audiobook_track -c '\d narrator'`: colunas sem `email`, índice `narrator_name_unique` UNIQUE presente

#### 2. Domain e repository interface

- [X] T024 [US1] Editar `src/lib/domain/narrator.ts`: remover `email` da interface `Narrator`; remover `email: ...` dos schemas Zod; manter `.trim()` em `name` e ajustar para NÃO aplicar `.toLowerCase()` (se estava sendo aplicado — confirmar pela implementação atual)
- [X] T025 [US1] Editar `src/lib/domain/narrator-repository.ts`: substituir a linha `findByEmail(email: string): Promise<Narrator | null>;` por `findByName(name: string): Promise<Narrator | null>;`
- [X] T026 [US1] Editar `src/lib/errors/narrator-errors.ts`: **renomear** a classe `NarratorEmailAlreadyInUseError` para `NarratorNameAlreadyInUseError`; ajustar a mensagem do construtor para `Nome já cadastrado: ${name}`; o parâmetro passa a ser `name: string`; manter `NarratorNotFoundError` inalterado

#### 3. Repositories (concreto e in-memory)

- [X] T027 [US1] Editar `src/lib/repositories/drizzle/drizzle-narrator-repository.ts`: (a) substituir `findByEmail` por `findByName` (select com `where(eq(narrator.name, name))`); (b) **manter** `POSTGRES_UNIQUE_VIOLATION`, `hasUniqueViolationCode`, `isUniqueViolation`; (c) remover `email` de `NARRATOR_COLUMNS`; (d) remover `email` dos objetos passados a `.values()` e `.set()`; (e) em `create`, trocar `NarratorEmailAlreadyInUseError(input.email)` por `NarratorNameAlreadyInUseError(input.name)`; (f) em `update`, trocar a condição `input.email !== undefined` para `input.name !== undefined` e lançar `NarratorNameAlreadyInUseError(input.name)`; ajustar imports
- [X] T028 [US1] (Nota: `InMemoryNarratorRepository` já foi editado na T019 junto com os testes — confirmar que a alteração compila após T024–T026)

#### 4. API routes

- [X] T029 [US1] Editar `src/app/api/v1/narrators/route.ts`: trocar import de `NarratorEmailAlreadyInUseError` por `NarratorNameAlreadyInUseError`; no bloco `catch` do `handleNarratorsCreate`, trocar a classe e o código do `conflictResponse` para `conflictResponse("NAME_ALREADY_IN_USE", "Nome já cadastrado")`
- [X] T030 [US1] Editar `src/app/api/v1/narrators/[id]/route.ts`: mesma troca no `handleNarratorsUpdate` — `NarratorNameAlreadyInUseError` + `conflictResponse("NAME_ALREADY_IN_USE", "Nome já cadastrado")`

#### 5. UI components

- [X] T031 [US1] Editar `src/app/(authenticated)/narrators/_components/narrators-table.tsx`: remover a coluna `email` do array `columns`; remover branch `columnId === "email"` no switch de largura/alinhamento; ajustar largura da coluna "Nome" para ocupar o espaço bem (usar tokens Tailwind, sem hardcode)
- [X] T032 [US1] Editar `src/app/(authenticated)/narrators/_components/narrator-row.tsx`: remover `emailFieldId`, `email` de `defaultValues`, bloco do `<Input type="email">` + label + mensagem de erro `errors.email`, `<TableCell data-testid="narrator-email">`; **trocar** o handler de conflito para mapear `code === "NAME_ALREADY_IN_USE"` (ou detecção equivalente baseada no `details`/`field`) em `setError("name", { message: "Nome já cadastrado" })`; remover branch `detail.field === "email"` e adicionar/ajustar branch para `detail.field === "name"`
- [X] T033 [US1] Editar `src/app/(authenticated)/narrators/_components/narrator-new-row.tsx`: remover `email: ""` de `defaultValues`, bloco do input de email (label, Input, mensagem de erro); trocar `setError("email", ...)` por `setError("name", { message: "Nome já cadastrado" })` no handler de conflito; ajustar branch de detecção do erro para código `NAME_ALREADY_IN_USE`

#### 6. Seed de dev

- [X] T034 [US1] Revisar `src/lib/db/seed.ts`: se houver inserts de narrador com `email`, remover o campo; **garantir** que os nomes inseridos sejam únicos entre si (se o seed tiver dois "Narrador Teste", ajustar). `src/lib/db/seed-test.ts` NÃO deve ser tocado (regra do projeto)

**Checkpoint US1**: rodar `bun run test:unit`, `bun run test:integration` e testes E2E específicos de narradores. Todos verdes. Abrir `http://localhost:1197/narrators` em dev e validar fluxo manual conforme [quickstart.md](./quickstart.md) §4.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Documentação e limpeza final.

- [X] T035 [P] Atualizar tabela de domínio em `CLAUDE.md` (seção "Modelo de domínio (resumo)"): remover qualquer menção a `email` na linha de Narrador; adicionar nota de que `name` é único (case-sensitive, após `trim`)
- [X] T036 [P] Se existir `docs/futuras-features.md` ou similar mencionando e-mail do narrador para integração Google Drive (herdado da feature 015), remover a nota obsoleta ou registrar que a integração foi descartada
- [X] T037 Executar greps de verificação do [quickstart.md](./quickstart.md) §"Artefatos verificáveis":
  - DEVEM retornar **zero**: `rg '\bemail\b' src/lib/domain/narrator.ts src/lib/domain/narrator-repository.ts`; `rg '\bemail\b' src/lib/repositories/drizzle/drizzle-narrator-repository.ts`; `rg '\bemail\b' 'src/app/(authenticated)/narrators'`; `rg 'NarratorEmailAlreadyInUseError' src/ __tests__/`; `rg 'findByEmail' src/ __tests__/`; `rg 'narrator_email_unique' src/lib/db/schema.ts`
  - DEVEM retornar match: `rg 'narrator_name_unique' src/lib/db/schema.ts`; `rg 'NarratorNameAlreadyInUseError' src/lib/errors/narrator-errors.ts`; `rg 'findByName' src/lib/domain/narrator-repository.ts`; `rg 'NAME_ALREADY_IN_USE' src/app/api/v1/narrators/`
- [X] T038 Rodar validação manual completa de [quickstart.md](./quickstart.md) (passos 4 e 5) — login, CRUD completo via UI incluindo casos de nome duplicado e idempotência, curls da API

---

## Final Quality Gate (single, before PR)

Per Constitution Principle XVI, quality checks are NOT run per-phase.
Run them once here, before marking the feature done or opening the PR:

- [x] `bun run lint` — zero erros e zero warnings
- [x] `bun run test:unit` — toda a suíte passando
- [x] `bun run test:integration` — toda a suíte passando
- [x] `bun run test:e2e` — especialmente `narrators-*.spec.ts`
- [x] `bun run build` — build de produção compila sem erros

Se qualquer verificação falhar, a feature não está pronta.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — roda imediatamente
- **Foundational (Phase 2)**: Vazia
- **US1 (Phase 3)**: depende do Setup concluído
- **Polish (Phase N)**: depende da US1 concluída
- **Final Quality Gate**: depende de Polish concluído

### Within US1

1. **Testes primeiro** (T004–T020): podem todos rodar em paralelo pois editam arquivos diferentes
2. **Checkpoint Tests-First**: suíte parcial falha
3. **Implementação**: sequencial por camadas:
   - T021 → T022 → T023 (schema + migração + aplicar)
   - T024 → T025 → T026 (domain + interface + erros renomeado) — depois de T021
   - T027 (drizzle repo) — depois de T024, T025, T026
   - T028 (confirmação do in-memory repo já editado em T019) — depois de T024, T025, T026
   - T029, T030 (API routes) [P entre si] — depois de T026
   - T031, T032, T033 (UI) [P entre si] — depois de T024
   - T034 (seed) — depois de T023 (base com constraint nova)
4. **Checkpoint US1**: toda a suíte de narradores verde + smoke manual

### Parallel Opportunities

- **Tests-First (T004–T020)**: 17 tasks paralelas, arquivos distintos
- **API routes (T029, T030)**: paralelos entre si
- **UI components (T031, T032, T033)**: paralelos entre si
- **Polish (T035, T036)**: paralelos entre si

### Sequential Constraints

- T021 **DEVE** vir antes de T022 (schema antes de gerar migration)
- T022 **DEVE** vir antes de T023 (gerar antes de aplicar)
- T003 (check de duplicatas) **DEVE** ser resolvido antes de T023 — caso contrário a migração falha
- T024 bloqueia T027 (domain types antes do repo usá-los)
- T026 bloqueia T027, T029, T030 (erro renomeado antes dos call-sites)
- T025 bloqueia T027 (interface antes da implementação)

---

## Parallel Example: Tests-First em US1

```bash
# Rodar todos os updates de teste em paralelo:
Task T004: __tests__/unit/services/narrator-service.test.ts
Task T006: __tests__/unit/api/narrators-create.test.ts
Task T007: __tests__/unit/api/narrators-update.test.ts
Task T008: __tests__/unit/api/narrators-list.test.ts
Task T010: __tests__/integration/repositories/drizzle-narrator-repository.test.ts
Task T011: __tests__/e2e/narrators-list.spec.ts
Task T012: __tests__/e2e/narrators-create.spec.ts
Task T013: __tests__/e2e/narrators-update.spec.ts
Task T014: __tests__/e2e/narrators-accessibility.spec.ts
Task T015: __tests__/e2e/narrators-concurrent-ops.spec.ts
Task T016: __tests__/e2e/narrators-responsive.spec.ts
Task T017: __tests__/e2e/narrators-font-size.spec.ts
Task T019: __tests__/repositories/in-memory-narrator-repository.ts
```

## Parallel Example: UI components em US1

```bash
# Após T024 (domain atualizado), UI components em paralelo:
Task T031: Editar narrators-table.tsx
Task T032: Editar narrator-row.tsx
Task T033: Editar narrator-new-row.tsx
```

---

## Implementation Strategy

### MVP First (US1 é a totalidade)

1. Phase 1 Setup (T001–T003)
2. Phase 3 US1 em TDD:
   a. Tests-First em paralelo (T004–T020)
   b. Confirmar vermelho
   c. Implementação em camadas (T021–T034)
   d. Confirmar verde
3. Phase N Polish (T035–T038)
4. Final Quality Gate
5. `/finish-task` → PR contra `main`

### Single Developer

Sequência recomendada:

1. T001–T003 (setup + check de duplicatas)
2. Bloco de testes em paralelo (T004–T020) — rodar suítes e confirmar vermelho
3. T021 → T022 → T023 (DB)
4. T024 → T025 → T026 (domain + erro renomeado)
5. T027 → T028 (repos)
6. T029, T030 em paralelo (API)
7. T031, T032, T033 em paralelo (UI)
8. T034 (seed)
9. Rodar testes afetados localmente; confirmar verde
10. T035–T038 (polish)
11. Final Quality Gate
12. Commit + PR

---

## Notes

- [P] tasks = arquivos distintos, sem dependência pendente
- Cada teste atualizado DEVE falhar antes da implementação da camada correspondente
- Commits convencionais recomendados por camada:
  - `test: update narrator tests for email removal and name uniqueness`
  - `refactor(db): drop narrator.email, swap unique index to name`
  - `refactor(narrators): rename domain error email→name`
  - `refactor(narrators): replace findByEmail with findByName in repositories`
  - `refactor(api): map name uniqueness conflict to NAME_ALREADY_IN_USE`
  - `refactor(ui): remove narrator email input; wire name duplicate error`
  - `docs(narrators): update domain table and quickstart`
- Rodar apenas os testes diretamente afetados durante a implementação (Princípio XVI). A suíte completa só no Final Quality Gate.
- Se o grep de T037 encontrar ocorrência inesperada, investigar antes de commitar.
