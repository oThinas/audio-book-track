import type { AuditPayload } from "@/lib/audit/audit-payload";
import type { AuditLogRow } from "@/lib/db/schema/audit-log";
import type { RepositoryTx } from "@/lib/repositories/book-repository";

export interface AuditLogRepository {
  /** Insere uma linha dentro da transação ativa (obrigatório para mutações de domínio). */
  insertWithin(tx: RepositoryTx, event: AuditPayload): Promise<void>;

  /** Insere uma linha em conexão própria (best-effort, callbacks de auth). */
  insert(event: AuditPayload): Promise<void>;

  /** Apaga linhas com `created_at < cutoff`. Retorna número de linhas removidas. Idempotente. */
  deleteOlderThan(cutoff: Date): Promise<number>;

  /** Investigação: ações do usuário X desde a data, ordem cronológica reversa. */
  findByUserSince(userId: string, since: Date, limit: number): Promise<readonly AuditLogRow[]>;
  findByEntity(
    entityType: string,
    entityId: string,
    limit: number,
  ): Promise<readonly AuditLogRow[]>;
  findByRequestId(requestId: string): Promise<readonly AuditLogRow[]>;
}
