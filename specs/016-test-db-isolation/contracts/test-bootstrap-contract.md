# Contract: Test Bootstrap

**Feature**: 016-test-db-isolation
**Date**: 2026-04-17

Esta feature não expõe APIs REST novas. O "contrato" aqui é o **shape de programação** que os testes e os scripts de infra devem seguir. Mudanças nesses contratos DEVEM quebrar a suíte de testes — são pontos de inflexão.

---

## Contract 1: Env Validation

**Location**: [src/lib/env/index.ts](src/lib/env/index.ts)

```ts
const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1).optional(),
    TEST_DATABASE_URL: z.string().min(1).optional(),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string().min(1),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  })
  .superRefine((values, ctx) => {
    if (values.NODE_ENV === "test") {
      if (!values.TEST_DATABASE_URL) {
        ctx.addIssue({
          code: "custom",
          message: "TEST_DATABASE_URL is required when NODE_ENV=test.",
          path: ["TEST_DATABASE_URL"],
        });
      }
      return;
    }
    if (!values.DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        message: `DATABASE_URL is required when NODE_ENV=${values.NODE_ENV}.`,
        path: ["DATABASE_URL"],
      });
    }
  });

export const env = envSchema.parse(process.env);
```

**Contract**:
- Quando `NODE_ENV === "test"`, a ausência de `TEST_DATABASE_URL` DEVE fazer o processo abortar em < 1 segundo (SC-007) com mensagem indicando qual arquivo editar. `DATABASE_URL` é opcional nesse modo — testes nunca abrem conexão nela.
- Quando `NODE_ENV !== "test"`, `DATABASE_URL` é obrigatória e `TEST_DATABASE_URL` é silenciosamente ignorada pela aplicação.

---

## Contract 2: Migrate CLI

**Location**: [src/lib/db/migrate.ts](src/lib/db/migrate.ts)

```ts
// Argv suportados:
//   --url <connection-string>    (default: env.DATABASE_URL)
//   --schema <schema-name>       (default: aplica no schema atual, i.e. public)
//
// Retorno:
//   exit 0 em sucesso
//   exit 1 em falha, com stderr legível

// Exemplos:
//   bun run src/lib/db/migrate.ts
//     → aplica em DATABASE_URL / public
//
//   bun run src/lib/db/migrate.ts --url "$TEST_DATABASE_URL"
//     → aplica em TEST_DATABASE_URL / public (usado por db:test:setup)
//
//   bun run src/lib/db/migrate.ts --url "$TEST_DATABASE_URL" --schema "e2e_w0_abc123de"
//     → aplica no schema específico (usado pela fixture do worker)
```

**Contract**:
- Quando `--schema` é passado: o script MUST abrir conexão com `options=-c search_path=<schema>`, garantir `CREATE SCHEMA IF NOT EXISTS`, e rodar migrations que populam `__drizzle_migrations` dentro desse schema.
- Quando `--schema` NÃO é passado: comportamento atual preservado (migrations aplicadas no schema corrente da URL, default `public`).
- Idempotente: rodar 2x seguidas em schema vazio é equivalente a rodar 1x.

---

## Contract 3: Worker Schema Helpers

**Location**: [src/lib/db/test-schema.ts](src/lib/db/test-schema.ts)

```ts
/** Cria um schema novo na base de teste. Idempotente via IF NOT EXISTS. */
export async function createWorkerSchema(schemaName: string): Promise<void>;

/** Remove schema e todos seus objetos. Idempotente via IF EXISTS. */
export async function dropWorkerSchema(schemaName: string): Promise<void>;

/** DROP em schemas `e2e_%` mais velhos que o threshold em ms. */
export async function cleanOrphanSchemas(
  olderThanMs: number,
): Promise<{ dropped: readonly string[] }>;

/** Gera nome canônico: e2e_w{index}_{shortUuid}. */
export function buildWorkerSchemaName(workerIndex: number): string;
```

**Contract**:
- `createWorkerSchema` MUST falhar com mensagem explícita se a URL alvo for `DATABASE_URL` (guarda de segurança — só cria em test DB).
- `dropWorkerSchema` usa `CASCADE`.
- `cleanOrphanSchemas` retorna a lista de schemas efetivamente removidos para uso em logging.
- Todos aceitam conexão explícita ou usam `TEST_DATABASE_URL` por default.

---

## Contract 4: Playwright Worker Fixture

**Location**: [__tests__/e2e/fixtures/app-server.ts](__tests__/e2e/fixtures/app-server.ts)

```ts
export interface AppServer {
  readonly baseURL: string;
  readonly schemaName: string;
  readonly port: number;
}

export const test = base.extend<
  Record<string, never>,
  { appServer: AppServer }
>({
  appServer: [
    async ({}, use, workerInfo) => {
      const schemaName = buildWorkerSchemaName(workerInfo.workerIndex);
      const port = BASE_E2E_PORT + workerInfo.workerIndex;

      await createWorkerSchema(schemaName);
      try {
        await applyMigrations({ schema: schemaName });
        await seedAdmin({ schema: schemaName });
        const proc = await startNextDev({ port, schemaName });
        try {
          await use({
            baseURL: `http://localhost:${port}`,
            schemaName,
            port,
          });
        } finally {
          await stopNextDev(proc);
        }
      } finally {
        await dropWorkerSchema(schemaName);
      }
    },
    { scope: "worker" },
  ],
  baseURL: async ({ appServer }, use) => {
    await use(appServer.baseURL);
  },
});
```

**Contract**:
- Qualquer `*.spec.ts` que importar `test` deste arquivo (em vez de `@playwright/test`) herda o fixture automaticamente.
- `baseURL` é sobrescrito para a porta do worker — `page.goto('/')` resolve corretamente sem mudanças nos testes.
- Teardown em `finally` garante DROP do schema mesmo em falha da app.

---

## Contract 5: Reset Helper

**Location**: [__tests__/e2e/helpers/reset.ts](__tests__/e2e/helpers/reset.ts)

```ts
/**
 * Trunca todas as tabelas do schema EXCETO as de autenticação.
 * Usado em beforeEach de testes E2E.
 */
export async function truncateDomainTables(schemaName: string): Promise<void>;

const PRESERVED_TABLES = ["user", "account", "session"] as const;
```

**Contract**:
- A lista de tabelas é computada dinamicamente via `information_schema.tables`.
- `user`, `account`, `session` são SEMPRE preservadas — não há override. Se um teste precisa resetar autenticação, ele é responsável por fazer via DELETE explícito (caso raro).
- Usa `TRUNCATE ... RESTART IDENTITY CASCADE` em comando único (minimiza round-trips).

---

## Contract 6: Package Scripts

**Location**: [package.json](package.json)

```jsonc
{
  "scripts": {
    "db:migrate": "bun run src/lib/db/migrate.ts",
    "db:seed": "bun run src/lib/db/seed.ts",
    "db:test:setup": "bun run scripts/db/ensure-test-db.ts && bun run src/lib/db/migrate.ts --url $TEST_DATABASE_URL && bun run src/lib/db/seed-test.ts --url $TEST_DATABASE_URL",
    "db:test:seed": "bun run src/lib/db/seed-test.ts",
    "test:integration": "NODE_ENV=test vitest run __tests__/integration/",
    "test:e2e": "NODE_ENV=test bunx playwright test"
  }
}
```

**Contract**:
- `db:test:setup` é idempotente e seguro para rodar múltiplas vezes.
- `test:integration` e `test:e2e` sempre forçam `NODE_ENV=test` para ativar a validação de `TEST_DATABASE_URL`.

---

## Contract 7: Playwright Config

**Location**: [playwright.config.ts](playwright.config.ts)

```ts
export default defineConfig({
  testDir: "./__tests__/e2e",
  globalSetup: "./__tests__/e2e/global-setup.ts",
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 2 : 0,
  // webServer: REMOVIDO — responsabilidade da fixture
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  use: {
    trace: "on-first-retry",
  },
});
```

**Contract**:
- Sem `webServer` — os testes dependem do fixture `appServer` para obter `baseURL`.
- `workers: 1` no CI é fixo para previsibilidade no runner free-tier; `undefined` localmente (Playwright escolhe com base em CPU, até 4).
- `globalSetup` fica responsável apenas por limpeza de schemas órfãos (`cleanOrphanSchemas`), não por subir server nem seedar.

---

## Contract 8: Global Setup (Playwright)

**Location**: [__tests__/e2e/global-setup.ts](__tests__/e2e/global-setup.ts)

```ts
export default async function globalSetup(): Promise<void> {
  // 1. Valida env (TEST_DATABASE_URL presente).
  // 2. Garante que audiobook_track_test existe (delega pra ensure-test-db).
  // 3. Garante que migrations do schema public estão aplicadas (para integration, caso rode depois).
  // 4. Remove schemas e2e_* mais velhos que 1h.
  // NÃO sobe servidor. NÃO cria schemas de worker.
}
```

**Contract**:
- Idempotente.
- Não afeta a base de dev sob nenhuma condição.
- Falha rápida e explícita se `TEST_DATABASE_URL` estiver faltando.

---

Esses 8 contratos definem as fronteiras estáveis da feature. Qualquer alteração em suas assinaturas é uma mudança de API interna e exige revisão.
