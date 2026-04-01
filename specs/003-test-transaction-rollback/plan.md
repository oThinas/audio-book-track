# Implementation Plan: Transaction Rollback para Testes de Integração

**Branch**: `003-test-transaction-rollback` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-test-transaction-rollback/spec.md`

## Summary

Implementar transaction rollback por teste para isolamento completo dos testes de integração. Cada `test()`/`it()` roda dentro de uma transação PostgreSQL que é revertida ao final, garantindo banco limpo entre testes. Testes existentes (HTTP-based) serão migrados para acesso direto via services/repositories. Factories substituem o seed global. Comportamento idêntico local e CI.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Vitest 4.x, Drizzle ORM, node-postgres (`pg`), better-auth  
**Storage**: PostgreSQL 16 (Docker local, service container no CI)  
**Testing**: Vitest com `beforeEach`/`afterEach` via setup file  
**Target Platform**: Node.js (Bun runtime)  
**Project Type**: Next.js web application (testes rodam em Node)  
**Performance Goals**: Overhead de rollback < 10% do tempo total de testes  
**Constraints**: Testes de integração paralelos entre arquivos, sequenciais dentro de cada arquivo  
**Scale/Scope**: ~13 testes de integração em 5 arquivos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Capítulo como Unidade | N/A | Feature de infraestrutura de teste, não toca domínio |
| II. Precisão Financeira | N/A | Sem alterações em cálculos financeiros |
| III. Ciclo de Vida | N/A | Sem alterações em transições de status |
| IV. Simplicidade (YAGNI) | PASS | Solução mínima: setup file + factories. Sem abstrações extras |
| V. TDD | PASS | Testes de validação do próprio mecanismo serão escritos primeiro |
| VI. Arquitetura Limpa | PASS | Testes migrados para acessar service/repository layer diretamente |
| VII-IX. Frontend | N/A | Sem alterações no frontend |
| X. API REST | N/A | Sem alterações em endpoints |
| XI. PostgreSQL | PASS | Usa transações nativas do PostgreSQL corretamente |
| XII. Anti-Padrões | PASS | Sem violações identificadas |

**Gate result**: PASS — nenhuma violação.

## Project Structure

### Documentation (this feature)

```text
specs/003-test-transaction-rollback/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Research decisions
├── data-model.md        # Test infrastructure entities
├── quickstart.md        # Developer guide
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # (Phase 2 — /speckit.tasks)
```

### Source Code (repository root)

```text
__tests__/
├── helpers/
│   ├── db.ts              # NEW — Transaction rollback helper (getTestDb, pool lifecycle)
│   ├── factories.ts       # NEW — Test data factories (createTestUser, createTestSession)
│   └── auth.ts            # MODIFIED — Kept for utility, HTTP helpers deprecated
├── integration/
│   ├── setup.ts           # NEW — Vitest setup file (beforeEach/afterEach transaction hooks)
│   └── auth/
│       ├── auth.test.ts          # MODIFIED — Migrated from HTTP to direct DB/service access
│       ├── logout.test.ts        # MODIFIED — Migrated
│       ├── session.test.ts       # MODIFIED — Migrated
│       ├── rate-limit.test.ts    # UNCHANGED — Config verification, no DB needed
│       └── signup-blocked.test.ts # MODIFIED — Migrated
├── unit/                  # UNCHANGED
└── e2e/                   # UNCHANGED

vitest.config.ts           # MODIFIED — Add integration project with setupFiles

.github/workflows/
└── pr-checks.yml          # MODIFIED — Remove db:seed step
```

**Structure Decision**: Mantém a estrutura existente de `__tests__/`. Novos arquivos são apenas helpers (`db.ts`, `factories.ts`) e setup file (`integration/setup.ts`). Nenhuma alteração na estrutura de `src/`.

## Complexity Tracking

Nenhuma violação de constituição — seção não aplicável.

## Architecture Decisions

### AD-1: Raw PoolClient com BEGIN/ROLLBACK

Cada teste obtém um `PoolClient` dedicado do pool, executa `BEGIN`, cria uma instância Drizzle a partir dele, e no teardown executa `ROLLBACK` + `release()`.

```
Pool (singleton, criado uma vez)
  └── beforeEach: pool.connect() → client
        └── client.query('BEGIN')
        └── drizzle(client, { schema }) → db exposto ao teste
  └── afterEach: client.query('ROLLBACK')
        └── client.release()
```

**Why not `db.transaction()`**: O `db.transaction()` do Drizzle faz commit automático no final do callback — não permite rollback externo controlado pelo test runner.

### AD-2: Vitest Setup File por Projeto

O `vitest.config.ts` será configurado com projects (ou workspace) para separar integration tests dos demais. O setup file `__tests__/integration/setup.ts` registra hooks `beforeEach`/`afterEach` que são executados automaticamente para todos os testes de integração.

```typescript
// vitest.config.ts — integration project
{
  test: {
    include: ['__tests__/integration/**/*.test.ts'],
    setupFiles: ['__tests__/integration/setup.ts'],
  }
}
```

### AD-3: getTestDb() — Acesso à Instância Transacional

O helper `getTestDb()` retorna a instância Drizzle transacional do teste atual. É armazenada em uma variável de módulo atualizada pelo `beforeEach`.

```typescript
// __tests__/helpers/db.ts
let currentDb: DrizzleInstance;

export function getTestDb(): DrizzleInstance {
  if (!currentDb) throw new Error('getTestDb() called outside of a test');
  return currentDb;
}

export function setTestDb(db: DrizzleInstance) { currentDb = db; }
export function clearTestDb() { currentDb = undefined!; }
```

### AD-4: Factories Simples

Funções puras que recebem `db` e `overrides` opcionais. Geram dados únicos com sufixo aleatório para evitar conflitos entre testes paralelos (arquivos diferentes).

### AD-5: Migração de Testes HTTP → Direto

Os testes de integração atuais testam auth via HTTP (`POST /api/auth/sign-in`). Serão migrados para:
- **auth.test.ts**: Testar login verificando hash de senha + criação de sessão via Drizzle direto ou via better-auth internal API
- **logout.test.ts**: Testar deleção de sessão no banco
- **session.test.ts**: Testar persistência/expiração de sessão no banco
- **signup-blocked.test.ts**: Testar que a config de better-auth bloqueia signup (verificação de config, não HTTP)

O `rate-limit.test.ts` já é verificação de config — não precisa de migração.

## Implementation Phases

### Phase 1: Test Infrastructure (helpers + setup)

1. Criar `__tests__/helpers/db.ts` — pool singleton, `getTestDb()`, `setTestDb()`, `clearTestDb()`
2. Criar `__tests__/integration/setup.ts` — `beforeEach` (BEGIN + Drizzle) e `afterEach` (ROLLBACK + release)
3. Atualizar `vitest.config.ts` — separar integration tests com `setupFiles`
4. Criar `__tests__/helpers/factories.ts` — `createTestUser()`, `createTestSession()`
5. Escrever teste de validação do mecanismo (inserir dado, verificar que não persiste)

### Phase 2: Migrate Existing Tests

6. Migrar `auth.test.ts` — de HTTP para acesso direto
7. Migrar `logout.test.ts` — de HTTP para acesso direto
8. Migrar `session.test.ts` — de HTTP para acesso direto
9. Migrar `signup-blocked.test.ts` — de HTTP para verificação de config
10. Remover dependências HTTP não utilizadas de `__tests__/helpers/auth.ts`

### Phase 3: CI/CD Alignment

11. Atualizar `.github/workflows/pr-checks.yml` — remover step `db:seed`
12. Verificar que migrations continuam rodando no CI
13. Rodar suite completa localmente e validar paridade

### Phase 4: Validation

14. Rodar testes em ordem aleatória (`--sequence.shuffle`)
15. Verificar que dois testes com mesmo unique constraint passam
16. Validar que unit tests e e2e tests não são afetados