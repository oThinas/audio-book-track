# Tasks: Test Review & E2E Login

**Input**: Design documents from `/specs/004-test-review-e2e/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup

**Purpose**: Install Playwright and prepare E2E infrastructure

- [x] T001 Install `@playwright/test` as devDependency via `bun add -D @playwright/test`
- [x] T002 Install Playwright chromium browser via `bunx playwright install chromium`
- [x] T003 Create Playwright config at `playwright.config.ts` with webServer, chromium-only, testDir `__tests__/e2e`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Update existing test infrastructure so unit/integration/e2e suites are correctly separated

- [x] T004 Remove `e2e` project from `vitest.config.ts` (Vitest keeps only `unit` and `integration` projects)
- [x] T005 [P] Update `test:e2e` script in `package.json` from `vitest run __tests__/e2e/` to `bunx playwright test`
- [x] T006 [P] Update `test` script in `package.json` to run all 3 suites: `vitest run && bunx playwright test`
- [x] T007 [P] Add `.gitignore` entries for Playwright artifacts: `test-results/`, `playwright-report/`, `blob-report/`

**Checkpoint**: `bun run test:unit` and `bun run test:integration` pass. `bun run test:e2e` runs Playwright (no tests yet).

---

## Phase 3: User Story 1 - Revisao de Testes Existentes (Priority: P1)

**Goal**: Validate all existing tests are classified correctly per constitution rules

**Independent Test**: Run `bun run test:unit` (19 tests pass) and `bun run test:integration` (14 tests pass)

### Audit for User Story 1

- [x] T008 [P] [US1] Audit `__tests__/unit/` — verify all tests use mocks or test pure functions (no DB connections)
- [x] T009 [P] [US1] Audit `__tests__/integration/` — verify all tests use real DB via `getTestDb()` and `setup.ts`
- [x] T010 [P] [US1] Verify `__tests__/e2e/` is empty (ready for Playwright tests in US2)
- [x] T011 [US1] Write integration test for rate limiting behavior at `__tests__/integration/auth/rate-limit.test.ts` — send 4+ login attempts to real auth API and verify the 4th is blocked (429 or error response)
- [x] T012 [US1] Run `bun run test:unit` and `bun run test:integration` — confirm all pass with correct classification

**Checkpoint**: All existing tests classified correctly. Rate limit behavior validated. Unit: 19 pass. Integration: 15+ pass.

---

## Phase 4: User Story 2 - Teste E2E do Fluxo de Login (Priority: P2)

**Goal**: Write Playwright E2E tests validating the complete login flow in a real browser

**Independent Test**: Run `bun run test:e2e` — all Playwright tests pass with real browser, real server, real DB

### Implementation for User Story 2

- [x] T013 [US2] Ensure seed user exists: run `bun run db:seed` (creates `admin` / `admin123` if not present)
- [x] T014 [US2] Create E2E test file at `__tests__/e2e/auth/login.test.ts` with Playwright test structure
- [x] T015 [US2] Write test: unauthenticated user accessing `/dashboard` is redirected to `/login`
- [x] T016 [US2] Write test: login with valid credentials (`admin` / `admin123`) redirects to `/dashboard`
- [x] T017 [US2] Write test: login with invalid credentials shows error toast and stays on `/login`
- [x] T018 [US2] Run `bun run test:e2e` — all E2E tests pass in headless chromium

**Checkpoint**: E2E login flow fully validated. 3 test cases pass in real browser.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all suites

- [ ] T019 Run all 3 suites independently: `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`
- [ ] T020 Verify no test takes longer than 10 seconds (SC-005)
- [ ] T021 Update `specs/004-test-review-e2e/tasks.md` — mark all tasks as completed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Playwright installed)
- **US1 (Phase 3)**: Can start after Phase 2 — audit only, no new code
- **US2 (Phase 4)**: Can start after Phase 2 — writes new E2E tests
- **Polish (Phase 5)**: Depends on US1 + US2 complete

### User Story Dependencies

- **US1 (P1)**: Independent — audit and verify existing tests
- **US2 (P2)**: Independent of US1 — writes new Playwright tests in `__tests__/e2e/`

### Within Each Phase

- T001 → T002 → T003 (sequential: install → browser → config)
- T004, T005, T006, T007 can run in parallel [P]
- T008, T009, T010 can run in parallel (audit different dirs)
- T014 → T015/T016/T017 → T018 (create file → write tests → run)

### Parallel Opportunities

```bash
# Phase 2: all foundational tasks in parallel
T004: Remove e2e from vitest.config.ts
T005: Update test:e2e script
T006: Update test script
T007: Add .gitignore entries

# Phase 3: audit tasks in parallel
T008: Audit unit tests
T009: Audit integration tests
T010: Verify e2e is empty
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup Playwright
2. Complete Phase 2: Update test infrastructure
3. Complete Phase 3: Audit existing tests (US1)
4. **STOP and VALIDATE**: All existing tests correctly classified

### Full Delivery

1. Setup + Foundational (Phase 1-2)
2. US1: Audit tests → Validate classification
3. US2: Write E2E tests → Validate in browser
4. Polish: Final cross-suite validation