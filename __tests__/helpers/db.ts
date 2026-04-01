import type { drizzle } from "drizzle-orm/node-postgres";
import type { PoolClient } from "pg";
import { Pool } from "pg";

import type * as schema from "@/lib/db/schema";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

let pool: Pool | undefined;
let currentDb: TestDb | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
