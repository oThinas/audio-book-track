# Quickstart: Backup Diário do Banco de Produção

**Feature**: `030-weekly-db-backup` | **Date**: 2026-06-03

Ordem de implantação ponta-a-ponta. Os passos 1-3 são **pré-requisitos do merge** — o primeiro dispatch só funciona com tudo configurado.

## 1. Cloudflare R2 (config única, manual)

1. Criar conta em [dash.cloudflare.com](https://dash.cloudflare.com) (não existe ainda).
2. Habilitar R2 (exige cartão de crédito mesmo no free tier — 10 GB, zero egress; volume projetado ~270 MB).
3. Criar bucket `audiobook-track-backups` (location: automático).
4. **R2 → Manage R2 API Tokens → Create API Token**: permissão **Object Read & Write**, escopo **somente este bucket**. Anotar `Access Key ID`, `Secret Access Key` e o endpoint `https://<account_id>.r2.cloudflarestorage.com`.
5. **Bucket → Settings → Object lifecycle rules**:
   - Regra: prefix `backups/` → delete objects após **90 dias**.
   - Manter a regra default de abort multipart uploads (7 dias).

## 2. Sentry Cron Monitor (config única, manual)

1. Sentry → projeto existente → **Crons → Add Monitor**:
   - Slug: `backup-db` | Schedule: `0 6 * * *` | Timezone: UTC
   - Check-in margin: 120 min | Max runtime: 30 min
   - Alertas de failure + missed check-in → e-mail do operador.
2. Copiar a URL de check-in HTTP do monitor (formato `https://o<org>.ingest.<region>.sentry.io/api/<project>/cron/backup-db/<key>/`).

## 3. Secrets no GitHub (repo → Settings → Secrets and variables → Actions)

| Secret | Valor |
|--------|-------|
| `DATABASE_URL` | **Direct** connection string do Neon (host SEM `-pooler`, `sslmode=require`) |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Token do passo 1.4 |
| `R2_BUCKET` | `audiobook-track-backups` |
| `R2_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |
| `SENTRY_CRON_URL` | URL do passo 2.2 |

```bash
GITHUB_TOKEN='' gh secret set DATABASE_URL   # cola o valor no prompt
# idem para os demais
```

## 4. Merge + primeira execução

```bash
# após merge do PR em main:
GITHUB_TOKEN='' gh workflow run backup-db.yml
GITHUB_TOKEN='' gh run watch
```

Verificar: run verde no Actions, objeto em `backups/` no dashboard do R2, check-in `ok` no monitor Sentry.

## 5. Teste de restore manual (FR-013 — gate de entrega)

Seguir `docs/backup.md` do zero, sem atalhos: baixar o artefato mais recente, restaurar em Postgres 16 local descartável (Docker), rodar as verificações de integridade e **registrar no runbook** data, artefato e resultado. Backup sem restore testado não conta como backup.

## Validação dos cenários da spec

| Cenário | Como exercitar |
|---------|----------------|
| US1: backup diário automático | Aguardar primeiro cron (03:00 BRT) após merge |
| US1: dispatch manual | Passo 4 |
| US1: guarda anti-pooler | Trocar temporariamente o secret pela string pooled → dispatch → falha imediata acionável → restaurar secret |
| US2: round-trip verify | Inspecionar log do run: download + restore + sanity queries antes do check-in `ok` |
| US2: runbook validado | Passo 5 |
| US3: dead man's switch | Pausar o workflow (`gh workflow disable`) por 1 dia em ambiente controlado → alerta missed check-in → reabilitar |
| US4: retenção | Conferir lifecycle rule no dashboard; auditoria de contagem após 90 dias de regime |
