import { Pool } from "pg";

const PRESERVED_TABLES = new Set<string>(["user", "account", "session", "__drizzle_migrations"]);

let pool: Pool | undefined;

function getResetPool(): Pool {
  if (!pool) {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) {
      throw new Error("TEST_DATABASE_URL is required for reset operations.");
    }
    pool = new Pool({ connectionString: url, max: 2 });
  }
  return pool;
}

function assertSchemaName(schemaName: string): void {
  if (!/^[a-z][a-z0-9_]*$/.test(schemaName)) {
    throw new Error(`Invalid schema name: ${schemaName}`);
  }
}

export async function truncateDomainTables(schemaName: string): Promise<void> {
  assertSchemaName(schemaName);

  const client = getResetPool();
  const { rows } = await client.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
    [schemaName],
  );

  const targets = rows.map((r) => r.table_name).filter((name) => !PRESERVED_TABLES.has(name));

  if (targets.length === 0) return;

  const qualified = targets.map((t) => `"${schemaName}"."${t}"`).join(", ");
  await client.query(`TRUNCATE TABLE ${qualified} RESTART IDENTITY CASCADE`);
}

// Deletes a user by email in the worker's schema. Used by specs that need to
// sign up the same email across multiple test cases without relying on Playwright
// landing each case on a different worker — `truncateDomainTables` preserves
// the `user` table so the admin seed persists, which means a probe user created
// by one test would otherwise leak into the next if both end up on the same
// worker. Account and session rows are cascaded via FK.
export async function deleteUserByEmail(schemaName: string, email: string): Promise<void> {
  assertSchemaName(schemaName);
  const client = getResetPool();
  await client.query(`DELETE FROM "${schemaName}"."user" WHERE email = $1`, [email]);
}

export async function closeResetPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
