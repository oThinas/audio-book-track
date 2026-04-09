# Quickstart: Testes de Invalidacao de Sessao

**Branch**: `007-session-invalidation-tests`

## Pre-requisitos

- Bun runtime instalado
- PostgreSQL rodando (para testes de integracao existentes)
- Variaveis de ambiente configuradas (`.env`)

## Rodar os testes

```bash
# Unit tests (inclui novos testes de clear-session e proxy)
bun run test:unit

# E2E tests (inclui novo teste de logout)
bun run test:e2e

# Lint
bun run lint
```

## Arquivos novos nesta feature

```
__tests__/unit/api/auth/clear-session.test.ts   # Testes do route handler
__tests__/e2e/auth/logout.spec.ts                # Teste E2E do fluxo de logout
```

## Arquivos modificados nesta feature

```
__tests__/unit/proxy/proxy.test.ts               # Novos cenarios de edge case
```

## Notas

- Nenhum codigo de producao e alterado — apenas testes.
- Os testes E2E requerem o servidor dev rodando (Playwright gerencia isso automaticamente via `webServer` config).
- O usuario seed `admin/admin123` deve existir no banco para E2E.