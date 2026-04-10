# Contract: Health Endpoint

**Branch**: `010-db-health-check` | **Date**: 2026-04-10

## `GET /api/health`

Endpoint de verificação de saúde da aplicação. Sem autenticação.

### Request

- **Method**: `GET`
- **Path**: `/api/health`
- **Headers**: Nenhum obrigatório
- **Body**: Nenhum
- **Authentication**: Nenhuma (acesso público)

### Response — Saudável

- **Status**: `200 OK`
- **Content-Type**: `application/json`

```json
{
  "status": "healthy",
  "checks": {
    "database": "healthy"
  }
}
```

### Response — Não saudável

- **Status**: `503 Service Unavailable`
- **Content-Type**: `application/json`

```json
{
  "status": "unhealthy",
  "checks": {
    "database": "unhealthy"
  }
}
```

### Comportamento

| Cenário                          | Status HTTP | `status`      | `checks.database` |
|----------------------------------|-------------|---------------|--------------------|
| Banco acessível                  | 200         | `"healthy"`   | `"healthy"`        |
| Banco inacessível                | 503         | `"unhealthy"` | `"unhealthy"`      |
| Banco lento (timeout na query)   | 503         | `"unhealthy"` | `"unhealthy"`      |
| Credenciais inválidas            | 503         | `"unhealthy"` | `"unhealthy"`      |

### Regras de segurança

- A resposta NÃO inclui: connection string, credenciais, versão do banco, hostname interno, stack traces.
- A resposta NÃO inclui latência da query (evita information leakage).
- O endpoint NÃO requer autenticação para permitir uso por load balancers e orquestradores.

### Timeout

- A query de verificação (`SELECT 1`) tem timeout de 5 segundos.
- Se a query não completar dentro do timeout, o endpoint retorna `503`.