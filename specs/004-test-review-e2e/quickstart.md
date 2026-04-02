# Quickstart: Test Review & E2E Login

## Pre-requisitos

1. PostgreSQL rodando com banco configurado
2. `.env` com `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
3. Migrations: `bun run db:migrate`
4. Seed: `bun run db:seed`
5. Playwright browsers: `bunx playwright install chromium`

## Rodar testes

```bash
# Unit (Vitest)
bun run test:unit

# Integration (Vitest, requer PostgreSQL)
bun run test:integration

# E2E (Playwright, requer PostgreSQL + seed + chromium)
bun run test:e2e

# Todos
bun run test
```

## Estrutura de testes

| Suite | Framework | Diretorio | O que testa |
|-------|-----------|-----------|-------------|
| Unit | Vitest | `__tests__/unit/` | Funcoes puras, schemas, mocks |
| Integration | Vitest | `__tests__/integration/` | DB real, crypto, sessoes |
| E2E | Playwright | `__tests__/e2e/` | Fluxos completos no browser |

## Debug E2E

```bash
# Rodar com browser visivel
bunx playwright test --headed

# Rodar teste especifico
bunx playwright test login

# Ver report HTML
bunx playwright show-report
```