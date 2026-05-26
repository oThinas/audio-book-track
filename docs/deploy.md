# Runbook de Deploy — AudioBook Track

> Runbook canônico para o **primeiro deploy** e para os deploys subsequentes em produção. Cobre provisionamento de infraestrutura, configuração de observabilidade (Sentry, monitor de uptime, Vercel Cron), variáveis de ambiente, smoke tests pós-deploy e procedimento de rollback. Atende ao FR-023 da feature [029-production-observability](../specs/029-production-observability/spec.md).

**Audiência**: dev/operador solo. Sequência linear — executar de cima para baixo na primeira vez; depois, consultar seções pontualmente.

**Plataforma alvo**: Vercel (Hobby ou Pro) + Postgres gerenciado (Supabase ou Neon) + Sentry (free tier) + UptimeRobot (free tier).

---

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Provisionamento de infraestrutura](#2-provisionamento-de-infraestrutura)
3. [Configuração das variáveis de ambiente](#3-configuração-das-variáveis-de-ambiente)
4. [Configuração do Sentry e source maps](#4-configuração-do-sentry-e-source-maps)
5. [Configuração do Vercel Cron (purga do audit log)](#5-configuração-do-vercel-cron-purga-do-audit-log)
6. [Configuração do monitor externo de uptime](#6-configuração-do-monitor-externo-de-uptime)
7. [Primeiro deploy](#7-primeiro-deploy)
8. [Verificação pós-deploy (smoke tests)](#8-verificação-pós-deploy-smoke-tests)
9. [Deploys subsequentes](#9-deploys-subsequentes)
10. [Rollback](#10-rollback)
11. [Production readiness checklist](#11-production-readiness-checklist)

---

## 1. Pré-requisitos

- Conta Vercel (Hobby grátis ou Pro).
- Conta no provedor de Postgres escolhido (Supabase ou Neon — ambos têm tier gratuito ≥ 500MB).
- Conta Sentry (free tier — até 5k erros/mês).
- Conta UptimeRobot ou BetterStack (free tier — 1 monitor a cada 5min).
- CLI instaladas localmente: `vercel`, `gh`, `bun` (já em uso no projeto).
- Branch `main` mergeada com a feature 029 e o build local passando (`bun run build`).
- Domínio (opcional na primeira semana — Vercel fornece um `*.vercel.app` automaticamente).

---

## 2. Provisionamento de infraestrutura

### 2.1. Provedor de Postgres (escolher 1)

**Opção A — Supabase** (recomendado: UI rica para investigação, integração de auth não usada aqui mas presente).

1. Criar projeto em `supabase.com/dashboard` → região `South America (São Paulo)` se disponível, senão `US East`.
2. Anotar a **Connection string (Direct connection — port 5432)** para migrations e a **Connection string (Pooler — port 6543)** para o app em runtime.
3. Habilitar a extensão `pgcrypto` no SQL Editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```
   (Necessária para `gen_random_uuid()` usado pela `audit_log`.)

**Opção B — Neon**.

1. Criar projeto em `console.neon.tech`.
2. Pegar a connection string (Neon já entrega com pooling embutido — uma URL só).
3. `pgcrypto` já vem habilitada por padrão.

### 2.2. Projeto Vercel

1. `vercel login` (terminal local).
2. Da raiz do repositório:
   ```bash
   vercel link
   ```
   Escolher: criar projeto novo, nome `audio-book-track`, scope pessoal/organização.
3. Confirmar que o framework detectado é Next.js.
4. **Não** fazer deploy ainda — configurar variáveis antes (Seção 3).

### 2.3. Projeto Sentry

1. Criar projeto em `sentry.io` → plataforma `Next.js`.
2. Anotar:
   - `SENTRY_DSN` (URL pública usada pelo runtime).
   - `SENTRY_ORG` (slug da organização).
   - `SENTRY_PROJECT` (slug do projeto recém-criado).
3. Em `Settings → Auth Tokens` → criar token com escopo `project:releases` + `org:read` + `project:write`. Anotar como `SENTRY_AUTH_TOKEN` — usado **apenas no build** para upload de source maps.

---

## 3. Configuração das variáveis de ambiente

Adicionar no painel da Vercel (`Project Settings → Environment Variables`). **Escopo `Production`** para todas, exceto onde indicado.

| Variável | Origem | Escopo | Obrigatória |
|---|---|---|---|
| `DATABASE_URL` | Pooler string do Postgres (Supabase 6543 / Neon) | Production + Preview | ✅ |
| `TEST_DATABASE_URL` | (não setar em prod — só local/CI) | — | ❌ em prod |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | Production + Preview | ✅ |
| `BETTER_AUTH_URL` | `https://<seu-domínio>` (sem trailing slash) | Production | ✅ |
| `SENTRY_DSN` | Sentry (passo 2.3) | Production | ✅ (FR-017) |
| `SENTRY_ORG` | Sentry (passo 2.3) | Production (build) | ✅ |
| `SENTRY_PROJECT` | Sentry (passo 2.3) | Production (build) | ✅ |
| `SENTRY_AUTH_TOKEN` | Sentry (passo 2.3) | Production (build) | ✅ (FR-019) |
| `CRON_SECRET` | `openssl rand -hex 32` | Production | ✅ (FR-011 + D14) |
| `APP_VERSION` | git commit SHA — preencher via `vercel env` no CI ou usar `VERCEL_GIT_COMMIT_SHA` automaticamente | Production | ⚠️ opcional |
| `E2E_TEST_MODE` | (não setar em prod) | — | ❌ em prod |

**Validação no startup (fail-fast)**: o schema Zod em `src/lib/env/schema.ts` faz `superRefine` exigindo `SENTRY_DSN` + `CRON_SECRET` quando `NODE_ENV=production`. Se faltar, o build do Vercel quebra antes de ir para prod — comportamento intencional (`/deployment-patterns` checklist).

**Impacto de cada variável se ausente em prod**:

- `DATABASE_URL` ausente → app não sobe.
- `BETTER_AUTH_SECRET` ausente → sessões inválidas, ninguém loga.
- `SENTRY_DSN` ausente → erros não chegam ao Sentry (build falha por `superRefine`).
- `SENTRY_AUTH_TOKEN` ausente no build → source maps não são uploaded; stack traces em prod ficam minificados.
- `CRON_SECRET` ausente → endpoint `/api/cron/purge-audit-log` retorna 401 para qualquer chamada; audit log nunca purga (cresce indefinidamente até intervenção manual).

---

## 4. Configuração do Sentry e source maps

### 4.1. Arquivos canônicos (já no repositório após implementação da 029)

- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `next.config.ts` (envolvido por `withSentryConfig`)
- `instrumentation.ts` (registra Sentry no boot)

Todos seguem o template oficial de `@sentry/nextjs`. Validar antes do primeiro deploy:

```bash
grep -l "withSentryConfig\|@sentry/nextjs" next.config.ts sentry.*.config.ts instrumentation.ts
```

### 4.2. Configuração de sampling (D12)

- `tracesSampleRate: 0` — **sem APM** (estouraria free tier).
- `sampleRate: 1.0` — **100% dos erros** capturados.
- `enabled: process.env.NODE_ENV === "production"` — desligado em dev.
- `beforeSend(event)` filtra `DomainError` (erros esperados de domínio, não vão pro Sentry).

### 4.3. Source maps

Upload automático pelo `withSentryConfig` no build de produção. Validar manualmente após o primeiro deploy:

1. Provocar erro controlado em prod (ver Seção 8.4).
2. Abrir o evento no Sentry → ver "Source Map: ✓".
3. Stack trace deve mostrar nome de arquivo e linha originais (`src/lib/services/...`), não `chunks/abc123.js:1:42`.

Se source maps não chegarem: checar `SENTRY_AUTH_TOKEN` + escopo do token. Logs do build Vercel mostram a etapa de upload.

---

## 5. Configuração do Vercel Cron (purga do audit log)

`vercel.json` na raiz do repositório (criado pela feature 029):

```json
{
  "crons": [
    {
      "path": "/api/cron/purge-audit-log",
      "schedule": "0 3 * * *"
    }
  ]
}
```

- Schedule é **UTC**: `0 3 * * *` = 03:00 UTC ≈ 00:00 BRT (justificativa em D5).
- Vercel envia `Authorization: Bearer <CRON_SECRET>` automaticamente — o endpoint valida com `crypto.timingSafeEqual`.
- Hobby plan: até 2 crons diários. Esta feature usa 1, sobra 1.

**Validação após o deploy**:

1. `Project Settings → Cron Jobs` no painel Vercel — deve listar o job.
2. Botão "Run now" no painel — dispara manualmente e mostra resposta 200 + corpo `{ purged: N, cutoff, duration_ms }`.
3. Em caso de erro, o painel mostra o status code e o corpo de erro do endpoint.

---

## 6. Configuração do monitor externo de uptime

### 6.1. UptimeRobot (free tier)

1. Conta em `uptimerobot.com`.
2. `+ Add New Monitor` → tipo `HTTPS`, URL `https://<seu-domínio>/api/health`, intervalo `5 minutes` (mínimo do free tier).
3. Em `Alert Contacts` → adicionar email (e/ou Slack, Discord) — esse é o canal de notificação quando o app cai.
4. Em configurações do monitor → `Keyword` opcional: `"status":"ok"`. Faz o monitor disparar mesmo quando o app retorna 503 com payload válido.
5. Salvar.

### 6.2. Alternativa — BetterStack (free tier)

Equivalente; UI mais moderna. Mesmo princípio.

### 6.3. Validação

Para validar o monitor antes do tráfego real:

1. Tirar manualmente o app do ar (pausar deployment no Vercel ou bloquear o Postgres).
2. Aguardar 2 minutos.
3. Confirmar que a notificação chega no canal configurado em < 5 minutos do início da queda (SC-005).
4. Religar o app — confirmar notificação de "recovered".

---

## 7. Primeiro deploy

```bash
# 1. Aplicar migrations no Postgres de produção
DATABASE_URL='<production-direct-connection-string>' bun run db:migrate

# 2. Confirmar que a tabela audit_log existe e os 4 índices estão criados
psql '<production-direct-connection-string>' -c "\d audit_log"

# 3. Deploy
vercel --prod

# 4. Aguardar build (3–5 min). Acompanhar logs:
vercel logs --prod --follow

# 5. Confirmar URL final
vercel inspect --logs <deployment-url>
```

**Sinais de sucesso no build**:
- Etapa `Linting and checking validity of types` passou.
- Etapa `Creating an optimized production build` passou.
- Etapa Sentry: linhas tipo `Uploaded source maps for release <SHA>`.
- Status final `Deployment ready`.

### 7.1. Provisionar usuários iniciais

Como `signUp` público está desabilitado em produção (FR-005 + better-auth `disableSignUp`), é necessário criar os primeiros usuários por script. Usa o mesmo fluxo do `signUpEmail` que o login consome, então a hash de senha e o plugin `username` ficam idênticos aos do runtime.

**Pré-requisitos**:
- `DATABASE_URL` de produção (use a **direct connection string**, não a pooled — Drizzle usa prepared statements).
- `BETTER_AUTH_URL` e `BETTER_AUTH_SECRET` idênticos aos configurados na Vercel.

**Gerar senhas fortes**:
```bash
openssl rand -base64 18 | tr -d '/+='
```

**Rodar — 1 invocação por usuário** (idempotente; re-rodar com o mesmo email é seguro):
```bash
export DATABASE_URL='postgres://...prod-direct...'
export BETTER_AUTH_URL='https://<seu-domínio>.vercel.app'
export BETTER_AUTH_SECRET='<mesmo valor da Vercel>'

bun run db:seed:prod-users \
  --email thiago@coodex.ai \
  --username thinas \
  --name "Thiago Prado" \
  --password '<senha-1>'

bun run db:seed:prod-users \
  --email cliente1@dominio.com \
  --username cliente1 \
  --name "Cliente 1" \
  --password '<senha-2>'

bun run db:seed:prod-users \
  --email cliente2@dominio.com \
  --username cliente2 \
  --name "Cliente 2" \
  --password '<senha-3>'

unset DATABASE_URL BETTER_AUTH_URL BETTER_AUTH_SECRET
```

**Dicas de segurança**:
- Rodar `set +o history` (bash/zsh) antes de colar senhas, ou exportar via `.env` temporário e apagar depois.
- Validações do plugin: `username` 3–30 chars; senha mínimo 8 chars (better-auth padrão).
- Confirmar no banco: `SELECT email, username FROM "user" ORDER BY created_at DESC;`.

Implementação: [`scripts/seed-prod-users.ts`](../scripts/seed-prod-users.ts).

---

## 8. Verificação pós-deploy (smoke tests)

Executar **em ordem** após o `Deployment ready`. Mantém checklist em [`quickstart.md`](../specs/029-production-observability/quickstart.md) sincronizado.

### 8.1. Health check responde 200

```bash
curl -i https://<seu-domínio>/api/health
# Esperado: 200 OK + payload { status: "ok", uptime_seconds, app_version, checks.database.status: "ok" }
```

### 8.2. Login + mutação geram log estruturado e audit

1. Fazer login pela UI.
2. Disparar uma mutação simples (criar Studio, por exemplo).
3. Capturar o `X-Request-Id` da resposta (DevTools → Network).
4. **Vercel UI** → `Logs` → filtrar por `<request-id>`. Deve aparecer linha JSON contendo `method`, `path`, `status`, `duration_ms`, `user_id`, `request_id`.
5. **Supabase/Neon UI** → SQL Editor:
   ```sql
   SELECT * FROM audit_log WHERE request_id = '<request-id>';
   ```
   Deve retornar 1 linha com `action='studio.create'`.

### 8.3. Source maps funcionam (Sentry)

1. Provocar um erro server-side controlado em prod — caminho recomendado: criar branch curta com `throw new Error("smoke test")` em um endpoint behind feature flag, deployar em preview (não em prod), validar evento no Sentry, descartar branch.
2. Abrir o evento no Sentry → conferir que a stack trace mostra `src/...` com número de linha original.

### 8.4. Cron de purga executa

1. Vercel painel → `Cron Jobs` → `purge-audit-log` → botão `Run now`.
2. Resposta esperada: 200 com `{ purged: 0, cutoff, duration_ms }` (na primeira execução não há linhas > 90 dias).
3. Verificar no Sentry/Vercel Logs que não houve erro 500 nem rejeição 401.

### 8.5. Monitor externo confirma uptime

- UptimeRobot dashboard deve mostrar `Up` para `https://<seu-domínio>/api/health`.

### 8.6. Postgres provider mostra conexões saudáveis

- Supabase UI → `Database → Connection Pool` ou Neon UI → `Operations` deve mostrar latência baixa e poucas conexões abertas (≤ 5 em uso normal).

**Se algum item de 8.1–8.6 falhar**: investigar antes de seguir. Não anunciar o app até a smoke test estar verde.

---

## 9. Deploys subsequentes

Fluxo padrão:

```bash
# 1. PR mergeado em main automaticamente dispara preview deploy via Vercel GitHub integration.
# 2. Validar preview localmente:
curl -i https://<preview-url>/api/health

# 3. Promover preview a produção:
vercel --prod   # ou via UI: "Promote to Production"

# 4. Se a mudança incluir migration:
DATABASE_URL='<production-direct-connection-string>' bun run db:migrate
# ⚠️ rodar ANTES de promover o deploy se a migration adiciona coluna NOT NULL ou DROP coluna usada pelo código antigo.
# ⚠️ rodar DEPOIS se a migration é puramente aditiva (ex: nova tabela como audit_log) — código antigo não a referencia.
```

**Regras de migration backward-compatible** (`/deployment-patterns`):

- ADD COLUMN nullable → seguro deployar app antes ou depois.
- ADD COLUMN NOT NULL com default → deployar migration antes do app.
- DROP COLUMN → deployar app sem o uso da coluna antes da migration.
- RENAME COLUMN → preferir 3 passos (add new, dual-write, drop old) em vez de rename direto.
- Sempre testar migration em preview/staging com dados representativos antes de prod.

---

## 10. Rollback

Quando algo dá errado em prod (erro spike no Sentry, queda no UptimeRobot, bug funcional crítico).

### 10.1. Rollback de código (rápido — < 1 min)

```bash
# Listar deployments recentes
vercel ls

# Promover deployment anterior a produção
vercel rollback <deployment-url-anterior>
```

Ou pela UI: `Deployments → <versão anterior> → ... → Promote to Production`.

### 10.2. Rollback de migration

**Só faça** se a migration nova é incompatível com o código antigo e o rollback de código já foi aplicado.

```bash
# Drizzle não tem rollback automático — usar o SQL down.sql gerado em drizzle/migrations/<n>_*/down.sql
DATABASE_URL='<production-direct-connection-string>' psql -f drizzle/migrations/<n>_*/down.sql

# Confirmar estado
DATABASE_URL='<production-direct-connection-string>' psql -c "SELECT * FROM __drizzle_migrations ORDER BY id DESC LIMIT 3;"
```

⚠️ Migrations destrutivas (DROP TABLE, DROP COLUMN com dados) **não têm rollback seguro**. Restaurar via backup do provedor:

- Supabase Pro: `Database → Backups → Restore`.
- Neon Pro: `Branches → Restore from point-in-time`.
- Free tier: **não há backup** confiável — evitar destrutivas em prod sem dump manual prévio.

### 10.3. Pós-rollback

1. Anotar no Sentry o intervalo de tempo problemático.
2. Investigar via `request_id` (audit log + Vercel logs + Sentry).
3. Abrir PR de fix; deployar via fluxo da Seção 9.

---

## 11. Production readiness checklist

Checklist consolidado do `/deployment-patterns` adaptado à realidade Vercel + Next.js + Postgres gerenciado. Marcar **antes** de cada deploy importante (primeiro deploy + qualquer mudança de schema ou auth).

### 11.1. Aplicação

- [ ] `bun run lint` zero warnings.
- [ ] `bun run test:unit` + `test:integration` + `test:e2e` verdes.
- [ ] `bun run build` localmente sem erro.
- [ ] Nenhum `console.log` adicionado (`serverLogger` é o canal estruturado).
- [ ] Nenhum segredo hardcoded — apenas env vars.
- [ ] `withApiErrorHandler` cobre todas as rotas `/api/v1/**` novas.
- [ ] `/api/health` retorna payload conforme contrato (Seção 8.1).

### 11.2. Infraestrutura

- [ ] Migrations testadas em preview antes de prod (Seção 9).
- [ ] Env vars conferidas (Seção 3) — incluindo escopo (Production vs Preview).
- [ ] `pgcrypto` habilitada no Postgres de prod.
- [ ] Pool de conexões dimensionado: Supabase Pooler ou Neon (default ~ 100 conexões — suficiente para Vercel serverless até ~10k req/min).
- [ ] SSL/TLS automático (Vercel default).

### 11.3. Monitoring

- [ ] Sentry recebendo eventos (Seção 8.3).
- [ ] Source maps de-minificando stack traces (Seção 8.3).
- [ ] Logs estruturados aparecem na Vercel UI (Seção 8.2).
- [ ] Audit log gravando mutações (Seção 8.2).
- [ ] UptimeRobot/BetterStack monitorando `/api/health` (Seção 8.5).
- [ ] Vercel Cron `purge-audit-log` listado e idempotente (Seção 8.4).

### 11.4. Segurança

- [ ] `CRON_SECRET` rotacionado quando alguém com acesso ao painel Vercel sair do projeto.
- [ ] `BETTER_AUTH_SECRET` rotacionado periodicamente (≥ 1×/ano).
- [ ] Rate limit do better-auth ligado em produção (`E2E_TEST_MODE` **não** setado).
- [ ] CORS implícito do Next.js permanece restrito a same-origin (não há rota cross-origin nesta app).

### 11.5. Operações

- [ ] Este runbook está atualizado para a configuração atual.
- [ ] `docs/observability.md` documenta onde olhar cada sinal (FR-022).
- [ ] Rollback de código já foi simulado pelo menos uma vez (Seção 10.1).
- [ ] Catálogo `AUDIT_ACTIONS` versionado no código — qualquer adição precisa de PR.

---

## Apêndice — Anonimização LGPD do audit log

Quando solicitado por usuário (direito ao esquecimento), executar manualmente no Postgres de prod:

```sql
-- Substituir user_id do usuário pelo placeholder fixo "deleted-user"
UPDATE audit_log
SET user_id = '00000000-0000-0000-0000-000000000000'
WHERE user_id = '<user-uuid-to-anonymize>';

-- Confirmar
SELECT COUNT(*) FROM audit_log WHERE user_id = '<user-uuid-to-anonymize>';
-- → deve ser 0
```

Esta operação **não** é coberta por feature automatizada. Vira feature dedicada quando houver primeiro pedido real (FR-029-spec/assumptions).
