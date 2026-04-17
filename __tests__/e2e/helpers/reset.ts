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

export async function truncateDomainTables(schemaName: string): Promise<void> {
  if (!/^[a-z][a-z0-9_]*$/.test(schemaName)) {
    throw new Error(`Invalid schema name for truncate: ${schemaName}`);
  }

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

export async function closeResetPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
