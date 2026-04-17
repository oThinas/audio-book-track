import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { env } from "@/lib/env";

const MIGRATIONS_DIR = "./drizzle";

export interface MigrateArgs {
  readonly url?: string;
  readonly schema?: string;
}

const FLAGS = ["--url", "--schema"] as const;
type Flag = (typeof FLAGS)[number];

function isFlag(value: string | undefined): value is Flag {
  return typeof value === "string" && (FLAGS as readonly string[]).includes(value);
}

export function parseMigrateArgs(argv: readonly string[]): MigrateArgs {
  const result: { url?: string; schema?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!isFlag(flag)) {
      throw new Error(`Unknown migrate flag: ${flag}`);
    }
    const value = argv[i + 1];
    if (value === undefined || isFlag(value)) {
      throw new Error(`Missing value for flag ${flag}`);
    }
    if (flag === "--url") result.url = value;
    if (flag === "--schema") result.schema = value;
    i += 1;
  }
  return result;
}

function buildConnectionString(url: string, schema: string | undefined): string {
  if (!schema) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("options", `-c search_path=${schema}`);
  return parsed.toString();
}

export async function runMigrations(args: MigrateArgs): Promise<void> {
  const defaultUrl = env.NODE_ENV === "test" ? env.TEST_DATABASE_URL : env.DATABASE_URL;
  const url = args.url ?? defaultUrl;
  if (!url) {
    throw new Error(
      "No database URL available. Pass --url or set DATABASE_URL (or TEST_DATABASE_URL when NODE_ENV=test).",
    );
  }
  const connectionString = buildConnectionString(url, args.schema);
  const pool = new Pool({ connectionString });
  try {
    if (args.schema) {
      await pool.query(`CREATE SCHEMA IF NOT EXISTS "${args.schema}"`);
      // Drizzle-generated migrations hardcode `"public"."table"` in FK
      // references, so we can't reuse drizzle-kit's migrator for a non-public
      // target. Apply SQL files manually with the schema name substituted.
      await applyMigrationsForSchema(pool, args.schema);
    } else {
      const database = drizzle(pool);
      await migrate(database, { migrationsFolder: MIGRATIONS_DIR });
    }
  } finally {
    await pool.end();
  }
}

async function applyMigrationsForSchema(pool: Pool, targetSchema: string): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS "${targetSchema}"."__drizzle_migrations" (
       id SERIAL PRIMARY KEY,
       hash TEXT NOT NULL UNIQUE,
       created_at BIGINT NOT NULL
     )`,
  );

  const files = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith(".sql")).sort();

  const { rows } = await pool.query<{ hash: string }>(
    `SELECT hash FROM "${targetSchema}"."__drizzle_migrations"`,
  );
  const applied = new Set(rows.map((r) => r.hash));

  for (const file of files) {
    if (applied.has(file)) continue;
    const raw = await readFile(join(MIGRATIONS_DIR, file), "utf-8");
    const rewritten = raw.replaceAll(/"public"\.(?=")/g, `"${targetSchema}".`);
    const statements = rewritten
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await pool.query(statement);
    }

    await pool.query(
      `INSERT INTO "${targetSchema}"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
      [file, Date.now()],
    );
  }
}

async function main(): Promise<void> {
  const args = parseMigrateArgs(process.argv.slice(2));
  console.info("Running migrations...", {
    schema: args.schema ?? "public",
    customUrl: Boolean(args.url),
  });
  await runMigrations(args);
  console.info("Migrations completed successfully.");
}

const isEntrypoint =
  typeof process.argv[1] === "string" && process.argv[1] === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
