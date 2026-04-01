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
  "test:coverage": "vitest run --coverage",
  "test:watch": "vitest"
}
```

### 6. Create GitHub Actions workflows

- `.github/workflows/unit-tests.yml` — triggers on push to any branch (jobs: `lint`, `unit-tests`)
- `.github/workflows/pr-checks.yml` — triggers on pull_request to main (jobs: `integration-tests`, `e2e-tests`, `build`)

### 7. Configure branch protection

Via GitHub CLI (requires `gh auth login` first):

```bash
gh api repos/oThinas/audio-book-track/branches/main/protection \
  -X PUT \
  --input - << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["unit-tests", "lint", "integration-tests", "e2e-tests", "build"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

Or via GitHub UI: Settings > Branches > Add branch protection rule for `main`.

## Verification

```bash
# Test commands work
bun run test:unit
bun run test:integration  # requires Docker PostgreSQL
bun run test:e2e

# Pre-commit hook works
# Stage a file with lint violations, commit, verify auto-fix

# CI triggers
git push origin 002-test-ci-branch-protection
# Open PR to main — integration, e2e, build checks trigger
```