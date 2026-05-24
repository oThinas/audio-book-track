import { getTestDb } from "@tests/helpers/db";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { describe, expect, it } from "vitest";
import { requestContext } from "@/lib/api/request-context";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-actions";
import { DrizzleAuditLogRepository } from "@/lib/repositories/drizzle/drizzle-audit-log-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { AuditServiceImpl } from "@/lib/services/audit-service";
import { StudioService } from "@/lib/services/studio-service";

function build() {
  const db = getTestDb();
  const auditRepo = new DrizzleAuditLogRepository(db);
  const auditService = new AuditServiceImpl(auditRepo);
  const uow = new SavepointUnitOfWork(db);
  const service = new StudioService(new DrizzleStudioRepository(db), { auditService, uow });
  return { service, auditRepo };
}

async function runInRequest<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return requestContext.run({ requestId: `req-${crypto.randomUUID()}`, userId }, fn);
}

describe("StudioService — audit trail", () => {
  it("create emits studio.create", async () => {
    const { service, auditRepo } = build();
    const result = await runInRequest("user-1", () =>
      service.create({ name: `Studio ${crypto.randomUUID()}`, defaultHourlyRateCents: 5000 }),
    );
    const rows = await auditRepo.findByEntity("studio", result.studio.id, 10);
    expect(rows[0].action).toBe(AUDIT_ACTIONS.STUDIO_CREATE);
    expect(rows[0].userId).toBe("user-1");
  });

  it("update emits studio.update", async () => {
    const { service, auditRepo } = build();
    const created = await runInRequest("user-1", () =>
      service.create({ name: `S ${crypto.randomUUID()}`, defaultHourlyRateCents: 5000 }),
    );
    await runInRequest("user-1", () =>
      service.update(created.studio.id, { defaultHourlyRateCents: 6000 }),
    );
    const rows = await auditRepo.findByEntity("studio", created.studio.id, 10);
    expect(rows.map((r) => r.action)).toContain(AUDIT_ACTIONS.STUDIO_UPDATE);
  });

  it("softDelete emits studio.delete", async () => {
    const { service, auditRepo } = build();
    const created = await runInRequest("user-1", () =>
      service.create({ name: `S ${crypto.randomUUID()}`, defaultHourlyRateCents: 5000 }),
    );
    await runInRequest("user-1", () => service.softDelete(created.studio.id));
    const rows = await auditRepo.findByEntity("studio", created.studio.id, 10);
    expect(rows.map((r) => r.action)).toContain(AUDIT_ACTIONS.STUDIO_DELETE);
  });

  it("reactivate emits studio.reactivate", async () => {
    const { service, auditRepo } = build();
    const name = `S ${crypto.randomUUID()}`;
    const created = await runInRequest("user-1", () =>
      service.create({ name, defaultHourlyRateCents: 5000 }),
    );
    await runInRequest("user-1", () => service.softDelete(created.studio.id));
    const reactivated = await runInRequest("user-1", () =>
      service.create({ name, defaultHourlyRateCents: 7000 }),
    );
    expect(reactivated.reactivated).toBe(true);
    const rows = await auditRepo.findByEntity("studio", created.studio.id, 10);
    expect(rows.map((r) => r.action)).toContain(AUDIT_ACTIONS.STUDIO_REACTIVATE);
  });
});
