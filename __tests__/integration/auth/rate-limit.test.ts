import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const testAuth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30 })],
  rateLimit: {
    enabled: true,
    window: 60,
    max: 3,
  },
});

afterAll(async () => {
  await pool.end();
});

const SIGN_IN_URL = `${process.env.BETTER_AUTH_URL}/api/auth/sign-in/username`;

function createLoginRequest(): Request {
  return new Request(SIGN_IN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "192.168.1.100",
    },
    body: JSON.stringify({
      username: "nonexistent-user",
      password: "wrong-password",
    }),
  });
}

describe("Rate Limiting Behavior (FR-009)", () => {
  it("should block the 4th login attempt within the rate limit window", async () => {
    const responses: Response[] = [];

    for (let i = 0; i < 4; i++) {
      const response = await testAuth.handler(createLoginRequest());
      responses.push(response);
    }

    const firstThreeStatuses = responses.slice(0, 3).map((r) => r.status);
    for (const status of firstThreeStatuses) {
      expect(status).not.toBe(429);
    }

    expect(responses[3].status).toBe(429);
  });
});
