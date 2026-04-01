# Quickstart: Test Commands, CI Pipelines & Branch Protection

**Feature**: 002-test-ci-branch-protection

## Prerequisites

- Bun installed
- GitHub repository with admin access
- Docker (for local integration tests)

## Setup Steps

### 1. Install hook dependencies

```bash
bun add -d husky lint-staged
```

### 2. Initialize Husky

```bash
bunx husky init
```

### 3. Configure lint-staged in package.json

```json
{
  "lint-staged": {
    "*.{ts,tsx,json}": "bunx biome check --write"
  }
}
```

### 4. Create pre-commit hook

```bash
echo "bunx lint-staged" > .husky/pre-commit
```

### 5. Update test scripts in package.json

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

### 6. Create GitHub Actions workflows

- `.github/workflows/unit-tests.yml` — triggers on push
- `.github/workflows/pr-checks.yml` — triggers on pull_request to main

### 7. Configure branch protection

Via GitHub UI or CLI:
```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  -X PUT \
  -f required_status_checks='{"strict":true,"contexts":["unit-tests","lint","integration-tests","e2e-tests","build"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews=null \
  -f restrictions=null \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

## Verification

```bash
# Test commands work
bun run test:unit
bun run test:integration
bun run test:e2e

# Pre-commit hook works
echo "const   x=1" > /tmp/test.ts && git add /tmp/test.ts && git commit -m "test"
# Should auto-fix formatting

# CI triggers (push to branch, open PR)
git push origin 002-test-ci-branch-protection
```