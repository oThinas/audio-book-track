# Research: Test Commands, CI Pipelines & Branch Protection

**Date**: 2026-04-01  
**Feature**: 002-test-ci-branch-protection

## R1: Vitest — Separate Test Commands by Directory

**Decision**: Use Vitest's `include` pattern in package.json scripts to target specific directories.

**Rationale**: Vitest supports glob patterns in the CLI (`vitest run __tests__/unit/`). This is simpler than workspace configs and aligns with the existing directory structure. The current `vitest.config.ts` already includes all `__tests__/**/*.test.ts` — individual scripts just narrow the scope.

**Alternatives considered**:
- Vitest workspaces (multiple config files) — overkill for directory-based separation
- Vitest `projects` config — adds complexity without benefit here
- Test file naming convention (`.unit.test.ts`) — less ergonomic than directory-based

**Implementation**:
```json
{
  "test": "vitest run",
  "test:unit": "vitest run __tests__/unit/",
  "test:integration": "vitest run __tests__/integration/",
  "test:e2e": "vitest run __tests__/e2e/",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

## R2: Pre-commit Hook — Biome Lint Auto-Fix

**Decision**: Use Husky + lint-staged for pre-commit hook with Biome auto-fix.

**Rationale**: Husky is the standard for git hooks in JS projects. lint-staged runs the linter only on staged files (not the entire project), keeping it fast. Biome's `check --write` fixes and formats in one pass.

**Alternatives considered**:
- lefthook — lighter but less ecosystem adoption
- simple-git-hooks — minimal but no lint-staged integration
- Raw git hooks (`.git/hooks/pre-commit`) — not shareable across clones

**Implementation**:
- `husky` for git hook management
- `lint-staged` for scoping lint to staged files only
- Biome command: `bunx biome check --write --staged`
- lint-staged re-stages the auto-fixed files automatically

## R3: GitHub Actions — Push Pipeline (Unit Tests + Lint)

**Decision**: Single workflow file triggered on `push` to any branch. Runs lint check and unit tests with coverage report in parallel jobs.

**Rationale**: Lint and unit tests are fast (~30s each). Running them on every push gives immediate feedback. Coverage is reported but does not fail the pipeline (per clarification — full-stack project with untested visual components).

**Alternatives considered**:
- Single job with sequential steps — slower, no parallelism
- Separate workflows for lint and tests — unnecessary complexity for small checks

**Key decisions**:
- Uses `oven-sh/setup-bun` for Bun installation
- Dependency caching via `actions/cache` on `~/.bun/install/cache`
- Coverage output as job summary (not a separate artifact for now)

## R4: GitHub Actions — PR Pipeline (Integration + E2E + Build)

**Decision**: Workflow triggered on `pull_request` targeting `main`. Runs integration tests, e2e tests, and build verification.

**Rationale**: These checks are heavier (need PostgreSQL, full build). Running only on PRs saves CI minutes while still gating all code entering `main`.

**Key decisions**:
- PostgreSQL via `services` container in GitHub Actions
- Integration and e2e tests run after DB is healthy
- Build verification uses `bun run build`
- All three checks must pass for PR to be mergeable

## R5: Branch Protection — GitHub Settings

**Decision**: Configure via GitHub repository settings (manual or via `gh api`).

**Rationale**: Branch protection rules are a GitHub platform feature, not code. They require admin access to configure. Can be automated via GitHub CLI for reproducibility.

**Rules to set**:
- Require status checks to pass before merging
- Required checks: `unit-tests`, `lint`, `integration-tests`, `e2e-tests`, `build`
- Block direct pushes to `main`
- Block force pushes to `main`
- No reviewer approval required (solo developer)

**Alternatives considered**:
- GitHub rulesets (newer API) — more powerful but same effect for this use case
- CODEOWNERS — not needed for solo project