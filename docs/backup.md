# Backup e Restore do Banco de Produção

> Runbook operacional do backup diário do PostgreSQL de produção.
> Workflow: [.github/workflows/backup-db.yml](../.github/workflows/backup-db.yml) ·
> Especificação: [specs/030-weekly-db-backup/](../specs/030-weekly-db-backup/spec.md)

---

## 1. Visão geral

| Item | Valor |
|---|---|
| **Cadência** | Diária — cron `0 6 * * *` UTC = **03:00 em Brasília** (sem DST no Brasil atualmente) |
| **Mecanismo** | GitHub Actions agendado → `pg_dump --format=custom --compress=9` → upload para Cloudflare R2 |
| **Destino** | Bucket R2 `audiobook-track-backups`, prefixo `backups/` |
| **Nome do artefato** | `backups/audiobook-track-<UTC-timestamp>.dump` (ex: `audiobook-track-2026-06-04T06-00-12Z.dump`) |
| **Retenção** | 90 dias (lifecycle do bucket) ≈ 90 dumps em rotação |
| **RPO** | ≤ 24 horas |
| **Verificação** | Round-trip em **toda** execução: o objeto é baixado de volta do R2 e restaurado em um Postgres descartável, com sanity queries — só então a execução conta como sucesso |
| **Dead man's switch** | Sentry Cron Monitor `backup-db` — alerta em falha E em ausência de execução |
| **Disparo manual** | `GITHUB_TOKEN='' gh workflow run backup-db.yml` (ex: antes de migração arriscada) |
| **Custo** | R$ 0 — free tiers (R2 10 GB / ~270 MB projetados; repo público = Actions ilimitado; Sentry 1 cron monitor) |

**Princípio**: backup sem restore testado não conta como backup. A restaurabilidade é verificada automaticamente em toda execução e manualmente via o procedimento da Seção 5 (registro na Seção 8).

## 2. Versões e compatibilidade

| Componente | Versão | Regra |
|---|---|---|
| Servidor de produção | **PostgreSQL 16.14** (Neon, aarch64) | Fonte dos dumps |
| Client no workflow | `postgresql-client-17` (PGDG, pinado) | `pg_dump`/`pg_restore` major DEVE ser ≥ major do servidor |
| Restore (target) | PostgreSQL **≥ 17** | Target major DEVE ser ≥ ao major do **client `pg_restore` usado** (não só ≥ à origem): `pg_restore` 17 emite `SET transaction_timeout` (GUC do PG 17) que um target 16 rejeita. Nunca restaurar em major inferior à origem |

Se o Neon for atualizado para major 17+ (upgrade manual — Neon não faz major upgrade automático), o pin do client no workflow já cobre 17; acima disso, atualizar o pin em `backup-db.yml` e esta tabela.

## 3. Setup do destino (Cloudflare R2) — configuração única

Estado: **concluído em 2026-06-03**. Passos para reprodução (novo ambiente/conta):

1. Criar conta em [dash.cloudflare.com](https://dash.cloudflare.com) e habilitar **R2 Object Storage** (exige cartão de crédito mesmo no free tier — 10 GB de armazenamento, egress gratuito).
2. **Create bucket**: nome `audiobook-track-backups`, location Automatic, classe Standard, acesso privado (default).
3. Criar o token S3 — **atenção ao fluxo**: Dashboard → **R2 Object Storage** → botão **`{} API`** (canto superior direito) → **Manage API tokens** → **Create Account API token**:
   - Permissão: **Object Read & Write**
   - Escopo: **somente** o bucket `audiobook-track-backups` (nunca account-wide)
   - TTL: Forever
   - Na tela de sucesso, rolar até a seção **"Use the following credentials with S3-compatible clients"**: anotar **Access Key ID** e **Secret Access Key** (exibidos **uma única vez**) e o endpoint `https://<account_id>.r2.cloudflarestorage.com`
   - ⚠️ **Não** usar o fluxo genérico My Profile → API Tokens — ele gera um token Cloudflare comum, **sem** as credenciais S3. Se um token foi criado e o par de chaves se perdeu: criar token novo pelo fluxo acima e **deletar o antigo** (as credenciais S3 também podem ser derivadas — Access Key ID = ID do token, Secret = SHA-256 do valor — mas recriar é menos sujeito a erro)
4. Configurar os secrets no GitHub (Seção 4).
5. Configurar as lifecycle rules de retenção (Seção 7 — pendente nesta fase).

## 4. Secrets (GitHub Actions — repository secrets)

Repo → **Settings → Secrets and variables → Actions → Repository secrets** (não usar Environment secrets — o workflow não declara `environment`).

| Secret | Valor | Atenção |
|---|---|---|
| `DATABASE_URL` | **Direct** connection string do Neon, com `sslmode=require` | ⚠️ Host **SEM** `-pooler`. A string pooled (usada pela Vercel em runtime) quebra o `pg_dump` — o workflow tem uma guarda que rejeita host contendo `-pooler` com erro imediato. No Neon Console: Connection Details → **desmarcar** "Connection pooling" |
| `R2_ACCESS_KEY_ID` | Access Key do token da Seção 3.3 | |
| `R2_SECRET_ACCESS_KEY` | Secret Key do mesmo token | |
| `R2_BUCKET` | `audiobook-track-backups` | |
| `R2_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` | |
| `SENTRY_CRON_URL` | URL de check-in do monitor `backup-db` (formato `https://o<org>.ingest.<region>.sentry.io/api/<project>/cron/backup-db/<key>/`) | Incluir a barra final |

Nenhum desses valores pode aparecer em código, log ou nome de artefato.

## 5. Restore manual em banco descartável (teste e investigação)

> ⚠️ **NUNCA restaurar diretamente sobre o banco de produção.** Este procedimento usa um container local descartável. Para recuperação real de produção, ver Seção 5.4.

### 5.1. Pré-requisitos

- Docker, AWS CLI v2 e `pg_restore`/`psql` ≥ 16 (macOS: `brew install libpq` e usar `$(brew --prefix libpq)/bin/pg_restore`, ou `brew install postgresql@17`)
- Credenciais do token R2 (Seção 3.3) exportadas:

```bash
export AWS_ACCESS_KEY_ID='<access key do token R2>'
export AWS_SECRET_ACCESS_KEY='<secret key do token R2>'
export R2_ENDPOINT='https://<account_id>.r2.cloudflarestorage.com'
export R2_BUCKET='audiobook-track-backups'
# Compatibilidade AWS CLI >= 2.23 com R2:
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
export AWS_DEFAULT_REGION=auto
```

### 5.2. Download e restore

```bash
# 1. Listar os backups disponíveis (mais recentes no fim)
aws s3 ls "s3://${R2_BUCKET}/backups/" --endpoint-url "$R2_ENDPOINT"

# 2. Baixar o artefato escolhido
aws s3 cp "s3://${R2_BUCKET}/backups/<arquivo>.dump" ./restore-test.dump \
  --endpoint-url "$R2_ENDPOINT"

# 3. Subir um Postgres descartável (porta 5433 para não colidir com local).
#    ⚠️ O major do container deve ser >= o major do SEU pg_restore local
#    (`pg_restore --version`): pg_restore 17 emite SET transaction_timeout
#    (GUC do PG 17) e um target 16 rejeita com "unrecognized configuration
#    parameter". postgres:17 cobre clients 16 e 17.
docker run --name restore-test -d \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=verify \
  -p 5433:5432 postgres:17

# aguardar healthy (~5s)
until docker exec restore-test pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

# 4. Restaurar (mesmas flags do workflow)
pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error \
  -d "postgresql://postgres:postgres@localhost:5433/verify" \
  ./restore-test.dump
```

### 5.3. Verificações de integridade

```bash
VERIFY_URL="postgresql://postgres:postgres@localhost:5433/verify"

# Estrutura: >= 8 tabelas no schema public
psql "$VERIFY_URL" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'"

# Migrations aplicadas: >= 1 registro (journal vive no schema drizzle)
psql "$VERIFY_URL" -tAc "SELECT count(*) FROM drizzle.__drizzle_migrations"

# Dados: admin de produção presente
psql "$VERIFY_URL" -tAc 'SELECT count(*) FROM "user"'

# Amostragem de dados financeiros (espelha a fonte da verdade do domínio)
psql "$VERIFY_URL" -c 'SELECT count(*) AS chapters, count(*) FILTER (WHERE status = '"'"'paid'"'"') AS paid FROM chapter'
psql "$VERIFY_URL" -c 'SELECT id, title, status, price_per_hour_cents FROM book ORDER BY created_at DESC LIMIT 5'
```

Critério de aprovação: contagens batem com o esperado da produção no momento do backup e nenhuma query falha.

**Limpeza**:

```bash
docker rm -f restore-test && rm -f restore-test.dump
```

### 5.4. Recuperação real de produção (desastre)

Em caso de perda do banco de produção:

1. Criar novo projeto/branch no Neon (PostgreSQL **≥ 17** — ou igual ao major do `pg_restore` que será usado; ver regra na Seção 2).
2. Restaurar o dump mais recente nele (Seção 5.2, apontando para a connection string do novo banco em vez do container).
3. Atualizar `DATABASE_URL` na **Vercel** (pooled string nova) e no **GitHub Actions** (direct string nova — ver Seção 6.1).
4. Redeploy na Vercel e smoke test (`/api/health`).
5. Registrar o incidente e o restore na Seção 8.

**Antes de qualquer recuperação**: avaliar se o restore window nativo do Neon resolve (ver Seção 5.5) — é mais rápido e perde menos dados.

### 5.5. Neon restore window vs dumps do R2 — qual usar

| Cenário | Ferramenta |
|---|---|
| Erro operacional recente (< 24h): DELETE errado, migration destrutiva, dado corrompido hoje | **Neon restore window** (free tier ~24h): Console → Branches → Restore — point-in-time, perde minutos e não horas |
| Perda do projeto/conta Neon, corrupção antiga (> 24h), necessidade de dado de semanas atrás, auditoria histórica | **Dumps do R2** (este runbook): até 90 dias de retenção, independentes do provedor |

## 6. Rotação de credenciais

### 6.1. Connection string do Neon (`DATABASE_URL`)

1. Neon Console → Roles → reset password (ou criar role nova).
2. Atualizar o secret no GitHub: `GITHUB_TOKEN='' gh secret set DATABASE_URL` — colar a **direct** string nova (host sem `-pooler`, `sslmode=require`).
3. Atualizar também `DATABASE_URL` na Vercel (lá é a **pooled** — atenção para não inverter as duas).
4. Disparar um backup manual para validar: `GITHUB_TOKEN='' gh workflow run backup-db.yml`.

### 6.2. Token R2

1. Cloudflare → R2 → Manage R2 API Tokens → criar token novo (mesmo escopo: Object Read & Write, somente o bucket).
2. `GITHUB_TOKEN='' gh secret set R2_ACCESS_KEY_ID` e `GITHUB_TOKEN='' gh secret set R2_SECRET_ACCESS_KEY`.
3. Revogar o token antigo **somente após** um backup manual bem-sucedido com o novo.

### 6.3. `SENTRY_CRON_URL`

Muda apenas se a DSN key do projeto Sentry for regenerada (raro). Nesse caso, copiar a URL nova no monitor `backup-db` (Crons → instruções de instrumentação) e `GITHUB_TOKEN='' gh secret set SENTRY_CRON_URL`.

## 7. Monitoramento (Sentry Crons — dead man's switch)

O monitor **`backup-db`** (Sentry → Monitors → Cron) vigia o agendamento e cobre o modo de falha mais insidioso: o backup que **deixa de rodar** sem erro nenhum.

### 7.1. Configuração do monitor

| Campo | Valor |
|---|---|
| Slug | `backup-db` |
| Schedule | `0 6 * * *` (crontab, UTC) |
| Grace period (check-in margin) | 120 min |
| Max runtime | 30 min (o job tem `timeout-minutes: 15`) |
| Failure tolerance | 1 (alerta no primeiro miss/error) |
| Alertas | E-mail do owner da conta Sentry (operador único do projeto) — failure + missed check-in |

### 7.2. Semântica dos check-ins (espelha o workflow)

| Check-in | Quando | Tolerância a falha do próprio curl |
|---|---|---|
| `in_progress` | Primeiro step do job | `\|\| true` — telemetria nunca derruba o backup |
| `ok` | Último step do caminho feliz (após restore verificado) | **Sem** `\|\| true` — sucesso que o Sentry não confirmou vira run vermelho para investigação |
| `error` | Step `if: failure()` | `\|\| true` — já estamos no caminho de falha |

### 7.3. O que cada alerta significa

| Alerta no Sentry | Causa provável | Ação |
|---|---|---|
| **Failed check-in** (`error`) | Qualquer step do pipeline falhou (guarda, dump, upload, verificação) | Abrir o run no Actions (`gh run list --workflow=backup-db.yml`), ler o step vermelho |
| **Missed check-in** | Workflow não rodou: auto-disable por 60 dias de inatividade do repo, workflow removido/renomeado, GitHub indisponível | Ver 7.4 |
| **Timeout** | Job passou de 30 min sem check-in final | Investigar travamento (rede R2/Neon); o `timeout-minutes: 15` do job deve ter matado antes |

### 7.4. Reativação após auto-disable do GitHub

Repos públicos têm scheduled workflows **desabilitados automaticamente após 60 dias sem atividade** (o GitHub envia e-mail de aviso; o Sentry alerta o missed check-in no dia seguinte):

```bash
GITHUB_TOKEN='' gh workflow enable backup-db.yml
GITHUB_TOKEN='' gh workflow run backup-db.yml   # backup imediato para cobrir o gap
```

Conferir também o banner em Actions → Database Backup no GitHub.

## 8. Retenção e monitoramento de cota

### 8.1. Lifecycle rules do bucket (configuração única — concluída em 2026-06-03)

Cloudflare → R2 → `audiobook-track-backups` → **Settings → Object lifecycle rules**:

| Regra | Escopo | Ação |
|---|---|---|
| Expiração de backups | Prefixo `backups/` | **Delete** objetos com idade > **90 dias** |
| Limpeza de uploads incompletos | Bucket inteiro (default do R2) | **Abort** multipart uploads incompletos após 7 dias |

A expiração roda server-side no R2 — nenhum código de rotação no workflow. Em regime permanente: **~90-91 dumps** em rotação (1/dia + eventuais manuais).

### 8.2. Auditoria de volume

Projeção no tamanho atual da base (~8,4 MB → dump comprimido ~1-3 MB): **~270 MB total**, ~3% da cota gratuita de 10 GB.

**Dashboard**: R2 → bucket → visão geral mostra contagem de objetos e tamanho total.

**CLI**:

```bash
aws s3 ls "s3://${R2_BUCKET}/backups/" --endpoint-url "$R2_ENDPOINT" \
  --summarize --human-readable | tail -2
```

Conferir o volume **a cada teste de restore** (Seção 9) — custo de um olhar.

### 8.3. Gatilho de reavaliação: base ≥ ~500 MB

Quando `SELECT pg_size_pretty(pg_database_size(current_database()))` na produção se aproximar de **500 MB**, o dump comprimido tende a ~50-150 MB e 90 dumps podem romper a cota gratuita. Opções, em ordem de preferência:

1. **Reduzir retenção** (90 → 30 dias na lifecycle rule): mantém RPO de 1 dia com ~30 dumps.
2. **Reduzir cadência** (diária → semanal, 1 linha no cron): degrada RPO para 7 dias — evitar se houver movimento financeiro frequente.
3. **Aceitar cobrança** do R2 acima de 10 GB (US$ 0,015/GB-mês — dezenas de centavos): válido se 90 dias de retenção diária tiverem valor operacional comprovado.

## 9. Registro de testes de restore

> Backup sem restore testado não conta como backup. Todo teste de restore manual (Seção 5) DEVE ser registrado aqui.

| Data | Artefato | Executor | Resultado | Observações |
|---|---|---|---|---|
| _(pendente — gate de entrega da feature, T024)_ | | | | |
