import { getTestDb } from "@tests/helpers/db";
import { createTestSession, createTestUser } from "@tests/helpers/factories";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { session } from "@/lib/db/schema";

const SEVEN_DAYS_IN_SECONDS = 604800;
const SEVEN_DAYS_IN_MS = SEVEN_DAYS_IN_SECONDS * 1000;

describe("Session Persistence (US3) — direct DB", () => {
  it("should create session with expiresAt 7 days from now", async () => {
    const db = getTestDb();
    const now = Date.now();
    const { user: created } = await createTestUser(db);
    const { session: sess } = await createTestSession(db, created.id);

    const rows = await db
      .select({ expiresAt: session.expiresAt })
      .from(session)
      .where(eq(session.id, sess.id));

    expect(rows).toHaveLength(1);

    const expiresAt = rows[0].expiresAt.getTime();
    const diff = expiresAt - now;

    // expiresAt should be approximately 7 days from now (within 60s tolerance)
    expect(diff).toBeGreaterThan(SEVEN_DAYS_IN_MS - 60_000);
    expect(diff).toBeLessThanOrEqual(SEVEN_DAYS_IN_MS + 60_000);
  });

  it("should persist session in database with all required fields", async () => {
    const db = getTestDb();
    const { user: created } = await createTestUser(db);
    const { session: sess } = await createTestSession(db, created.id);

    const rows = await db
      .select({
        id: session.id,
        token: session.token,
        expiresAt: session.expiresAt,
        userId: session.userId,
        createdAt: session.createdAt,
      })
      .from(session)
      .where(eq(session.id, sess.id));

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(sess.id);
    expect(rows[0].token).toBeTruthy();
    expect(rows[0].expiresAt).toBeInstanceOf(Date);
    expect(rows[0].userId).toBe(created.id);
    expect(rows[0].createdAt).toBeInstanceOf(Date);
  });

  it("should allow custom expiration for session", async () => {
    const db = getTestDb();
    const { user: created } = await createTestUser(db);
    const customExpiry = new Date(Date.now() + 3600_000); // 1 hour
    const { session: sess } = await createTestSession(db, created.id, {
      expiresAt: customExpiry,
    });

    const rows = await db
      .select({ expiresAt: session.expiresAt })
      .from(session)
      .where(eq(session.id, sess.id));

    expect(rows).toHaveLength(1);
    const diff = Math.abs(rows[0].expiresAt.getTime() - customExpiry.getTime());
    expect(diff).toBeLessThan(1000); // within 1s tolerance
  });
});
