import { Pool } from "pg";

import { env } from "@/lib/env";

const DATABASE_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

async function main(): Promise<void> {
  const testUrl = env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required. Copy .env.test.example to .env.test and set it.",
    );
  }

  const parsed = new URL(testUrl);
  const targetDb = parsed.pathname.replace(/^\//, "");
  if (!targetDb) {
    throw new Error("TEST_DATABASE_URL must include a database name (e.g. /audiobook_track_test).");
  }
  if (!DATABASE_NAME_PATTERN.test(targetDb)) {
    throw new Error(`Refusing to create database with unsafe name: ${targetDb}`);
  }
  if (targetDb === "postgres") {
    throw new Error("TEST_DATABASE_URL must not point to the `postgres` maintenance database.");
  }

  parsed.pathname = "/postgres";
  const pool = new Pool({ connectionString: parsed.toString() });
  try {
    const { rows } = await pool.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [targetDb],
    );
    if (rows[0]?.exists) {
      console.info(`Database "${targetDb}" already exists; skipping.`);
      return;
    }
    await pool.query(`CREATE DATABASE "${targetDb}"`);
    console.info(`Created database "${targetDb}".`);
  } finally {
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("ensure-test-db failed:", error);
    process.exit(1);
  });
