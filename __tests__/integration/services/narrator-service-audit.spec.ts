import { getTestDb } from "@tests/helpers/db";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { describe, expect, it } from "vitest";
import { requestContext } from "@/lib/api/request-context";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-actions";
import { DrizzleAuditLogRepository } from "@/lib/repositories/drizzle/drizzle-audit-log-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { AuditServiceImpl } from "@/lib/services/audit-service";
import { NarratorService } from "@/lib/services/narrator-service";

function build() {
  const db = getTestDb();
  const auditRepo = new DrizzleAuditLogRepository(db);
  const auditService = new AuditServiceImpl(auditRepo);
  const uow = new SavepointUnitOfWork(db);
  const service = new NarratorService(new DrizzleNarratorRepository(db), {
    auditService,
    uow,
  });
  return { service, auditRepo };
}

async function runInRequest<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return requestContext.run({ requestId: `req-${crypto.randomUUID()}`, userId }, fn);
}

describe("NarratorService — audit trail", () => {
  it("create emits narrator.create with entity_type=narrator and the created id", async () => {
    const { service, auditRepo } = build();

    const result = await runInRequest("user-1", () =>
      service.create({ name: `Narrator ${crypto.randomUUID()}` }),
    );

    const rows = await auditRepo.findByEntity("narrator", result.narrator.id, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe(AUDIT_ACTIONS.NARRATOR_CREATE);
    expect(rows[0].userId).toBe("user-1");
  });

  it("update emits narrator.update", async () => {
    const { service, auditRepo } = build();
    const created = await runInRequest("user-1", () =>
      service.create({ name: `N ${crypto.randomUUID()}` }),
    );

    await runInRequest("user-1", () => service.update(created.narrator.id, { name: "Updated" }));

    const rows = await auditRepo.findByEntity("narrator", created.narrator.id, 10);
    expect(rows.map((r) => r.action)).toContain(AUDIT_ACTIONS.NARRATOR_UPDATE);
  });

  it("softDelete emits narrator.delete", async () => {
    const { service, auditRepo } = build();
    const created = await runInRequest("user-1", () =>
      service.create({ name: `N ${crypto.randomUUID()}` }),
    );

    await runInRequest("user-1", () => service.softDelete(created.narrator.id));

    const rows = await auditRepo.findByEntity("narrator", created.narrator.id, 10);
    expect(rows.map((r) => r.action)).toContain(AUDIT_ACTIONS.NARRATOR_DELETE);
  });

  it("reactivate emits narrator.reactivate when re-creating a soft-deleted narrator", async () => {
    const { service, auditRepo } = build();
    const name = `N ${crypto.randomUUID()}`;
    const created = await runInRequest("user-1", () => service.create({ name }));
    await runInRequest("user-1", () => service.softDelete(created.narrator.id));

    const reactivated = await runInRequest("user-1", () => service.create({ name }));
    expect(reactivated.reactivated).toBe(true);

    const rows = await auditRepo.findByEntity("narrator", created.narrator.id, 10);
    expect(rows.map((r) => r.action)).toContain(AUDIT_ACTIONS.NARRATOR_REACTIVATE);
  });
});
