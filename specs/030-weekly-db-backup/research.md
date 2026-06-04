# Research: Backup Diário do Banco de Produção

**Feature**: `030-weekly-db-backup` | **Date**: 2026-06-03

Todas as incertezas técnicas do Technical Context resolvidas. Nenhum NEEDS CLARIFICATION remanescente (a sessão grill-me na spec já resolveu as decisões de produto; este documento resolve as decisões de engenharia).

## R1. Versão do client `pg_dump` no runner

**Decision**: Instalar `postgresql-client-17` via repositório PGDG (script oficial `apt.postgresql.org.sh` já presente na imagem `ubuntu-24.04` em `/usr/share/postgresql-common/pgdg/`), em vez de depender do client 16 pré-instalado no runner.

**Rationale**: A regra do `pg_dump` é client major ≥ server major. O servidor é PostgreSQL 16.14 (Neon). O client 16 do runner funcionaria *hoje*, mas: (a) a imagem `ubuntu-latest` muda sem aviso; (b) um upgrade manual futuro do Neon para 17 quebraria o backup silenciosamente até alguém investigar. Client 17 dumpa servidores 16 e 17, e `pg_restore` 17 restaura em targets 16+. O PGDG configura `postgresql-client-17` como alternativa de maior prioridade, então `pg_dump` no PATH resolve para 17.

**Alternatives considered**:
- *Client 16 pré-instalado (zero setup)*: rejeitado — frágil a mudanças da imagem do runner e a upgrade do servidor.
- *Container `postgres:17` como tool image*: rejeitado — mais lento (pull de imagem) e complica o acesso ao filesystem do workspace.

## R2. Connection string: direct vs pooler + guarda

**Decision**: O secret `DATABASE_URL` do GitHub Actions recebe a **direct/unpooled connection string** do Neon (host **sem** sufixo `-pooler`), com `sslmode=require`. O workflow valida como primeiro step: se o host contiver `-pooler`, falha imediatamente com mensagem acionável.

**Rationale**: O pooler do Neon (PgBouncer em transaction mode) não suporta de forma confiável as features de sessão que o `pg_dump` usa (snapshot consistente, `SET` de sessão, prepared statements). A Vercel usa a pooled em runtime — o risco real é alguém rotacionar o secret colando a string "oficial" da Vercel. A guarda converte um modo de falha intermitente/obscuro em erro imediato e autoexplicativo (FR-006).

**Guard (shell)**:
```bash
if [[ "$DATABASE_URL" == *-pooler* ]]; then
  echo "::error::DATABASE_URL aponta para o pooler do Neon. Use a DIRECT connection string (host sem '-pooler'). Ver docs/backup.md."
  exit 1
fi
```

**Alternatives considered**: renomear o secret para `BACKUP_DATABASE_URL` — rejeitado na sessão de clarificação (mantém nome do input + guarda).

## R3. Ferramenta de upload para R2

**Decision**: AWS CLI v2 (pré-instalada no runner `ubuntu-latest`) com `--endpoint-url` apontando para o R2, e as variáveis de compatibilidade de checksum:

```bash
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
```

**Rationale**: Zero instalação; S3-compatible é o caminho suportado pelo R2. A partir do AWS CLI v2.23 (jan/2025), o SDK passou a enviar checksums CRC32 por padrão ("default integrity protections"), o que causou incompatibilidades com provedores S3-compatible, incluindo R2. As duas variáveis acima restauram o comportamento "só quando exigido" e são a mitigação documentada pela Cloudflare — inofensivas se o R2 já suportar os novos checksums, e blindam contra upgrades futuros do CLI no runner.

**Alternatives considered**:
- *rclone*: funciona bem com R2, mas exige instalação + arquivo de config; mais uma ferramenta para manter.
- *wrangler r2 object put*: exige Node/wrangler + `CLOUDFLARE_API_TOKEN` (escopo de conta, mais amplo que um token S3 escopado ao bucket); limite de tamanho de objeto menos conveniente.
- *aws cli com config persistente (`aws configure set`)*: equivalente; env vars são mais explícitas e autocontidas no YAML.

## R4. Verificação round-trip de restauração

**Decision**: Service container `postgres:17` no próprio job (mesmo padrão e health-check de `pr-checks.yml`; era 16 — elevado para 17 porque o `pg_restore` 17 emite `SET transaction_timeout`, GUC do PG 17, que um target 16 rejeita sob `--exit-on-error`). Pipeline da verificação:

1. `aws s3 cp` (download do artefato recém-enviado, do R2 de volta ao runner);
2. piso de tamanho: falha se < 10 KB (10240 bytes) — recalibrado: a primeira execução real mediu ~32 KB para dump legítimo da base quase vazia;
3. `pg_restore --list` (TOC legível — falha rápida antes do restore caro);
4. `pg_restore --no-owner --no-privileges --exit-on-error -d $VERIFY_DATABASE_URL` no container;
5. Sanity queries:
   - `SELECT count(*) FROM pg_tables WHERE schemaname = 'public'` ≥ 8 (domínio: studio, book, chapter, narrator, editor, audit_log + better-auth: user, account, session, verification, user_preference);
   - `SELECT count(*) FROM __drizzle_migrations` ≥ 1;
   - `SELECT count(*) FROM "user"` ≥ 1 (admin de produção sempre existe).

**Rationale**: Restaurar **o artefato baixado do R2** (não o arquivo local pré-upload) prova exatamente o que está armazenado — corrupção em trânsito inclusa. R2 não cobra egress → download diário é grátis. `--no-owner --no-privileges` evita falhas espúrias por roles do Neon inexistentes no container; `--exit-on-error` garante que qualquer erro de restore reprove a execução (sem "sucesso com N erros"). Thresholds de sanity usam `≥` (mínimos estáveis) e não igualdade exata, para não quebrar a cada migration nova.

**Alternatives considered**:
- *Validar só com `pg_restore --list` local pré-upload*: rejeitado na clarificação — não prova restaurabilidade nem o que está efetivamente no bucket.
- *`docker run postgres:16` manual no step*: equivalente, mas service container reusa o idioma do repo com health-check declarativo.

## R5. Sentry Crons — protocolo de check-in

**Decision**: Check-ins HTTP via `curl` contra a URL de check-in do monitor, armazenada no secret `SENTRY_CRON_URL`:

```
https://o<orgId>.ingest.<region>.sentry.io/api/<projectId>/cron/backup-db/<publicKey>/
```

- Início do job: `curl -sf "$SENTRY_CRON_URL?status=in_progress"`
- Último step (sucesso): `curl -sf "$SENTRY_CRON_URL?status=ok"`
- Step `if: failure()`: `curl -sf "$SENTRY_CRON_URL?status=error"`

O monitor `backup-db` é criado/configurado no Sentry UI (runbook): schedule `0 6 * * *` (UTC), check-in margin 120 min, max runtime 30 min, failure/recovery alerts para o e-mail do operador.

**Rationale**: O protocolo HTTP dispensa SDK — `curl` puro no YAML. Todos os componentes da URL derivam do `SENTRY_DSN` já existente, mas guardar a URL completa como secret evita montagem frágil por string no workflow. Check-ins com slug inexistente até auto-criam o monitor no Sentry, mas a configuração explícita no UI (schedule + margem) é o que arma o alerta de check-in ausente — por isso o runbook trata a criação como passo obrigatório, não acidental. Free tier inclui 1 cron monitor — exatamente o necessário (clarificação da spec).

**Detalhe de robustez**: os `curl` de check-in usam `|| true` **apenas** no check-in `in_progress` (telemetria não pode derrubar o backup), mas o check-in `ok` final NÃO usa `|| true` — se o Sentry estiver fora, o job falha e o operador investiga (preferível a sucesso sem monitoramento confirmado). O check-in `error` usa `|| true` (já estamos em failure path).

## R6. Agendamento, concorrência e o auto-disable de 60 dias

**Decision**:
- `on.schedule: cron '0 6 * * *'` (03:00 BRT) + `on.workflow_dispatch` (FR-009);
- `concurrency: { group: backup-db, cancel-in-progress: false }` — execuções concorrentes (agendada + manual) serializam em fila, nunca cancelam backup em andamento;
- `timeout-minutes: 15` no job (base de ~8 MB completa em ~3 min; 15 dá folga 5× antes do max runtime de 30 min do monitor Sentry);
- `permissions: {}` no workflow — o pipeline não faz checkout (nenhum arquivo do repo é usado) nem chama a API do GitHub; zero permissões do `GITHUB_TOKEN` é o mínimo correto.
- Auto-disable após 60 dias sem atividade no repo: **aceito sem keepalive** — o alerta de check-in ausente do Sentry Crons é a deteção (User Story 3); o runbook documenta o procedimento de reativação (`gh workflow enable backup-db.yml`).

**Rationale**: Scheduled workflows rodam exclusivamente da branch default (`main`) — o cron só arma depois do merge. `workflow_dispatch` permite o disparo manual do primeiro backup (validação de entrega, FR-013) e backups pré-migração.

## R7. Lifecycle policy do R2 (retenção 90 dias)

**Decision**: Regra de lifecycle no bucket via dashboard da Cloudflare (R2 → bucket → Settings → Object lifecycle rules): **delete objects** com prefixo `backups/` após **90 dias**. Manter também a regra default de abortar multipart uploads incompletos após 7 dias. Configuração única, manual, documentada com passo a passo no runbook (`docs/backup.md`).

**Rationale**: O R2 executa a expiração server-side — nenhum código de rotação no workflow (menos um modo de falha). A regra default de multipart cobre o edge case de upload interrompido que deixaria partes órfãs ocupando cota invisível.

**Alternatives considered**: rotação via `aws s3api put-bucket-lifecycle-configuration` no próprio workflow — rejeitado (YAGNI: reaplicar a cada execução uma config que muda nunca; e exigiria permissão de bucket-config no token, violando o escopo mínimo).

## R8. Layout do bucket e naming dos artefatos

**Decision**:
- Bucket: `audiobook-track-backups` (sugestão; nome final definido na criação — runbook).
- Objeto: `backups/audiobook-track-<UTC-timestamp>.dump`, timestamp `date -u +%Y-%m-%dT%H-%M-%SZ` (ex: `backups/audiobook-track-2026-06-03T06-00-12Z.dump`).
- Extensão `.dump` = formato custom do `pg_dump` (`--format=custom --compress=9`).

**Rationale**: Prefixo `backups/` delimita o alvo da lifecycle rule. Timestamp com hora-minuto-segundo elimina colisão agendado×manual no mesmo dia (FR-004, edge case da spec). Hífens no lugar de `:` evitam problemas de key S3/ferramentas.

## R9. Validação pré-merge e primeira execução

**Decision**: O workflow não tem como rodar de branch (schedule e dispatch exigem o arquivo na default branch). Validação em 3 camadas:
1. **Pré-merge**: `actionlint` mental/local + review do YAML (sem execução real);
2. **Pós-merge imediato**: `gh workflow run backup-db.yml` (dispatch manual) — primeira execução real, com todos os secrets já configurados ANTES do merge (quickstart ordena: setup R2/Sentry/secrets → merge → dispatch);
3. **Entrega (FR-013)**: restore manual completo seguindo `docs/backup.md` num Postgres local descartável, registrado no próprio runbook.

**Rationale**: A "fase final de verificação" da constituição (lint/test/build) não exercita YAML de workflow; a execução real pós-merge é o teste de aceitação genuíno, e o restore manual valida o documento — não apenas o sistema.

## R10. O que NÃO entra (YAGNI confirmado)

- Criptografia client-side (`age`) — decisão consciente da clarificação; revisável.
- Keepalive contra auto-disable — Sentry Crons já detecta; keepalive adicionaria commits de ruído.
- Script de rotação próprio — lifecycle do R2 resolve server-side.
- Notificação em Slack/canais extras — e-mail do GitHub + alertas Sentry bastam para operador único.
- Backup de roles/globals (`pg_dumpall --globals-only`) — better-auth gerencia usuários da aplicação dentro do banco; roles do Neon são gerenciadas pelo provedor e recriáveis pelo runbook.
