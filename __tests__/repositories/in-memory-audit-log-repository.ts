import type { AuditPayload } from "@/lib/audit/audit-payload";
import type { AuditLogRow } from "@/lib/db/schema/audit-log";
import type { AuditLogRepository } from "@/lib/repositories/audit-log-repository";
import type { RepositoryTx } from "@/lib/repositories/book-repository";

interface InMemoryRow extends AuditLogRow {}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  readonly rows: InMemoryRow[] = [];

  private push(event: AuditPayload): void {
    this.rows.push({
      id: crypto.randomUUID(),
      userId: event.userId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      requestId: event.requestId,
      createdAt: new Date(),
    });
  }

  async insertWithin(_tx: RepositoryTx, event: AuditPayload): Promise<void> {
    this.push(event);
  }

  async insert(event: AuditPayload): Promise<void> {
    this.push(event);
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const before = this.rows.length;
    const remaining = this.rows.filter((r) => r.createdAt >= cutoff);
    this.rows.length = 0;
    this.rows.push(...remaining);
    return before - this.rows.length;
  }

  async findByUserSince(
    userId: string,
    since: Date,
    limit: number,
  ): Promise<readonly AuditLogRow[]> {
    return this.rows
      .filter((r) => r.userId === userId && r.createdAt > since)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    limit: number,
  ): Promise<readonly AuditLogRow[]> {
    return this.rows
      .filter((r) => r.entityType === entityType && r.entityId === entityId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async findByRequestId(requestId: string): Promise<readonly AuditLogRow[]> {
    return this.rows
      .filter((r) => r.requestId === requestId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  reset(): void {
    this.rows.length = 0;
  }
}
