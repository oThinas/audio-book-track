import { runMigrations } from "@/lib/db/migrate";
import { env } from "@/lib/env";

export async function setup(): Promise<void> {
  if (!env.TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL is required for integration tests. Set it in .env.test.");
  }
  await runMigrations({ url: env.TEST_DATABASE_URL });
}

export async function teardown(): Promise<void> {
  // Intentionally empty — the test DB stays populated between runs;
  // cleanup is handled per-test via BEGIN/ROLLBACK in integration setup.ts.
}
