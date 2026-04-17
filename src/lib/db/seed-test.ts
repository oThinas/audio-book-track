import { fileURLToPath } from "node:url";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";

export interface SeedTestArgs {
  readonly url?: string;
  readonly schema?: string;
}

const FLAGS = ["--url", "--schema"] as const;
type Flag = (typeof FLAGS)[number];

function isFlag(value: string | undefined): value is Flag {
  return typeof value === "string" && (FLAGS as readonly string[]).includes(value);
}

export function parseSeedTestArgs(argv: readonly string[]): SeedTestArgs {
  const result: { url?: string; schema?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!isFlag(flag)) throw new Error(`Unknown seed-test flag: ${flag}`);
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

function buildConnectionString(url: string, schemaName: string | undefined): string {
  if (!schemaName) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("options", `-c search_path=${schemaName}`);
  return parsed.toString();
}

export async function seedAdmin(args: SeedTestArgs = {}): Promise<void> {
  const baseUrl = args.url ?? (env.NODE_ENV === "test" ? env.TEST_DATABASE_URL : env.DATABASE_URL);
  if (!baseUrl) {
    throw new Error("seed-test requires --url or TEST_DATABASE_URL (when NODE_ENV=test).");
  }

  const connectionString = buildConnectionString(baseUrl, args.schema);
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  const auth = betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true, disableSignUp: false },
    plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30 })],
  });

  try {
    const existing = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, "admin@audiobook.local"),
      columns: { id: true },
    });
    if (existing) return;

    const result = await auth.api.signUpEmail({
      body: {
        name: "Administrador",
        email: "admin@audiobook.local",
        password: "admin123",
        username: "admin",
      },
    });
    if (!result) throw new Error("Failed to create seed-test admin.");
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const args = parseSeedTestArgs(process.argv.slice(2));
  await seedAdmin(args);
  console.info("seed-test completed.");
}

const isEntrypoint =
  typeof process.argv[1] === "string" && process.argv[1] === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("seed-test failed:", error);
      process.exit(1);
    });
}
