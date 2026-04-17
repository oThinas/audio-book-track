# Implementation Plan: Test Database Isolation

**Branch**: `016-test-db-isolation` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-test-db-isolation/spec.md`

## Summary

Introduzir duas bases Postgres distintas no mesmo servidor (`audiobook_track` para dev, `audiobook_track_test` para testes) e isolar testes E2E via **schema-per-worker** no Postgres. Cada worker Playwright recebe um schema único (ex: `e2e_w{N}_{uuid}`), com migrations próprias aplicadas, uma instância Next.js dedicada rodando em porta isolada e `search_path` apontando para o schema do worker via `options=-c search_path=...` na connection string. Reset entre testes de um mesmo worker faz `TRUNCATE` apenas nas tabelas de domínio, preservando as linhas do admin em `user`/`account`/`session`. Integration tests passam a usar a base de teste também (schema `public`), mantendo o isolamento via `BEGIN`/`ROLLBACK`. Seed dividido em `seed.ts` (dev) e `seed-test.ts` (apenas admin, estável). CI roda E2E **serial (1 worker)** para previsibilidade no runner free-tier do GitHub Actions; paralelismo de 4 workers fica para dev local.

Referência adicional considerada: padrão schema-per-test-file do repositório [oThinas/nest-clean](https://github.com/oThinas/nest-clean) (UUID como schema name, mutação de `DATABASE_URL` via `searchParams`, `DROP SCHEMA ... CASCADE` no teardown). Adaptamos o modelo para schema-per-**worker** (o que Playwright suporta nativamente), preservando a lógica de UUID por sessão para eliminar colisões com execuções anteriores órfãs.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (Bun 1.2 runtime)
**Primary Dependencies**: Next.js 16.2.1, Drizzle ORM 0.45, `pg` 8.20, Playwright 1.59, Vitest 4.1, better-auth 1.5
**Storage**: PostgreSQL (local: único servidor; dev DB = `audiobook_track`; test DB = `audiobook_track_test`)
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Node/Bun 20+ no CI (GitHub Actions Ubuntu runner) e dev local (Darwin/macOS, Linux)
**Project Type**: web (Next.js App Router monolítico)
**Performance Goals**:
- Reset E2E entre testes ≤ 50ms (`TRUNCATE` seletivo)
- Bootstrap de worker (create schema + migrate + start Next.js) ≤ 15s
- Localmente (≥4 CPUs): redução ≥ 40% no tempo total da suíte E2E com 4 workers vs execução serial equivalente
- CI (GitHub Actions free-tier): suíte completa sem retries espúrios; tempo total não é meta
**Constraints**:
- Proibido `drizzle-kit push` (constituição exige `generate` + `migrate`)
- Proibido mock de `@/lib/db` em testes integration
- CI configurado com **1 worker Playwright** para evitar resource exhaustion no runner free-tier (2 vCPU / 7 GB RAM)
- `search_path` deve ser passado via connection-string (`options=-c search_path=...`) porque o `Pool` da app lê a URL uma única vez
**Scale/Scope**: ~10 arquivos E2E hoje, ~25 testes; suíte cresce conforme features novas (narradores, livros, capítulos) são adicionadas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| I. Capítulo como unidade | N/A — feature de infra de teste, não toca domínio | ✅ |
| II. Precisão financeira | Não afeta cálculo de ganho; somente aumenta isolamento dos testes que validam esse cálculo | ✅ |
| III. Ciclo de vida do capítulo | N/A | ✅ |
| IV. Simplicidade | Usa recursos nativos do Postgres (schemas) em vez de mocks elaborados ou containers por worker | ✅ |
| V. TDD obrigatório | Plan inclui testes primeiro: (a) testes que provam o isolamento (dois testes criando entidade com mesmo nome em workers distintos passam), (b) testes que validam seed-test (contém apenas admin) | ✅ |
| VI. Arquitetura em camadas | Não afeta camadas da app; alterações em `src/lib/env`, `src/lib/db`, scripts em `src/lib/db/*` e `__tests__/**` | ✅ |
| VII. UI puramente visual | N/A | ✅ |
| VIII. Leveza do bundle | N/A — mudanças em toolchain de teste, zero impacto em bundle de cliente | ✅ |
| IX. Design tokens | N/A | ✅ |
| X. API REST correta | N/A | ✅ |
| XI. Dados (numeric, FK com índice, sem SELECT *) | Preservado — feature não altera schema de domínio | ✅ |
| XII. Anti-padrões | Sem `any`, sem segredos hardcoded (conexões via env), sem `console.log` em prod, sem `drizzle-kit push` | ✅ |
| XV. MCP/design.pen | N/A (sem UI nova) | ✅ |
| XVI. lint + test + build verdes | Plan exige rodar `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e` e `bun run build` ao final | ✅ |

**Gate**: PASS — nenhuma violação. Sem entradas na Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/016-test-db-isolation/
├── plan.md              # Este arquivo
├── research.md          # Phase 0: decisões técnicas sobre schema-per-worker
├── data-model.md        # Phase 1: recursos (DBs, schemas, env vars)
├── quickstart.md        # Phase 1: como rodar localmente e no CI
├── contracts/
│   └── test-bootstrap-contract.md  # Phase 1: contrato do bootstrap E2E
├── checklists/
│   └── requirements.md
└── tasks.md             # Gerado por /speckit-tasks
```

### Source Code (repository root)

Mudanças e adições concentradas em quatro áreas — código de app, utilitários de DB, bootstrap de testes, infra de CI:

```text
src/
├── lib/
│   ├── env/
│   │   └── index.ts                      # [MOD] adiciona TEST_DATABASE_URL (opcional em dev, obrigatório em test)
│   └── db/
│       ├── index.ts                      # [inalterado] — DATABASE_URL continua sendo lido uma vez
│       ├── migrate.ts                    # [MOD] aceita --schema e --url para migrar em schema específico da base de teste
│       ├── seed.ts                       # [MOD] seed de dev (mantém admin + livre para crescer com exemplos)
│       ├── seed-test.ts                  # [NEW] seed mínimo para base de teste (apenas admin)
│       └── test-schema.ts                # [NEW] helpers: createWorkerSchema(name), dropWorkerSchema(name), cleanOrphanSchemas()

__tests__/
├── e2e/
│   ├── fixtures/
│   │   └── app-server.ts                 # [NEW] fixture worker-scoped: cria schema, aplica migrations, roda seed-test, sobe Next.js
│   ├── helpers/
│   │   ├── auth.ts                       # [MOD] aceita baseURL da fixture
│   │   ├── accessibility.ts              # [inalterado]
│   │   └── reset.ts                      # [NEW] truncateDomainTables(workerSchema): preserva user/account/session
│   ├── global-setup.ts                   # [DEL] removido — responsabilidade migra para fixtures
│   └── (demais .spec.ts passam a consumir a fixture)
├── helpers/
│   ├── db.ts                             # [MOD] passa a ler TEST_DATABASE_URL
│   └── factories.ts                      # [inalterado] — modelo para novas factories de domínio
└── integration/
    └── setup.ts                          # [MOD] lê TEST_DATABASE_URL

scripts/
└── db/
    ├── ensure-test-db.ts                 # [NEW] cria audiobook_track_test se não existir (idempotente)
    └── clean-orphan-schemas.ts           # [NEW] DROP em schemas e2e_* órfãos (usado no bootstrap)

.github/
└── workflows/
    └── ci.yml                            # [MOD] cria test DB, aplica migrations em public, roda E2E com 4 workers

package.json                              # [MOD] scripts db:test:setup, db:test:seed, ajustes em test:integration e test:e2e
playwright.config.ts                      # [MOD] remove webServer, habilita fullyParallel, workers=4 no CI, aponta para fixture
vitest.config.ts                          # [MOD] expõe TEST_DATABASE_URL para suites integration
.env.example                              # [MOD] adiciona TEST_DATABASE_URL
.env.test                                 # [NEW, gitignored] DATABASE_URL e TEST_DATABASE_URL para ambiente de teste local
drizzle/                                  # [inalterado] migrations existentes são reutilizadas
```

**Structure Decision**: Monorepo Next.js single-project. Feature toca principalmente a zona `__tests__/`, `src/lib/db/`, `src/lib/env/`, scripts de toolchain (`playwright.config.ts`, `vitest.config.ts`, CI) e adiciona um pequeno módulo `scripts/db/`. Zero impacto em camadas de domínio/API da aplicação.

## Complexity Tracking

Nenhuma violação de constituição. Nada a justificar.
