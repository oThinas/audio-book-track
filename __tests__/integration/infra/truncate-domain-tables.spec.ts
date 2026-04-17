import { randomUUID } from "node:crypto";
import { truncateDomainTables } from "@tests/e2e/helpers/reset";
import { getPool } from "@tests/helpers/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWorkerSchema, dropWorkerSchema } from "@/lib/db/test-schema";

const schemaName = `e2e_reset_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
const userId = "preserved-admin-id";
const userEmail = "preserved-admin@test.local";

async function seedSchema(): Promise<void> {
  const pool = getPool();
  await pool.query(
    `CREATE TABLE "${schemaName}"."user" (
       id text PRIMARY KEY,
       name text NOT NULL,
       email text NOT NULL UNIQUE,
       "emailVerified" boolean NOT NULL DEFAULT false,
       created_at timestamptz NOT NULL DEFAULT now(),
       updated_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  await pool.query(
    `CREATE TABLE "${schemaName}".account (
       id text PRIMARY KEY,
       user_id text NOT NULL REFERENCES "${schemaName}"."user"(id) ON DELETE CASCADE,
       provider text NOT NULL
     )`,
  );
  await pool.query(
    `CREATE TABLE "${schemaName}".session (
       id text PRIMARY KEY,
       user_id text NOT NULL REFERENCES "${schemaName}"."user"(id) ON DELETE CASCADE,
       token text NOT NULL
     )`,
  );
  await pool.query(
    `CREATE TABLE "${schemaName}".user_preference (
       id text PRIMARY KEY,
       user_id text NOT NULL REFERENCES "${schemaName}"."user"(id) ON DELETE CASCADE,
       theme text NOT NULL DEFAULT 'system'
     )`,
  );
  await pool.query(
    `CREATE TABLE "${schemaName}".verification (
       id text PRIMARY KEY,
       value text NOT NULL
     )`,
  );

  await pool.query(
    `INSERT INTO "${schemaName}"."user" (id, name, email) VALUES ($1, 'Admin', $2)`,
    [userId, userEmail],
  );
  await pool.query(
    `INSERT INTO "${schemaName}".account (id, user_id, provider) VALUES ('a1', $1, 'credential')`,
    [userId],
  );
  await pool.query(
    `INSERT INTO "${schemaName}".session (id, user_id, token) VALUES ('s1', $1, 'tok')`,
    [userId],
  );
  await pool.query(
    `INSERT INTO "${schemaName}".user_preference (id, user_id, theme) VALUES ('p1', $1, 'dark')`,
    [userId],
  );
  await pool.query(`INSERT INTO "${schemaName}".verification (id, value) VALUES ('v1', 'nonce')`);
}

async function countRows(table: string): Promise<number> {
  const { rows } = await getPool().query<{ c: number }>(
    `SELECT count(*)::int AS c FROM "${schemaName}"."${table}"`,
  );
  return rows[0]?.c ?? 0;
}

describe("truncateDomainTables", () => {
  beforeAll(async () => {
    await createWorkerSchema(schemaName);
    await seedSchema();
  });

  afterAll(async () => {
    await dropWorkerSchema(schemaName).catch(() => {});
  });

  it("empties non-preserved tables while keeping user/account/session intact", async () => {
    await truncateDomainTables(schemaName);

    expect(await countRows("user_preference")).toBe(0);
    expect(await countRows("verification")).toBe(0);
    expect(await countRows("user")).toBe(1);
    expect(await countRows("account")).toBe(1);
    expect(await countRows("session")).toBe(1);
  });

  it("is idempotent when non-preserved tables are already empty", async () => {
    await truncateDomainTables(schemaName);
    await expect(truncateDomainTables(schemaName)).resolves.toBeUndefined();
    expect(await countRows("user_preference")).toBe(0);
  });
});
