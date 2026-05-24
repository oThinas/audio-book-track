import { type AuditEvent, buildAuditPayload } from "@/lib/audit/audit-payload";
import { serverLogger } from "@/lib/logger/server-logger";
import type { AuditLogRepository } from "@/lib/repositories/audit-log-repository";
import type { RepositoryTx } from "@/lib/repositories/book-repository";

export interface AuditService {
  /**
   * Insere o evento DENTRO da transação ativa. Uso obrigatório para mutações
   * de domínio: o rollback da transação descarta o audit junto.
   */
  recordWithin(tx: RepositoryTx, event: AuditEvent): Promise<void>;

  /**
   * Insere o evento em conexão própria (best-effort). Uso EXCLUSIVO de
   * callbacks de auth — better-auth não expõe a transação. Erros de insert
   * são capturados e logados via serverLogger.warn; não propagam para não
   * bloquear o callback.
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
