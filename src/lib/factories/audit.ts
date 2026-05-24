import { db } from "@/lib/db";
import { DrizzleAuditLogRepository } from "@/lib/repositories/drizzle/drizzle-audit-log-repository";
import { type AuditService, AuditServiceImpl } from "@/lib/services/audit-service";

let cached: AuditService | null = null;

export function createAuditService(): AuditService {
  if (!cached) {
    cached = new AuditServiceImpl(new DrizzleAuditLogRepository(db));
  }
  return cached;
}
