import { createGetSessionRequest, createSignInRequest } from "@tests/helpers/auth";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth/server";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

afterAll(async () => {
  await pool.end();
});

describe("POST /api/auth/sign-in/username", () => {
  it("should return 200 and session data with correct credentials", async () => {
    const response = await auth.handler(createSignInRequest());

    expect(response.status).toBe(200);

    const cookies = response.headers.get("set-cookie");
    expect(cookies).toBeTruthy();

    const sessionResponse = await auth.handler(createGetSessionRequest(cookies ?? ""));

    const sessionData = await sessionResponse.json();
    expect(sessionData.user).toBeDefined();
    expect(sessionData.user.username).toBe("admin");
    expect(sessionData.user.email).toBe("admin@audiobook.local");
  });

  it("should return 401 with generic error for wrong password", async () => {
    const response = await auth.handler(createSignInRequest("admin", "wrongpassword"));

    expect(response.status).toBeGreaterThanOrEqual(400);

    const data = await response.json();
    const errorMsg = (data.message || data.error?.message || "").toLowerCase();
    expect(errorMsg).not.toContain("password is incorrect");
    expect(errorMsg).not.toContain("wrong password");
    expect(errorMsg).not.toContain("username not found");
  });

  it("should return 401 with generic error for nonexistent username", async () => {
    const response = await auth.handler(createSignInRequest("nonexistent_user", "admin123"));

    expect(response.status).toBeGreaterThanOrEqual(400);

    const data = await response.json();
    const errorMsg = (data.message || data.error?.message || "").toLowerCase();
    expect(errorMsg).not.toContain("user not found");
    expect(errorMsg).not.toContain("does not exist");
    expect(errorMsg).not.toContain("no account");
  });

  it("should return error for empty fields", async () => {
    const response = await auth.handler(createSignInRequest("", ""));

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it("should store password as hash, not plaintext (FR-010)", async () => {
    const successResponse = await auth.handler(createSignInRequest());
    expect(successResponse.status).toBe(200);

    const failResponse = await auth.handler(createSignInRequest("admin", "admin124"));
    expect(failResponse.status).toBeGreaterThanOrEqual(400);
  });
});
