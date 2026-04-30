# Baseline de testes — feature 021

**Capturado em**: 2026-04-30T05:46:10Z
**Branch**: `021-presentation-only-components` (com `main` mergeado)
**Comando**: `bun run test:unit && bun run test:integration && bun run test:e2e`
**Ambiente**: Postgres 16-alpine via `docker compose up -d db`; `db:test:setup` aplicado.

## Resumo

| Suíte | Test Files | Tests | Passados | Falhados | Duração |
|---|---:|---:|---:|---:|---:|
| Unit (`vitest run __tests__/unit/`) | 59 | 633 | 633 | 0 | 4.58s |
| Integration (`NODE_ENV=test vitest run __tests__/integration/`) | 32 | 216 | 216 | 0 | 4.47s |
| E2E (`playwright test`, chromium) | — | 214 | 214 | 0 | ~1.0m |
| **Total** | **91+** | **1063** | **1063** | **0** | — |

## Notas

- **Vitest 4.1.2** rodando em projetos `unit` (env `node`, com `// @vitest-environment jsdom` por arquivo quando necessário) e `integration` (env `node`, transação BEGIN/ROLLBACK por teste).
- **Playwright** com schema-per-worker em `audiobook_track_test`; servidores `next start` por worker em `BASE_E2E_PORT + workerIndex`.
- Esta baseline é o **oráculo de não-regressão** para a refatoração de componentes apresentacionais. Toda task `[US1|US2]` que toca componentes existentes DEVE manter integration + e2e na mesma contagem (`216` e `214`); novas suítes unitárias de hooks aumentarão `633`.

## Como reproduzir

```bash
docker compose up -d db
bun run db:test:setup
bun run test:unit
bun run test:integration
bun run test:e2e
```