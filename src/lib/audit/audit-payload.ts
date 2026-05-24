import { getCurrentRequestId } from "@/lib/api/request-context";
import type { AuditAction } from "@/lib/audit/audit-actions";

export interface AuditEvent {
  readonly action: AuditAction;
  readonly userId: string | null;
  readonly entityType: string | null;
  readonly entityId: string | null;
}

export interface AuditPayload {
  readonly action: AuditAction;
  readonly userId: string | null;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly requestId: string;
}

export function buildAuditPayload(event: AuditEvent): AuditPayload {
  const requestId = getCurrentRequestId() ?? `system:${crypto.randomUUID()}`;
  return {
    action: event.action,
    userId: event.userId,
    entityType: event.entityType,
    entityId: event.entityId,
    requestId,
  };
}
