# Quickstart: Transaction Rollback para Testes de Integração

**Date**: 2026-04-01
**Feature**: 003-test-transaction-rollback

## Como escrever um novo teste de integração

```typescript
// __tests__/integration/example/my-feature.test.ts
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { user } from "@/lib/db/schema";
import { getTestDb } from "@tests/helpers/db";
import { createTestUser } from "@tests/helpers/factories";

describe("My Feature", () => {
  it("should do something with a user", async () => {
    const db = getTestDb();
    const { user: created } = await createTestUser(db);

    const rows = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.id, created.id));

    expect(rows).toHaveLength(1);
    // Ao final do teste, tudo é revertido automaticamente
  });

  it("can create the same user again (rollback garante isolamento)", async () => {
    const db = getTestDb();
    const { user: created } = await createTestUser(db, { email: "same@test.local" });

    // Este teste não conflita com o anterior — cada um tem sua transação
    expect(created.email).toBe("same@test.local");
  });
});
```

## Factories disponíveis

```typescript
import { createTestUser, createTestSession } from "@tests/helpers/factories";

// Criar usuário com defaults
const { user, account } = await createTestUser(db);

// Criar usuário com overrides
const { user, account } = await createTestUser(db, {
  name: "Custom User",
  email: "custom@test.local",
  username: "customuser",
  password: "mypassword",
});

// Criar sessão para um usuário
const { session } = await createTestSession(db, user.id);

// Criar sessão com overrides
const { session } = await createTestSession(db, user.id, {
  token: "custom-token",
  expiresAt: new Date(Date.now() + 3600_000), // 1 hora
});
```

## Como rodar

```bash
# Todos os testes de integração
bun run test:integration

# Um arquivo específico
bun run test:integration -- __tests__/integration/auth/auth.test.ts

# Todos os testes (unit + integration + e2e)
bun run test

# Com coverage
bun run test:coverage
```

## Pré-requisitos

- PostgreSQL rodando (via `docker compose up -d`)
- Migrations aplicadas (`bun run db:migrate`)
- **Seed NÃO é necessário** — cada teste cria seus próprios dados via factories

## Regras

1. **Nunca** use HTTP requests em testes de integração — acesse services/repositories diretamente
2. **Sempre** use `getTestDb()` para obter a instância de banco — nunca crie sua própria conexão
3. **Sempre** use factories (`createTestUser`, `createTestSession`) para criar dados
4. **Nunca** dependa de dados criados por outro teste
5. O rollback é automático — não precisa de cleanup manual

## Verificação de password (via better-auth/crypto)

```typescript
import { verifyPassword } from "better-auth/crypto";

const { account: acc } = await createTestUser(db, { password: "admin123" });

const isValid = await verifyPassword({
  hash: acc.password ?? "",
  password: "admin123",
});
expect(isValid).toBe(true);
```