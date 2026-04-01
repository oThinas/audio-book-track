import { getTestDb } from "@tests/helpers/db";
import { createTestUser } from "@tests/helpers/factories";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { user } from "@/lib/db/schema";

describe("Transaction Rollback Infrastructure", () => {
  const SHARED_EMAIL = "unique-test@test.local";

  it("should allow inserting a unique email (first test)", async () => {
    const db = getTestDb();
    const { user: created } = await createTestUser(db, { email: SHARED_EMAIL });

    expect(created.email).toBe(SHARED_EMAIL);
  });

  it("should allow inserting the same unique email (proves rollback works)", async () => {
    const db = getTestDb();
    const { user: created } = await createTestUser(db, { email: SHARED_EMAIL });

    expect(created.email).toBe(SHARED_EMAIL);
  });

  it("should not see data from a previous test", async () => {
    const db = getTestDb();

    const rows = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.email, SHARED_EMAIL));

    expect(rows).toHaveLength(0);
  });

  it("should see factory-created data within the test but not after", async () => {
    const db = getTestDb();
    const { user: created } = await createTestUser(db, { email: "factory-check@test.local" });

    const rows = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, "factory-check@test.local"));

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(created.id);
  });
});
