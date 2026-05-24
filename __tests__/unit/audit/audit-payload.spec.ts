import { describe, expect, it } from "vitest";
import { requestContext } from "@/lib/api/request-context";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-actions";
import { buildAuditPayload } from "@/lib/audit/audit-payload";

describe("buildAuditPayload", () => {
  it("reads request_id from the active requestContext", () => {
    requestContext.run({ requestId: "req_abc", userId: "u-1" }, () => {
      const payload = buildAuditPayload({
        action: AUDIT_ACTIONS.STUDIO_CREATE,
        userId: "u-1",
        entityType: "studio",
        entityId: "studio-1",
      });

      expect(payload).toEqual({
        action: "studio.create",
        userId: "u-1",
        entityType: "studio",
        entityId: "studio-1",
        requestId: "req_abc",
      });
    });
  });

  it("generates a system:<uuid> request_id when called outside a request", () => {
    const payload = buildAuditPayload({
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      userId: null,
      entityType: null,
      entityId: null,
    });

    expect(payload.requestId).toMatch(/^system:[0-9a-f-]{36}$/);
  });

  it("preserves null userId/entityType/entityId for auth events", () => {
    requestContext.run({ requestId: "req_x", userId: null }, () => {
      const payload = buildAuditPayload({
        action: AUDIT_ACTIONS.AUTH_LOGOUT,
        userId: null,
        entityType: null,
        entityId: null,
      });

      expect(payload.userId).toBeNull();
      expect(payload.entityType).toBeNull();
      expect(payload.entityId).toBeNull();
      expect(payload.requestId).toBe("req_x");
    });
  });

  it("returns a fresh object on each call (no mutation)", () => {
    requestContext.run({ requestId: "req_y", userId: "u" }, () => {
      const a = buildAuditPayload({
        action: AUDIT_ACTIONS.BOOK_CREATE,
        userId: "u",
        entityType: "book",
        entityId: "b1",
      });
      const b = buildAuditPayload({
        action: AUDIT_ACTIONS.BOOK_CREATE,
        userId: "u",
        entityType: "book",
        entityId: "b1",
      });

      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });
});
