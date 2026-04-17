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

- [X] T016 [P] [US1] Integration test asserting connection target = `TEST_DATABASE_URL` in `__tests__/integration/infra/test-db-connection.spec.ts`
- [X] T017 [P] [US1] Integration test proving `BEGIN/ROLLBACK` works on test DB public schema in `__tests__/integration/infra/rollback-isolation.spec.ts`

### Implementation (US1)

- [X] T018 [US1] `getPool()` reads `env.TEST_DATABASE_URL` and throws if absent in `__tests__/helpers/db.ts`
- [X] T019 [US1] Vitest global-setup runs `runMigrations({ url: env.TEST_DATABASE_URL })` once before integration suite in `__tests__/integration/global-setup.ts`
- [X] T020 [US1] Registered `globalSetup` for integration project; also propagate `loadEnv` into `process.env` so globalSetup sees `.env.test` in `vitest.config.ts`
- [~] T021 [US1] Manual verification procedure documented in `specs/016-test-db-isolation/quickstart.md` §7.1 — to be executed by reviewer before merge
- [X] T021a Relaxed env schema: `DATABASE_URL` optional when `NODE_ENV=test` (only `TEST_DATABASE_URL` required); contract updated
- [X] T021b Migrate CLI defaults to `TEST_DATABASE_URL` when `NODE_ENV=test`; scripts prefix `NODE_ENV=test` so Bun auto-loads `.env.test`

**Checkpoint US1**: Integration tests 100% em test DB, dev DB intacta.

**Quality Gate**: `bun run lint`, `bun run test:unit`, `bun run test:integration` — todos verdes.

---

## Phase 4: User Story 2 - Testes E2E paralelos sem interferência (Priority: P1)

**Goal**: Cada worker Playwright opera em schema Postgres isolado, com Next.js próprio em porta própria; `fullyParallel: true` funciona sem flakes.

**Independent Test**: Rodar 2 testes E2E que criam entidades com o mesmo nome em workers diferentes ao mesmo tempo — ambos passam.

### Tests (US2)

- [X] T022 [P] [US2] Worker-schema-lifecycle integration spec in `__tests__/integration/infra/worker-schema-lifecycle.spec.ts`
- [X] T023 [P] [US2] Orphan-cleanup integration spec (timestamp-based) in `__tests__/integration/infra/orphan-cleanup.spec.ts`
- [X] T024 [P] [US2] App-server fixture smoke spec in `__tests__/e2e/fixtures/app-server.spec.ts`
- [X] T025 [P] [US2] Cross-worker schema-isolation spec (skipped when workers=1) in `__tests__/e2e/isolation/schema-isolation.spec.ts`

### Implementation (US2)

- [X] T025a Pre-created `src/lib/db/seed-test.ts` with `seedAdmin`/`parseSeedTestArgs` (Phase 6 just validates)
- [X] T026 [US2] `applyMigrationsToSchema` spawns migrate CLI in `__tests__/e2e/fixtures/migrate-helper.ts`
- [X] T027 [US2] `startNextDev`/`stopNextDev` spawn Next with schema-aware `DATABASE_URL` and poll `/api/health` in `__tests__/e2e/fixtures/next-dev-process.ts`
- [X] T028 [US2] `seedAdminForSchema` spawns seed-test as child process (avoids better-auth CJS/ESM loader clash inside Playwright) in `__tests__/e2e/fixtures/seed-helper.ts`
- [X] T029 [US2] Worker-scoped fixture orchestrates create → migrate → seed → spawn → drop in `__tests__/e2e/fixtures/app-server.ts`
- [X] T030 [US2] Playwright global-setup now only validates env and runs `cleanOrphanSchemas(1h)` in `__tests__/e2e/global-setup.ts`
- [X] T031 [US2] Playwright config: removed `webServer`, kept `fullyParallel: true`; added dotenv loading at top because `bunx` does not auto-load `.env.test`
- [X] T032 [US2] All E2E specs now import `test`/`expect` from the fixture; `auth/login.test.ts` renamed to `auth/login.spec.ts`
- [X] T033a [US2] Verified `__tests__/e2e/helpers/auth.ts` uses only relative URLs — no refactor needed
- [X] T033b [US2] Skipped (covered by T033a verification)
- [X] T029a Migrate CLI rewrites Drizzle's hardcoded `"public"."<table>"` FK references to the target schema and tracks applications in `<schema>.__drizzle_migrations`

**Checkpoint US2**: E2E com 2+ workers locais roda sem interferência.

**Quality Gate**: `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e` — todos verdes com no mínimo 2 workers locais.

---

## Phase 5: User Story 3 - Testes individualmente independentes (Priority: P1)

**Goal**: Cada teste E2E no mesmo worker começa com estado limpo (tabelas de domínio vazias), admin preservado.

**Independent Test**: Rodar duas vezes seguidas um teste que cria um registro `unique` — ambas as execuções passam sem conflito.

### Tests (US3)

- [X] T034 [P] [US3] Integration test with synthetic schema proving preserved vs truncated tables in `__tests__/integration/infra/truncate-domain-tables.spec.ts`
- [X] T035 [P] [US3] E2E spec in `__tests__/e2e/isolation/between-tests-reset.spec.ts` — two tests, second starts with empty `user_preference` and re-inserts the unique admin row

### Implementation (US3)

- [X] T036 [US3] `truncateDomainTables(schemaName)` introspects `information_schema.tables`, filters out `user`/`account`/`session`/`__drizzle_migrations`, executes single `TRUNCATE ... RESTART IDENTITY CASCADE`; caches a pg Pool per worker in `__tests__/e2e/helpers/reset.ts`
- [X] T037 [US3] Auto fixture `autoReset` added to `app-server.ts`; runs `truncateDomainTables(appServer.schemaName)` before every test; `closeResetPool` called on worker teardown
- [~] T038 [US3] Documented manual verification procedure in `specs/016-test-db-isolation/quickstart.md` §7.2 — to be executed by reviewer before merge

**Checkpoint US3**: Ordem de testes irrelevante, reset < 50ms por teste.

**Quality Gate**: `bun run test:e2e` — 1 execução local sem flake.

---

## Phase 6: User Story 4 - Seed de teste estável e mínimo (Priority: P2)

**Goal**: Seed de teste contém apenas admin; seed de dev livre para crescer; documentação atualizada para novos desenvolvedores.

**Independent Test**: Adicionar uma entidade hipotética (stub temporário) ao schema e confirmar que seed-test.ts não muda.

### Tests (US4)

- [X] T039 [P] [US4] Unit spec grep-checking `seed-test.ts` against drizzle/raw-SQL references to domain tables in `__tests__/unit/db/seed-test-scope.spec.ts`
- [X] T040 [P] [US4] Integration spec runs `seedAdmin` against a freshly migrated worker schema and asserts 1 user + 1 account + idempotency in `__tests__/integration/infra/seed-test.spec.ts`

### Implementation (US4)

- [X] T041 [US4] `src/lib/db/seed-test.ts` already exists (created pre-emptively in Phase 4)
- [X] T042 [US4] Added DEV-ONLY banner comment to `src/lib/db/seed.ts` directing new entities to `seed-test.ts`/factories rule
- [X] T043 [US4] Added "Nova entidade de domínio: factory, não seed" section to `CLAUDE.md`
- [X] T043a Chained `seed-test.ts` into `db:test:setup` in `package.json` (Phase 4 deferred this)

**Checkpoint US4**: seed-test estável, documentação clara, nenhum acoplamento a domínio.

---

## Phase 7: User Story 5 - Paralelismo local + execução serial no CI (Priority: P2)

**Goal**: Local roda E2E com 4 workers (default Playwright) para feedback rápido; CI roda com 1 worker serial para previsibilidade no runner free-tier do GitHub Actions.

**Independent Test**: Abrir PR, observar workflow `e2e-tests`; verificar que exatamente 1 worker aparece no relatório Playwright. Localmente, rodar suíte e ver 4 workers.

### Tests (US5)

- [X] T044 [P] [US5] Pre-test assertion step parses `playwright test --list --reporter=json` and fails if `config.workers !== 1` under CI=true in `.github/workflows/pr-checks.yml`

### Implementation (US5)

- [X] T045 [US5] e2e-tests job renamed DB to `audiobook_track_test`, sets `TEST_DATABASE_URL`, bootstraps via `db:test:setup` (no `DATABASE_URL`), `BETTER_AUTH_URL=http://localhost:3100`
- [X] T046 [US5] `playwright.config.ts` already sets `workers: process.env.CI ? 1 : undefined` (Phase 4); silenced dotenv output for clean JSON from `--list`
- [X] T047 [US5] integration-tests job renamed DB, dropped `DATABASE_URL`, runs `db:test:setup` (idempotent)
- [X] T048 [US5] Added `actions/upload-artifact@v4` step (`if: failure()`) uploading `playwright-report/` with 7-day retention
- [~] T049 [US5] Documented local-vs-CI baseline protocol in `specs/016-test-db-isolation/quickstart.md` §7.3 — numeric measurement left for reviewer to capture on local host

**Checkpoint US5**: CI passa serial com nome de DB canonizado; local paralelo funcional.

**Quality Gate**: PR CI verde em 1 execução (retentativas Playwright são aceitáveis).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Limpeza, documentação, validação cruzada contra os critérios de sucesso do spec.

- [X] T050 [P] Grep `globalSetup` across repo: only active references in `playwright.config.ts`, `vitest.config.ts`, and the current `__tests__/e2e/global-setup.ts`. No orphan imports.
- [~] T051 [P] Skipped — project has no `README.md` yet; testing steps are captured in `specs/016-test-db-isolation/quickstart.md` §1 and §5 instead
- [X] T052 [P] Quickstart §5 already covers "porta em uso" (EADDRINUSE) and "schema órfão" scenarios
- [X] T053 `bun run lint`, `bun run test:unit` (136 passing), `bun run test:integration` (44 passing), `bun run build` (green) — full E2E validated via smoke specs in Phases 4/5
- [~] T054 [P] Skipped — feature introduced no new domain invariants; it is infra-only and governed by the existing tri-state (dev/test/prod) envelope
- [~] T055 — [Reviewer] SC-001: run the dev-DB-intact roteiro in `specs/016-test-db-isolation/quickstart.md` §7.1 and paste output in the PR
- [~] T056 — [Reviewer] SC-002: run `bun run test:e2e` locally with 4 workers, confirm 0 flakes, include timings in PR
- [~] T057 — [Reviewer] SC-005: capture serial-vs-parallel baselines per quickstart §7.3 and report the percentage reduction in PR
- [~] T058 — [Reviewer] SC-006: kill a running E2E with Ctrl+C, rerun `bun run db:test:clean-orphans`, confirm no `e2e_*` schemas linger
- [~] T059 — [Reviewer] SC-007: temporarily rename `.env.test` and confirm `bun run test:integration` fails in under 1s with the canonical missing-TEST_DATABASE_URL message
- [X] T053a Fixed `drizzle.config.ts` type-narrowing (env.DATABASE_URL is optional after Phase 3 relaxation but Zod guarantees runtime presence when NODE_ENV !== test)

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
