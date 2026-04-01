import { createSignUpEmailRequest, createSignUpUsernameRequest } from "@tests/helpers/auth";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { auth } from "@/lib/auth/server";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

afterAll(async () => {
  await pool.end();
});

describe("Sign-up Blocked (FR-002)", () => {
  it("should block sign-up via /api/auth/sign-up/email", async () => {
    const response = await auth.handler(
      createSignUpEmailRequest("Hacker", "hacker@evil.com", "hacker123"),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it("should block sign-up via /api/auth/sign-up/username", async () => {
    const response = await auth.handler(
      createSignUpUsernameRequest("Hacker", "hacker@evil.com", "hacker123", "hacker"),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
