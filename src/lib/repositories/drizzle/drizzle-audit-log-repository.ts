import { and, desc, eq, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { AuditPayload } from "@/lib/audit/audit-payload";
import type * as schema from "@/lib/db/schema";
import { type AuditLogRow, auditLog } from "@/lib/db/schema/audit-log";
import type { AuditLogRepository } from "@/lib/repositories/audit-log-repository";
import type { RepositoryTx } from "@/lib/repositories/book-repository";

type Executor = NodePgDatabase<typeof schema>;

const COLUMNS = {
  id: auditLog.id,
  userId: auditLog.userId,
  action: auditLog.action,
  entityType: auditLog.entityType,
  entityId: auditLog.entityId,
  requestId: auditLog.requestId,
  createdAt: auditLog.createdAt,
} as const;

function payloadToRow(event: AuditPayload) {
  return {
    userId: event.userId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    requestId: event.requestId,
  };
}

export class DrizzleAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: Executor) {}

  private executor(tx?: RepositoryTx): Executor {
    return (tx as Executor | undefined) ?? this.db;
  }

  async insertWithin(tx: RepositoryTx, event: AuditPayload): Promise<void> {
    await this.executor(tx).insert(auditLog).values(payloadToRow(event));
  }

  async insert(event: AuditPayload): Promise<void> {
    await this.db.insert(auditLog).values(payloadToRow(event));
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const rows = await this.db
      .delete(auditLog)
      .where(lt(auditLog.createdAt, cutoff))
      .returning({ id: auditLog.id });
    return rows.length;
  }

  async findByUserSince(
    userId: string,
    since: Date,
    limit: number,
  ): Promise<readonly AuditLogRow[]> {
    return this.db
      .select(COLUMNS)
      .from(auditLog)
      .where(and(eq(auditLog.userId, userId), lt(since, auditLog.createdAt)))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    limit: number,
  ): Promise<readonly AuditLogRow[]> {
    return this.db
      .select(COLUMNS)
      .from(auditLog)
      .where(and(eq(auditLog.entityType, entityType), eq(auditLog.entityId, entityId)))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);
  }

  async findByRequestId(requestId: string): Promise<readonly AuditLogRow[]> {
    return this.db
      .select(COLUMNS)
      .from(auditLog)
      .where(eq(auditLog.requestId, requestId))
      .orderBy(desc(auditLog.createdAt));
  }
}
