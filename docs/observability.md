# Observabilidade em Produção — Runbook do Operador

> Companion do [docs/deploy.md](./deploy.md). Este arquivo responde **as quatro perguntas operacionais** que aparecem quando algo está estranho em produção. Toda investigação começa aqui.

Estrutura inspirada na skill `/dashboard-builder`: organização por operator question, não por ferramenta.

---

## 1. Está saudável?

Sinais de saúde imediata, sem entrar no diagnóstico fino.

### `/api/health`

`GET https://<seu-dominio>/api/health` retorna `200` com o payload:

```json
{
  "status": "ok",
  "uptime_seconds": 4231,
  "app_version": "1.2.3",
  "checks": { "database": { "status": "ok", "latency_ms": 5 } }
}
```

Quando o Postgres está fora do ar, retorna `503` com `status: "degraded"` e `checks.database.status: "down"`. Inclui sempre `Cache-Control: no-store` e `X-Request-Id`.

### Monitor externo

Configurado em UptimeRobot/BetterStack (provisionamento documentado em [docs/deploy.md §6](./deploy.md#6-configurar-monitor-externo)).

- Intervalo de poll: 5 minutos.
- Alerta dispara após duas falhas consecutivas (> 2 min off).
- Onde olhar: painel do monitor (link no canal `#oncall`).

### Postgres — pool e CPU

Painel nativo do provedor:

- **Supabase**: Dashboard → Project Settings → Database → Insights.
- **Neon**: Dashboard → Project → Monitoring → CPU/Connections.

Sinal de problema: CPU > 70% sustentado por > 5 min, conexões > 80% do limite.

---

## 2. Onde está o gargalo?

Quando algo está lento, descobrir **qual rota** e **qual etapa**.

### Logs estruturados (Vercel Function Logs)

Cada request `/api/v1/**` emite um log JSON do tipo `api.request`:

```json
{
  "level": "info",
  "msg": "api.request",
  "request_id": "req_…",
  "user_id": "user-…",
  "method": "POST",
  "path": "/api/v1/chapters/123",
  "status": 200,
  "duration_ms": 487,
  "slow": false
}
```

Quando `duration_ms > 3000` o campo `slow=true` aparece — filtro pronto para "rotas lentas" no Vercel Logs.

### Cálculo p50/p95 ad-hoc

No painel do Vercel, filtre por `path = "/api/v1/<rota>"` por X minutos, exporte CSV, calcule percentis. Para análises recorrentes, considere encaminhar para um sink (Logflare, Axiom, Datadog) — fora do escopo do MVP.

### Postgres — query lenta

`pg_stat_statements` (já habilitado nos providers gerenciados):

```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## 3. O que mudou?

Detecção de mudança quando comportamento muda de hora para outra.

### Audit log

Toda mutação de domínio e evento de auth gera 1 linha em `audit_log` (90 dias de retenção). Investigação ponta-a-ponta começa pelo `request_id` capturado nos logs:

```sql
-- Investigar partindo de um request_id
SELECT * FROM audit_log WHERE request_id = 'req_…';

-- Ações do usuário X nos últimos 7 dias
SELECT * FROM audit_log
WHERE user_id = '<uuid>' AND created_at >= now() - interval '7 days'
ORDER BY created_at DESC;

-- Histórico da entidade
SELECT * FROM audit_log
WHERE entity_type = 'book' AND entity_id = '<book-id>'
ORDER BY created_at DESC;
```

Use Supabase Studio, Drizzle Studio (`bunx --bun drizzle-kit studio`) ou TablePlus para navegar visualmente. Sem endpoint REST público — consulta direta no banco.

Catálogo completo de `action` em [src/lib/audit/audit-actions.ts](../src/lib/audit/audit-actions.ts).

### Sentry — release diff

Sentry agrupa eventos por `release` (que carrega o `APP_VERSION` da build). Em `Issues → group by release` é possível ver "este erro só aparece a partir de v1.2.3". `request_id` aparece como tag no evento — clique pra correlacionar com o log estruturado.

### Vercel — deployment history

`vercel ls` ou painel da Vercel mostra cada deploy com SHA, timestamp e autor. Use para correlacionar com o "começou a falhar às X horas".

---

## 4. Que ação tomar?

Playbook curto para os incidents mais comuns.

| Sintoma | Primeiro passo |
|---|---|
| `/api/health` retorna 503 e DB está down | Verificar status do provider (Supabase/Neon page). Se for problema deles: aguardar; se for limit: aumentar plano ou aplicar rate-limit no app. |
| Spike de error rate no Sentry após deploy | `vercel rollback` para a versão anterior (zero downtime). Investigar offline. |
| Rota lenta sustentada (slow=true frequente) | Rodar `EXPLAIN ANALYZE` na query principal. Adicionar índice se necessário. Verificar contagem de queries (N+1). |
| Conexões do Postgres no limite | Reduzir `connectionLimit` no `pg` Pool ou aumentar plano. Investigar leaks de conexão (transações longas). |
| Erro `audit.best_effort_failed` no log | Best-effort, não bloqueia auth. Verificar se DB está saudável; se sim, investigar o erro específico no log. |
| Cron `purge-audit-log` retorna 401 | `CRON_SECRET` no Vercel não bate com o configurado. Regenerar e atualizar `vercel.json`. |
| Cron retorna `purged: 0` há vários dias | Sem dados velhos para apagar — esperado. Confirmar com `SELECT min(created_at) FROM audit_log`. |

---

## Quotas do free tier (revisar trimestralmente)

| Serviço | Limite gratuito | Como monitorar |
|---|---|---|
| Vercel | 100 GB-h compute/mês, 100k invocations/dia | Vercel Dashboard → Usage |
| Sentry | 5k erros/mês | Sentry Dashboard → Quota |
| UptimeRobot | 50 monitors, 5 min interval | UptimeRobot Account |
| Supabase | 500 MB DB, 2 GB transfer | Project → Settings → Usage |
| Neon | 191.9 compute-h/mês, 0.5 GB | Project Dashboard |

Sinal de "está se aproximando do limite": qualquer métrica > 80% do plano. Plano de ação inclui upgrade ou otimização (cache, paginação, BRIN onde aplicável).

---

## Apêndice — Anonimização LGPD

Procedimento descrito em [docs/deploy.md — apêndice LGPD](./deploy.md#apêndice--anonimização-lgpd-do-audit-log). Resumo: `audit_log.user_id` é denormalizado (sem FK) e nunca contém PII além do UUID; em hard-delete de conta o `user_id` pode ser substituído por `NULL` via UPDATE direto, preservando a trilha de ações sem identificar o ex-usuário.
