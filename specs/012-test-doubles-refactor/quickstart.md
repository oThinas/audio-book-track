# Quickstart: Test Doubles Refactor

**Branch**: `012-test-doubles-refactor` | **Date**: 2026-04-14

## Contexto Rápido

Refatoração de testes unitários para substituir `vi.mock()` de módulos internos por test doubles manuais (fakes injetáveis e `vi.fn()`). Escopo: apenas 2 arquivos de teste + 2 módulos de produção.

## Padrões de Referência no Codebase

### Modelo 1: Fake in-memory para repository (classe)

```
Teste:      __tests__/unit/user-preference-service.test.ts
Fake:       __tests__/repositories/in-memory-user-preference-repository.ts
Interface:  src/lib/domain/user-preference-repository.ts
Service:    src/lib/services/user-preference-service.ts
```

Usar quando: service depende de repository interface via construtor.

### Modelo 2: vi.fn() para fake de função injetável

```
Teste:      __tests__/unit/db/health-check.test.ts
Tipo:       PingFn = () => Promise<void>
Produção:   src/lib/db/health-check.ts (aceita PingFn como parâmetro)
```

Usar quando: módulo aceita função como parâmetro (injeção de função).

## Arquivos a Modificar

### Produção (extrair lógica testável)

| Arquivo | O que fazer |
|---------|-------------|
| Módulo testado por `health.test.ts` | Extrair lógica em função que aceita dependências como parâmetro |
| Módulo testado por `instrumentation.test.ts` | Extrair lógica em função que aceita dependências como parâmetro |

### Testes (remover vi.mock() de internos)

| Arquivo | O que fazer |
|---------|-------------|
| `__tests__/unit/api/health.test.ts` | Substituir `vi.mock("@/lib/db/ping")` e `vi.mock("@/lib/db/health-check")` por fakes injetados |
| `__tests__/unit/db/instrumentation.test.ts` | Substituir `vi.mock("@/lib/db/ping")` e `vi.mock("@/lib/db/health-check")` por fakes injetados |

### Documentação

| Arquivo | O que fazer |
|---------|-------------|
| `CLAUDE.md` | Adicionar convenção de test doubles na seção de classificação de testes |

## Comandos de Verificação

```bash
bun run lint          # Linting
bun run test:unit     # Testes unitários
bun run test:integration  # Testes de integração (não devem quebrar)
bun run build         # Build de produção
```

## Allowlist de `vi.mock()` Permitidos

| Módulo | Razão |
|--------|-------|
| `next/headers` | Framework externo (Next.js) |
| `next/navigation` | Framework externo (Next.js) |
| `@axe-core/playwright` | Biblioteca externa |
| `better-auth/cookies` | Biblioteca externa |
| `@/lib/env` | Infraestrutura de ambiente |
| `@/lib/db` | Infraestrutura de I/O (singleton PostgreSQL) |