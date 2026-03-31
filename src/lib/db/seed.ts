import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";

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

async function main() {
  console.info("Seeding database...");

  const result = await seedAuth.api.signUpEmail({
    body: {
      name: "Administrador",
      email: "admin@audiobook.local",
      password: "admin123",
      username: "admin",
    },
  });

  if (!result) {
    console.error("Failed to create seed user.");
    process.exit(1);
  }

  console.info("Seed user created:", {
    username: "admin",
    email: "admin@audiobook.local",
  });

  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
