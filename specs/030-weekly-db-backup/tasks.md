# Tasks: Backup Diário do Banco de Produção

**Input**: Design documents from `/specs/030-weekly-db-backup/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/backup-workflow.md, quickstart.md

**Tests**: Sem tasks de teste Vitest/Playwright — Princípio V justificado no plan.md (feature é YAML de workflow + runbook, sem código de aplicação). O "teste" é estrutural: verificação round-trip embutida no próprio workflow (US2) + validação real pós-merge (Phase 7).

**Organization**: Tasks agrupadas por user story. Atenção: US1-US3 editam o mesmo arquivo (`.github/workflows/backup-db.yml`) — execução sequencial entre essas stories; US4 é independente (dashboard Cloudflare + runbook).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

## Path Conventions

Feature de infraestrutura — apenas 2 arquivos no repo: `.github/workflows/backup-db.yml` e `docs/backup.md`. Demais tasks são configuração externa (Cloudflare R2, Sentry, GitHub secrets), executadas pelo operador e documentadas no runbook.

---

## Phase 1: Setup (Infraestrutura externa — pré-requisitos do merge)

**Purpose**: Provisionar destino de armazenamento e credenciais. Sem isso o primeiro dispatch falha.

- [ ] T001 Criar conta Cloudflare e habilitar R2 (exige cartão de crédito mesmo no free tier) — quickstart.md §1.1-1.2
- [ ] T002 Criar bucket `audiobook-track-backups` (location automático) no dashboard R2 — quickstart.md §1.3
- [ ] T003 Criar API token S3 com permissão **Object Read & Write** escopado SOMENTE ao bucket; anotar Access Key ID, Secret Access Key e endpoint `https://<account_id>.r2.cloudflarestorage.com` — quickstart.md §1.4
- [ ] T004 Configurar GitHub Actions secrets via `GITHUB_TOKEN='' gh secret set`: `DATABASE_URL` (direct connection string do Neon, host SEM `-pooler`, `sslmode=require`), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` — data-model.md §Secrets

**Checkpoint**: Bucket existe, token escopado criado, 5 secrets configurados no repo.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Skeleton do workflow sobre o qual US1-US3 constroem steps.

**⚠️ CRITICAL**: Nenhuma story toca o workflow antes desta task.

- [ ] T005 Criar skeleton de `.github/workflows/backup-db.yml`: `name`, triggers (`schedule` cron `0 6 * * *` + `workflow_dispatch`), `permissions: {}` (pipeline não usa checkout nem `GITHUB_TOKEN`), `concurrency: { group: backup-db, cancel-in-progress: false }`, job único `ubuntu-latest` com `timeout-minutes: 15`, service container `postgres:16` com `POSTGRES_USER: postgres`, `POSTGRES_PASSWORD: postgres`, `POSTGRES_DB: verify` e health-check `pg_isready` (padrão de `.github/workflows/pr-checks.yml`, trocando o nome do banco), env globais `AWS_REQUEST_CHECKSUM_CALCULATION=when_required`, `AWS_RESPONSE_CHECKSUM_VALIDATION=when_required`, `AWS_DEFAULT_REGION=auto` — contracts/backup-workflow.md §Triggers/§Permissões/§Service container/§Env

**Checkpoint**: Workflow válido (sem steps de negócio ainda) — stories podem começar.

---

## Phase 3: User Story 1 - Backup automático diário fora da infraestrutura primária (Priority: P1) 🎯 MVP

**Goal**: Dump completo diário do Postgres de produção (Neon 16.14) enviado ao R2, com guarda de configuração e nome único por execução.

**Independent Test**: Disparo manual (`workflow_dispatch`) gera objeto `backups/audiobook-track-<ts>.dump` íntegro no bucket; secret com string pooled faz a execução falhar imediatamente com mensagem acionável.

### Implementation for User Story 1

- [ ] T006 [US1] Adicionar step de guarda anti-pooler em `.github/workflows/backup-db.yml`: se host de `$DATABASE_URL` contém `-pooler` → `echo "::error::..."` com instrução de usar a direct string + `exit 1`, ANTES de qualquer geração de artefato — contracts §step 2, research.md R2, FR-006
- [ ] T007 [US1] Adicionar step de instalação do client PostgreSQL 17 via PGDG (`/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh` + `apt-get install postgresql-client-17`) com `pg_dump --version` ecoado para auditoria em `.github/workflows/backup-db.yml` — contracts §step 3, research.md R1
- [ ] T008 [US1] Adicionar step de dump em `.github/workflows/backup-db.yml`: gerar timestamp UTC único (`date -u +%Y-%m-%dT%H-%M-%SZ`) exportado via `$GITHUB_OUTPUT`, executar `pg_dump --format=custom --compress=9 --file=audiobook-track-<ts>.dump "$DATABASE_URL"` — contracts §step 4, research.md R8, FR-003/FR-004
- [ ] T009 [US1] Adicionar step de upload em `.github/workflows/backup-db.yml`: `aws s3 cp` para `s3://$R2_BUCKET/backups/audiobook-track-<ts>.dump` com `--endpoint-url "$R2_ENDPOINT"`, credenciais via `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` mapeadas dos secrets R2 — contracts §step 5, research.md R3, FR-002

**Checkpoint**: Pipeline dump→upload completo no YAML. Validação real só pós-merge (Phase 7) — schedule/dispatch exigem o arquivo na `main`.

---

## Phase 4: User Story 2 - Verificação contínua de restaurabilidade + runbook validado (Priority: P2)

**Goal**: Nenhuma execução declara sucesso sem restaurar o artefato baixado de volta do R2; runbook `docs/backup.md` cobre setup e restore manual.

**Independent Test**: Log de uma execução mostra download → piso de tamanho → `pg_restore --list` → restore no container → sanity queries ANTES do sucesso; artefato truncado forçado reprova. Runbook executável do zero por operador sem contexto.

### Implementation for User Story 2

- [ ] T010 [US2] Adicionar steps de round-trip em `.github/workflows/backup-db.yml`: download do MESMO objeto recém-enviado (`aws s3 cp s3://... ./verify.dump`), piso de tamanho ≥ 102400 bytes (`stat -c%s`) com `exit 1` abaixo, e `pg_restore --list verify.dump` como TOC check — contracts §steps 6-8, FR-005
- [ ] T011 [US2] Adicionar step de restore-verify em `.github/workflows/backup-db.yml`: `pg_restore --no-owner --no-privileges --exit-on-error -d postgresql://postgres:postgres@localhost:5432/verify verify.dump` no service container + sanity queries via `psql -tAc`: `pg_tables` schema public ≥ 8, `__drizzle_migrations` ≥ 1, `"user"` ≥ 1 — qualquer reprovação → `exit 1` — contracts §steps 9-10, research.md R4
- [ ] T012 [P] [US2] Criar `docs/backup.md` (seções core): visão geral da estratégia (cadência diária, RPO 24h, retenção 90d), setup completo do R2 espelhando quickstart.md §1 (conta, bucket, token escopado), tabela de secrets com qual string colar em `DATABASE_URL` (direct, NUNCA `-pooler`), versão do servidor (PostgreSQL 16.14) + regra de compatibilidade de restore (FR-014), procedimento de restore manual passo a passo em Postgres 16 local descartável via Docker (download com `aws s3 cp`, `pg_restore`, verificações de integridade com queries concretas) — FR-012
- [ ] T013 [US2] Adicionar a `docs/backup.md` (seções complementares): rotação de credenciais (Neon connection string, token R2, passo a passo `gh secret set`), recuperação de primeira linha (restore window nativo do Neon ~24h) vs disaster recovery (dumps R2) com critério de escolha, e seção "Registro de testes de restore" com template de entrada (data, artefato, executor, resultado) — FR-012, research.md R10

**Checkpoint**: Workflow só declara sucesso com restore verificado; runbook completo aguardando validação humana (Phase 7).

---

## Phase 5: User Story 3 - Detecção de backup ausente / dead man's switch (Priority: P2)

**Goal**: Sentry Crons alerta quando o backup falha E quando deixa de rodar (incl. auto-disable de 60 dias do GitHub).

**Independent Test**: Desabilitar o workflow por 1 dia → alerta de missed check-in chega por e-mail → reabilitar.

### Implementation for User Story 3

- [ ] T014 [US3] Criar monitor `backup-db` no Sentry UI (Crons → Add Monitor): schedule `0 6 * * *`, timezone UTC, check-in margin 120 min, max runtime 30 min, alertas de failure + missed check-in para o e-mail do operador; copiar a URL de check-in HTTP — quickstart.md §2, data-model.md §Monitor
- [ ] T015 [US3] Configurar secret `SENTRY_CRON_URL` via `GITHUB_TOKEN='' gh secret set SENTRY_CRON_URL` — data-model.md §Secrets
- [ ] T016 [US3] Adicionar steps de check-in em `.github/workflows/backup-db.yml`: `in_progress` como PRIMEIRO step (`curl -sf "$SENTRY_CRON_URL?status=in_progress" || true`), `ok` como ÚLTIMO step do caminho feliz (`curl -sf "$SENTRY_CRON_URL?status=ok"` SEM `|| true`), e step separado `if: failure()` com `curl -sf "$SENTRY_CRON_URL?status=error" || true` — contracts §steps 1/11/12, research.md R5 (semântica de `|| true` por check-in)
- [ ] T017 [US3] Adicionar a `docs/backup.md`: seção de monitoramento (o que o monitor cobre, onde ver check-ins no Sentry) e procedimento de reativação pós auto-disable (`GITHUB_TOKEN='' gh workflow enable backup-db.yml`) — research.md R6

**Checkpoint**: Pipeline completo dos 12 steps do contrato montado; nenhuma falha ou ausência é silenciosa.

---

## Phase 6: User Story 4 - Retenção automática com custo zero (Priority: P3)

**Goal**: Expiração server-side de 90 dias mantém ~90 dumps em rotação dentro da cota gratuita, sem manutenção.

**Independent Test**: Lifecycle rules visíveis no dashboard do bucket; auditoria de contagem/volume confere com a projeção (~270 MB).

### Implementation for User Story 4

- [ ] T018 [P] [US4] Configurar lifecycle rules no bucket (R2 → bucket → Settings → Object lifecycle rules): delete objects com prefixo `backups/` após 90 dias + manter regra default de abort multipart uploads incompletos (7 dias) — quickstart.md §1.5, research.md R7, FR-010
- [ ] T019 [US4] Adicionar a `docs/backup.md`: seção de retenção e cota (como auditar volume/contagem no dashboard R2, projeção ~270 MB vs cota 10 GB, gatilho explícito de reavaliação de cadência/retenção quando a base atingir ~500 MB) — FR-012, research.md R10

**Checkpoint**: Rotação ativa e documentada — todas as stories funcionais.

---

## Phase 7: Polish & Validação de Entrega

**Purpose**: Conformidade com o contrato, gates de qualidade e validação real (pós-merge).

- [ ] T020 Validar `.github/workflows/backup-db.yml` contra contracts/backup-workflow.md: 12 steps presentes na ordem, semântica de falha por step, timestamp único compartilhado entre upload/download, nenhum secret ecoado em log; rodar `actionlint` se disponível localmente
- [ ] T021 Fase final de qualidade (constituição XVI): `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run build` — nada de aplicação mudou; confirmação de não-regressão
- [ ] T022 Pós-merge: primeira execução real via `GITHUB_TOKEN='' gh workflow run backup-db.yml` + `gh run watch`; verificar run verde, objeto em `backups/` no dashboard R2 e check-in `ok` no monitor Sentry — quickstart.md §4
- [ ] T023 Pós-merge: exercitar a guarda anti-pooler (trocar `DATABASE_URL` temporariamente pela string pooled → dispatch → falha imediata acionável + check-in `error` no Sentry → restaurar secret) — contracts §Critérios de aceitação
- [ ] T024 Pós-merge (gate de entrega FR-013/SC-005): teste de restore manual completo seguindo EXCLUSIVAMENTE `docs/backup.md` em Postgres 16 local descartável; registrar data, artefato e resultado das verificações na seção "Registro de testes de restore" do runbook — backup sem restore testado não conta como backup

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — T001 → T002 → T003 → T004 (sequencial: cada passo usa o anterior)
- **Foundational (Phase 2)**: T005 independe do Setup (arquivo local) — pode rodar em paralelo com Phase 1
- **US1 (Phase 3)**: depende de T005; T006 → T007 → T008 → T009 (mesmo arquivo, ordem do pipeline)
- **US2 (Phase 4)**: T010/T011 dependem de T009 (round-trip referencia o objeto enviado); T012 [P] independe (arquivo novo); T013 depende de T012
- **US3 (Phase 5)**: T014 → T015 (URL vem do monitor); T016 depende de T011 (check-in `ok` é o último step do pipeline); T017 depende de T013
- **US4 (Phase 6)**: T018 depende apenas de T002 (bucket) — paralelizável com US1-US3; T019 depende de T012
- **Polish (Phase 7)**: T020-T021 pré-merge (dependem de tudo no repo); T022 → T023 → T024 pós-merge, nesta ordem

### User Story Dependencies

- **US1 (P1)**: base do pipeline — primeiro
- **US2 (P2)**: estende o workflow de US1 (steps 6-10 do contrato) + cria o runbook
- **US3 (P2)**: insere check-ins nas bordas do pipeline de US1+US2
- **US4 (P3)**: independente de US1-US3 (dashboard + runbook) — encaixável a qualquer momento após T002/T012

### Parallel Opportunities

- T005 (skeleton) ∥ Phase 1 (config externa)
- T012 (runbook core) ∥ T010/T011 (workflow) — arquivos diferentes
- T018 (lifecycle) ∥ qualquer task de US2/US3 após T002
- Demais tasks tocam o mesmo arquivo (`backup-db.yml` ou `backup.md`) — sequenciais por design

## Parallel Example: User Story 2

```bash
# Em paralelo (arquivos diferentes):
Task A: "T010+T011 — steps de round-trip e restore-verify em .github/workflows/backup-db.yml"
Task B: "T012 — seções core do runbook em docs/backup.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (setup externo) + Phase 2 (skeleton) — paralelizáveis
2. Phase 3 (US1): pipeline dump→upload
3. **STOP and VALIDATE**: merge + dispatch manual → objeto no R2 (validação parcial de T022)
4. MVP entregue: backups diários existem fora da infra primária (ainda sem verificação automática nem dead man's switch)

### Incremental Delivery

1. US1 → backup diário real no R2 (MVP)
2. US2 → nenhum sucesso sem restore verificado + runbook completo
3. US3 → falha E ausência alertam o operador
4. US4 → rotação automática, custo zero permanente
5. Phase 7 → validação de entrega (incl. gate FR-013: restore manual registrado)

**Nota prática**: como o volume total é pequeno (1 workflow + 1 doc), o caminho natural é um único PR com todas as stories, validando incrementalmente via os checkpoints. A estrutura por story existe para rastreabilidade e para permitir parar em qualquer checkpoint com valor entregue.

---

## Notes

- Workflow scheduled/dispatch só roda da branch `main` — toda validação real é pós-merge (T022-T024); pré-merge valida-se por contrato (T020) e gates de qualidade (T021)
- Nenhuma task de teste Vitest: justificativa do Princípio V no plan.md §Constitution Check
- Tasks externas (T001-T004, T014-T015, T018) não geram diff no repo — registrar conclusão marcando o checkbox aqui e seguindo o runbook
- Commits convencionais por grupo lógico: `ci:` para o workflow, `docs:` para o runbook
