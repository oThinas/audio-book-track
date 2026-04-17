# Estratégia de Testes — AudioBook Track

Este documento descreve como os testes do projeto são classificados, isolados e executados. É a referência canônica para decidir onde um novo teste deve morar e como ele deve ser escrito.

Para as regras de obrigatoriedade e cobertura, ver [CLAUDE.md](../CLAUDE.md) § TDD e § Regras de Classificação de Testes. Este documento foca em **como a estratégia é implementada**.

---

## 1. Pirâmide de testes

```
       ┌──────────────┐
       │     E2E      │  Playwright + schema-per-worker
       ├──────────────┤
       │ Integration  │  Vitest + Postgres real
       ├──────────────┤
       │     Unit     │  Vitest + mocks/fakes
       └──────────────┘
```

Cada camada responde a uma pergunta diferente:

| Camada | Pergunta | Escopo |
|---|---|---|
| Unit | "Esta função/classe faz o que eu espero, isolada de I/O?" | 1 unidade, sem rede, sem DB |
| Integration | "Este módulo funciona com o banco real?" | 2+ módulos, DB real, sem UI |
| E2E | "O usuário consegue completar este fluxo no navegador?" | App rodando, DB real, UI |

### Árvore de decisão para um novo teste

```
O teste usa vi.mock(), fakes injetados ou testa função pura?       → Unit
O teste conecta no banco ou integra múltiplos módulos reais?       → Integration
O teste abre browser e simula ações de um usuário real?            → E2E
```

---

## 2. Unit tests

**Onde moram**: `__tests__/unit/**/*.{test,spec}.ts`
**Framework**: Vitest
**Setup**: [__tests__/unit/setup.ts](../__tests__/unit/setup.ts) — mock global de `@/lib/db` e `@/lib/env`
**Comando**: `bun run test:unit`

### Regras

- **Zero I/O real**: sem pg, sem fetch, sem filesystem fora do necessário para o módulo testado.
- **Toda dependência externa mockada ou substituída por fake.**
- Rápido o bastante para rodar em watch-mode sem fricção.

### Doubles permitidos

| Padrão | Quando usar |
|---|---|
| Fake de função (`vi.fn()`) | Módulo aceita dependência via argumento de função — padrão em `checkDatabaseHealth(ping)` |
| Fake de repositório (classe) | Service recebe repository pelo construtor — padrão em `InMemoryUserPreferenceRepository` |
| `vi.mock()` | Somente para módulos **não injetáveis por design**: `next/headers`, `next/navigation`, `@/lib/db`, `@/lib/env` |

Ver a allowlist completa em [CLAUDE.md § Convenção de Test Doubles](../CLAUDE.md).

### Por que `@/lib/env` tem `schema.ts` separado de `index.ts`

`index.ts` executa `envSchema.parse(process.env)` no carregamento do módulo (side effect). O mock global `vi.mock("@/lib/env")` substitui o módulo inteiro; testes que precisam do **schema real** importam diretamente de `@/lib/env/schema` (arquivo puro, sem side effects, não mockado).

Exemplo: [__tests__/unit/env/test-database-url.spec.ts](../__tests__/unit/env/test-database-url.spec.ts).

### Exemplo de unit test

```ts
// __tests__/unit/db/health-check.test.ts
import { describe, expect, it, vi } from "vitest";
import { checkDatabaseHealth, type PingFn } from "@/lib/db/health-check";

describe("checkDatabaseHealth", () => {
  it("retries and returns healthy when ping succeeds on third attempt", async () => {
    const ping: PingFn = vi.fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValueOnce(undefined);

    const result = await checkDatabaseHealth(ping, {
      maxRetries: 3, retryIntervalMs: 10, timeoutMs: 100,
    });

    expect(result).toEqual({ healthy: true });
    expect(ping).toHaveBeenCalledTimes(3);
  });
});
```

---

## 3. Integration tests

**Onde moram**: `__tests__/integration/**/*.{test,spec}.ts`
**Framework**: Vitest + PostgreSQL real
**Banco**: `audiobook_track_test` (nunca toca `audiobook_track`)
**Setup global**: [__tests__/integration/global-setup.ts](../__tests__/integration/global-setup.ts)
**Setup por arquivo**: [__tests__/integration/setup.ts](../__tests__/integration/setup.ts)
**Comando**: `bun run test:integration`

### Como o isolamento funciona

Para provar regras de integração sem que testes interfiram entre si, usamos **transações + rollback** dentro do schema `public` da base de teste:

```
┌─ vitest globalSetup (1x por suíte) ────────────────────────────┐
│  Se TEST_DATABASE_URL ausente, falha rápido                    │
│  Aplica migrations em audiobook_track_test (public)            │
└────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─ beforeEach (por teste) ───────────────────────────────────────┐
│  const client = await pool.connect();                          │
│  await client.query("BEGIN");                                  │
│  setTestDb(drizzle(client));                                   │
└────────────────────────────────────────────────────────────────┘
     │
     ▼
  — teste executa —
     │
     ▼
┌─ afterEach ────────────────────────────────────────────────────┐
│  await client.query("ROLLBACK");   ← desfaz todas as mudanças  │
│  client.release();                                             │
└────────────────────────────────────────────────────────────────┘
```

**Ganho**: cada teste enxerga o estado pós-migrations; tudo que ele escreve é descartado. Nenhum teste vê dados de outro. Sem seeds compartilhados, sem limpeza manual.

### Por que `TEST_DATABASE_URL` separada da `DATABASE_URL`

O env schema ([src/lib/env/schema.ts](../src/lib/env/schema.ts)) usa `superRefine` condicional:

- `NODE_ENV === "test"` → exige **`TEST_DATABASE_URL`** (e `DATABASE_URL` é opcional)
- `NODE_ENV !== "test"` → exige **`DATABASE_URL`**

Garante que nenhum teste integração consiga acidentalmente conectar na base de dev — o `getPool()` em [__tests__/helpers/db.ts](../__tests__/helpers/db.ts) falha rápido se `TEST_DATABASE_URL` não estiver setado.

### Exemplo de integration test

```ts
// __tests__/integration/auth/session.test.ts
import { describe, expect, it } from "vitest";
import { getTestDb } from "@tests/helpers/db";
import { createTestUser, createTestSession } from "@tests/helpers/factories";

describe("session isolation", () => {
  it("creates a session for a user", async () => {
    const db = getTestDb();
    const { user } = await createTestUser(db);
    const { session } = await createTestSession(db, { userId: user.id });

    expect(session.userId).toBe(user.id);
    // Ao final do teste, ROLLBACK descarta user + session — próximo teste começa limpo
  });
});
```

### Factories, não seed

Novas entidades de domínio NÃO alteram `seed-test.ts`. Em vez disso, criam-se factories em [__tests__/helpers/factories.ts](../__tests__/helpers/factories.ts). O seed-test permanece estável: apenas o admin. Regra documentada em [CLAUDE.md § Nova entidade: factory, não seed](../CLAUDE.md).

---

## 4. E2E tests

**Onde moram**: `__tests__/e2e/**/*.spec.ts`
**Framework**: Playwright + Chromium
**Banco**: `audiobook_track_test` com **schema único por worker**
**Fixture central**: [__tests__/e2e/fixtures/app-server.ts](../__tests__/e2e/fixtures/app-server.ts)
**Global setup**: [__tests__/e2e/global-setup.ts](../__tests__/e2e/global-setup.ts)
**Comando**: `bun run test:e2e`

### Arquitetura schema-per-worker

```
audiobook_track_test (1 base, N schemas)
├── public                       ← integration tests (BEGIN/ROLLBACK)
├── e2e_w0_abc12345              ← Playwright worker 0
├── e2e_w1_def67890              ← Playwright worker 1
├── e2e_w2_...                   ← ...
└── drizzle                      ← migration journal (dev/integration)
```

Cada worker do Playwright recebe:

1. **Um schema exclusivo** (`e2e_w{index}_{uuid8}`) criado no início do worker.
2. **Migrations aplicadas no schema** via CLI `migrate.ts --schema <nome>` (reescreve `"public"."..."` hardcoded do Drizzle para o schema-alvo).
3. **Seed-test executado** (apenas admin) contra esse schema.
4. **Uma instância `next start` em porta própria** (`3100 + workerIndex`) com `DATABASE_URL` apontando para o schema via `?options=-c search_path=<schema>`.
5. **Admin session preservada** durante o worker — reset entre testes só trunca tabelas de domínio.

### Ciclo de vida do fixture `appServer`

```
worker start
    │
    ├─ createWorkerSchema(e2e_w0_abc12345)
    ├─ applyMigrationsToSchema(...)          ← spawn `bun run src/lib/db/migrate.ts --schema ...`
    ├─ seedAdminForSchema(...)               ← spawn `bun run src/lib/db/seed-test.ts --schema ...`
    ├─ startNextDev(port=3100, ...)          ← spawn `bun x next start --port 3100`
    │    └─ env: DATABASE_URL=<test?search_path=...>, BETTER_AUTH_URL=http://localhost:3100,
    │           E2E_TEST_MODE=1 (desliga rate limit + habilita signup)
    ├─ waitUntilReady(baseURL/api/health)
    │
    ├─ test 1 ─┐
    │          ├─ truncateDomainTables(schema)   ← autoReset fixture
    │          ├─ beforeEach login(page)
    │          └─ — test body —
    │
    ├─ test 2 ─┐
    │          ├─ truncateDomainTables(schema)
    │          └─ ...
    │
    └─ worker teardown
         ├─ stopNextDev
         └─ dropWorkerSchema(e2e_w0_abc12345)
```

### Por que `next start` em vez de `next dev`

Cada worker precisa de um servidor isolado (cada um conecta em schema diferente). Com múltiplos workers compilando `next dev --turbopack` em paralelo, o cold start pode estourar o timeout do fixture e testes falham.

Solução: [global-setup.ts](../__tests__/e2e/global-setup.ts) roda `next build` **uma vez** por sessão e cacheia via `BUILD_ID` (janela de frescor definida em `BUILD_FRESH_WINDOW_MS`). Workers rodam `next start` — serve `.next/` pré-compilado em segundos.

Trade-off: sem HMR durante E2E. Aceitável — E2E testa comportamento, não dev-loop.

### Por que `E2E_TEST_MODE=1` em vez de `NODE_ENV=test`

`next start` exige `NODE_ENV=production`. Se a auth config usasse `NODE_ENV === "test"` para desabilitar rate limit, o valor seria `false` em runtime. Usamos `process.env.E2E_TEST_MODE` (lido por request no servidor Next.js) para desacoplar:

```ts
// src/lib/auth/server.ts
disableSignUp: process.env.E2E_TEST_MODE !== "1",
rateLimit: process.env.E2E_TEST_MODE === "1"
  ? { enabled: false }
  : { window: 60, max: 3 },
```

- Produção: signup desativado, rate limit ativo.
- E2E: signup habilitado (necessário para testes de isolamento), rate limit desligado (senão o `beforeEach login` de cada teste esgota o limite).

### Reset entre testes

[__tests__/e2e/helpers/reset.ts](../__tests__/e2e/helpers/reset.ts) implementa `truncateDomainTables(schema)`:

- Introspecta `information_schema.tables` do schema do worker.
- Trunca TODAS as tabelas exceto `user`, `account`, `session`, `__drizzle_migrations`.
- Comando único (`TRUNCATE ... RESTART IDENTITY CASCADE`) para minimizar round-trips.

Roda como fixture auto-scope em `beforeEach`. Admin preservado → `login()` segue funcionando teste após teste.

### Limpeza de schemas órfãos

Se um worker morrer (Ctrl+C, crash), `dropWorkerSchema` pode não rodar. Para evitar acúmulo:

- `createWorkerSchema` adiciona `COMMENT ON SCHEMA <nome> IS 'created_at:<ISO>'`.
- `cleanOrphanSchemas(olderThanMs)` varre `pg_namespace` + `pg_description`, dropa schemas `e2e_%` mais velhos que o threshold.
- Playwright `globalSetup` chama `cleanOrphanSchemas(1h)` antes de cada run.
- Script manual: `bun run db:test:clean-orphans`.

### Exemplo de E2E test

```ts
// __tests__/e2e/settings-page.spec.ts
import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

test.describe("Settings page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);   // usa admin preservado pelo schema-per-worker
  });

  test("renderiza título", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
  });
});
```

**Importante**: sempre importar `test` e `expect` de `./fixtures/app-server`, nunca de `@playwright/test`. O fixture injeta `baseURL` correto e ativa o auto-reset.

---

## 5. Configuração de ambientes

### `.env.test` (local, gitignored)

```
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/audiobook_track_test
BETTER_AUTH_SECRET=test-secret-not-for-production
BETTER_AUTH_URL=http://localhost:1197
NODE_ENV=test
```

Copiar de [.env.test.example](../.env.test.example) no primeiro clone. `DATABASE_URL` é omitida intencionalmente — testes não devem conseguir tocar a base de dev.

### Primeira execução

```bash
bun run db:test:setup     # cria audiobook_track_test + migrations + admin seed
bun run test:unit
bun run test:integration
bun run test:e2e          # paralelo local; serial quando CI=true
```

Todos os scripts encadeiam `NODE_ENV=test` automaticamente — Bun carrega `.env.test` por convenção.

### CI (GitHub Actions)

- 1 worker Playwright serial ([playwright.config.ts](../playwright.config.ts): `workers: process.env.CI ? 1 : undefined`).
- Step de assertion antes dos testes que parseia `playwright test --list --reporter=json` e falha se `config.workers !== 1`.
- Artifact upload de `playwright-report/` em caso de falha.

Ver [.github/workflows/pr-checks.yml](../.github/workflows/pr-checks.yml).

---

## 6. Decisões-chave e porquês

| Decisão | Alternativa rejeitada | Razão |
|---|---|---|
| Schema-per-worker (E2E) | Base-per-worker | CREATE DATABASE é mais lento que CREATE SCHEMA em uma ordem de magnitude; DB compartilhada suporta N conexões |
| BEGIN/ROLLBACK (integration) | Schema-per-teste integration | Overhead desnecessário; BEGIN/ROLLBACK é atômico e rápido |
| `next start` + build único | `next dev --turbopack` por worker | 4 cold starts paralelos saturam CPU |
| `E2E_TEST_MODE` flag | `NODE_ENV === "test"` | `next start` exige `NODE_ENV=production`, não pode flipar auth |
| TRUNCATE seletivo | DROP + CREATE schema por teste | TRUNCATE é uma ordem de magnitude mais rápido; admin preservado |
| Factory em vez de seed | Expandir `seed-test.ts` | Seed-test estável = zero manutenção conforme domínio cresce |

---

## 7. Quando algo quebra

| Sintoma | Causa provável | Ação |
|---|---|---|
| `TEST_DATABASE_URL is required when NODE_ENV=test` | `.env.test` ausente | Copiar `.env.test.example` → `.env.test` |
| `ECONNREFUSED localhost:5432` | Postgres parado | Subir stack local |
| `EADDRINUSE` em porta `3100+` | Next.js de run anterior preso | Matar processos nas portas dos workers (`BASE_E2E_PORT` em [fixtures/app-server.ts](../__tests__/e2e/fixtures/app-server.ts)) |
| `schema e2e_w0_... already exists` | Worker anterior morto sem cleanup | `bun run db:test:clean-orphans` |
| E2E fica em `/login` depois do submit | Rate limit ou build auth stale | Verificar `E2E_TEST_MODE=1` no spawn + `bun run build` novamente |
| Teste passa isolado, falha no conjunto | State leaking entre testes | Verificar se tabela é preservada no truncate — se não deveria, adicionar factory cleanup |

Mais detalhes em [specs/016-test-db-isolation/quickstart.md § 5 Troubleshooting](../specs/016-test-db-isolation/quickstart.md).