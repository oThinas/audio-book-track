import "dotenv/config";
import { execSync } from "node:child_process";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export default async function globalSetup() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    await db.execute(sql`TRUNCATE TABLE session, account, verification, "user" CASCADE`);

    execSync("bun run db:seed", { stdio: "pipe" });
  } finally {
    await pool.end();
  }
}
