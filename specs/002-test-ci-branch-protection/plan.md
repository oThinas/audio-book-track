# Implementation Plan: Test Commands, CI Pipelines & Branch Protection

**Branch**: `002-test-ci-branch-protection` | **Date**: 2026-04-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-test-ci-branch-protection/spec.md`

## Summary

Set up separated test commands (unit, integration, e2e), GitHub Actions CI pipelines (unit+lint on push, integration+e2e+build on PR), a pre-commit hook for lint auto-fix, and branch protection on `main`. The project already has the test directory structure and tooling in place — this feature adds the automation and enforcement layer.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Next.js (latest), Vitest 4.x, Biome 2.x, Bun  
**Storage**: PostgreSQL 16 (Docker — needed for integration tests in CI)  
**Testing**: Vitest with @vitest/coverage-v8  
**Target Platform**: GitHub-hosted runners (ubuntu-latest)  
**Project Type**: Next.js full-stack web application  
**Performance Goals**: Push CI < 2 min, PR CI < 5 min  
**Constraints**: Solo developer project, no reviewer approval needed  
**Scale/Scope**: Small project, ~8 test files currently

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Chapter as unit of work | N/A | No domain changes |
| II. Financial precision | N/A | No financial changes |
| III. Lifecycle integrity | N/A | No status transitions |
| IV. Simplicity first (YAGNI) | PASS | Only what's needed — no over-engineering |
| V. TDD | PASS | This feature enables better TDD enforcement via CI |
| VI. Clean architecture | N/A | No backend changes |
| VII. Frontend composition | N/A | No UI changes |
| VIII. Performance | PASS | CI caching to keep pipelines fast |
| IX. Design tokens | N/A | No visual changes |
| X. REST API patterns | N/A | No API changes |
| XI. PostgreSQL | PASS | Integration tests use PostgreSQL service container |
| XII. Anti-patterns | PASS | No anti-patterns introduced |
| XIII. Metrics/KPIs | N/A | No dashboard changes |
| XIV. PDF viewer | N/A | No PDF changes |

**Gate result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-test-ci-branch-protection/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # N/A (no data model changes)
├── quickstart.md        # Phase 1 output
├── contracts/           # N/A (no API contracts)
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
# Files to CREATE
.github/
├── workflows/
│   ├── unit-tests.yml        # Push pipeline: unit tests + lint + coverage report
│   └── pr-checks.yml         # PR pipeline: integration + e2e + build
.husky/
├── pre-commit                # Lint auto-fix hook

# Files to MODIFY
package.json                  # Update test scripts
vitest.config.ts              # May need workspace configs for category separation

# Files UNCHANGED
__tests__/
├── unit/                     # Already exists
│   └── schemas/auth.test.ts
├── integration/              # Already exists
│   └── auth/*.test.ts
├── e2e/                      # Already exists
│   └── auth/login.test.ts
└── helpers/                  # Already exists
    └── auth.ts
```

**Structure Decision**: The existing `__tests__/{unit,integration,e2e}/` directory convention is already in place. No structural changes needed — only script and CI configuration additions.

## Complexity Tracking

No violations to justify.