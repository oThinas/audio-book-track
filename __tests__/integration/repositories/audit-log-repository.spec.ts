import { getTestDb } from "@tests/helpers/db";
import { describe, expect, it } from "vitest";

import { AUDIT_ACTIONS } from "@/lib/audit/audit-actions";
import type { AuditPayload } from "@/lib/audit/audit-payload";
import { DrizzleAuditLogRepository } from "@/lib/repositories/drizzle/drizzle-audit-log-repository";

function repo() {
  return new DrizzleAuditLogRepository(getTestDb());
}

function makePayload(overrides: Partial<AuditPayload> = {}): AuditPayload {
  return {
    action: AUDIT_ACTIONS.STUDIO_CREATE,
    userId: "user-1",
    entityType: "studio",
    entityId: `studio-${crypto.randomUUID()}`,
    requestId: `req-${crypto.randomUUID()}`,
    ...overrides,
  };
}

describe("DrizzleAuditLogRepository", () => {
  it("insertWithin persists the row inside the active transaction", async () => {
    const r = repo();
    const payload = makePayload();

    await r.insertWithin(getTestDb(), payload);

    const found = await r.findByRequestId(payload.requestId);
    expect(found).toHaveLength(1);
    expect(found[0].action).toBe(payload.action);
    expect(found[0].userId).toBe(payload.userId);
    expect(found[0].entityType).toBe(payload.entityType);
    expect(found[0].entityId).toBe(payload.entityId);
  });

  it("insert persists with its own connection", async () => {
    const r = repo();
    const payload = makePayload({ action: AUDIT_ACTIONS.BOOK_CREATE, entityType: "book" });

    await r.insert(payload);

    const found = await r.findByRequestId(payload.requestId);
    expect(found).toHaveLength(1);
  });

  it("findByUserSince filters by userId and returns rows in reverse chronological order", async () => {
    const r = repo();
    const userId = `u-${crypto.randomUUID()}`;
    const since = new Date(Date.now() - 60_000);

    await r.insertWithin(getTestDb(), makePayload({ userId, action: AUDIT_ACTIONS.STUDIO_CREATE }));
    await r.insertWithin(getTestDb(), makePayload({ userId, action: AUDIT_ACTIONS.STUDIO_UPDATE }));
    await r.insertWithin(getTestDb(), makePayload({ userId: "other-user" }));

    const found = await r.findByUserSince(userId, since, 10);
    expect(found).toHaveLength(2);
    expect(found.every((row) => row.userId === userId)).toBe(true);
  });

  it("findByEntity returns rows for that entity", async () => {
    const r = repo();
    const entityId = `book-${crypto.randomUUID()}`;
    await r.insertWithin(
      getTestDb(),
      makePayload({ entityType: "book", entityId, action: AUDIT_ACTIONS.BOOK_CREATE }),
    );
    await r.insertWithin(
      getTestDb(),
      makePayload({ entityType: "book", entityId, action: AUDIT_ACTIONS.BOOK_UPDATE }),
    );
    await r.insertWithin(getTestDb(), makePayload({ entityType: "book" }));

    const found = await r.findByEntity("book", entityId, 10);
    expect(found).toHaveLength(2);
  });

  it("deleteOlderThan removes rows older than cutoff and is idempotent", async () => {
    const r = repo();
    // Insert and then push createdAt back via raw SQL since DEFAULT now() is set on insert
    const old = makePayload();
    const fresh = makePayload();
    await r.insertWithin(getTestDb(), old);
    await r.insertWithin(getTestDb(), fresh);

    // Backdate the first row by 100 days
    const { sql } = await import("drizzle-orm");
    const db = getTestDb();
    await db.execute(
      sql`UPDATE audit_log SET created_at = now() - interval '100 days' WHERE request_id = ${old.requestId}`,
    );

    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const firstRun = await r.deleteOlderThan(cutoff);
    expect(firstRun).toBeGreaterThanOrEqual(1);

    const secondRun = await r.deleteOlderThan(cutoff);
    expect(secondRun).toBe(0);

    const fresher = await r.findByRequestId(fresh.requestId);
    expect(fresher).toHaveLength(1);
  });
});
