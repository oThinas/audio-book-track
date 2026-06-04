# Implementation Plan: Backup Diário do Banco de Produção

**Branch**: `030-weekly-db-backup` | **Date**: 2026-06-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/030-weekly-db-backup/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Backup diário automatizado do Postgres de produção (Neon, PG 16.14): GitHub Actions agendado (`0 6 * * *` = 03:00 BRT) executa `pg_dump --format=custom --compress=9` pela direct connection (com guarda anti-pooler), sobe o artefato para bucket Cloudflare R2 (lifecycle de 90 dias ≈ 90 dumps em rotação, ~270 MB, custo zero) e **verifica a restaurabilidade na própria execução**: baixa o objeto de volta do R2 e restaura em service container `postgres:17` com sanity queries — só então declara sucesso. Sentry Crons atua como dead man's switch (check-ins `in_progress`/`ok`/`error`; alerta em check-in ausente cobre não-execução silenciosa, incl. o auto-disable de 60 dias do GitHub). Runbook operacional em `docs/backup.md` com setup completo (Cloudflare/R2/token/lifecycle/Sentry/secrets), procedimento de restore manual e registro do teste de restore obrigatório na entrega.

## Technical Context

**Language/Version**: Bash (steps de workflow) + YAML GitHub Actions; PostgreSQL client 17 (PGDG) contra servidor 16.14

**Primary Dependencies**: `pg_dump`/`pg_restore` 17 (PGDG), AWS CLI v2 (pré-instalada no runner, com `AWS_REQUEST_CHECKSUM_CALCULATION=when_required` para compat R2), `curl` (check-ins Sentry), service container `postgres:17` (major ≥ client de restore)

**Storage**: Cloudflare R2 (S3-compatible) — bucket único, prefixo `backups/`, lifecycle 90 dias; origem Neon PostgreSQL 16.14 via direct connection string

**Testing**: Verificação round-trip embutida em cada execução (download do R2 + `pg_restore --exit-on-error` + sanity queries); execução real via `workflow_dispatch` pós-merge; teste de restore manual via runbook (FR-013). Sem testes Vitest/Playwright — a feature não contém código de aplicação

**Target Platform**: GitHub Actions `ubuntu-latest` (repo público — minutos ilimitados); scheduled workflow na branch `main`

**Project Type**: Infraestrutura/CI — 1 workflow YAML + 1 documento de runbook; zero mudança em `src/`, zero mudança de schema

**Performance Goals**: Job completo < 15 min (`timeout-minutes`; projeção real ~3 min com base de 8,4 MB); RPO ≤ 24h (SC-002)

**Constraints**: Custo zero (free tiers: R2 10 GB, Sentry 1 cron monitor, Actions público); secrets exclusivamente no GitHub Actions; token R2 escopado a um único bucket; nenhuma falha silenciosa

**Scale/Scope**: Base ~8,4 MB (teto realista < 1 GB; gatilho de reavaliação documentado em ~500 MB); ~91 artefatos em regime; 1 operador

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|-----------|-----------|--------|
| I. Capítulo como unidade | N/A — nenhuma operação de domínio; backup é cópia integral do banco | ✅ |
| II. Precisão financeira | N/A — nenhum cálculo; a feature *protege* os dados financeiros existentes. Nenhum campo monetário criado | ✅ |
| III. Ciclo de vida do capítulo | N/A — nenhuma transição de status tocada | ✅ |
| IV. Simplicidade (YAGNI) | 1 workflow YAML + 1 doc; rotação delegada ao provedor (lifecycle); sem keepalive, sem criptografia client-side, sem script de app — exclusões justificadas em research.md R10 | ✅ |
| V. TDD | **Justificativa exigida**: não há lógica de domínio nem código TS — TDD clássico (Vitest) não se aplica a YAML de workflow. Equivalente adotado: contrato executável (contracts/backup-workflow.md) + verificação de restauração em TODA execução + critérios de aceitação exercitados via dispatch real (quickstart §"Validação dos cenários"). Cobertura 80% refere-se a código de aplicação — inalterada | ✅ (justificado) |
| VI. Arquitetura limpa backend | N/A — nenhum controller/service/repo criado | ✅ |
| VII. Frontend | N/A — nenhuma UI | ✅ |
| VIII. Performance | Nenhum byte no bundle do cliente | ✅ |
| IX. Design tokens | N/A | ✅ |
| X. API REST | N/A — nenhum endpoint novo (decisão consciente de NÃO criar endpoint de freshness; Sentry Crons cobre) | ✅ |
| XI. PostgreSQL | Sem mudança de schema/migrations. `pg_dump` lê o banco inteiro por design (não é `SELECT *` de código de produção) | ✅ |
| XII. Anti-padrões | Sem segredos hardcoded (6 secrets GH Actions); sem swallow de erros (todo step falha alto; check-ins de telemetria com `\|\| true` são deliberados e documentados no contrato) | ✅ |
| XV. Ferramentas | Context7 N/A (nenhuma lib de app); design.pen N/A (sem tela) | ✅ |
| XVI. Verificação final | `bun run lint`/`test:*`/`build` rodam normalmente no PR (nada de app mudou); validação real = dispatch pós-merge + restore manual | ✅ |

**Gate result**: PASS — nenhuma violação; única justificativa (V) registrada acima. Pós-Phase 1 re-check: PASS (design não introduziu código de aplicação).

## Project Structure

### Documentation (this feature)

```text
specs/030-weekly-db-backup/
├── plan.md              # Este arquivo
├── spec.md              # Especificação (com Clarifications da sessão grill-me)
├── research.md          # Phase 0 — 10 decisões de engenharia (R1-R10)
├── data-model.md        # Phase 1 — entidades operacionais (artefato, bucket, secrets, monitor)
├── quickstart.md        # Phase 1 — ordem de implantação ponta-a-ponta
├── contracts/
│   └── backup-workflow.md  # Contrato do workflow (triggers, steps, semântica de falha)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — ainda não criado)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    └── backup-db.yml    # NOVO — workflow de backup (único código da feature)

docs/
└── backup.md            # NOVO — runbook: setup R2/Sentry/secrets, restore manual,
                         #        rotação de credenciais, monitoramento de cota,
                         #        registro do teste de restore (FR-013)
```

**Structure Decision**: Feature de infraestrutura pura — nenhum diretório de `src/` é tocado. Dois arquivos novos: o workflow (contrato em `contracts/backup-workflow.md`) e o runbook (FR-012). Configurações externas (bucket R2 + lifecycle, monitor Sentry, 6 secrets) são estado fora do repositório, documentadas como pré-requisitos no quickstart e no runbook.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Nenhuma violação — tabela vazia. (A justificativa do Princípio V está inline no gate; não é violação, é inaplicabilidade documentada.)
