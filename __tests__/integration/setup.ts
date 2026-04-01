import { clearTestDb, endPool, getPool, setTestDb } from "@tests/helpers/db";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach } from "vitest";
import * as schema from "@/lib/db/schema";

let client: PoolClient;

beforeEach(async () => {
  client = await getPool().connect();
  await client.query("BEGIN");
  const db = drizzle(client, { schema });
  setTestDb(db);
});

afterEach(async () => {
  await client.query("ROLLBACK");
  client.release();
  clearTestDb();
});

afterAll(async () => {
  await endPool();
});
