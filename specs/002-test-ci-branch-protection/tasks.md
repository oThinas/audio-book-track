# Tasks: Test Commands, CI Pipelines & Branch Protection

**Input**: Design documents from `/specs/002-test-ci-branch-protection/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Not explicitly requested for this infrastructure feature. Test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and initialize tooling needed by all stories

- [x] T001 Install husky and lint-staged as dev dependencies via `bun add -d husky lint-staged`
- [x] T002 Initialize husky with `bunx husky init` to create .husky/ directory
- [x] T003 Create .github/workflows/ directory structure

**Checkpoint**: Tooling installed, ready for configuration

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Update test scripts in package.json — all CI workflows depend on these commands existing

**WARNING**: No user story work can begin until this phase is complete

- [x] T004 Update test scripts in package.json: replace existing `test`, `test:watch`, `test:e2e` scripts and add `test:unit`, `test:integration`, `test:coverage` commands targeting `__tests__/unit/`, `__tests__/integration/`, `__tests__/e2e/` directories respectively
- [x] T005 Verify all test commands execute correctly: `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`, `bun run test`, `bun run test:coverage`

**Checkpoint**: All four test commands work locally, running only their respective test categories

---

## Phase 3: User Story 1 - Run Tests by Category (Priority: P1) MVP

**Goal**: Developers can run unit, integration, and e2e tests independently with a single command each.

**Independent Test**: Run `bun run test:unit` and verify only `__tests__/unit/` tests execute. Repeat for integration and e2e.

> Note: This story is fully delivered by Phase 2 (T004-T005). No additional tasks needed — the test commands ARE the deliverable.

**Checkpoint**: User Story 1 complete after Phase 2

---

## Phase 4: User Story 4 - Automatic Lint Before Every Commit (Priority: P1)

**Goal**: Lint auto-fix runs on every commit, fixing staged files automatically before the commit proceeds.

**Independent Test**: Stage a file with lint violations, commit, and verify Biome auto-fixes the file and the commit succeeds with clean code.

- [x] T006 [US4] Add lint-staged configuration to package.json with rule `"*.{ts,tsx,json}": "bunx biome check --write"` targeting staged files
- [x] T007 [US4] Configure .husky/pre-commit hook to run `bunx lint-staged` on commit
- [x] T008 [US4] Verify pre-commit hook: stage a file with lint violations, commit, and confirm auto-fix runs and commit succeeds

**Checkpoint**: Pre-commit lint auto-fix works locally

---

## Phase 5: User Story 2 - Unit Tests & Lint Gate on Every Push (Priority: P1)

**Goal**: CI pipeline runs unit tests, lint check, and coverage report on every push to any branch.

**Independent Test**: Push a commit to a feature branch, verify GitHub Actions triggers and reports unit test + lint status.

- [x] T009 [US2] Create GitHub Actions workflow .github/workflows/unit-tests.yml triggered on push to any branch with jobs named exactly `lint` and `unit-tests` (bunx biome check . / bun run test:unit + bun run test:coverage) using oven-sh/setup-bun and dependency caching. Job names must match T014 branch protection check names.
- [ ] T010 [US2] Verify push pipeline: push to branch and confirm lint, unit tests, and coverage report run and report status checks

**Checkpoint**: Every push triggers unit tests + lint CI

---

## Phase 6: User Story 3 - Integration & E2E Tests Gate on PR Merge (Priority: P1)

**Goal**: CI pipeline runs integration tests, e2e tests on every PR targeting main.

**Independent Test**: Open a PR to main, verify integration and e2e tests run and report status.

- [x] T011 [US3] Create GitHub Actions workflow .github/workflows/pr-checks.yml triggered on pull_request targeting main with PostgreSQL 16 service container, jobs named exactly `integration-tests` (bun run test:integration) and `e2e-tests` (bun run test:e2e). Job names must match T014 branch protection check names.

**Checkpoint**: Every PR to main triggers integration + e2e tests

---

## Phase 7: User Story 5 - Build Verification on Every PR (Priority: P1)

**Goal**: CI pipeline verifies the project builds successfully on every PR targeting main.

**Independent Test**: Open a PR with a build-breaking change, verify the build check fails and blocks merge.

- [x] T012 [US5] Add build verification job named exactly `build` to .github/workflows/pr-checks.yml running `bun run build`. Job name must match T014 branch protection check names.
- [ ] T013 [US5] Verify PR pipeline end-to-end: open a PR to main and confirm integration tests, e2e tests, and build all run and report status

**Checkpoint**: Every PR to main also verifies build

---

## Phase 8: User Story 6 - Block Direct Commits to Main (Priority: P2)

**Goal**: Direct pushes and force pushes to main are blocked; all changes go through PRs with passing CI.

**Independent Test**: Attempt to push directly to main, verify it is rejected.

- [ ] T014 [US6] Configure GitHub branch protection rules on main via `gh api` or GitHub UI: require status checks (unit-tests, lint, integration-tests, e2e-tests, build), block direct pushes, block force pushes, no reviewer approval required (**MANUAL — requires `gh auth login` or GitHub UI**)
- [ ] T015 [US6] Verify branch protection: attempt direct push to main and confirm rejection (**MANUAL — after T014**)

**Checkpoint**: Main branch fully protected

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [ ] T016 [P] Verify all CI workflow YAML files are valid by running `gh workflow list` after push (**MANUAL — after push**)
- [x] T017 [P] Update specs/002-test-ci-branch-protection/quickstart.md with any adjustments discovered during implementation
- [ ] T018 Run full end-to-end verification: push to branch (unit tests + lint trigger), open PR to main (integration + e2e + build trigger), verify all checks gate merge (**MANUAL — after push + PR**)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Delivered by Phase 2 — no additional work
- **US4 (Phase 4)**: Depends on Phase 1 (husky installed) — can start after Phase 1
- **US2 (Phase 5)**: Depends on Phase 2 (test commands exist)
- **US3 (Phase 6)**: Depends on Phase 2 (test commands exist)
- **US5 (Phase 7)**: Depends on Phase 6 (same workflow file)
- **US6 (Phase 8)**: Depends on Phases 5-7 (CI check names must exist for branch protection)
- **Polish (Phase 9)**: Depends on all phases complete

### User Story Dependencies

- **US1 (Run Tests by Category)**: Delivered by Foundational phase — no story dependencies
- **US4 (Lint Pre-Commit)**: Independent — only needs husky from Setup
- **US2 (Unit Tests + Lint on Push)**: Independent — only needs test commands from Foundational
- **US3 (Integration + E2E on PR)**: Independent — only needs test commands from Foundational
- **US5 (Build on PR)**: Shares workflow file with US3 — do sequentially
- **US6 (Branch Protection)**: Depends on US2, US3, US5 — CI check names must exist first

### Parallel Opportunities

After Phase 2 completes:
- **US4** (Phase 4) and **US2** (Phase 5) and **US3** (Phase 6) can all run in parallel
- US5 must follow US3 (same workflow file)
- US6 must follow all CI stories

---

## Parallel Example: After Foundational

```bash
# These three can run in parallel after Phase 2:
Task: "T006-T008 — Configure pre-commit hook (US4)"
Task: "T009-T010 — Create push CI pipeline (US2)"
Task: "T011 — Create PR CI pipeline (US3)"
```

---

## Implementation Strategy

### MVP First (US1 + US4)

1. Complete Phase 1: Setup (install deps)
2. Complete Phase 2: Foundational (test commands)
3. Complete Phase 4: US4 (pre-commit lint)
4. **STOP and VALIDATE**: Test commands work, pre-commit hook works
5. Local developer experience fully functional

### Incremental Delivery

1. Setup + Foundational → Test commands ready (US1 delivered)
2. Add US4 → Pre-commit lint works locally
3. Add US2 → Push CI triggers automatically
4. Add US3 + US5 → PR CI triggers with full checks
5. Add US6 → Branch protection enforced
6. Each story adds a layer of automation without breaking previous ones

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 is delivered by the foundational phase (test script configuration IS the story)
- US4 (lint hook) is independent and can be done first for immediate local benefit
- US6 (branch protection) must be last — it depends on all CI check names existing
- Commit after each task or logical group