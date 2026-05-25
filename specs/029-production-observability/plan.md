# Implementation Plan: Observabilidade em Produção (Day-Zero)

**Branch**: `029-production-observability` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/029-production-observability/spec.md`

## Summary

Adicionar quatro sinais de observabilidade ao app antes do primeiro deploy em produção: (1) **logs estruturados** por request HTTP em `/api/v1/**` (timing + correlação), (2) **audit log** transacional de toda mutação de domínio e evento de autenticação retido por 90 dias, (3) **health endpoint** com check efetivo de Postgres consumido por monitor externo de uptime, (4) **error tracking** centralizado via Sentry free tier com source maps. Plus dois artefatos documentais em `docs/`: `observability.md` (como investigar) e `deploy.md` (runbook do primeiro deploy e dos subsequentes).

**Abordagem técnica**: estender infraestrutura existente — `serverLogger`, `requestContext` (AsyncLocalStorage com `requestId`), `/api/health` e `withApiErrorHandler` já fornecem 60% das peças. Adicionar uma única tabela `audit_log` (sem FK ao `user`, intencionalmente denormalizada para sobreviver à exclusão LGPD); um `AuditService` injetado nos domain services e gravado dentro do mesmo `SavepointUnitOfWork` da mutação; um helper `withRequestLogging` aplicado dentro de `withApiErrorHandler` que emite o log estruturado de duração ao final do handler; SDK oficial `@sentry/nextjs` para erros; Vercel Cron diário para purgar audit_log > 90d.

## Skills Consultadas

Esta passagem do plano integra orientações de 5 skills (Princípio XV), com ênfase em `/deployment-patterns` por ser a primeira ida a produção do projeto.

| Skill | Principal aplicação |
|---|---|
| `/deployment-patterns` ⭐ | (1) **Checklist de production readiness aplicado integralmente** — todas as 5 seções (App, Infra, Monitoring, Security, Ops) viram seções do `docs/deploy.md`. (2) Health check com **payload detalhado** (`checks.database` + `uptime_seconds` + `latency_ms`), 200/503 semântico. (3) **Validação de env vars no startup com Zod** — `SENTRY_DSN`, `CRON_SECRET` e `APP_VERSION` entram no schema `@/lib/env`, falhando o build se ausentes em prod. (4) **Rollback documentado** — `vercel rollback` + cláusula sobre migrations backward-compatible. (5) **Source maps via build hook**, não comitados. (6) **Sem Docker** — Vercel serverless não usa container, mas os princípios (não-root, deps mínimas, secrets via env) viram regras de configuração Vercel. |
| `/api-design` | (1) Health endpoint segue padrão `200/503` com payload semântico (não `200 { success: false }`). (2) Cron endpoint protegido com `Authorization: Bearer <CRON_SECRET>` — retorna 401 se ausente, 200 com `{ purged: N }` no sucesso. (3) `Cache-Control: no-store` no `/api/health` (dado dinâmico). (4) **Não-versionamento intencional** do `/api/health` — é infraestrutura, não API de domínio (justificativa em [D6](research.md#d6)). |
| `/backend-patterns` | (1) **Repository pattern** para `AuditLogRepository` (port em `lib/repositories/audit-log-repository.ts`, adapter `lib/repositories/drizzle/drizzle-audit-log-repository.ts`). (2) **Centralized error handler** já existente (`withApiErrorHandler`) — apenas inserir hook de envio ao Sentry no ramo "erro inesperado". (3) **N+1 prevention**: consulta de audit por entidade usa single SELECT com índice composto, sem JOIN com `user` (`user_id` é denormalizado). (4) **Structured logger** já existe — apenas adicionar `request_id`/`user_id` automaticamente via `requestContext`. |
| `/postgres-patterns` | (1) **BRIN index em `audit_log.created_at`** (não B-tree) — purga diária é range scan em coluna time-series; BRIN ocupa ~1% do espaço do B-tree e tem performance equivalente para esse padrão de acesso. (2) **Índice parcial** `(user_id, created_at DESC) WHERE user_id IS NOT NULL` evita inflar índice com eventos de auth pré-resolução. (3) **`SELECT 1` no health check com `statement_timeout` curto** para não derrubar pool. (4) **`text` para `entity_id`** (não `uuid`) porque entidades têm formatos variados de id. (5) **`gen_random_uuid()`** para PK — pgcrypto já habilitado. (6) Anti-pattern check: rodar query de FKs não-indexadas após migration. |
| `/dashboard-builder` | Aplicado **invertido** — a spec descartou explicitamente UI de dashboard de audit dentro do app. Em vez disso, a skill informa a **estrutura do `docs/observability.md`**: organizar por **operator questions** ("é saudável?", "onde está o gargalo?", "o que mudou?", "que ação tomar?") em vez de por ferramenta. Resultado: 4 seções de runbook orientadas a investigação, não 5 capítulos por ferramenta. |

## Technical Context

**Language/Version**: TypeScript 5.9.3, Bun 1.2 (runtime + test runner + package manager)
**Primary Dependencies**: Next.js 16.2.1 (App Router + Turbopack), React 19.2.4, Drizzle ORM 0.45.2, Zod 4.3.6, better-auth 1.5.6, `serverLogger` custom existente
**New Dependencies**:
- `@sentry/nextjs` ^8.x — SDK oficial Sentry para Next.js (server + client + edge). Bundle client ≈ 25kb gzipped. Justificado pela FR-017. Source maps via plugin oficial no build de produção.
- **Nenhuma outra.** `pino` é descartado em favor do `serverLogger` existente (apenas estender). `node:async_hooks` já em uso via `requestContext`. Sem nova lib de uptime — provedor externo opera fora do código.

**Storage**: PostgreSQL 15+ via Drizzle ORM. Uma nova tabela `audit_log` + 4 índices. Migration reversível.
**Testing**: Vitest (`bun run test:unit`, `bun run test:integration`), Playwright (`bun run test:e2e`). Fakes manuais via construtor + `vi.fn()`. Audit log testado em integration (DB real) e via teste de "audit catalog ↔ uses match" em unit (estático).
**Target Platform**: Vercel Hobby/Pro (Next.js Server Components em Node runtime). Postgres gerenciado (Supabase ou Neon — decisão fica no runbook).

**Performance Goals**:
- `/api/health` p95 < 500ms incluindo ping de DB (FR-013, SC-004).
- Overhead do logger em `/api/v1/**`: < 5ms por request.
- Overhead da escrita de audit log dentro da transação: < 10ms por mutação.
- Consulta "ações do usuário X nos últimos 7 dias" em < 2s para 500k linhas (SC-008).
- Cron de purga executa em < 30s para até 1M linhas elegíveis (apaga em batch).

**Constraints**:
- **Audit log de domínio é transacional** com a mutação (Princípio XI: mesma transação via `SavepointUnitOfWork`). Falha de audit = rollback da mutação. Sem audit órfão.
- **Audit log de auth é best-effort** — não bloqueia login/logout/signup.
- **Sentry é best-effort** — indisponibilidade não trava response (FR-020).
- **Sem `SELECT *`** (Princípio XI). Sem `drizzle-kit push`. Migration via `generate` + `migrate`.
- **PII zero no audit log**: schema do banco não tem coluna capaz de armazenar IP, UA, email, diff. Teste de schema falha se alguém adicionar tal coluna.
- **Logger não loga body de request** nem cookies — apenas method/path/status/duration/IDs.
- **`/api/health` é infraestrutura, não-versionado** (justificativa em [D6](research.md#d6)).
- **`X-Request-Id` é a chave universal** — não introduzir novo identificador.

**Scale/Scope**:
- ~10 usuários ativos (multi-admin homogêneo).
- Volume esperado de audit: ~50–200k linhas/mês.
- 1 tabela nova + 1 endpoint cron + 1 endpoint health (extensão).
- ~22 valores de `action` no catálogo inicial (Studio×4, Book×3, Chapter×6, Narrator×4, Editor×4, Auth×4).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Justificativa |
|---|-----------|--------|---------------|
| I | Capítulo como Unidade de Trabalho | ✅ Pass | Audit registra eventos no nível da mutação (inclui todas mutações de capítulo). `book.status` recomputado não gera audit separado — não é mutação iniciada pelo usuário. |
| II | Precisão Financeira | ✅ Pass | Sem mudança em fórmula. Audit registra `action=chapter.status.transitioned` mas **não** armazena valores em centavos — apenas o fato. Disputa financeira investigada via chapter (preservado) + audit (quem/quando). |
| III | Ciclo de Vida do Capítulo | ✅ Pass | Sem nova transição. Cada transição existente passa a gerar uma linha `chapter.status.transitioned`. |
| IV | Simplicidade (YAGNI) | ✅ Pass | Audit minimal (6 colunas). Sem UI customizada. Sem stack self-hosted. |
| V | TDD | ✅ Pass | Tasks iniciam por RED. Cobertura ≥ 80%; **100% nos helpers de catálogo e payload de audit**. |
| VI | Arquitetura Limpa Backend | ✅ Pass | `AuditLogRepository` (port) + `DrizzleAuditLogRepository` (adapter). `AuditService` injetado nos domain services. Factory `createAuditService()` em `lib/factories/audit.ts`. |
| VII | Frontend | N/A | Feature não toca frontend. |
| VIII | Performance | ✅ Pass | Overhead < 5ms (logger) + < 10ms (audit). Sentry SDK lazy-init no edge. Bundle client +25kb gzipped. |
| IX | Design Tokens | N/A | Sem UI nova. |
| X | API REST | ✅ Pass | `/api/health` 200/503 semântico + `Cache-Control: no-store`. `/api/cron/purge-audit-log` 401 sem `Authorization: Bearer <CRON_SECRET>`, 200 com `{ purged: N }`. |
| XI | PostgreSQL e BD | ✅ Pass | Migration via `generate` + `migrate`. `audit_log.user_id` sem FK (denormalizado por design — sobrevive a exclusão LGPD). Índices: BRIN para purge, partial para evitar nulls. `text` para `entity_id`. `gen_random_uuid()` para PK. Transação via `SavepointUnitOfWork.recordWithin(tx, ...)`. |
| XII | Anti-Padrões Proibidos | ✅ Pass | Sem `any`. Sem `console.log` (`serverLogger`). Sem SQL fora de repos. Mensagens estáticas em `DomainError`. |
| XIII | Métricas e KPIs | ✅ Pass | Implementa infra que dashboards futuros consomem; não substitui dashboards de produção da feature 028. |
| XIV | PDF | N/A | Não toca. |
| XV | Ferramentas e Skills | ✅ Pass | Consultadas: `/deployment-patterns` ⭐, `/api-design`, `/backend-patterns`, `/postgres-patterns`, `/dashboard-builder`. Context7 MCP a consultar em `/speckit-tasks` para `@sentry/nextjs`. |
| XVI | Qualidade e Verificação | ✅ Pass | Fase final única: `lint` + `test:unit` + `test:integration` + `test:e2e` (smoke `/api/health`) + `build`. |

**Resultado**: Nenhum item ❌. Plano segue para Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/029-production-observability/
├── plan.md              # This file
├── spec.md              # /speckit-specify output
├── research.md          # Phase 0 output (D1–D15)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── health.openapi.yaml
│   ├── cron-purge-audit-log.openapi.yaml
│   └── audit-log-internal.md
├── checklists/
│   └── requirements.md  # /speckit-specify output (já existe)
└── tasks.md             # /speckit-tasks output (não criado aqui)
```

### Operational Documentation (project root — per memory `feedback-operational-docs-location`)

```text
docs/
├── observability.md     # NEW · runbook de investigação por operator question
└── deploy.md            # NEW · runbook de deploy (FR-023)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   ├── health/
│   │   │   └── route.ts                                # EDIT · adicionar uptime_seconds + latency_ms
│   │   └── cron/
│   │       └── purge-audit-log/
│   │           └── route.ts                            # NEW · protegido por CRON_SECRET
│   └── (sem mudança em rotas de domínio — audit é interno via service)
│
├── instrumentation.ts                                  # EDIT · inicializar Sentry no boot
├── sentry.client.config.ts                             # NEW · init Sentry browser
├── sentry.server.config.ts                             # NEW · init Sentry server
├── sentry.edge.config.ts                               # NEW · init Sentry edge
├── next.config.ts                                      # EDIT · wrap com `withSentryConfig`
│
├── lib/
│   ├── api/
│   │   ├── with-error-handler.ts                       # EDIT · adicionar withRequestLogging + Sentry forward
│   │   ├── with-request-logging.ts                     # NEW · emite log estruturado on response
│   │   ├── request-context.ts                          # EDIT · expor getCurrentUserId
│   │   └── error-codes.ts                              # EDIT · adicionar UNAUTHORIZED_CRON (se necessário)
│   │
│   ├── audit/
│   │   ├── audit-actions.ts                            # NEW · catálogo único + types
│   │   └── audit-payload.ts                            # NEW · builder puro
│   │
│   ├── db/
│   │   ├── schema/
│   │   │   ├── audit-log.ts                            # NEW · tabela (sem FK ao user)
│   │   │   └── index.ts                                # EDIT · re-exportar audit-log
│   │   ├── ping.ts                                     # UNCHANGED
│   │   └── health-check.ts                             # EDIT · adicionar latency_ms
│   │
│   ├── env/
│   │   └── schema.ts                                   # EDIT · SENTRY_DSN, CRON_SECRET, APP_VERSION (com superRefine validando prod)
│   │
│   ├── factories/
│   │   └── audit.ts                                    # NEW · createAuditService()
│   │
│   ├── logger/
│   │   └── server-logger.ts                            # EDIT · auto-inject requestId + userId via requestContext
│   │
│   ├── repositories/
│   │   ├── audit-log-repository.ts                     # NEW · port (interface)
│   │   └── drizzle/
│   │       └── drizzle-audit-log-repository.ts         # NEW · adapter
│   │
│   ├── sentry/
│   │   ├── server.ts                                   # NEW · captureServerException
│   │   └── client.ts                                   # NEW · init browser
│   │
│   └── services/
│       ├── audit-service.ts                            # NEW · recordWithin(tx, event) + record(event)
│       ├── studio-service.ts                           # EDIT · injetar auditService
│       ├── book-service.ts                             # EDIT
│       ├── chapter-service.ts                          # EDIT (inclui status transitions e reorder)
│       ├── narrator-service.ts                         # EDIT
│       └── editor-service.ts                           # EDIT
│
├── lib/auth/
│   └── server.ts                                       # EDIT · callbacks signIn/signOut/signUp emitem audit
│
├── vercel.json                                         # NEW · "crons": [{path, schedule: "0 3 * * *"}]
│
└── __tests__/
    ├── unit/
    │   ├── audit/
    │   │   ├── audit-actions.spec.ts                   # NEW · catálogo congelado
    │   │   └── audit-payload.spec.ts                   # NEW
    │   ├── api/
    │   │   ├── with-request-logging.spec.ts            # NEW
    │   │   └── cron-purge.spec.ts                      # NEW
    │   ├── logger/
    │   │   └── server-logger-context.spec.ts           # NEW
    │   └── env/
    │       └── observability-env.spec.ts               # NEW
    │
    ├── integration/
    │   ├── repositories/
    │   │   └── audit-log-repository.spec.ts            # NEW
    │   ├── services/
    │   │   ├── audit-service-transactional.spec.ts     # NEW · rollback descarta audit
    │   │   ├── studio-service-audit.spec.ts            # NEW
    │   │   ├── book-service-audit.spec.ts              # NEW
    │   │   ├── chapter-service-audit.spec.ts           # NEW
    │   │   ├── narrator-service-audit.spec.ts          # NEW
    │   │   └── editor-service-audit.spec.ts            # NEW
    │   ├── auth/
    │   │   └── auth-audit.spec.ts                      # NEW
    │   ├── api/
    │   │   ├── health-route.spec.ts                    # EDIT · uptime + latency
    │   │   └── cron-purge-route.spec.ts                # NEW
    │   └── migrations/
    │       └── audit-log-schema.spec.ts                # NEW · garante que não há coluna PII
    │
    └── e2e/
        └── observability-smoke.spec.ts                 # NEW · post-deploy smoke
```

**Structure Decision**: Mantém a arquitetura existente (Next.js monolito em `src/`). Audit log é novo domínio com port/adapter/service/factory. Logger e request-context **estendidos, não duplicados**. Sentry vive em `lib/sentry/` + configs canônicos do `@sentry/nextjs` na raiz. Vercel Cron config em `vercel.json` (único arquivo novo na raiz — `next.config.ts` recebe wrap).

## Composition rules (do `/backend-patterns`)

Aplicação concreta nesta feature:

- **`AuditService` é injetado** nos domain services via construtor (Princípio VI). Cada factory (ex: `createStudioService()`) passa a chamar `createAuditService()` internamente. Services NÃO instanciam `AuditService` por conta própria.
- **`recordWithin(tx, event)`** é o método principal — recebe a transação ativa do `SavepointUnitOfWork`. Garantia: rollback da TX descarta o audit junto. Domain services usam `recordWithin` 100% das vezes para mutações de domínio.
- **`record(event)`** (sem `tx`) é a versão best-effort, usada **apenas** por callbacks de auth. Erros logados via `serverLogger.warn` mas não propagam.
- **Logger context é automático**: `serverLogger.info("msg", { foo: "bar" })` passa a injetar automaticamente `request_id` (já existente) **e** `user_id` (novo, lido de `requestContext` se a sessão já foi resolvida pelo wrapper).
- **withRequestLogging é interno** ao `withApiErrorHandler`, não exposto. Garante que toda rota `/api/v1/**` e `/api/health` emita o log no `finally` do handler, antes do response sair.

## Complexity Tracking

| Decisão | Por quê | Alternativa rejeitada |
|---------|---------|----------------------|
| **`audit_log.user_id` sem FK** | Audit precisa sobreviver à exclusão hard-delete de usuário (LGPD). FK `ON DELETE RESTRICT` impede compliance; `SET NULL` viola constituição. Denormalização explícita é o trade-off honesto. | (a) FK `RESTRICT` — bloqueia LGPD. (b) FK `SET NULL` — viola Princípio XI. (c) Tabela `audit_user_snapshot` — over-engineering. |
| **`audit_log.entity_id` é `text`, não `uuid`** | Entidades têm formatos variados (uuid agora; futuro pode ter slugs/ids compostos). `text` evita migration quando entidade nova tiver formato diferente. Custo: 4 bytes a mais por linha. | `uuid` força conversão e quebra quando entidade nova não usa uuid. |
| **`/api/health` permanece fora de `/api/v1`** | É infraestrutura consumida por monitor externo. Versioná-la criaria fricção operacional sem benefício. | Mover para `/api/v1/health` complica o monitor sem ganho funcional. |
| **BRIN em vez de B-tree no `created_at` para purge** | Purge é range scan numa coluna estritamente crescente. BRIN ocupa ~1% do B-tree com performance equivalente nesse padrão. Para consultas por tempo, B-tree composto cobre. | B-tree em `created_at` puro desperdiça espaço. |
| **Audit log gravado dentro da MESMA transação** | Princípio XI exige transação. Audit órfão ou audit fantasma corrompem investigação. | (a) Outbox + worker — over-engineering pra volume atual. (b) After-commit hook — janela de race em crash. |
| **Audit de auth é best-effort, sem TX** | better-auth não expõe TX ao callback. Forçar TX exigiria embrulhar better-auth — frágil. | Embrulhar better-auth em `SavepointUnitOfWork` — fricção alta. |
| **Sentry SDK incluído mesmo em dev** | FR-021 quer error tracking funcional em dev/homolog também. Gated por `enabled: NODE_ENV === "production"` evita ruído. | Lazy-load só em prod — adiciona condicionais por todo lado. |

---

**Re-evaluation post Phase 1 design**: Sem novas violações. Schema da `audit_log` validado contra Princípio XI (índices, tipos, ausência de `SELECT *`). Catálogo de actions é constante única (Princípio VI/XII). Plano segue para `/speckit-tasks`.
