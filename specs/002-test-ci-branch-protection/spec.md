# Feature Specification: Test Commands, CI Pipelines & Branch Protection

**Feature Branch**: `002-test-ci-branch-protection`  
**Created**: 2026-04-01  
**Status**: Draft  
**Input**: User description: "Separate commands for unit, integration, and e2e tests; GitHub Actions for unit tests on every push; GitHub Actions for integration and e2e tests before PR merge; block direct commits to main."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run Tests by Category (Priority: P1)

As a developer, I want separate commands to run unit, integration, and e2e tests independently so I can execute only the relevant test suite during development without waiting for unrelated tests.

**Why this priority**: This is the foundation for all other stories. CI pipelines depend on having distinct test commands to invoke. Without this, the remaining features cannot work.

**Independent Test**: Can be fully tested by running each command (`test:unit`, `test:integration`, `test:e2e`) and verifying that only the corresponding test files execute.

**Acceptance Scenarios**:

1. **Given** a project with unit, integration, and e2e test files, **When** I run the unit test command, **Then** only unit tests execute and results are reported.
2. **Given** a project with unit, integration, and e2e test files, **When** I run the integration test command, **Then** only integration tests execute and results are reported.
3. **Given** a project with unit, integration, and e2e test files, **When** I run the e2e test command, **Then** only e2e tests execute and results are reported.
4. **Given** I run the general test command, **When** all test suites complete, **Then** tests from all categories are included.

---

### User Story 2 - Unit Tests & Lint Gate on Every Push (Priority: P1)

As a developer, I want a CI pipeline that automatically runs unit tests and lint on every push to any branch so that broken code and style violations are caught immediately.

**Why this priority**: Fast feedback on every push prevents regressions from propagating. Unit tests and lint are fast and should gate every code change. Lint in CI is a safety net for cases where the pre-commit hook is bypassed.

**Independent Test**: Can be tested by pushing a commit to a feature branch and verifying the CI pipeline runs both unit tests and lint, reporting pass/fail status.

**Acceptance Scenarios**:

1. **Given** a push to any branch, **When** the CI pipeline triggers, **Then** unit tests and lint run and results are reported as commit status checks.
2. **Given** a push with failing unit tests or lint errors, **When** the CI pipeline completes, **Then** the commit status is marked as failed.
3. **Given** a push with all unit tests passing and no lint errors, **When** the CI pipeline completes, **Then** the commit status is marked as successful.

---

### User Story 3 - Integration & E2E Tests Gate on PR Merge (Priority: P1)

As a developer, I want a CI pipeline that runs integration and e2e tests before a PR can be merged so that only fully validated code reaches the main branch.

**Why this priority**: Integration and e2e tests are heavier and should run at the PR level to validate cross-component behavior before merging. This is the last quality gate before code reaches main.

**Independent Test**: Can be tested by opening a PR against main and verifying integration and e2e tests run and block merge if failing.

**Acceptance Scenarios**:

1. **Given** a PR is opened or updated targeting `main`, **When** the CI pipeline triggers, **Then** integration and e2e tests run and report status.
2. **Given** a PR with failing integration or e2e tests, **When** a merge is attempted, **Then** the merge is blocked.
3. **Given** a PR with all integration and e2e tests passing, **When** a merge is attempted, **Then** the merge is allowed.

---

### User Story 4 - Automatic Lint Before Every Commit (Priority: P1)

As a developer, I want lint to run automatically before every commit and auto-fix any issues so that code style is enforced consistently without manual intervention.

**Why this priority**: Lint is fast and runs locally. Catching style issues at commit time prevents noise in CI and code reviews, keeping the feedback loop tight.

**Independent Test**: Can be tested by attempting a commit with lint violations and verifying the pre-commit hook auto-fixes, stages corrections, and allows the commit to proceed.

**Acceptance Scenarios**:

1. **Given** staged files with lint violations, **When** the developer commits, **Then** lint auto-fix runs, corrected files are re-staged, and the commit proceeds.
2. **Given** staged files with no lint violations, **When** the developer commits, **Then** the commit proceeds without delay.
3. **Given** staged files with unfixable lint errors, **When** the developer commits, **Then** the commit is blocked with a clear error message.

---

### User Story 5 - Build Verification on Every PR (Priority: P1)

As a developer, I want the CI pipeline to verify that the project builds successfully on every PR so that code that does not compile never reaches the main branch.

**Why this priority**: A failing build is the most fundamental quality gate. No code should be merged if it cannot build. This is fast to verify and critical for project stability.

**Independent Test**: Can be tested by opening a PR with a build-breaking change and verifying the CI pipeline reports failure and blocks merge.

**Acceptance Scenarios**:

1. **Given** a PR is opened or updated targeting `main`, **When** the CI pipeline triggers, **Then** a build verification step runs.
2. **Given** a PR with code that fails to build, **When** the CI pipeline completes, **Then** the build check is marked as failed and merge is blocked.
3. **Given** a PR with code that builds successfully, **When** the CI pipeline completes, **Then** the build check is marked as passed.

---

### User Story 6 - Block Direct Commits to Main (Priority: P2)

As a project maintainer, I want direct pushes to the `main` branch to be blocked so that all changes go through the PR review and CI validation process.

**Why this priority**: Enforcing PRs ensures code review and CI validation always happen. This is a governance rule that depends on the CI pipelines being in place first.

**Independent Test**: Can be tested by attempting to push directly to `main` and verifying the push is rejected.

**Acceptance Scenarios**:

1. **Given** branch protection rules are configured on `main`, **When** a developer attempts to push directly to `main`, **Then** the push is rejected.
2. **Given** branch protection rules are configured, **When** a developer creates a PR to `main`, **Then** the PR workflow is allowed and CI checks run.
3. **Given** a PR with all required CI checks passing, **When** the developer merges the PR, **Then** the code is merged into `main` successfully (no reviewer approval required — solo developer project).

---

### Edge Cases

- What happens when there are no test files for a given category (e.g., no integration tests yet)? The command should succeed with zero tests reported.
- What happens when CI runs on a branch that has no test files at all? The pipeline should pass (no tests is not a failure).
- What happens when the database is unavailable during integration test CI? The pipeline should fail with a clear error indicating the database connection issue.
- What happens when a developer force-pushes to `main`? Branch protection should block force pushes as well.
- What happens when lint auto-fix changes files that were not originally staged? Only re-stage files that were already staged; do not add new files.
- What happens when the build step times out in CI? The check should fail and block merge.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST provide a dedicated command to run only unit tests.
- **FR-002**: The project MUST provide a dedicated command to run only integration tests.
- **FR-003**: The project MUST provide a dedicated command to run only e2e tests.
- **FR-004**: The project MUST provide a command to run all test categories together.
- **FR-005**: Test files MUST be organized by category (unit, integration, e2e) using a consistent directory convention.
- **FR-006**: A CI pipeline MUST run unit tests (with coverage report) and lint check on every push to any branch. Coverage is informational only and MUST NOT fail the pipeline.
- **FR-007**: A CI pipeline MUST run integration and e2e tests on every PR targeting `main`.
- **FR-008**: The `main` branch MUST be protected against direct pushes; all changes MUST go through a PR.
- **FR-009**: PRs targeting `main` MUST NOT be mergeable unless all required CI checks pass.
- **FR-010**: Branch protection MUST also block force pushes to `main`.
- **FR-011**: A pre-commit hook MUST run lint auto-fix on staged files before every commit, re-stage corrected files, and allow the commit to proceed.
- **FR-012**: If lint auto-fix cannot resolve all issues, the commit MUST be blocked with a clear error message.
- **FR-013**: A CI pipeline MUST verify the project builds successfully on every PR targeting `main`.
- **FR-014**: PRs with a failing build MUST NOT be mergeable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can run each test category (unit, integration, e2e) with a single command.
- **SC-002**: 100% of pushes to any branch trigger the unit test and lint CI pipeline automatically.
- **SC-003**: 100% of PRs targeting `main` trigger integration and e2e test pipelines automatically.
- **SC-004**: No code reaches `main` without passing through a PR with all CI checks green.
- **SC-005**: Direct push attempts to `main` are rejected 100% of the time.
- **SC-006**: CI pipeline feedback is available within 5 minutes of a push or PR update.
- **SC-007**: 100% of commits pass through lint auto-fix before being recorded.
- **SC-008**: 100% of PRs targeting `main` include a build verification check.
- **SC-009**: Coverage report is visible on every push pipeline run for developer awareness.

## Clarifications

### Session 2026-04-01

- Q: How should lint behave before a commit? → A: Auto-fix, stage corrected files, then proceed with the commit.
- Q: Should PRs require reviewer approval in addition to CI checks? → A: No, CI checks only. Solo developer project with no other reviewers.
- Q: Should lint also run in CI as a safety net (in addition to the pre-commit hook)? → A: Yes, run lint in CI on every push alongside unit tests.
- Q: Should CI enforce a coverage threshold? → A: Report coverage but don't fail. Full-stack project with visual components that won't be unit tested.

## Assumptions

- The project already uses Vitest as its test runner and Bun as its runtime.
- Test file organization will follow a directory-based convention (e.g., `__tests__/unit/`, `__tests__/integration/`, `__tests__/e2e/`).
- GitHub Actions is the CI/CD platform.
- Branch protection will be configured via GitHub repository settings (requires repository admin access; cannot be fully enforced through code alone).
- Integration tests may require a database connection; the CI pipeline will provision one via a service container.
- The existing `test` and `test:e2e` scripts in `package.json` will be updated to align with the new directory convention.
- This is a solo developer project; PRs do not require reviewer approval — only passing CI checks are needed to merge.