---

description: "Tasks for 016-test-db-isolation"
---

# Tasks: Test Database Isolation

**Input**: Design documents from `/specs/016-test-db-isolation/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/test-bootstrap-contract.md](./contracts/test-bootstrap-contract.md)

**Tests**: Obrigatórios (constituição exige TDD; cobertura ≥ 80%). Todo item de "Tests" abaixo DEVE ficar RED antes de sua implementação correspondente.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- File paths are absolute relative to repo root

## Conventions

- **Suffix canônico de arquivo de teste**: `.spec.ts` para unit, integration e E2E. Arquivos legados `*.test.ts` são renomeados no curso da feature quando tocados.
- **Nome canônico da base de teste**: `audiobook_track_test` (sem underscores entre `audio` e `book`). Qualquer referência legada a `audio_book_track_test` deve ser substituída.

## Path Conventions

Monorepo Next.js single-project:
- App: `src/`
- Testes: `__tests__/`
- Scripts: `scripts/`
- Migrations Drizzle: `drizzle/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Artefatos compartilhados por todas as histórias — arquivos de configuração e esqueletos de diretório.

- [~] T001 Skipped — directory will be created with real files in Phase 4 (no `.gitkeep` needed)
- [~] T002 Skipped — directory will be created with real files in Phase 2 (no `.gitkeep` needed)
- [X] T003 [P] Add `.env.test` to `.gitignore` in `.gitignore`
- [~] T004 Skipped — `TEST_DATABASE_URL` lives only in `.env.test.example` (kept out of `.env.example` by design)
- [X] T005 [P] Create `.env.test.example` as template for local test env in `.env.test.example`

**Quality Gate**: Nenhum script é adicionado ao `package.json` ainda; fase apenas prepara terreno.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infra que US1, US2, US3, US4 e US5 dependem — validação de env, extensão do migrate CLI, helpers de schema, e script de bootstrap da base de teste.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests (foundation)

- [X] T006 [P] Write unit test for env validation in `__tests__/unit/env/test-database-url.spec.ts`
- [X] T007 [P] Write unit test for `buildWorkerSchemaName(index)` in `__tests__/unit/db/test-schema.spec.ts`
- [X] T008 [P] Write unit test for migrate CLI arg parsing in `__tests__/unit/db/migrate-cli.spec.ts`

### Implementation (foundation)

- [X] T009 Extract env schema to `src/lib/env/schema.ts` with `TEST_DATABASE_URL` (optional) + `superRefine` when `NODE_ENV=test`
- [X] T010 [P] Create schema helpers (`buildWorkerSchemaName`, `createWorkerSchema`, `dropWorkerSchema`, `cleanOrphanSchemas`) in `src/lib/db/test-schema.ts`
- [X] T011 Extend migrate CLI with `parseMigrateArgs`, `runMigrations`, `--url`/`--schema` flags in `src/lib/db/migrate.ts`
- [X] T012 [P] Idempotent `ensure-test-db.ts` in `scripts/db/ensure-test-db.ts`
- [X] T013 [P] Orphan-schema cleanup script in `scripts/db/clean-orphan-schemas.ts`
- [X] T014 Add `db:test:setup`, `db:test:seed`, `db:test:clean-orphans` and force `NODE_ENV=test` on test scripts in `package.json` — note: `db:test:setup` will chain `seed-test.ts` in Phase 6 once it exists
- [X] T015 `bun run lint` clean; `bun run test:unit` — 131 tests passing (3 new specs green)

**Checkpoint**: Foundation ready — user stories can proceed.

**Quality Gate**: `bun run lint` sem warnings, `bun run test:unit` verde.

---

## Phase 3: User Story 1 - Bancos dev/test fisicamente separados (Priority: P1) 🎯 MVP

**Goal**: Garantir que testes (integration + unit com DB) operam exclusivamente em `audiobook_track_test`, deixando `audiobook_track` intocada.

**Independent Test**: Popular a base de dev com um registro, rodar `bun run test:integration`, inspecionar a base de dev — o registro permanece inalterado e a base de teste contém tabelas migradas.

### Tests (US1)

- [ ] T016 [P] [US1] Write integration test that asserts connection URL used in tests is `TEST_DATABASE_URL` (compares against `process.env.DATABASE_URL`) in `__tests__/integration/infra/test-db-connection.spec.ts`
- [ ] T017 [P] [US1] Write integration test proving `BEGIN/ROLLBACK` rollback works against the test DB `public` schema in `__tests__/integration/infra/rollback-isolation.spec.ts`

### Implementation (US1)

- [ ] T018 [US1] Update `getPool()` to read `TEST_DATABASE_URL` in `__tests__/helpers/db.ts`
- [ ] T019 [US1] Create Vitest global setup that runs migrations in `public` of test DB once before integration suite in `__tests__/integration/global-setup.ts`
- [ ] T020 [US1] Register `globalSetup` in `vitest.config.ts` for the integration project in `vitest.config.ts`
- [ ] T021 [US1] Manual verification: write `DEV_RECORD` row into local `audiobook_track`, run `bun run test:integration`, assert row still present; document in `specs/016-test-db-isolation/quickstart.md` validation section

**Checkpoint US1**: Integration tests 100% em test DB, dev DB intacta.

**Quality Gate**: `bun run lint`, `bun run test:unit`, `bun run test:integration` — todos verdes.

---

## Phase 4: User Story 2 - Testes E2E paralelos sem interferência (Priority: P1)

**Goal**: Cada worker Playwright opera em schema Postgres isolado, com Next.js próprio em porta própria; `fullyParallel: true` funciona sem flakes.

**Independent Test**: Rodar 2 testes E2E que criam entidades com o mesmo nome em workers diferentes ao mesmo tempo — ambos passam.

### Tests (US2)

- [ ] T022 [P] [US2] Write integration test asserting `createWorkerSchema/dropWorkerSchema` round-trip (schema exists after create, gone after drop) in `__tests__/integration/infra/worker-schema-lifecycle.spec.ts`
- [ ] T023 [P] [US2] Write integration test for `cleanOrphanSchemas(olderThanMs)` removing matching schemas and preserving fresh ones in `__tests__/integration/infra/orphan-cleanup.spec.ts`
- [ ] T024 [P] [US2] Write E2E smoke test that asserts `appServer.schemaName` fixture matches `/^e2e_w\\d+_[a-f0-9]{8}$/` and baseURL is reachable in `__tests__/e2e/fixtures/app-server.spec.ts`
- [ ] T025 [P] [US2] Write E2E test that creates a row via UI/API in one worker and asserts a second worker sees empty state (schema isolation) in `__tests__/e2e/isolation/schema-isolation.spec.ts`

### Implementation (US2)

Ordem de execução: T026 ∥ T027 ∥ T028 (três helpers em arquivos independentes) → T029 (fixture consolida os três) → T030 ∥ T031 → T032 → T033a → T033b.

- [ ] T026 [US2] Implement helper `applyMigrationsToSchema({ url, schema })` that spawns migrate CLI in `__tests__/e2e/fixtures/migrate-helper.ts`
- [ ] T027 [US2] Implement helper `startNextDev({ port, schemaName })` that spawns `next dev --port <port>` with schema-aware `DATABASE_URL` and awaits `/api/health` in `__tests__/e2e/fixtures/next-dev-process.ts`
- [ ] T028 [US2] Implement seed-test invocation helper (imports and runs seed logic against a specific schema URL) in `__tests__/e2e/fixtures/seed-helper.ts`
- [ ] T029 [US2] Implement worker-scoped fixture that orchestrates create-schema → migrate → seed-test → spawn-next → drop-schema, consuming helpers T026/T027/T028, in `__tests__/e2e/fixtures/app-server.ts`
- [ ] T030 [US2] Rewrite Playwright global-setup to only run `cleanOrphanSchemas(1 hour)` and env validation in `__tests__/e2e/global-setup.ts`
- [ ] T031 [US2] Update `playwright.config.ts`: remove `webServer`, set `fullyParallel: true`, keep workers default locally (undefined) in `playwright.config.ts`
- [ ] T032 [US2] Update existing E2E specs to import `test` from the new fixture module instead of `@playwright/test` in each file under `__tests__/e2e/**/*.spec.ts`; also rename legacy `__tests__/e2e/auth/login.test.ts` → `__tests__/e2e/auth/login.spec.ts`
- [ ] T033a [US2] Verify whether `__tests__/e2e/helpers/auth.ts` uses relative URLs (grep for hardcoded `http://` / absolute URLs) in `__tests__/e2e/helpers/auth.ts`
- [ ] T033b [US2] If T033a found absolute URLs, refactor `auth.ts` to use relative paths so Playwright applies fixture `baseURL` automatically; skip if already compliant — file `__tests__/e2e/helpers/auth.ts`

**Checkpoint US2**: E2E com 2+ workers locais roda sem interferência.

**Quality Gate**: `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e` — todos verdes com no mínimo 2 workers locais.

---

## Phase 5: User Story 3 - Testes individualmente independentes (Priority: P1)

**Goal**: Cada teste E2E no mesmo worker começa com estado limpo (tabelas de domínio vazias), admin preservado.

**Independent Test**: Rodar duas vezes seguidas um teste que cria um registro `unique` — ambas as execuções passam sem conflito.

### Tests (US3)

- [ ] T034 [P] [US3] Write integration test for `truncateDomainTables(schema)` that asserts: domain tables empty; `user`/`account`/`session` preserved; sequences reset in `__tests__/integration/infra/truncate-domain-tables.spec.ts`
- [ ] T035 [P] [US3] Write E2E test that creates a row with a unique field, runs twice, both pass (validates reset between tests) in `__tests__/e2e/isolation/between-tests-reset.spec.ts`

### Implementation (US3)

- [ ] T036 [US3] Implement `truncateDomainTables(schema)` that introspects `information_schema.tables` and TRUNCATEs everything except `user`/`account`/`session` with `RESTART IDENTITY CASCADE` in `__tests__/e2e/helpers/reset.ts`
- [ ] T037 [US3] Wire `beforeEach` in fixture to call `truncateDomainTables(appServer.schemaName)` before each test (extend fixture in `__tests__/e2e/fixtures/app-server.ts`)
- [ ] T038 [US3] Re-run E2E suite to ensure admin session remains valid across tests (no re-login needed)

**Checkpoint US3**: Ordem de testes irrelevante, reset < 50ms por teste.

**Quality Gate**: `bun run test:e2e` — 1 execução local sem flake.

---

## Phase 6: User Story 4 - Seed de teste estável e mínimo (Priority: P2)

**Goal**: Seed de teste contém apenas admin; seed de dev livre para crescer; documentação atualizada para novos desenvolvedores.

**Independent Test**: Adicionar uma entidade hipotética (stub temporário) ao schema e confirmar que seed-test.ts não muda.

### Tests (US4)

- [ ] T039 [P] [US4] Write unit test asserting `seed-test.ts` only inserts into `user`/`account` tables (grep or AST check) in `__tests__/unit/db/seed-test-scope.spec.ts`
- [ ] T040 [P] [US4] Write integration test that runs seed-test against an empty schema and asserts exactly one admin row with known credentials in `__tests__/integration/infra/seed-test.spec.ts`

### Implementation (US4)

- [ ] T041 [US4] Create `src/lib/db/seed-test.ts` containing only the admin creation logic (idempotent via `findFirst` check), accepting `--url` and `--schema` argv in `src/lib/db/seed-test.ts`
- [ ] T042 [US4] Update `src/lib/db/seed.ts` header comment to clarify it is DEV-ONLY and may be expanded freely in `src/lib/db/seed.ts`
- [ ] T043 [US4] Update `CLAUDE.md` with short paragraph on "Nova entidade de domínio: factory, não seed" convention in `CLAUDE.md`

**Checkpoint US4**: seed-test estável, documentação clara, nenhum acoplamento a domínio.

---

## Phase 7: User Story 5 - Paralelismo local + execução serial no CI (Priority: P2)

**Goal**: Local roda E2E com 4 workers (default Playwright) para feedback rápido; CI roda com 1 worker serial para previsibilidade no runner free-tier do GitHub Actions.

**Independent Test**: Abrir PR, observar workflow `e2e-tests`; verificar que exatamente 1 worker aparece no relatório Playwright. Localmente, rodar suíte e ver 4 workers.

### Tests (US5)

- [ ] T044 [P] [US5] Add a job output assertion step that fails if Playwright report shows more than 1 worker used in CI in `.github/workflows/pr-checks.yml`

### Implementation (US5)

- [ ] T045 [US5] Update `.github/workflows/pr-checks.yml` e2e-tests job: **rename `audio_book_track_test` → `audiobook_track_test`** na definição do serviço Postgres e em env vars; criar tanto `audiobook_track` quanto `audiobook_track_test`; setar `TEST_DATABASE_URL`; trocar `bun run db:migrate` por `bun run db:test:setup` in `.github/workflows/pr-checks.yml`
- [ ] T046 [US5] Update `playwright.config.ts` setting `workers: process.env.CI ? 1 : undefined` (CI serial, local default) in `playwright.config.ts`
- [ ] T047 [US5] Update `.github/workflows/pr-checks.yml` integration-tests job: **rename `audio_book_track_test` → `audiobook_track_test`**; setar `TEST_DATABASE_URL` (real) e manter `DATABASE_URL` como placeholder não-usado; rodar `bun run db:test:setup` in `.github/workflows/pr-checks.yml`
- [ ] T048 [US5] Add artifact upload step for Playwright HTML report on failure in `.github/workflows/pr-checks.yml`
- [ ] T049 [US5] Measure local baseline: rodar E2E serial (`workers: 1`) e com 4 workers na mesma máquina, documentar a redução no PR description e em `specs/016-test-db-isolation/quickstart.md`

**Checkpoint US5**: CI passa serial com nome de DB canonizado; local paralelo funcional.

**Quality Gate**: PR CI verde em 1 execução (retentativas Playwright são aceitáveis).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Limpeza, documentação, validação cruzada contra os critérios de sucesso do spec.

- [ ] T050 [P] Remove any remaining references to the old truncate-based `global-setup.ts` content already replaced, ensuring no orphan imports remain in the repo (grep `globalSetup` references) across the codebase
- [ ] T051 [P] Update `README.md` "Como rodar testes" section to reference `bun run db:test:setup` as first-time step in `README.md`
- [ ] T052 [P] Add troubleshooting entries to quickstart for "porta em uso" and "schema órfão" (already partial — verify completeness) in `specs/016-test-db-isolation/quickstart.md`
- [ ] T053 Run full suite one last time: `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`, `bun run build` — ZERO warnings, ZERO failures
- [ ] T054 [P] Update `.specify/memory/constitution.md` if a new invariant emerged from the implementation (only if strictly needed) in `.specify/memory/constitution.md`
- [ ] T055 Validate SC-001: create a manual record in dev DB, run full suite, confirm record intact; document in PR description
- [ ] T056 Validate SC-002: run E2E locally with 4 workers once; observe 0 flakes; document in PR
- [ ] T057 Validate SC-005 (local): compare local E2E wall-clock between serial and 4 workers; document ≥ 40% reduction in PR
- [ ] T058 Validate SC-006: after a failed E2E run, inspect DB and confirm no `e2e_*` schemas remain (after orphan sweep window)
- [ ] T059 Validate SC-007: temporarily unset `TEST_DATABASE_URL` and confirm `bun run test:integration` fails in < 1s with actionable message

---

## Dependencies

### Phase ordering

```text
Phase 1 (Setup)
   ↓
Phase 2 (Foundational)        ← must complete before any story phase
   ↓
Phase 3 (US1) ──┐
Phase 4 (US2) ──┤             ← US1, US2, US3 independent once Foundation is done,
Phase 5 (US3) ──┘               can run in parallel by different developers
   ↓
Phase 6 (US4)                 ← depends on nothing structural, prefer after US3 so seed is exercised
Phase 7 (US5)                 ← depends on US1, US2, US3 (CI needs the whole stack)
   ↓
Phase 8 (Polish)
```

### Cross-phase task dependencies

- T009 (env update) blocks T018, T019, T026, T027, T028, T029, T041 — anyone reading `TEST_DATABASE_URL` depends on the Zod schema accepting it.
- T011 (migrate CLI) blocks T026 (E2E migrate helper) and T019 (integration global-setup).
- T010 (schema helpers) blocks T022, T023, T029, T030, T036.
- T014 (package scripts) blocks T021, T045 — scripts must exist before being invoked.
- T026, T027, T028 (helpers) block T029 (fixture consolidates them); sem eles a fixture não compila.
- T029 (fixture) is the central piece of US2; T030, T031, T032, T033a, T033b all follow.
- T036 (truncate helper) blocks T037 (wire into fixture) and T038.
- T041 (seed-test) blocks T042, T043; the fixture of T029 calls seed-test via T028.
- T046 (playwright workers config) blocks T045 (CI E2E run) — config determines worker count reported.

---

## Parallel execution examples

### Within Phase 2 Foundation

```text
Terminal A: T006, T007, T008          # 3 test files, no shared state
Terminal B: T010                      # test-schema.ts (needs T009 done first)
Terminal C: T012, T013                # scripts (independent files)
Sequential: T009 → T011 → T014 → T015
```

### Within Phase 4 (US2)

```text
Start: T022, T023, T024, T025 all in parallel (4 RED tests)
Then: T026 ∥ T027 ∥ T028           # 3 helpers em arquivos distintos
Then: T029                          # fixture consolida os 3 helpers
Then: T030 ∥ T031                   # global-setup e playwright.config
Then: T032                          # refactor de imports + rename de login.test.ts → .spec.ts
Then: T033a → T033b                 # verify, depois fix condicional
```

### Between phases (by different people)

Após Phase 2 fechar:
- Dev A pega Phase 3 (US1) — integration tests migrando para test DB.
- Dev B pega Phase 4 (US2) — schema-per-worker fixture.
- Dev C pega Phase 5 (US3) — truncate helper.

Convergem em Phase 6/7.

---

## Implementation strategy

**MVP (entrega incremental)**: Phase 1 + Phase 2 + Phase 3 já é entrega valiosa — resolve a separação física dev/test e é o que a maioria dos projetos nunca passa. Pode ser mergeado isoladamente se necessário.

**Incremento 1 → 2**: Adicionar Phase 4 + Phase 5 converte o E2E existente para schema-per-worker. Phase 7 segue no mesmo PR ou em PR curto a seguir.

**Incremento final**: Phase 6 (seed split) e Phase 8 (polish) fecham a feature.

**Recomendação**: um único PR cobrindo Phases 1–8, porque os contratos são todos internos e mudam em conjunto. Quebrar em PRs menores aumenta risco de conflitos no meio da migração (arquivos tocados são os mesmos).

---

## Summary

- **Total tasks**: 59 (T001–T059, com T033 dividido em T033a/T033b)
- **Per phase**: Setup 5, Foundational 10, US1 6, US2 12, US3 5, US4 5, US5 6, Polish 10
- **Parallel opportunities**: ~30 tasks marcadas com `[P]` (arquivos distintos, sem dependências cruzadas)
- **Independent test criteria**: todas as user stories têm pelo menos 1 teste de aceitação escrito antes da implementação (TDD strict)
- **MVP scope sugerido**: Phase 1 + Phase 2 + Phase 3 (resolve US1)
- **Format validation**: todas as tasks seguem `- [ ] T### [P?] [US?] descrição com caminho de arquivo`
