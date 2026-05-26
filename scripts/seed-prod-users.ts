// One-shot script to seed a single user. Uses better-auth's signUpEmail so
// passwords go through the same hashing and the same plugins (username) that
// the live login flow uses. Idempotent: skips if the email already exists.
//
// Usage (one invocation per user — passwords NEVER hardcoded):
//
//   DATABASE_URL='postgres://...' \
//   BETTER_AUTH_URL='https://audio-book-track-othinas-projects.vercel.app' \
//   BETTER_AUTH_SECRET='...' \
//   bun run db:seed:prod-users \
//     --email thiago@coodex.ai --username thinas --name "Thiago Prado" --password '...'

import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";

interface Args {
  readonly email: string;
  readonly username: string;
  readonly name: string;
  readonly password: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Bad argument near "${key ?? ""}". Expected --flag value pairs.`);
    }
    flags.set(key.slice(2), value);
  }

  const missing = ["email", "username", "name", "password"].filter((k) => !flags.get(k));
  if (missing.length > 0) {
    throw new Error(`Missing required flags: ${missing.map((k) => `--${k}`).join(", ")}`);
  }

  return {
    email: flags.get("email") as string,
    username: flags.get("username") as string,
    name: flags.get("name") as string,
    password: flags.get("password") as string,
  };
}

const seedAuth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
    }),
  ],
});

async function main(): Promise<void> {
  const args = parseArgs();

  const existing = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.email, args.email),
    columns: { id: true },
  });
  if (existing) {
    console.info(`${args.email} already exists — skipped.`);
    process.exit(0);
  }

  const result = await seedAuth.api.signUpEmail({
    body: {
      name: args.name,
      email: args.email,
      password: args.password,
      username: args.username,
    },
  });

  if (!result) {
    throw new Error(`Failed to create user: ${args.email}`);
  }

  console.info(`Created ${args.email} (username=${args.username}) on ${env.BETTER_AUTH_URL}`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
