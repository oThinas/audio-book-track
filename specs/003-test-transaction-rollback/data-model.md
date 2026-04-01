# Data Model: Transaction Rollback para Testes de Integração

**Date**: 2026-04-01  
**Feature**: 003-test-transaction-rollback

## Overview

Esta feature não altera o modelo de dados de produção. As entidades abaixo são **infraestrutura de teste** — existem apenas no contexto de `__tests__/`.

## Test Infrastructure Entities

### TestTransaction

Representa o ciclo de vida da transação por teste.

| Campo        | Tipo              | Descrição                                          |
|--------------|-------------------|----------------------------------------------------|
| client       | pg.PoolClient     | Conexão dedicada do pool, com transação aberta      |
| db           | DrizzleInstance    | Instância Drizzle criada a partir do client          |

**Lifecycle**:
```
beforeEach: pool.connect() → client.query('BEGIN') → drizzle(client) → expõe db
afterEach:  client.query('ROLLBACK') → client.release()
```

### TestPool (Singleton)

Pool compartilhado entre todos os testes de integração.

| Campo        | Tipo              | Descrição                                          |
|--------------|-------------------|----------------------------------------------------|
| pool         | pg.Pool           | Pool de conexões PostgreSQL, criado uma vez          |

**Lifecycle**:
```
beforeAll (global): new Pool({ connectionString: DATABASE_URL })
afterAll (global):  pool.end()
```

## Factory Functions

Factories criam dados dentro da transação do teste. Recebem `db` transacional.

### createTestUser(db, overrides?)

Cria um usuário + account no banco.

| Param     | Tipo            | Default                          |
|-----------|-----------------|----------------------------------|
| name      | string          | `'Test User'`                    |
| email     | string          | `'test-{random}@test.local'`    |
| username  | string          | `'testuser-{random}'`           |
| password  | string          | Hash de `'password123'`          |

**Returns**: `{ user, account }`

### createTestSession(db, userId, overrides?)

Cria uma sessão para um usuário existente.

| Param     | Tipo            | Default                          |
|-----------|-----------------|----------------------------------|
| userId    | string          | (obrigatório)                    |
| token     | string          | `'session-{random}'`            |
| expiresAt | Date            | `now + 7 days`                   |

**Returns**: `{ session }`

## Existing Production Entities (unchanged)

As tabelas `user`, `session`, `account`, `verification` não são alteradas. O transaction rollback garante que dados de teste nunca persistem.