# Quickstart: Database Health Check

**Branch**: `010-db-health-check` | **Date**: 2026-04-10

## Verificação rápida

Após implementação, verificar os dois comportamentos:

### 1. Startup com banco acessível

```bash
# Certifique-se que o PostgreSQL está rodando
docker compose up -d db

# Inicie a aplicação
bun run dev

# Deve exibir no terminal:
# [health-check] Database connection verified successfully
```

### 2. Startup com banco inacessível

```bash
# Pare o PostgreSQL
docker compose stop db

# Tente iniciar a aplicação
bun run dev

# Deve exibir no terminal (após ~6s):
# [health-check] Database health check failed after 3 attempts: connection refused
# E o processo deve encerrar com exit code 1
```

### 3. Endpoint de health check

```bash
# Com a aplicação rodando e banco acessível
curl http://localhost:3000/api/health
# → 200 {"status":"healthy","checks":{"database":"healthy"}}

# Com banco inacessível (se a app ainda estiver rodando)
curl http://localhost:3000/api/health
# → 503 {"status":"unhealthy","checks":{"database":"unhealthy"}}
```

## Arquivos criados/modificados

| Arquivo                          | Descrição                                          |
|----------------------------------|----------------------------------------------------|
| `src/instrumentation.ts`         | Hook de inicialização do Next.js com health check  |
| `src/lib/db/health-check.ts`     | Funções puras com PingFn (inversão de dependência)  |
| `src/lib/db/ping.ts`             | `createDatabasePing(db)` — adaptador Drizzle → PingFn |
| `src/app/api/health/route.ts`    | Endpoint HTTP de health check                      |
| `__tests__/unit/db/health-check.test.ts` | Testes unitários (retry, timeout, mensagens) |
| `__tests__/integration/infra/health-check.test.ts` | Testes de integração (DB real) |