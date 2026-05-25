import { type AuditEvent, buildAuditPayload } from "@/lib/audit/audit-payload";
import { serverLogger } from "@/lib/logger/server-logger";
import type { AuditLogRepository } from "@/lib/repositories/audit-log-repository";
import type { RepositoryTx } from "@/lib/repositories/book-repository";

export interface AuditService {
  /**
   * Inserts the event INSIDE the active transaction. Mandatory for domain
   * mutations: a transaction rollback discards the audit row along with it.
   */
  recordWithin(tx: RepositoryTx, event: AuditEvent): Promise<void>;

  /**
   * Inserts the event using its own connection (best-effort). EXCLUSIVELY for
   * auth callbacks — better-auth does not expose the transaction. Insert
   * errors are captured and logged via serverLogger.warn; they do not
   * propagate, so the auth callback never blocks.
   */
  record(event: AuditEvent): Promise<void>;
}

export class AuditServiceImpl implements AuditService {
  constructor(private readonly repository: AuditLogRepository) {}

  async recordWithin(tx: RepositoryTx, event: AuditEvent): Promise<void> {
    const payload = buildAuditPayload(event);
    await this.repository.insertWithin(tx, payload);
  }

  async record(event: AuditEvent): Promise<void> {
    const payload = buildAuditPayload(event);
    try {
      await this.repository.insert(payload);
    } catch (error) {
      serverLogger.warn("audit.best_effort_failed", {
        action: event.action,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
