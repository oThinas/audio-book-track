import { fileURLToPath } from "node:url";
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { env } from "@/lib/env";

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
  const url = args.url ?? env.DATABASE_URL;
  const connectionString = buildConnectionString(url, args.schema);
  const pool = new Pool({ connectionString });
  try {
    if (args.schema) {
      await pool.query(`CREATE SCHEMA IF NOT EXISTS "${args.schema}"`);
    }
    const database = drizzle(pool);
    await migrate(database, { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
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
