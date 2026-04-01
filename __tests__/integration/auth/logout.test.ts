import { createSignInRequest, createSignOutRequest } from "@tests/helpers/auth";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { auth } from "@/lib/auth/server";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

afterAll(async () => {
  await pool.end();
});

describe("Logout (US4)", () => {
  it("should invalidate session after sign-out", async () => {
    const signInResponse = await auth.handler(createSignInRequest());
    expect(signInResponse.status).toBe(200);

    const cookie = signInResponse.headers.get("set-cookie") ?? "";
    expect(cookie).toBeTruthy();

    const signOutResponse = await auth.handler(createSignOutRequest(cookie));

    expect(signOutResponse.status).toBe(200);

    // Verify session is invalidated — get-session should return null
    const sessionResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { Cookie: cookie },
      }),
    );

    const sessionData = await sessionResponse.json();
    const session = sessionData?.session ?? null;
    expect(session).toBeNull();
  });

  it("should clear session cookie on sign-out", async () => {
    const signInResponse = await auth.handler(createSignInRequest());
    const cookie = signInResponse.headers.get("set-cookie") ?? "";

    const signOutResponse = await auth.handler(createSignOutRequest(cookie));

    const setCookie = signOutResponse.headers.get("set-cookie") ?? "";
    // Cookie should be cleared (max-age=0 or expires in past)
    expect(setCookie).toMatch(/max-age=0|expires=Thu, 01 Jan 1970/i);
  });
});
