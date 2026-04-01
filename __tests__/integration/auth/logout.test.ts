import { getTestDb } from "@tests/helpers/db";
import { createTestSession, createTestUser } from "@tests/helpers/factories";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { session } from "@/lib/db/schema";

describe("Logout (US4) — direct DB", () => {
  it("should invalidate session after deletion", async () => {
    const db = getTestDb();
    const { user: created } = await createTestUser(db);
    const { session: sess } = await createTestSession(db, created.id);

    // Verify session exists
    const before = await db.select({ id: session.id }).from(session).where(eq(session.id, sess.id));
    expect(before).toHaveLength(1);

    // Delete session (simulates logout)
    await db.delete(session).where(eq(session.id, sess.id));

    // Verify session is gone
    const after = await db.select({ id: session.id }).from(session).where(eq(session.id, sess.id));
    expect(after).toHaveLength(0);
  });

  it("should not affect other users sessions on logout", async () => {
    const db = getTestDb();
    const { user: userA } = await createTestUser(db);
    const { user: userB } = await createTestUser(db);
    const { session: sessA } = await createTestSession(db, userA.id);
    const { session: sessB } = await createTestSession(db, userB.id);

    // Delete user A's session
    await db.delete(session).where(eq(session.id, sessA.id));

    // User B's session should still exist
    const remaining = await db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.id, sessB.id));
    expect(remaining).toHaveLength(1);
  });
});
