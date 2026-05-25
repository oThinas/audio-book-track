import type { AuditPayload } from "@/lib/audit/audit-payload";
import type { AuditLogRow } from "@/lib/db/schema/audit-log";
import type { RepositoryTx } from "@/lib/repositories/book-repository";

export interface AuditLogRepository {
  /** Inserts a row inside the active transaction (required for domain mutations). */
  insertWithin(tx: RepositoryTx, event: AuditPayload): Promise<void>;

  /** Inserts a row using its own connection (best-effort, used by auth callbacks). */
  insert(event: AuditPayload): Promise<void>;

  /** Deletes rows with `created_at < cutoff`. Returns the number of rows removed. Idempotent. */
  deleteOlderThan(cutoff: Date): Promise<number>;

  /** Investigation: actions by user X since the given date, reverse chronological order. */
  findByUserSince(userId: string, since: Date, limit: number): Promise<readonly AuditLogRow[]>;
  findByEntity(
    entityType: string,
    entityId: string,
    limit: number,
  ): Promise<readonly AuditLogRow[]>;
  findByRequestId(requestId: string): Promise<readonly AuditLogRow[]>;
}
