import { getTestDb } from "@tests/helpers/db";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { describe, expect, it } from "vitest";
import { requestContext } from "@/lib/api/request-context";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-actions";
import { DrizzleAuditLogRepository } from "@/lib/repositories/drizzle/drizzle-audit-log-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { AuditServiceImpl } from "@/lib/services/audit-service";
import { EditorService } from "@/lib/services/editor-service";

function build() {
  const db = getTestDb();
  const auditRepo = new DrizzleAuditLogRepository(db);
  const auditService = new AuditServiceImpl(auditRepo);
  const uow = new SavepointUnitOfWork(db);
  const service = new EditorService(new DrizzleEditorRepository(db), { auditService, uow });
  return { service, auditRepo };
}

async function runInRequest<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return requestContext.run({ requestId: `req-${crypto.randomUUID()}`, userId }, fn);
}

function uniqueEmail(): string {
  return `editor-${crypto.randomUUID()}@example.com`;
}

describe("EditorService — audit trail", () => {
  it("create emits editor.create", async () => {
    const { service, auditRepo } = build();
    const result = await runInRequest("user-1", () =>
      service.create({ name: `E ${crypto.randomUUID()}`, email: uniqueEmail() }),
    );
    const rows = await auditRepo.findByEntity("editor", result.editor.id, 10);
    expect(rows[0].action).toBe(AUDIT_ACTIONS.EDITOR_CREATE);
  });

  it("update emits editor.update", async () => {
    const { service, auditRepo } = build();
    const created = await runInRequest("user-1", () =>
      service.create({ name: `E ${crypto.randomUUID()}`, email: uniqueEmail() }),
    );
    await runInRequest("user-1", () =>
      service.update(created.editor.id, { name: `Updated ${crypto.randomUUID()}` }),
    );
    const rows = await auditRepo.findByEntity("editor", created.editor.id, 10);
    expect(rows.map((r) => r.action)).toContain(AUDIT_ACTIONS.EDITOR_UPDATE);
  });

  it("softDelete emits editor.delete", async () => {
    const { service, auditRepo } = build();
    const created = await runInRequest("user-1", () =>
      service.create({ name: `E ${crypto.randomUUID()}`, email: uniqueEmail() }),
    );
    await runInRequest("user-1", () => service.softDelete(created.editor.id));
    const rows = await auditRepo.findByEntity("editor", created.editor.id, 10);
    expect(rows.map((r) => r.action)).toContain(AUDIT_ACTIONS.EDITOR_DELETE);
  });

  it("reactivate emits editor.reactivate", async () => {
    const { service, auditRepo } = build();
    const name = `E ${crypto.randomUUID()}`;
    const email = uniqueEmail();
    const created = await runInRequest("user-1", () => service.create({ name, email }));
    await runInRequest("user-1", () => service.softDelete(created.editor.id));
    const reactivated = await runInRequest("user-1", () => service.create({ name, email }));
    expect(reactivated.reactivated).toBe(true);
    const rows = await auditRepo.findByEntity("editor", created.editor.id, 10);
    expect(rows.map((r) => r.action)).toContain(AUDIT_ACTIONS.EDITOR_REACTIVATE);
  });
});
