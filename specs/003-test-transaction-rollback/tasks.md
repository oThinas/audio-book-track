# Tasks: Transaction Rollback para Testes de Integração

**Input**: Design documents from `/specs/003-test-transaction-rollback/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: TDD is mandatory per constitution (Princípio V). Test tasks are included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the transaction rollback mechanism and test factories

- [x] T001 [P] Create test database helper with pool singleton, `getTestDb()`, `setTestDb()`, `clearTestDb()` in `__tests__/helpers/db.ts`
- [x] T002 Create integration test setup file with `beforeEach` (BEGIN + Drizzle instance) and `afterEach` (ROLLBACK + release client) in `__tests__/integration/setup.ts`
- [x] T003 Update Vitest config to add integration project with `setupFiles: ['__tests__/integration/setup.ts']` in `vitest.config.ts`
- [x] T004 [P] Create test factories `createTestUser()` and `createTestSession()` in `__tests__/helpers/factories.ts`

**Checkpoint**: Transaction rollback infrastructure ready — each `it()` runs in an isolated transaction.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Validate the transaction rollback mechanism works correctly before migrating existing tests

**⚠️ CRITICAL**: No migration work can begin until this phase is complete

- [x] T005 Write validation test: two tests inserting same unique email both pass (proves rollback works) in `__tests__/integration/infra/transaction-rollback.test.ts`
- [x] T006 Write validation test: data inserted in one test is not visible in the next test in `__tests__/integration/infra/transaction-rollback.test.ts`
- [x] T007 Write validation test: factory-created user exists within test but not after rollback in `__tests__/integration/infra/transaction-rollback.test.ts`
- [x] T008 Run validation tests and confirm all pass (`bun run test:integration -- __tests__/integration/infra/`)

**Checkpoint**: Transaction rollback mechanism proven to work — migration can begin.

---

## Phase 3: User Story 1 - Isolamento de dados entre testes (Priority: P1) 🎯 MVP

**Goal**: Migrar testes de integração existentes de HTTP para acesso direto ao banco, usando transaction rollback para isolamento total.

**Independent Test**: Rodar `bun run test:integration` — todos os testes passam com banco limpo entre cada `it()`.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T009 [US1] Write test for login verification (password hash check + session creation) via direct DB access in `__tests__/integration/auth/auth.test.ts`
- [x] T010 [US1] Write test for session invalidation (delete session from DB) via direct DB access in `__tests__/integration/auth/logout.test.ts`
- [x] T011 [US1] Write test for session persistence and expiration via direct DB access in `__tests__/integration/auth/session.test.ts`
- [x] T012 [US1] Write test for signup blocking (config verification, no HTTP) in `__tests__/integration/auth/signup-blocked.test.ts`

### Implementation for User Story 1

- [x] T013 [US1] Migrate `auth.test.ts` — replace HTTP calls with direct Drizzle queries using `getTestDb()` and `createTestUser()` factory in `__tests__/integration/auth/auth.test.ts`
- [x] T014 [US1] Migrate `logout.test.ts` — replace HTTP calls with direct session deletion via `getTestDb()` in `__tests__/integration/auth/logout.test.ts`
- [x] T015 [US1] Migrate `session.test.ts` — replace HTTP calls with direct session queries via `getTestDb()` and factories in `__tests__/integration/auth/session.test.ts`
- [x] T016 [US1] Migrate `signup-blocked.test.ts` — replace HTTP calls with better-auth config assertion in `__tests__/integration/auth/signup-blocked.test.ts`
- [x] T017 [US1] Remove or deprecate HTTP helper functions no longer used in `__tests__/helpers/auth.ts`
- [x] T018 [US1] Run full integration suite and confirm all tests pass (`bun run test:integration`)
- [x] T018b [US1] Benchmark integration test execution time and compare with baseline (overhead must be < 10% per SC-005)

**Checkpoint**: All integration tests migrated to direct DB access with transaction rollback. Each test is fully isolated.

---

## Phase 4: User Story 2 - Paridade local/CI (Priority: P1)

**Goal**: Garantir que o mecanismo funciona identicamente no CI/CD — mesmos testes, mesmo comportamento.

**Independent Test**: Push para branch, verificar que CI integration tests passam com resultados idênticos ao local.

### Implementation for User Story 2

- [x] T019 [US2] Remove `db:seed` step from integration-tests job in `.github/workflows/pr-checks.yml`
- [x] T020 [US2] Verify `db:migrate` step is preserved (creates tables needed by tests) in `.github/workflows/pr-checks.yml`
- [x] T021 [US2] Verify environment variables `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` are still set in CI in `.github/workflows/pr-checks.yml`
- [x] T022 [US2] Run integration tests locally and record results (pass/fail per test)
- [ ] T023 [US2] Push branch and verify CI integration tests produce identical results

**Checkpoint**: Local and CI environments produce identical test results. Seed is no longer required.

---

## Phase 5: User Story 3 - Experiência simples para novos testes (Priority: P2)

**Goal**: Validar que um novo teste de integração herda o isolamento automaticamente com setup mínimo.

**Independent Test**: Criar um novo arquivo de teste e verificar que funciona sem configuração adicional.

### Tests for User Story 3 ⚠️

- [x] T024 [US3] Write a sample integration test in a new file that uses only `getTestDb()` and factory — no manual setup/teardown in `__tests__/integration/infra/new-test-example.test.ts`

### Implementation for User Story 3

- [x] T025 [US3] Verify the sample test passes with zero boilerplate beyond `import { getTestDb }` and `import { createTestUser }`
- [x] T026 [US3] Verify adding a second `it()` in the same file has independent isolation (no data leaks between tests)
- [x] T027 [US3] Update quickstart.md with final verified patterns and imports in `specs/003-test-transaction-rollback/quickstart.md`

**Checkpoint**: Developer experience validated — new tests inherit isolation with a single import.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T028 Run integration tests with `--sequence.shuffle` to verify order independence
- [x] T029 Run full test suite (`bun run test`) to confirm unit and e2e tests are unaffected
- [x] T030 Remove sample test file created for US3 validation in `__tests__/integration/infra/new-test-example.test.ts`
- [x] T031 Run `bun run test:coverage` and verify coverage is maintained (no regression)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) — core migration work
- **US2 (Phase 4)**: Depends on US1 (Phase 3) — CI needs migrated tests to validate
- **US3 (Phase 5)**: Depends on Setup (Phase 1) only — can start after Phase 2, parallel with US1
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 — no dependency on other stories
- **User Story 2 (P1)**: Depends on US1 (needs migrated tests to verify CI parity)
- **User Story 3 (P2)**: Depends on Phase 2 only — can run parallel with US1

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Factory usage before direct queries
- Migration before cleanup
- All tests pass before checkpoint

### Parallel Opportunities

- T001 + T004 can run in parallel (different files)
- T009 + T010 + T011 + T012 can run in parallel (different test files)
- T013 + T014 + T015 + T016 can run in parallel (different test files, same pattern)
- T019 + T020 + T021 are edits to same file — sequential
- US1 and US3 can be worked on in parallel after Phase 2

---

## Parallel Example: User Story 1 Migration

```bash
# Launch all test migrations in parallel (different files):
Task: "Migrate auth.test.ts to direct DB access"
Task: "Migrate logout.test.ts to direct DB access"
Task: "Migrate session.test.ts to direct DB access"
Task: "Migrate signup-blocked.test.ts to config assertion"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Foundational (T005–T008)
3. Complete Phase 3: User Story 1 (T009–T018)
4. **STOP and VALIDATE**: All integration tests pass with transaction rollback
5. This alone delivers the core value: isolated tests

### Incremental Delivery

1. Setup + Foundational → Transaction rollback mechanism ready
2. User Story 1 → All existing tests migrated and isolated (MVP!)
3. User Story 2 → CI/CD aligned, seed removed
4. User Story 3 → DX validated, quickstart updated
5. Polish → Shuffle test, coverage check, cleanup

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- TDD is mandatory: write tests first, confirm they fail, then implement
- Commit after each phase checkpoint
- `rate-limit.test.ts` is unchanged — it's a config verification test with no DB interaction. The setup file's `beforeEach`/`afterEach` will run for it but should be harmless (creates/rolls back an empty transaction). Verify it still passes after T003.