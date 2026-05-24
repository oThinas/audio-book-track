# Quickstart: Observabilidade em Produção

**Feature**: [029-production-observability](./spec.md) | **Plan**: [plan.md](./plan.md)

Quickstart para validar cada user story em dev/homolog antes de pressionar deploy. Cobre os 6 user stories da spec. Itens marcados `[POST-DEPLOY]` só podem ser validados depois do primeiro `vercel --prod` — referenciados no [`docs/deploy.md`](../../docs/deploy.md).

## Pré-requisitos

```bash
# Banco local rodando
bun run db:start

# Migrations aplicadas (incluindo a nova audit_log)
bun run db:migrate

# Env vars de dev (.env.local) — não precisa Sentry/CRON em dev
DATABASE_URL=postgresql://...
TEST_DATABASE_URL=postgresql://...audiobook_track_test
APP_VERSION=dev
# SENTRY_DSN, CRON_SECRET — opcionais em dev (env schema permite ausência)
```

---

## US1 — Investigar request específica via `request_id` (P1)

**Cenário**: gerar uma mutação, capturar o `X-Request-Id`, navegar até audit + log + (opcionalmente) Sentry.

```bash
# 1. Subir o app
bun run dev

# 2. Fazer login e disparar uma mutação. Em outro terminal:
curl -i -X PATCH http://localhost:3000/api/v1/chapters/<id> \
  -H "Cookie: <session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Capítulo X"}'

# 3. Capturar o header X-Request-Id da resposta
#    → req_abc123…

# 4. No log do bun (stdout, JSON), procurar pelo request_id:
#    Aparece linha com level=info, method=PATCH, path, status, duration_ms, user_id, request_id

# 5. No banco (via Drizzle Studio: `bunx --bun drizzle-kit studio`):
SELECT * FROM audit_log WHERE request_id = 'req_abc123…';
# → uma linha com action='chapter.update', entity_type='chapter', entity_id=<id>
```

**Acceptance** (US1.1, US1.2, US1.3 da spec): `request_id` igual nas três fontes; localizado em < 5min.

---

## US2 — Saber se app está fora do ar (P1)

**Cenário 2.1**: health check com DB saudável.

```bash
curl -i http://localhost:3000/api/health
# HTTP/1.1 200 OK
# Cache-Control: no-store
# {"status":"ok","uptime_seconds":42,"app_version":"dev","checks":{"database":{"status":"ok","latency_ms":3}}}
```

**Cenário 2.2**: health check com DB degradado.

```bash
# 1. Parar o Postgres local
bun run db:stop

# 2. Chamar health
curl -i http://localhost:3000/api/health
# HTTP/1.1 503 Service Unavailable
# {"status":"degraded","uptime_seconds":99,"app_version":"dev","checks":{"database":{"status":"down","message":"timeout after 2000ms"}}}

# 3. Religar o DB
bun run db:start
```

**Cenário 2.3 — [POST-DEPLOY]**: configurar monitor externo apontando para `https://<seu-domínio>/api/health`. Validar alerta após queda simulada > 2min.

---

## US3 — Identificar rotas lentas (P2)

```bash
# 1. Subir o app
bun run dev

# 2. Provocar 100 requests numa rota qualquer:
for i in (seq 1 100); curl -s -o /dev/null http://localhost:3000/api/v1/books -H "Cookie: <session>"; end

# 3. Filtrar logs em stdout para a rota:
bun run dev 2>&1 | jq 'select(.path == "/api/v1/books")'

# 4. Verificar que cada linha tem: method, path, status, duration_ms, request_id, user_id
# 5. Calcular p95 ad-hoc: pipe para jq + sort + select index N*0.95
```

**Cenário 3.3**: simular lentidão.

```bash
# Adicionar artificialmente um await em algum service para reproduzir > 3000ms
# → log esperado contém `"slow": true`
```

---

## US4 — Audit trail de mutações + auth (P2)

**Cenário 4.1**: cada mutação de domínio gera uma linha.

```bash
# Disparar uma de cada (via UI ou curl):
# - criar studio
# - atualizar book
# - deletar chapter
# - reordenar chapters
# - transição de status de chapter

# Verificar no DB:
SELECT action, entity_type, entity_id, request_id, created_at
FROM audit_log
ORDER BY created_at DESC
LIMIT 10;
# → uma linha por mutação; bulk_delete e reorder agrupados em 1 linha cada
```

**Cenário 4.2**: rollback descarta audit.

```bash
# Cobertura via teste de integration:
bun vitest run __tests__/integration/services/audit-service-transactional.spec.ts
# Cenário: BEGIN → recordWithin → erro forçado → ROLLBACK → tabela vazia ✅
```

**Cenário 4.3**: auth events.

```bash
# 1. Fazer login bem-sucedido via UI
# 2. Tentar login com senha errada
# 3. Logout
# 4. Verificar no DB:
SELECT action, user_id FROM audit_log WHERE action LIKE 'auth.%' ORDER BY created_at DESC;
# → auth.login.success, auth.login.failed, auth.logout
```

**Cenário 4.4**: purge.

```bash
# Inserir manualmente uma linha datada de 91 dias atrás:
INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, request_id, created_at)
VALUES (gen_random_uuid(), null, 'studio.create', 'studio', 'fake-id', 'req_old', now() - interval '91 days');

# Disparar o cron manualmente:
curl -X POST http://localhost:3000/api/cron/purge-audit-log \
  -H "Authorization: Bearer $CRON_SECRET"
# → {"purged":1,"cutoff":"...","duration_ms":...}

# Re-executar (idempotência):
curl -X POST http://localhost:3000/api/cron/purge-audit-log \
  -H "Authorization: Bearer $CRON_SECRET"
# → {"purged":0,...}
```

**Cenário 4.5**: consulta investigativa rápida.

```sql
-- Ações do usuário X nos últimos 7 dias:
SELECT * FROM audit_log
WHERE user_id = '<uuid>'
  AND created_at >= now() - interval '7 days'
ORDER BY created_at DESC;
-- Esperado: < 2s para até 500k linhas (SC-008)

-- EXPLAIN ANALYZE: deve usar audit_log_user_created_idx
```

---

## US5 — Erros capturados e agrupados (P3) — [POST-DEPLOY] parcial

**Cenário 5.1 — dev (sem Sentry)**:

```typescript
// Em qualquer rota de teste:
throw new Error("intentional test error");
```

```bash
# Log estruturado captura o erro (level=error) com request_id, user_id, rota
# Em dev SENTRY_DSN não está setado → Sentry não envia. Comportamento esperado.
```

**Cenário 5.2 — [POST-DEPLOY]**: em produção, mesmo erro aparece na UI do Sentry em < 2min com stack trace de-minificado via source map. Validar manualmente.

**Cenário 5.3 — [POST-DEPLOY]**: validar agrupamento provocando o mesmo erro 10×.

---

## US6 — Métricas de infraestrutura visíveis (P3)

**Cenário 6.1**: abrir `docs/observability.md` e localizar em < 1 min:

- "Como ver duration por rota" → seção "Vercel Function Logs"
- "Como ver conexões do Postgres" → seção "Supabase/Neon UI"
- "Como ver erros agrupados" → seção "Sentry"
- "Como ver uptime histórico" → seção "Monitor externo"

**Cenário 6.2**: documentação inclui quotas do plano gratuito de cada ferramenta.

---

## Bateria de testes (verificação local)

Antes de marcar tasks como prontas:

```bash
# Tests do escopo desta feature (durante implementação por task — Princípio XVI)
bun vitest run __tests__/unit/audit __tests__/unit/api/with-request-logging __tests__/unit/logger __tests__/unit/env
bun vitest run __tests__/integration/repositories/audit-log-repository __tests__/integration/services/audit-service-transactional __tests__/integration/services/studio-service-audit __tests__/integration/services/book-service-audit __tests__/integration/services/chapter-service-audit __tests__/integration/services/narrator-service-audit __tests__/integration/services/editor-service-audit __tests__/integration/auth/auth-audit __tests__/integration/api/health-route __tests__/integration/api/cron-purge-route __tests__/integration/migrations/audit-log-schema

# Smoke E2E
bun run test:e2e -- observability-smoke

# Fase final — antes do PR / /finish-task (Princípio XVI):
bun run lint
bun run test:unit
bun run test:integration
bun run test:e2e
bun run build
```

---

## Lista de validações post-deploy

Itens marcados `[POST-DEPLOY]` acima fazem parte do checklist final do [`docs/deploy.md`](../../docs/deploy.md), seção "Verificação pós-deploy". A US1 também tem componente post-deploy: validar que o `request_id` correlaciona entre **Vercel logs**, **audit log** (Supabase/Neon), e **Sentry** em produção — não apenas em dev.
