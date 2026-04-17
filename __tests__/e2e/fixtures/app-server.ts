import { test as base } from "@playwright/test";

import { buildWorkerSchemaName, createWorkerSchema, dropWorkerSchema } from "@/lib/db/test-schema";

import { applyMigrationsToSchema } from "./migrate-helper";
import { type NextDevHandle, startNextDev, stopNextDev } from "./next-dev-process";
import { seedAdminForSchema } from "./seed-helper";

const BASE_E2E_PORT = 3100;

export interface AppServer {
  readonly baseURL: string;
  readonly schemaName: string;
  readonly port: number;
}

// biome-ignore lint/complexity/noBannedTypes: empty test-fixtures generic is required so Playwright resolves `appServer` against the worker-fixtures slot
export const test = base.extend<{}, { appServer: AppServer }>({
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
      }
    },
    { scope: "worker" },
  ],

  baseURL: async ({ appServer }, use) => {
    await use(appServer.baseURL);
  },
});

export { expect } from "@playwright/test";
