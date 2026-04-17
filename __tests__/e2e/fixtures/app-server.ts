import { test as base } from "@playwright/test";

import { buildWorkerSchemaName, createWorkerSchema, dropWorkerSchema } from "@/lib/db/test-schema";

import { closeResetPool, truncateDomainTables } from "../helpers/reset";
import { applyMigrationsToSchema } from "./migrate-helper";
import { type NextDevHandle, startNextDev, stopNextDev } from "./next-dev-process";
import { seedAdminForSchema } from "./seed-helper";

const BASE_E2E_PORT = 3100;

export interface AppServer {
  readonly baseURL: string;
  readonly schemaName: string;
  readonly port: number;
}

// biome-ignore lint/suspicious/noConfusingVoidType: Playwright's auto fixtures idiomatically produce void (no consumable value)
export const test = base.extend<{ autoReset: void }, { appServer: AppServer }>({
  appServer: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature requires empty pattern when no other fixtures are consumed
    async ({}, use, workerInfo) => {
      const testDatabaseUrl = process.env.TEST_DATABASE_URL;
      if (!testDatabaseUrl) {
        throw new Error("TEST_DATABASE_URL is required for E2E workers. Set it in .env.test.");
      }

      const schemaName = buildWorkerSchemaName(workerInfo.workerIndex);
      const port = BASE_E2E_PORT + workerInfo.workerIndex;

      await createWorkerSchema(schemaName, { url: testDatabaseUrl });
      let handle: NextDevHandle | undefined;
      try {
        await applyMigrationsToSchema({ url: testDatabaseUrl, schema: schemaName });
        await seedAdminForSchema({ url: testDatabaseUrl, schema: schemaName });
        handle = await startNextDev({ port, schemaName, testDatabaseUrl });
        await use({
          baseURL: handle.baseURL,
          schemaName,
          port,
        });
      } finally {
        if (handle) await stopNextDev(handle);
        await dropWorkerSchema(schemaName, { url: testDatabaseUrl }).catch(() => {});
        await closeResetPool();
      }
    },
    // Cold-start budget for 4 parallel workers: each spawns migrate, seed-test,
    // and a dedicated Next.js dev server with its own .next-e2e-<port> cache,
    // so the default 30s window is far too tight. 180s covers the slowest
    // machine we test on.
    { scope: "worker", timeout: 180_000 },
  ],

  baseURL: async ({ appServer }, use) => {
    await use(appServer.baseURL);
  },

  // Auto-run before every test: clear non-preserved tables so tests observe a
  // consistent baseline. Admin (user/account/session) stays so the session
  // established in previous tests continues to work.
  autoReset: [
    async ({ appServer }, use) => {
      await truncateDomainTables(appServer.schemaName);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
