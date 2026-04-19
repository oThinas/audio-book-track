import { getTestDb } from "@tests/helpers/db";
import { createTestSession, createTestUser } from "@tests/helpers/factories";
import { verifyPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { session } from "@/lib/db/schema";

describe("Login Verification (direct DB)", () => {
  it("should verify correct password against stored hash", async () => {
    const db = getTestDb();
    const { account: acc } = await createTestUser(db, {
      password: "admin123",
    });

    const isValid = await verifyPassword({
      hash: acc.password ?? "",
      password: "admin123",
    });

    expect(isValid).toBe(true);
  });

  it("should reject wrong password against stored hash", async () => {
    const db = getTestDb();
    const { account: acc } = await createTestUser(db, {
      password: "admin123",
    });

    const isValid = await verifyPassword({
      hash: acc.password ?? "",
      password: "wrongpassword",
    });

    expect(isValid).toBe(false);
  });

  it("should create a session for an authenticated user", async () => {
    const db = getTestDb();
    const { user: created } = await createTestUser(db);
    const { session: sess } = await createTestSession(db, created.id);

    const rows = await db
      .select({
        id: session.id,
        userId: session.userId,
        token: session.token,
        expiresAt: session.expiresAt,
      })
      .from(session)
      .where(eq(session.userId, created.id));

    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(created.id);
    expect(rows[0].token).toBe(sess.token);
    expect(rows[0].expiresAt).toBeInstanceOf(Date);
  });

  it("should return no session for nonexistent user", async () => {
    const db = getTestDb();

    const rows = await db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.userId, "nonexistent-user-id"));

    expect(rows).toHaveLength(0);
  });

  it("should store password as hash, not plaintext (FR-010)", async () => {
    const db = getTestDb();
    const plainPassword = "admin123";
    const { account: acc } = await createTestUser(db, {
      password: plainPassword,
    });

    expect(acc.password).not.toBe(plainPassword);
    expect(acc.password).toBeTruthy();
    expect((acc.password ?? "").length).toBeGreaterThan(plainPassword.length);
  });
});
