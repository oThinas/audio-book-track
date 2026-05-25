# Contrato interno: AuditLog write API

**Feature**: [029-production-observability](../spec.md)

Audit log **não tem endpoint público**. Esta feature deliberadamente não constrói rota HTTP para listar/consultar audit (consulta via ferramenta de DB existente — D6/spec assumptions). O contrato aqui descrito é **interno à camada de serviço** — fronteira entre `AuditService` e os domain services que dependem dele.

## `AuditService` (interface efetiva)

```typescript
// src/lib/services/audit-service.ts
import type { Transaction } from "@/lib/db";
import type { AuditAction } from "@/lib/audit/audit-actions";

export interface AuditEvent {
  /** Valor do catálogo AUDIT_ACTIONS. */
  readonly action: AuditAction;
  /** ID do usuário responsável; null para eventos de auth sem user resolvido. */
  readonly userId: string | null;
  /** Categoria da entidade alvo (ex: "chapter"); null para eventos auth genéricos. */
  readonly entityType: string | null;
  /** ID da entidade alvo (text — uuid ou outro formato); null para eventos auth genéricos. */
  readonly entityId: string | null;
}

export interface AuditService {
  /**
   * Insere o evento DENTRO da transação ativa do SavepointUnitOfWork.
   * Uso obrigatório para mutações de domínio (Princípio XI).
   *
   * Garantias:
   * - Rollback da transação descarta o audit junto.
   * - request_id é lido do AsyncLocalStorage (requestContext) automaticamente.
   * - Erro de insert propaga e rolla back a operação inteira.
   */
  recordWithin(tx: Transaction, event: AuditEvent): Promise<void>;

  /**
   * Insere o evento em conexão própria, best-effort.
   * Uso EXCLUSIVO de callbacks de auth (better-auth não expõe TX).
   *
   * Garantias:
   * - Erro de insert é capturado e logado via serverLogger.warn — não propaga.
   * - Não bloqueia o callback de auth.
   * - request_id pode ser "system:<uuid>" quando o evento ocorre fora de request.
   */
  record(event: AuditEvent): Promise<void>;
}
```

## Regras de uso (enforced via testes de integration)

| Regra | Quem garante |
|---|---|
| Toda mutação de domínio em service chama `recordWithin(tx, ...)` exatamente uma vez. | Teste `*-service-audit.spec.ts` por entidade. |
| Operações compostas (`bulkDelete`, `reorder`) emitem **uma única** linha agrupada no nível do livro, não N linhas por capítulo. | Teste `chapter-service-audit.spec.ts` cenário `bulk_delete`. |
| Eventos de auth chamam `record(...)`, nunca `recordWithin(...)`. | Teste `auth-audit.spec.ts`. |
| `AUDIT_ACTIONS` é fonte única — uso de string literal fora do catálogo quebra build (TS) ou teste. | Tipo `AuditAction` + teste "catalog frozen". |

## Não-objetivos

- **Não há endpoint REST público para leitura de audit nesta feature.** Consulta é via Drizzle Studio, Supabase Studio, Outerbase, TablePlus ou psql direto.
- **Não há projeção de audit em outras tabelas.** Audit é fonte de verdade isolada; demais relatórios não dependem dele.
- **Não há retenção variável por tipo de evento.** Toda linha vive 90 dias, independente de `action` (FR-011). Se no futuro evento financeiro precisar de retenção maior, fica como feature separada.
