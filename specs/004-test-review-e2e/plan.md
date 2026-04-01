# Implementation Plan: Test Review & E2E Login

**Branch**: `004-test-review-e2e` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-test-review-e2e/spec.md`

## Summary

Revisar e reclassificar testes existentes conforme as regras de classificação
do Princípio V da constituição (unit/integration/e2e), e configurar Playwright
como framework E2E para validar o fluxo completo de login no browser.

A reclassificação já foi parcialmente executada (3 testes movidos). Esta feature
valida que tudo está correto e adiciona o primeiro teste E2E real.

## Technical Context

**Language/Version**: TypeScript 5.9 (Bun runtime)
**Primary Dependencies**: Next.js 16.2, better-auth 1.5, Drizzle ORM, Playwright (novo)
**Storage**: PostgreSQL (via pg driver)
**Testing**: Vitest (unit + integration), Playwright (E2E — novo)
**Target Platform**: Web (Node.js server, Chromium headless para E2E)
**Project Type**: web-service (Next.js full-stack)
**Performance Goals**: E2E login flow < 10s
**Constraints**: Seed user (`admin` / `admin123`) deve existir no banco para E2E
**Scale/Scope**: 1 fluxo E2E (login), ~33 testes existentes para auditar

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Capítulo como Unidade | N/A | Feature de testes, não toca domínio |
| II. Precisão Financeira | N/A | Sem cálculos financeiros |
| III. Ciclo de Vida | N/A | Sem transições de status |
| IV. Simplicidade (YAGNI) | PASS | Playwright é o mínimo necessário para E2E real |
| V. TDD / Classificação | GATE | Feature implementa e valida este princípio |
| VI. Arquitetura Limpa | N/A | Sem código de negócio |
| VII. Frontend | N/A | Sem componentes novos |
| VIII. Performance | PASS | Playwright roda headless, sem impacto em bundle |
| IX. Design Tokens | N/A | Sem UI nova |
| X. Padrões API REST | N/A | Sem endpoints novos |
| XI. PostgreSQL | N/A | Sem migrations |
| XII. Anti-Padrões | PASS | Nenhum anti-padrão introduzido |
| XIII. Métricas/KPIs | N/A | Sem dashboard changes |
| XIV. PDF Viewer | N/A | Sem PDF |

**Gate V**: A feature existe para cumprir este princípio. A reclassificação dos
testes e a adição de E2E com Playwright são o entregável direto.

## Project Structure

### Documentation (this feature)

```text
specs/004-test-review-e2e/
├── plan.md              # This file
├── research.md          # Phase 0: Playwright config research
├── quickstart.md        # Phase 1: como rodar E2E
└── tasks.md             # Phase 2: task list (via /speckit.tasks)
```

### Source Code (repository root)

```text
__tests__/
├── unit/                    # Vitest — funções puras, mocks, config
│   ├── schemas/auth.test.ts
│   ├── proxy/proxy.test.ts
│   └── config/
│       ├── signup-blocked.test.ts
│       └── rate-limit.test.ts
├── integration/             # Vitest — DB real, transaction rollback
│   ├── auth/
│   │   ├── auth.test.ts
│   │   ├── logout.test.ts
│   │   └── session.test.ts
│   ├── infra/
│   │   └── transaction-rollback.test.ts
│   └── setup.ts
├── e2e/                     # Playwright — browser real
│   └── auth/
│       └── login.test.ts    # NOVO: fluxo de login E2E
└── helpers/
    ├── db.ts
    └── factories.ts

# Novos arquivos na raiz
playwright.config.ts         # NOVO: configuração Playwright
```

**Structure Decision**: Testes E2E migram de Vitest para Playwright.
O diretório `__tests__/e2e/` passa a conter testes Playwright.
Vitest continua para unit e integration. O script `test:e2e` no
package.json será atualizado para rodar Playwright em vez de Vitest.

## Research (Phase 0)

### Playwright com Next.js + Bun

**Decision**: Usar `@playwright/test` com `webServer` config para iniciar
Next.js automaticamente antes dos testes.

**Rationale**: Playwright é a ferramenta definida nas regras do projeto para
E2E. A opção `webServer` do `playwright.config.ts` inicia `next dev` ou
`next start` automaticamente e espera o server estar pronto.

**Alternativas consideradas**:
- Cypress: descartado — Playwright é o padrão definido na constituição e regras TS.
- Vitest com happy-dom/jsdom para E2E: descartado — não testa browser real,
  viola regra de classificação E2E.

### Configuração Playwright

**Decision**: Usar configuração mínima com chromium only, headless, e `webServer`
apontando para `bun run dev`.

**Config planejada**:
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
```

### Seed Data para E2E

**Decision**: E2E depende do seed user existir. O script `db:seed` cria o
usuário `admin` / `admin123` se não existir (idempotente).

**Rationale**: Rodar seed antes de E2E é simples e confiável. O seed script
já verifica se o user existe antes de criar.

### Vitest Config — Remover projeto E2E

**Decision**: Remover o projeto `e2e` do `vitest.config.ts` já que E2E
migra para Playwright. Vitest fica apenas com `unit` e `integration`.

### Login Form — Seletores para Playwright

**Decision**: Usar seletores semânticos (label, role, placeholder) em vez
de test-ids para manter os testes resilientes e acessíveis.

**Seletores planejados**:
- Username: `page.getByLabel('Username')`
- Password: `page.getByLabel('Senha')`
- Submit: `page.getByRole('button', { name: 'Entrar' })`
- Error toast: `page.locator('[data-sonner-toast]')` (sonner toast)

### Script test:e2e

**Decision**: Atualizar `test:e2e` no package.json de `vitest run __tests__/e2e/`
para `bunx playwright test`.

## Quickstart (Phase 1)

### Pré-requisitos

1. PostgreSQL rodando com banco de teste configurado
2. `.env` com `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
3. Migrations aplicadas: `bun run db:migrate`
4. Seed executado: `bun run db:seed`

### Rodar testes

```bash
# Unit tests (Vitest)
bun run test:unit

# Integration tests (Vitest, requer PostgreSQL)
bun run test:integration

# E2E tests (Playwright, requer PostgreSQL + seed)
bun run test:e2e

# Todos juntos
bun run test
```

### Instalar Playwright browsers

```bash
bunx playwright install chromium
```

## Complexity Tracking

> Nenhuma violação de constituição. Nenhuma complexidade extra.