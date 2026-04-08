import "dotenv/config";
import { execSync } from "node:child_process";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export default async function globalSetup() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    const tables = await db.execute(sql`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `);
    const tableNames = tables.rows.map((r) => `"${r.tablename}"`).join(", ");
    if (tableNames) {
      await db.execute(sql.raw(`TRUNCATE TABLE ${tableNames} CASCADE`));
    }

    execSync("bun run db:seed", { stdio: "pipe" });
  } finally {
    await pool.end();
  }
}
