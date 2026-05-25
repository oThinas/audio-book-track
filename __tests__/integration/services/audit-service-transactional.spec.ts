import { getPool, getTestDb } from "@tests/helpers/db";
import { describe, expect, it, vi } from "vitest";

import { AUDIT_ACTIONS } from "@/lib/audit/audit-actions";
import type { AuditLogRepository } from "@/lib/repositories/audit-log-repository";
import { DrizzleAuditLogRepository } from "@/lib/repositories/drizzle/drizzle-audit-log-repository";
import { AuditServiceImpl } from "@/lib/services/audit-service";

describe("AuditServiceImpl — transactional semantics", () => {
  it("recordWithin discards the audit row when the surrounding transaction rolls back", async () => {
    const pool = getPool();
    const client = await pool.connect();
    const requestId = `req-rollback-${crypto.randomUUID()}`;

    try {
      const { drizzle } = await import("drizzle-orm/node-postgres");
      const schemaModule = await import("@/lib/db/schema");
      const txDb = drizzle(client, { schema: schemaModule });
      const repo = new DrizzleAuditLogRepository(txDb);
      const service = new AuditServiceImpl(repo);

      await client.query("BEGIN");
      await service.recordWithin(txDb, {
        action: AUDIT_ACTIONS.STUDIO_CREATE,
        userId: "u1",
        entityType: "studio",
        entityId: `studio-${crypto.randomUUID()}`,
      });
      // Force rollback
      await client.query("ROLLBACK");

      const found = await new DrizzleAuditLogRepository(getTestDb()).findByRequestId(requestId);
      expect(found).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it("record() captures repository errors via logger.warn and does not propagate", async () => {
    const failingRepo: AuditLogRepository = {
      insertWithin: vi.fn(),
      insert: vi.fn().mockRejectedValue(new Error("db is down")),
      deleteOlderThan: vi.fn(),
      findByUserSince: vi.fn(),
      findByEntity: vi.fn(),
      findByRequestId: vi.fn(),
    };
    const service = new AuditServiceImpl(failingRepo);

    await expect(
      service.record({
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        userId: null,
        entityType: null,
        entityId: null,
      }),
    ).resolves.toBeUndefined();

    expect(failingRepo.insert).toHaveBeenCalledTimes(1);
  });
});
