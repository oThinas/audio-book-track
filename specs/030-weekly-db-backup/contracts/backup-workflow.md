# Contract: `.github/workflows/backup-db.yml`

**Feature**: `030-weekly-db-backup` | **Date**: 2026-06-03

Contrato do workflow de backup — a "interface externa" desta feature. O implementador (`/speckit-implement`) DEVE produzir um workflow que satisfaça este contrato; o YAML exato é detalhe de implementação.

## Triggers

| Trigger | Config | FR |
|---------|--------|-----|
| `schedule` | cron `0 6 * * *` (06:00 UTC = 03:00 BRT, diário) | FR-001 |
| `workflow_dispatch` | sem inputs | FR-009 |

Scheduled runs executam da branch `main` (regra do GitHub). O cron só arma após o merge.

## Permissões e concorrência

```yaml
permissions: {}           # pipeline não usa checkout nem GITHUB_TOKEN — zero permissões
concurrency:
  group: backup-db
  cancel-in-progress: false   # serializa, nunca cancela backup em andamento
```

Job único, `runs-on: ubuntu-latest`, `timeout-minutes: 15`.

## Service container

`postgres:17` com `POSTGRES_USER: postgres`, `POSTGRES_PASSWORD: postgres`, **`POSTGRES_DB: verify`** + health-check `pg_isready` (mesmo padrão de `pr-checks.yml`, trocando imagem e nome do banco). Banco descartável `verify` usado exclusivamente pela verificação de restauração — o step 9 restaura em `postgresql://postgres:postgres@localhost:5432/verify`. **Major do container DEVE ser ≥ major do client `pg_restore` (17)**: `pg_restore` 17 emite `SET transaction_timeout` (GUC do PG 17) que um target 16 rejeita sob `--exit-on-error` — falha real observada no run 26924745370.

## Secrets consumidos

`DATABASE_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `SENTRY_CRON_URL` — ver data-model.md. Nenhum valor pode ser ecoado em log.

## Env de compatibilidade R2 (todas as chamadas `aws`)

```bash
AWS_REQUEST_CHECKSUM_CALCULATION=when_required
AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
AWS_DEFAULT_REGION=auto
```

## Pipeline de steps (ordem e semântica de falha)

| # | Step | Comportamento exigido | FR |
|---|------|----------------------|-----|
| 1 | Check-in `in_progress` | `curl "$SENTRY_CRON_URL?status=in_progress"` com `\|\| true` (telemetria não derruba backup) | FR-008 |
| 2 | Guarda anti-pooler | Host da `DATABASE_URL` contém `-pooler` → `exit 1` com `::error::` acionável, ANTES de gerar artefato | FR-006 |
| 3 | Instalar client PG 17 | PGDG (`apt.postgresql.org.sh`) + `postgresql-client-17`; `pg_dump --version` ecoado | R1 |
| 4 | `pg_dump` | `--format=custom --compress=9 --file=<artefato>` contra `DATABASE_URL`; falha do comando = falha do job | FR-003 |
| 5 | Upload | `aws s3 cp <artefato> s3://$R2_BUCKET/backups/audiobook-track-<UTC-ts>.dump --endpoint-url $R2_ENDPOINT` | FR-002 |
| 6 | Download round-trip | `aws s3 cp` do MESMO objeto de volta para um caminho distinto | FR-005 |
| 7 | Piso de tamanho | Arquivo baixado < 10240 bytes → `exit 1` (tripwire vazio/truncado; calibrado com dump real de ~32 KB) | FR-005 |
| 8 | TOC check | `pg_restore --list` no arquivo baixado; falha = job falha | FR-005 |
| 9 | Restore verify | `pg_restore --no-owner --no-privileges --exit-on-error -d postgresql://...@localhost:5432/verify` (service container) | FR-005 |
| 10 | Sanity queries | `pg_tables` public ≥ 8; `__drizzle_migrations` ≥ 1; `"user"` ≥ 1 — qualquer uma reprovando → `exit 1` | FR-005 |
| 11 | Check-in `ok` | `curl -sf "$SENTRY_CRON_URL?status=ok"` SEM `\|\| true` — Sentry fora = job falha (sem sucesso não monitorado) | FR-008 |
| 12 | Check-in `error` | Step separado com `if: failure()`, `curl ... ?status=error \|\| true` | FR-007/008 |

Timestamp gerado uma única vez no início (`date -u +%Y-%m-%dT%H-%M-%SZ`) e compartilhado entre steps via `$GITHUB_OUTPUT` ou env — upload e download referenciam o MESMO objeto.

## Critérios de aceitação do contrato

- [ ] Execução feliz termina verde com check-in `ok` enviado e objeto verificado no bucket.
- [ ] `DATABASE_URL` pooled → falha no step 2, nenhum artefato gerado, check-in `error` enviado.
- [ ] Objeto corrompido/incompleto no bucket → falha nos steps 7-10, check-in `error` enviado.
- [ ] Duas execuções disparadas juntas → serializam (concurrency group), dois objetos distintos.
- [ ] Nenhum secret visível em nenhum log de step.
- [ ] Workflow ausente do schedule por > margem → alerta missed check-in no Sentry (verificável pausando o monitor… ou aguardando o primeiro gap real).

## Fora do contrato (delegado ao runbook `docs/backup.md`)

Setup do bucket/token/lifecycle (config única manual), criação do monitor Sentry, procedimento de restore manual, rotação de credenciais, monitoramento de cota e gatilho de reavaliação (~500 MB).
