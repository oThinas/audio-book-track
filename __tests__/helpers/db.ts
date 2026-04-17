import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";

export type TestDb = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let currentDb: TestDb | undefined;

export function getPool(): Pool {
  if (!pool) {
    if (!env.TEST_DATABASE_URL) {
      throw new Error("TEST_DATABASE_URL is required for integration tests. Set it in .env.test.");
    }
    pool = new Pool({ connectionString: env.TEST_DATABASE_URL });
  }
  return pool;
}

export async function endPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export function getTestDb(): TestDb {
  if (!currentDb) {
    throw new Error("getTestDb() called outside of a test — is setup.ts loaded?");
  }
  return currentDb;
}

export function setTestDb(db: TestDb): void {
  currentDb = db;
}

export function clearTestDb(): void {
  currentDb = undefined;
}
