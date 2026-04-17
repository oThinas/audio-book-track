import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    // Signup is disabled by default. E2E test workers spawn `next start` with
    // NODE_ENV=production (Next.js requires it), so we gate on a dedicated
    // `E2E_TEST_MODE` flag read at request time instead of at build time.
    disableSignUp: process.env.E2E_TEST_MODE !== "1",
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
    }),
  ],
  session: {
    expiresIn: 604800,
    updateAge: 86400,
    cookieCache: {
      enabled: true,
      maxAge: 300,
    },
  },
  rateLimit:
    process.env.E2E_TEST_MODE === "1"
      ? { enabled: false }
      : {
          window: 60,
          max: 3,
        },
});
