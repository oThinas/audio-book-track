import { getTestDb } from "@tests/helpers/db";
import { createTestUser } from "@tests/helpers/factories";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { user } from "@/lib/db/schema";

describe("BEGIN/ROLLBACK isolation on test DB public schema", () => {
  const TRACER_EMAIL = "rollback-tracer@test.local";

  it("inserts a tracer row inside the transaction", async () => {
    const db = getTestDb();
    const { user: created } = await createTestUser(db, { email: TRACER_EMAIL });

    expect(created.email).toBe(TRACER_EMAIL);

    const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, TRACER_EMAIL));
    expect(rows).toHaveLength(1);
  });

  it("rolls back the tracer so a later test cannot see it", async () => {
    const db = getTestDb();

    const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, TRACER_EMAIL));

    expect(rows).toHaveLength(0);
  });
});
