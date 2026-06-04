# Data Model: Backup Diário do Banco de Produção

**Feature**: `030-weekly-db-backup` | **Date**: 2026-06-03

Esta feature **não altera o schema PostgreSQL** nem adiciona entidades de domínio na aplicação. As "entidades" são operacionais — vivem no bucket R2, no GitHub Actions e no Sentry. Documentadas aqui como contrato de dados operacional.

## Artefato de backup (objeto no R2)

| Atributo | Valor / Regra |
|----------|---------------|
| Key | `backups/audiobook-track-<UTC-timestamp>.dump` |
| Timestamp | `date -u +%Y-%m-%dT%H-%M-%SZ` — único por execução, sem colisão agendado×manual |
| Formato | `pg_dump --format=custom --compress=9` (estrutura + dados, restauração completa e seletiva) |
| Tamanho mínimo | ≥ 10 KB (10240 bytes) — tripwire para vazio/truncado (FR-005); recalibrado após medição real |
| Tamanho real medido | ~32 KB comprimido (base atual ~8,4 MB de `pg_database_size` é majoritariamente catálogo/índices, não dados) |
| Origem | PostgreSQL 16.14 (Neon, direct connection) |
| Compatibilidade de restore | PostgreSQL ≥ 16 (FR-014) |
| Ciclo de vida | Criado 1×/dia (cron) ou sob demanda (dispatch) → verificado round-trip na mesma execução → expirado server-side aos 90 dias |
| Estado de validade | Um objeto só é considerado backup válido se a execução que o criou terminou em sucesso (restore verificado). Artefatos de execuções falhas podem existir no bucket, mas a execução correspondente está marcada como falha |

## Bucket R2

| Atributo | Valor |
|----------|-------|
| Nome | `audiobook-track-backups` (definido na criação — runbook) |
| Prefixo de dados | `backups/` (delimita a lifecycle rule) |
| Lifecycle rule 1 | Delete objects sob `backups/` após 90 dias |
| Lifecycle rule 2 | Abort incomplete multipart uploads após 7 dias (default mantida) |
| Criptografia | At-rest do provedor (AES-256) — sem client-side (decisão da spec) |
| Acesso | Exclusivamente via API token S3 escopado a este único bucket (Object Read & Write) |
| Capacidade em regime | ~91 objetos ≈ 270 MB ≪ 10 GB (cota free) |

## Secrets (GitHub Actions — repositório)

| Secret | Conteúdo | Validação no workflow |
|--------|----------|----------------------|
| `DATABASE_URL` | Direct connection string do Neon (`sslmode=require`, host **sem** `-pooler`) | Guarda: falha se host contém `-pooler` (FR-006) |
| `R2_ACCESS_KEY_ID` | Access Key do API token S3 escopado ao bucket | — |
| `R2_SECRET_ACCESS_KEY` | Secret Key do mesmo token | — |
| `R2_BUCKET` | Nome do bucket | — |
| `R2_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` | — |
| `SENTRY_CRON_URL` | URL de check-in do monitor `backup-db` | — |

Regras (FR-011): nenhum desses valores aparece em código, logs ou nome de artefato; o token R2 é escopado **somente** ao bucket de backup; rotação documentada no runbook.

## Monitor Sentry Crons

| Atributo | Valor |
|----------|-------|
| Slug | `backup-db` |
| Schedule | `0 6 * * *` (UTC) — espelha o cron do workflow |
| Check-in margin | 120 min (tolerância antes de alertar ausência) |
| Max runtime | 30 min (job tem `timeout-minutes: 15`) |
| Timezone | UTC |
| Alertas | Failure + missed check-in → e-mail do operador |
| Check-ins | `in_progress` (início) → `ok` (sucesso) \| `error` (falha) |
| Cota | 1 cron monitor (free tier) — este é o único do projeto |

## Estados de uma execução de backup

```
                    ┌──────────────────────────────────────────────┐
agendamento/dispatch → check-in in_progress → guarda anti-pooler   │
                    │  → pg_dump → upload R2 → download round-trip │
                    │  → piso 10KB → pg_restore --list             │
                    │  → restore em postgres:17 → sanity queries   │
                    └──────────────────────────────────────────────┘
                          │ tudo OK                      │ qualquer etapa falha
                          ▼                              ▼
                 check-in ok → SUCESSO          check-in error → FALHA
                                                (status vermelho no Actions
                                                 + alerta Sentry)

  nenhuma execução na janela esperada + margem → alerta "missed check-in"
  (dead man's switch — cobre auto-disable de 60 dias, workflow removido, etc.)
```

Invariantes (mapeiam FRs):
- Nenhum caminho declara sucesso sem restore verificado do artefato baixado do R2 (FR-005, SC-003).
- Nenhum caminho de falha é silencioso: ou check-in `error` chega ao Sentry, ou check-in nenhum chega e a ausência alerta (FR-007, FR-008).
- A guarda anti-pooler roda **antes** de qualquer geração de artefato (FR-006).
