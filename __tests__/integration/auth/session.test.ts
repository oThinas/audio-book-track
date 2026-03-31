import { createGetSessionRequest, createSignInRequest } from "@tests/helpers/auth";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { auth } from "@/lib/auth/server";

const SEVEN_DAYS_IN_SECONDS = 604800;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

afterAll(async () => {
  await pool.end();
});

describe("Session Persistence (US3)", () => {
  it("should create session with expiresAt 7 days from now", async () => {
    const now = Date.now();

    const response = await auth.handler(createSignInRequest());

    expect(response.status).toBe(200);

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toBeTruthy();

    const sessionResponse = await auth.handler(
      createGetSessionRequest(cookie),
    );

    const data = await sessionResponse.json();
    expect(data.session).toBeDefined();
    expect(data.session.expiresAt).toBeDefined();

    const expiresAt = new Date(data.session.expiresAt).getTime();
    const sevenDaysInMs = SEVEN_DAYS_IN_SECONDS * 1000;
    const diff = expiresAt - now;

    // expiresAt should be approximately 7 days from now (within 60s tolerance)
    expect(diff).toBeGreaterThan(sevenDaysInMs - 60_000);
    expect(diff).toBeLessThanOrEqual(sevenDaysInMs + 60_000);
  });

  it("should set session cookie with maxAge of 7 days (604800s)", async () => {
    const response = await auth.handler(createSignInRequest());

    expect(response.status).toBe(200);

    const setCookie = response.headers.get("set-cookie") ?? "";
    const maxAgeMatch = setCookie.match(/max-age=(\d+)/i);
    expect(maxAgeMatch).not.toBeNull();

    const maxAge = Number(maxAgeMatch?.[1]);
    expect(maxAge).toBe(SEVEN_DAYS_IN_SECONDS);
  });

  it("should persist session in database and return it via get-session", async () => {
    const signInResponse = await auth.handler(createSignInRequest());

    const cookie = signInResponse.headers.get("set-cookie") ?? "";
    expect(cookie).toBeTruthy();

    const sessionResponse = await auth.handler(
      createGetSessionRequest(cookie),
    );

    expect(sessionResponse.status).toBe(200);

    const sessionData = await sessionResponse.json();
    expect(sessionData.session).toBeDefined();
    expect(sessionData.session.id).toBeDefined();
    expect(sessionData.session.token).toBeDefined();
    expect(sessionData.session.expiresAt).toBeDefined();
    expect(sessionData.user).toBeDefined();
    expect(sessionData.user.username).toBe("admin");
  });
});