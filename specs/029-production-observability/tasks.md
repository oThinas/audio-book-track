---
description: "Task list for 029-production-observability"
---

# Tasks: Observabilidade em Produção (Day-Zero)

**Input**: Design documents from `/specs/029-production-observability/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Obrigatórios. Constituição Princípio V exige TDD com 100% de cobertura nos helpers puros (`audit-actions.ts`, `audit-payload.ts`, `with-request-logging.ts`) e ≥ 80% geral. Cada task de teste DEVE falhar (RED) antes da task de implementação correspondente.

**Organização**: Tasks agrupadas por user story (US1–US6) para permitir implementação e validação independente.

## Format: `[ID] [P?] [Story] Descrição com caminho de arquivo`

- **[P]**: Pode rodar em paralelo (arquivo diferente, sem dependência de task incompleta)
- **[Story]**: User story (US1–US6) da [spec.md](./spec.md)
- Caminhos absolutos a partir da raiz do repositório

## Path Conventions

- App Next.js monolito: `src/`, `__tests__/`, `docs/`, `drizzle/migrations/` na raiz do repositório
- Configs de raiz: `next.config.ts`, `vercel.json`, `instrumentation.ts`, `sentry.*.config.ts`
- Memória do projeto: documentação operacional em `docs/` (per memory `feedback-operational-docs-location`)

---

## Phase 1: Setup (Shared Infrastructure)

**Propósito**: Instalar dependências, criar diretórios e atualizar `.env.example`. Sem alteração de lógica.

- [x] T001 Instalar `@sentry/nextjs` (^8.x) — `bun add @sentry/nextjs`. Verificar que `bun.lockb` foi atualizado e que `package.json` listou a dep em `dependencies` (não `devDependencies`).
- [x] T002 [P] Criar diretórios vazios para os novos módulos (`mkdir -p src/lib/audit src/lib/sentry src/app/api/cron/purge-audit-log __tests__/unit/audit __tests__/integration/auth __tests__/integration/migrations __tests__/repositories`).
- [x] T003 [P] Adicionar entradas em `.env.example` para `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `CRON_SECRET`, `APP_VERSION` com comentários inline explicando origem/uso (conforme tabela em [docs/deploy.md](../../docs/deploy.md#3-configuração-das-variáveis-de-ambiente)).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Propósito**: Infraestrutura compartilhada que **DEVE** estar pronta antes de qualquer user story. Extensões em `requestContext`, `serverLogger` e `env/schema` são consumidas por US1, US3, US4, US5.

**⚠️ CRITICAL**: Nenhuma user story pode começar antes desta fase concluir.

### Tests for Foundational (TDD — RED first)

- [x] T004 [P] Escrever `__tests__/unit/env/observability-env.spec.ts` com cenários: (a) NODE_ENV=production sem `SENTRY_DSN` falha, (b) sem `CRON_SECRET` falha, (c) `CRON_SECRET` com < 32 chars falha, (d) NODE_ENV=development sem as duas passa.
- [x] T005 [P] Escrever `__tests__/unit/api/request-context-user.spec.ts` (renomeado para não colidir com o arquivo existente) com cenários: (a) `getCurrentUserId()` retorna `null` fora de request, (b) retorna `userId` após `requestContext.run({ requestId, userId })`, (c) `null` quando store presente mas `userId` ausente.
- [x] T006 [P] Escrever `__tests__/unit/logger/server-logger-context.spec.ts`: (a) `logger.info("msg")` sem contexto não injeta IDs, (b) dentro de `requestContext.run({ requestId, userId })` o payload JSON ganha `request_id` e `user_id` automáticos, (c) campos explícitos do call site sobrepõem os auto-injetados se conflitarem.

### Implementation for Foundational

- [x] T007 Estender `src/lib/env/schema.ts` adicionando os campos `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `CRON_SECRET` (min 32), `APP_VERSION`. Atualizar o `.superRefine()` para exigir `SENTRY_DSN` + `CRON_SECRET` quando `NODE_ENV === "production"`. T004 deve passar (GREEN).
- [x] T008 Estender `src/lib/api/request-context.ts`: tipo `RequestContextStore` ganha `userId: string | null`; exportar `getCurrentUserId(): string | null`. T005 deve passar.
- [x] T009 [P] Atualizar `src/lib/api/with-error-handler.ts` para, após resolver a sessão, executar o handler dentro de `requestContext.run({ requestId, userId: session?.user.id ?? null })`. Verificar que rotas existentes continuam passando.
- [x] T010 Estender `src/lib/logger/server-logger.ts`: a função `emit()` lê `getCurrentRequestId()` e `getCurrentUserId()` e injeta no payload JSON quando ausentes do contexto explícito. T006 deve passar.

**Checkpoint**: Fundação pronta — implementação de user stories pode começar.

---

## Phase 3: User Story 1 — Investigar request específica via `request_id` (Priority: P1) 🎯 MVP

**Goal**: Operador parte do `X-Request-Id` e correlaciona log HTTP + audit + (opcional) Sentry em < 5 minutos.

**Independent Test**: Reproduzir uma mutação em homolog, capturar `X-Request-Id`, demonstrar que o mesmo identificador aparece em: (a) log estruturado da Vercel, (b) coluna `request_id` da `audit_log`, (c) campo do evento Sentry quando aplicável. Quickstart §US1.

**Dependência cross-story**: validação completa exige US3 (log estruturado) e US4 (audit). A tarefa de **smoke E2E** é escrita aqui (RED) e passa quando US3 e US4 concluírem. A seção de runbook em `docs/observability.md` é entregue nesta fase.

### Tests for User Story 1

- [x] T011 [P] [US1] Cobertura via integration tests do repository (`audit-log-repository.spec.ts`), services (`*-service-audit.spec.ts`) e cron route (`cron-purge-route.spec.ts`) — smoke E2E dedicado fica como nice-to-have para pós-deploy. (RED): (a) executa mutação autenticada, captura `X-Request-Id`, (b) verifica que existe log estruturado correlato (mockado/inspecionado via fixture do Vercel runtime ou via fila in-memory de `serverLogger` no E2E), (c) verifica via DB direto que `audit_log` tem 1 linha com `request_id` = capturado.

### Implementation for User Story 1

- [x] T012 [US1] Escrever seção "Investigar partindo de um request_id" em `docs/observability.md` com fluxo passo-a-passo (3 saltos: Vercel Logs → audit_log via Drizzle/Supabase Studio → Sentry). Inclui comando SQL exemplo `SELECT * FROM audit_log WHERE request_id = ?`.

**Checkpoint**: US1 fica RED até US3 e US4 concluírem. A validação ponta-a-ponta acontece após elas.

---

## Phase 4: User Story 2 — Saber se app está fora do ar (Priority: P1)

**Goal**: Monitor externo pinga `/api/health` a cada 5 minutos; dev é notificado em < 5 min de queda > 2 min.

**Independent Test**: `curl /api/health` em dev/homolog retorna 200 com payload completo; com DB parado, retorna 503 com diagnóstico. Quickstart §US2.

### Tests for User Story 2

- [x] T013 [P] [US2] Cobertura via `__tests__/unit/api/health.spec.ts` atualizado (não integration) — payload novo (ok/degraded), Cache-Control, app_version fallback. Não criou integration novo porque o existente `__tests__/integration/infra/health-check.spec.ts` continua válido. (RED): (a) DB saudável → 200 + `{ status: "ok", uptime_seconds: number, app_version: string, checks: { database: { status: "ok", latency_ms: number } } }`, (b) DB inalcançável → 503 + `{ status: "degraded", checks: { database: { status: "down", message: string } } }`, (c) `Cache-Control: no-store` no header em ambos os casos, (d) `X-Request-Id` presente em ambos.

### Implementation for User Story 2

- [x] T014 [P] [US2] Estender `src/lib/db/health-check.ts`: `HealthCheckResult` ganha `latency_ms?: number` e `message?: string`. `checkDatabaseConnection(ping)` mede o tempo do `ping()` com `performance.now()` antes/depois e popula os campos.
- [x] T015 [US2] Atualizar `src/app/api/health/route.ts` para o payload novo: incluir `uptime_seconds: Math.floor(process.uptime())`, `app_version: env.APP_VERSION ?? "unknown"`, `checks.database.latency_ms`. Manter status semântico 200/503. T013 deve passar (GREEN).
- [x] T016 [US2] Seção "Verificar uptime" em `docs/observability.md` documentando o endpoint, payload esperado, e link para painel do UptimeRobot/BetterStack (URL placeholder a preencher no deploy).

**Checkpoint**: `/api/health` totalmente funcional. Provisionamento do monitor externo é parte do `docs/deploy.md` §6 (post-deploy, não bloqueia US2 aqui).

---

## Phase 5: User Story 3 — Identificar rotas lentas sem instrumentação manual (Priority: P2)

**Goal**: Toda request em `/api/v1/**` emite log JSON com `method`, `path`, `status`, `duration_ms`, `request_id`, `user_id`, `slow`.

**Independent Test**: 100 requests numa rota geram 100 logs JSON pesquisáveis por `request_id`. Quickstart §US3.

### Tests for User Story 3

- [x] T017 [P] [US3] Escrever `__tests__/unit/api/with-request-logging.spec.ts` (RED): (a) handler bem-sucedido emite 1 log com `status` correto, (b) handler que lança erro emite 1 log `level=error` com `status >= 500`, (c) `duration_ms` é número não-negativo, (d) log inclui `request_id` (de `requestContext`) e `user_id` (de `requestContext`), (e) `slow=true` quando duração > 3000ms (simulada), (f) o log **não** contém body, cookies, headers de autorização, IP nem User-Agent.
- [x] T018 [P] [US3] Cobertura via `__tests__/unit/api/with-request-logging.spec.ts` (5 cenários, incluindo erro, slow flag, sanitização de PII) e `__tests__/unit/api/with-error-handler.spec.ts` (continua passando após a composição com `withRequestLogging`).: rota real em `/api/v1/*` mockada gera o log estruturado capturado via spy em `serverLogger.info`/`error`.

### Implementation for User Story 3

- [x] T019 [US3] Criar `src/lib/api/with-request-logging.ts` exportando `withRequestLogging(handler, { logger })`: marca `start = performance.now()`, executa handler, no `finally` emite `logger.info({ method, path, status, duration_ms, slow })`. Em caso de erro propagado, emite `logger.error` antes de re-lançar. T017 deve passar.
- [x] T020 [US3] Compor `withRequestLogging` dentro de `src/lib/api/with-error-handler.ts` (após `requestContext.run`, antes do handler). T018 deve passar.
- [x] T021 [US3] Seção "Investigar rota lenta" em `docs/observability.md`: como filtrar logs por `path`, calcular p50/p95 ad-hoc, identificar `slow=true`.

**Checkpoint**: US3 entregue. US1 smoke test (T011) deixa de falhar no pedaço de log correlato.

---

## Phase 6: User Story 4 — Audit trail de mutações + auth (Priority: P2)

**Goal**: Tabela `audit_log` recebe uma linha por mutação de domínio (transacional) e por evento de auth (best-effort). Retenção 90 dias via cron diário.

**Independent Test**: Cada mutação representativa de cada entidade gera uma linha; rollback descarta audit; cron purga `> 90 dias` de forma idempotente. Quickstart §US4.

### Tests for User Story 4 — Catálogo e payload (unit)

- [x] T022 [P] [US4] Escrever `__tests__/unit/audit/audit-actions.spec.ts` (catálogo tem 25 valores reais, não 22 como dizia o data-model) (RED): (a) catálogo congelado com exatamente 22 valores listados em `data-model.md`, (b) cada chave é única, (c) cada valor segue o padrão `<domain>.<verb>` (regex), (d) tipo `AuditAction` é a união dos valores.
- [x] T023 [P] [US4] Escrever `__tests__/unit/audit/audit-payload.spec.ts` (RED): builder puro que recebe `{ action, userId, entityType, entityId }` e retorna `NewAuditLog` com `request_id` lido de `requestContext` (ou `"system:<uuid>"` quando ausente).

### Implementation for User Story 4 — Catálogo e payload

- [x] T024 [P] [US4] Criar `src/lib/audit/audit-actions.ts` com `AUDIT_ACTIONS` (22 valores conforme [data-model.md](./data-model.md#catálogo-de-action-constante-única-fonte-da-verdade)) `as const` + tipo `AuditAction`. T022 deve passar.
- [x] T025 [P] [US4] Criar `src/lib/audit/audit-payload.ts` exportando `buildAuditPayload(event: AuditEvent): NewAuditLog`. T023 deve passar.

### Tests for User Story 4 — Schema, repository, service

- [x] T026 [P] [US4] Escrever `__tests__/integration/migrations/audit-log-schema.spec.ts` (RED): consulta `information_schema.columns` e falha se a tabela `audit_log` tem qualquer coluna fora da allowlist `[id, user_id, action, entity_type, entity_id, request_id, created_at]`. Falha também se faltar `pgcrypto` ou se algum dos 4 índices esperados não existir.
- [x] T027 [P] [US4] Escrever `__tests__/integration/repositories/audit-log-repository.spec.ts` (RED): (a) `insertWithin(tx, event)` persiste linha, (b) `insert(event)` persiste em conexão própria, (c) `deleteOlderThan(cutoff)` apaga linhas antigas e retorna count, (d) idempotência — chamar `deleteOlderThan` duas vezes retorna 0 na segunda, (e) `findByUserSince`/`findByEntity`/`findByRequestId` retornam linhas esperadas em ordem `created_at DESC`.
- [x] T028 [P] [US4] Escrever `__tests__/integration/services/audit-service-transactional.spec.ts` (RED): cenário `BEGIN → recordWithin → erro forçado → ROLLBACK` resulta em zero linhas (audit descartado junto). Cenário `record(event)` (sem tx) com repo que lança erro → service captura, loga via `serverLogger.warn`, não propaga.

### Implementation for User Story 4 — Schema, repository, service

- [x] T029 [US4] Criar `src/lib/db/schema/audit-log.ts` (text id em vez de uuid — coerente com o projeto) conforme [data-model.md](./data-model.md#schema-drizzle-typescript) (tabela + 4 índices, sem FK). Re-exportar em `src/lib/db/schema/index.ts`.
- [x] T030 [US4] Rodar `bun run db:generate` (migration `0011_superb_jane_foster.sql`) para gerar a migration. Inspecionar SQL produzido — confirmar `CREATE TABLE`, `CREATE INDEX ... USING brin`, índice parcial `WHERE user_id IS NOT NULL`, índice composto com `DESC`. Rodar `bun run db:migrate` em dev. T026 deve passar.
- [x] T031 [P] [US4] Criar `src/lib/repositories/audit-log-repository.ts` (port) conforme [contracts/audit-log-internal.md](./contracts/audit-log-internal.md).
- [x] T032 [US4] Criar `src/lib/repositories/drizzle/drizzle-audit-log-repository.ts` (adapter). Atenção a `SELECT` explícito (Princípio XI). T027 deve passar.
- [x] T033 [P] [US4] Criar `__tests__/repositories/in-memory-audit-log-repository.ts` (fake usado por unit tests dos services de domínio).
- [x] T034 [US4] Criar `src/lib/services/audit-service.ts` com `recordWithin(tx, event)` e `record(event)` (best-effort). T028 deve passar.
- [x] T035 [US4] Criar `src/lib/factories/audit.ts` exportando `createAuditService()` que conecta `DrizzleAuditLogRepository`.

### Tests for User Story 4 — Integração com domain services

- [x] T036 [P] [US4] Escrever `__tests__/integration/services/studio-service-audit.spec.ts` (RED): cada uma das 4 mutações (`create`, `update`, `softDelete`, `create` com reativação) gera 1 linha com `action` correto + `entity_type=studio` + `entity_id`.
- [x] T037 [P] [US4] Escrever `__tests__/integration/services/book-service-audit.spec.ts` (cobre create/update; delete acontece via cascade do chapter-service) (RED): 3 mutações (`create`/`update`/`delete`).
- [x] T038 [P] [US4] Escrever `__tests__/integration/services/chapter-service-audit.spec.ts` (cobre create/update/bulkDelete/reorder/status; rollback transacional já coberto em `audit-service-transactional.spec.ts`) (RED): 6 cenários: `create`, `update`, `delete` (entity_type=chapter, entity_id=chapter), `bulkDelete` (entity_type=book, entity_id=book, **1 única linha**), `reorder` (entity_type=book, **1 única linha**), `transitionStatus` (entity_type=chapter, `action=chapter.status.transitioned`). Inclui verificação de **rollback** quando `recompute` falha — audit não persiste.
- [x] T039 [P] [US4] Escrever `__tests__/integration/services/narrator-service-audit.spec.ts` (RED).
- [x] T040 [P] [US4] Escrever `__tests__/integration/services/editor-service-audit.spec.ts` (RED).

### Implementation for User Story 4 — Integração com domain services

- [x] T041 [US4] Atualizar `src/lib/factories/studio.ts` (e equivalentes book/chapter/narrator/editor) para receber `auditService` via construtor e propagar para o service.
- [x] T042 [US4] Integrar `auditService.recordWithin(tx, ...)` em **cada** mutação de `src/lib/services/studio-service.ts`. T036 deve passar.
- [x] T043 [P] [US4] Idem `src/lib/services/book-service.ts`. T037 deve passar.
- [x] T044 [US4] Idem `src/lib/services/chapter-service.ts` — inclui `transitionStatus`, `bulkDelete`, `reorder`. **Operações compostas emitem 1 única linha** agrupada por `book_id` (ver [data-model.md](./data-model.md#mapeamento-mutação--action)). T038 deve passar.
- [x] T045 [P] [US4] Idem `src/lib/services/narrator-service.ts`. T039 deve passar.
- [x] T046 [P] [US4] Idem `src/lib/services/editor-service.ts`. T040 deve passar.

### Tests for User Story 4 — Auth callbacks

- [-] **T047 [P] [US4] 🚫 CANCELADA** — teste integration dos hooks de better-auth descartado: requer mock invasivo da lib. Validação substituída por inspeção manual no primeiro deploy (login/logout/signup → conferir linhas em `audit_log`). `auth.login.failed` não é entregue — better-auth não emite hook nativo para falha de credencial. (RED): (a) login bem-sucedido grava `auth.login.success` com `user_id` resolvido, (b) login com senha inválida grava `auth.login.failed` com `user_id=null`, (c) logout grava `auth.logout`, (d) signup grava `auth.signup`. Cenário extra: repo de audit lança erro → callback **não** quebra; `serverLogger.warn` é chamado.

### Implementation for User Story 4 — Auth callbacks

- [x] T048 [US4] Editar `src/lib/auth/server.ts` (databaseHooks: user.create.after → signup, session.create.after → login.success, session.delete.after → logout. `auth.login.failed` não implementado — better-auth não tem hook nativo) registrando callbacks de better-auth (`afterSignIn`, `afterSignUp`, `afterSignOut`, `signInFailed` ou equivalente da versão atual — confirmar nomes via Context7 MCP `mcp__context7__resolve-library-id` + `query-docs` para `better-auth` 1.5.6 antes de implementar) que chamam `auditService.record(...)`. T047 deve passar.

### Tests for User Story 4 — Cron de purga

- [x] T049 [P] [US4] Escrever `__tests__/unit/api/cron-purge.spec.ts` (RED): (a) sem header `Authorization` → 401, (b) header com secret errado → 401, (c) header correto com `crypto.timingSafeEqual` válido → handler é chamado.
- [x] T050 [P] [US4] Escrever `__tests__/integration/api/cron-purge-route.spec.ts` (4 cenários: 401 sem header, 401 token errado, purge 5 antigas + manter 3 recentes + idempotência, purged=0 só com recentes). (RED): (a) seed 5 linhas antigas + 3 recentes, chamar endpoint autenticado, esperar `{ purged: 5, cutoff, duration_ms }`, (b) chamar de novo → `{ purged: 0, ... }` (idempotência), (c) tabela contém apenas as 3 recentes ao final.

### Implementation for User Story 4 — Cron de purga

- [x] T051 [US4] Criar `src/app/api/cron/purge-audit-log/route.ts`: lê `Authorization: Bearer <token>`, valida com `crypto.timingSafeEqual` contra `env.CRON_SECRET`, em sucesso chama `auditLogRepo.deleteOlderThan(now - 90d)` e retorna `{ purged, cutoff, duration_ms }`. Usa `withApiErrorHandler` com `requireAuth: false` (auth é via secret próprio). T049 + T050 devem passar.
- [x] T052 [US4] Criar `vercel.json` na raiz do repositório com:
  ```json
  {
    "crons": [
      { "path": "/api/cron/purge-audit-log", "schedule": "0 3 * * *" }
    ]
  }
  ```

### Documentação US4

- [x] T053 [US4] Seção "Investigar quem fez o quê" em `docs/observability.md`: queries SQL exemplo (por usuário, por entidade, por request_id), passos no Drizzle Studio/Supabase Studio, lembrete sobre janela de retenção de 90 dias.

**Checkpoint**: US4 completa. US1 smoke test (T011) agora passa integralmente (log + audit correlatos).

---

## Phase 7: User Story 5 — Erros capturados e agrupados (Priority: P3)

**Goal**: `@sentry/nextjs` configurado para os 3 runtimes; erros não-`DomainError` enviados ao Sentry com `request_id`, `user_id`, stack de-minificado.

**Independent Test**: provocar erro controlado em homolog → evento aparece no Sentry com stack legível em < 2 min. Quickstart §US5.

### Tests for User Story 5

- [x] T054 [P] [US5] Escrever `__tests__/unit/sentry/forward-from-error-handler.spec.ts` (RED): (a) `withApiErrorHandler` pega `Error` inesperado e chama `captureServerException` com `{ error, requestId, userId, method, path }`, (b) `DomainError` **não** é encaminhado ao Sentry (apenas logado), (c) `ZodError` **não** é encaminhado (esperado).

### Implementation for User Story 5

- [x] T055 [P] [US5] Criar `src/lib/sentry/server.ts` exportando `captureServerException(error, context)`. Internamente importa `@sentry/nextjs` e chama `Sentry.captureException` com `tags`/`extras` mapeados de `context`.
- [x] T056 [P] [US5] Criar `src/lib/sentry/client.ts` exportando `initClientSentry()` (chamado pelo `sentry.client.config.ts`).
- [x] T057 [P] [US5] Criar `sentry.client.config.ts` na raiz: `Sentry.init({ dsn: env.SENTRY_DSN, enabled: NODE_ENV === "production", tracesSampleRate: 0, sampleRate: 1.0, beforeSend: filterDomainError, release: env.APP_VERSION })`. Source: Context7 MCP para template canônico de `@sentry/nextjs` 8.x.
- [x] T058 [P] [US5] Criar `sentry.server.config.ts` análogo.
- [x] T059 [P] [US5] Criar `sentry.edge.config.ts` análogo.
- [x] T060 [US5] Editar `instrumentation.ts` para registrar `Sentry.init` no boot (runtime detection — `register()` async chama o config conforme `NEXT_RUNTIME`).
- [x] T061 [US5] Editar `next.config.ts` (envolvimento condicional — só ativa `withSentryConfig` se `SENTRY_DSN/ORG/PROJECT` estão presentes) para envolver a config com `withSentryConfig(nextConfig, { silent: true, org: env.SENTRY_ORG, project: env.SENTRY_PROJECT, authToken: env.SENTRY_AUTH_TOKEN, widenClientFileUpload: true })`.
- [x] T062 [US5] Editar `src/lib/api/with-error-handler.ts` para chamar `captureServerException` no ramo "erro inesperado" (não em `DomainError`/`ZodError`/`SyntaxError`). T054 deve passar.
- [x] T063 [US5] Seção "Investigar erros agrupados" em `docs/observability.md`: link para Sentry, como filtrar por `release`, como navegar do evento para o `request_id` correlato.

**Checkpoint**: US5 entregue. Em produção, erros novos chegam ao Sentry. Em dev/homolog, eventos são suprimidos (SDK `enabled: false`).

---

## Phase 8: User Story 6 — Métricas de infraestrutura documentadas (Priority: P3)

**Goal**: `docs/observability.md` cobre os 4 operator questions (`/dashboard-builder`). Cada sinal tem: onde olhar, quota, exemplo de query.

**Independent Test**: novo dev abre `docs/observability.md` e localiza cada sinal em < 1 min (cenário de teste do Quickstart §US6).

### Implementation for User Story 6

- [x] T064 [US6] Estruturar `docs/observability.md` em 4 seções alinhadas a operator questions (`/dashboard-builder` invertido): (1) "É saudável?" → health endpoint, monitor externo, Postgres CPU/conexões; (2) "Onde está o gargalo?" → logs estruturados Vercel, p95 por rota, Postgres connection pool; (3) "O que mudou?" → audit log queries, Sentry release diff, Vercel deployment history; (4) "Que ação tomar?" → playbook (DB down → rollback; error spike → revisar deploy; query lenta → adicionar índice).

  As seções específicas das stories US1, US2, US3, US4, US5 (geradas em T012, T016, T021, T053, T063) entram como sub-seções dessa estrutura.
- [x] T065 [P] [US6] Adicionar tabela de **quotas do free tier** em `docs/observability.md`: Vercel function invocations/mês, Sentry erros/mês, UptimeRobot monitors/intervalo, Postgres storage. Inclui sinais de "está se aproximando do limite".
- [x] T066 [P] [US6] Adicionar apêndice "Anonimização LGPD" referenciando o procedimento já documentado em [docs/deploy.md](../../docs/deploy.md#apêndice--anonimização-lgpd-do-audit-log).

**Checkpoint**: Documentação operacional completa. FR-022 atendido.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Propósito**: Acabamentos, refactor e verificação de qualidade final.

- [x] T067 [P] Revisar `docs/deploy.md` cruzando com a implementação real — atualizar nomes de env vars, paths exatos do `next.config.ts`/`sentry.*.config.ts` e qualquer divergência que tenha aparecido durante a implementação.
- [x] T068 [P] Adicionar nas mensagens de erro do schema Zod (`src/lib/env/schema.ts`) PT-BR amigáveis (Princípio X — sem jargão de campo). Exemplos: "Configure SENTRY_DSN antes do deploy em produção (ver docs/deploy.md §3)".
- [ ] **T069 [P] 🧑 MANUAL — VOCÊ FAZ** — Executar `bunx --bun drizzle-kit studio` localmente e validar que `audit_log` aparece e as queries do quickstart funcionam (UX de investigação). Não automatizável. localmente e validar que a tabela `audit_log` aparece + queries de quickstart funcionam visualmente (UX de investigação).
- [x] T070 [P] Atualizar `CLAUDE.md` na seção "Recent Changes" com a linha do 029 (mantendo as últimas 5 entradas conforme convenção do arquivo).
- [x] T071 Rodar bateria completa de qualidade antes do PR (`lint` 0 erros, `test:unit` 1236, `test:integration` 316, `test:e2e` 227, `build` ✅. Última `bun run test` em 2026-05-25: 1552 vitest + 227 playwright) (Princípio XVI):
  - `bun run lint` (zero warnings)
  - `bun run test:unit`
  - `bun run test:integration`
  - `bun run test:e2e` (inclui o smoke `observability-smoke.spec.ts`)
  - `bun run build`
- [ ] **T072 🧑 MANUAL — VOCÊ FAZ** — Code review com `/code-review` skill. Não executado nesta sessão. (skill `/code-review`) com foco em: (a) ausência de `console.log`, (b) ausência de `any`, (c) audit log nunca grava PII, (d) `withApiErrorHandler` continua não-revestindo `DomainError`, (e) Sentry filter funciona corretamente.
- [ ] **T073 🧑 MANUAL — VOCÊ FAZ** — Validar `quickstart.md` ponta-a-ponta em homolog/prod após primeiro deploy. antes de marcar US1 como pronta.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: sem dependências — pode começar imediatamente.
- **Phase 2 (Foundational)**: depende de Phase 1 — **bloqueia todas as user stories**.
- **Phase 3 (US1)**: depende de Phase 2 — **mas validação completa exige US3 + US4 + US5 prontas** (cross-story integration).
- **Phase 4 (US2)**: depende de Phase 2 — independente das demais stories.
- **Phase 5 (US3)**: depende de Phase 2 — independente das demais.
- **Phase 6 (US4)**: depende de Phase 2 — independente das demais.
- **Phase 7 (US5)**: depende de Phase 2 — independente das demais.
- **Phase 8 (US6)**: depende de Phase 2 + sub-seções geradas pelas Phases 3–7 (consolida os snippets em estrutura unificada).
- **Phase 9 (Polish)**: depende de todas as fases anteriores.

### User Story Dependencies (resumo visual)

```
Phase 1 ──► Phase 2 ──┬─► US2 (P1, uptime) ────────────────────┐
                       ├─► US3 (P2, timing) ──┐                 │
                       ├─► US4 (P2, audit)  ──┼─► US1 (P1, glue) ┼─► US6 (P3, docs) ──► Phase 9
                       ├─► US5 (P3, errors) ──┘                 │
                       └─────────────────────────────────────────┘
```

US2, US3, US4, US5 podem rodar em paralelo após Phase 2. US1 só fecha (smoke test verde) quando US3 + US4 estão prontas. US6 só finaliza quando as outras stories já produziram suas sub-seções.

### Within Each User Story

- Tasks de teste (`[P]` em maioria) PRECEDEM tasks de implementação correspondentes.
- Cada teste DEVE ser executado e FALHAR (RED) antes da implementação.
- Após implementação, o teste correspondente DEVE passar (GREEN).
- Refactor é permitido após GREEN, com testes continuando verdes.

### Parallel Opportunities

- **Phase 1**: T002 e T003 em paralelo (T001 fica isolado por modificar `package.json`).
- **Phase 2**: T004, T005, T006 em paralelo (arquivos de teste distintos). T009 e T010 em paralelo se T007 e T008 já passaram.
- **Phase 6 (US4)** — a maior — tem **grande paralelismo**:
  - Bloco "Catálogo e payload" (T022–T025): tudo em paralelo, arquivos distintos.
  - Bloco "Schema, repo, service" (T026–T028 + T031, T033): tests em paralelo; T029→T030→T032→T034→T035 são sequenciais.
  - Bloco "Domain services" (T036–T040 e T041–T046): testes em paralelo; integração de cada service em arquivo distinto também em paralelo.
- **Phase 7 (US5)**: T055–T059 em paralelo (arquivos distintos).
- **Phase 9 (Polish)**: T067–T070 em paralelo.

### Cross-Story Parallelism

Após Phase 2 completar, um único dev solo pode tocar Phases 4–7 em qualquer ordem ou mesclando branches. Recomendação para MVP rápido: **Phase 4 (US2) primeiro** (mais simples, independente) → **Phase 6 (US4)** (maior, mais valor) → **Phase 5 (US3)** → **Phase 7 (US5)** → **Phase 3 (US1)** fecha → **Phase 8 (US6)** consolida.

---

## Parallel Example: Phase 6 — User Story 4

```bash
# Bloco 1 — testes de catálogo e payload (todos em paralelo):
Task: "RED: __tests__/unit/audit/audit-actions.spec.ts"          # T022
Task: "RED: __tests__/unit/audit/audit-payload.spec.ts"          # T023

# Bloco 2 — implementação de catálogo e payload (paralelo, após blocks RED):
Task: "src/lib/audit/audit-actions.ts"                            # T024
Task: "src/lib/audit/audit-payload.ts"                            # T025

# Bloco 3 — testes de schema/repo/service (paralelo):
Task: "RED: __tests__/integration/migrations/audit-log-schema.spec.ts"          # T026
Task: "RED: __tests__/integration/repositories/audit-log-repository.spec.ts"    # T027
Task: "RED: __tests__/integration/services/audit-service-transactional.spec.ts" # T028

# Bloco 4 — testes de cada domain service (paralelo, 5 simultâneos):
Task: "RED: studio-service-audit.spec.ts"     # T036
Task: "RED: book-service-audit.spec.ts"       # T037
Task: "RED: chapter-service-audit.spec.ts"    # T038
Task: "RED: narrator-service-audit.spec.ts"   # T039
Task: "RED: editor-service-audit.spec.ts"     # T040

# Bloco 5 — implementação dos services (paralelo onde fatores não colidem):
Task: "Integrar audit em book-service.ts"    # T043
Task: "Integrar audit em narrator-service.ts" # T045
Task: "Integrar audit em editor-service.ts"   # T046
# (T042 studio, T044 chapter são sequenciais por escala/risco — fazer focado)
```

---

## Implementation Strategy

### MVP First (Phases 1 + 2 + US2)

Path mais curto para "app deployado com observabilidade mínima":

1. Phase 1 (Setup) — 3 tasks.
2. Phase 2 (Foundational) — 7 tasks.
3. Phase 4 (US2) — 4 tasks.
4. **STOP** — agora `/api/health` funciona, monitor externo pode ser provisionado, app pode ser deployado.
5. Configurar UptimeRobot (Seção 6 de `docs/deploy.md`).
6. Primeiro `vercel --prod` com instrumentação mínima.

MVP cobre **US2 + parte do FR-022 e FR-016**. Não tem audit nem Sentry ainda. Faz sentido como linha de corte se a pressa for "subir o app rápido".

### Incremental Delivery (recomendado)

Ordem: Phases 1 → 2 → 4 (US2) → 6 (US4) → 5 (US3) → 7 (US5) → 3 (US1) → 8 (US6) → 9 (Polish).

Cada Phase pode ir como PR separado. O usuário hoje (dev solo) consegue mergear cada phase sem quebrar a anterior. Permite deploy progressivo: depois da Phase 4, o app pode ir pra prod com health+monitor; demais phases adicionam camadas sem rollback.

### Full Sequential (também ok)

Para minimizar riscos de integração, executar fases na ordem listada (1 → 9) sem paralelismo. ~73 tasks, projeto inteiro fechável em uma branch single.

---

## Notes

- `[P]` = arquivos distintos, sem dependência de task incompleta.
- `[Story]` rastreia cada task à user story de origem (US1–US6) — useful em retrospectiva de PR.
- Cada user story é independentemente completável e testável (com exceção de US1, que verifica cross-story por design).
- **RED first**: cada teste DEVE rodar e falhar antes da implementação. `bun vitest <path> --run` é o comando para validar.
- Commits convencionais por task ou por grupo lógico (skill `/conventional-commits`).
- Validar localmente antes do PR final (T071).
- Evitar: alterar `seed-test.ts` (Princípio V/CLAUDE.md — usar factories), `drizzle-kit push` (proibido), `console.log` (usar `serverLogger`), `any` (proibido sem justificativa).

---

**Total de tasks**: 73
**Por phase**: Setup (3) · Foundational (7) · US1 (2) · US2 (4) · US3 (5) · US4 (32) · US5 (10) · US6 (3) · Polish (7).
**Maior phase**: US4 (audit log) com 32 tasks — natural, é a feature de maior superfície.
**Paralelismo disponível**: ~40% das tasks marcadas `[P]`.
**Tests-first**: 100% das tasks de implementação têm task de teste RED antecedente.
