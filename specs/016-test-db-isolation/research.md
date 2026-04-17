# Research: Test Database Isolation

**Feature**: 016-test-db-isolation
**Date**: 2026-04-17

## Objetivo

Documentar decisões técnicas sobre como aplicar `search_path` por worker Playwright, como aplicar migrations Drizzle em schemas não-`public`, e como adaptar o padrão schema-per-test-file do nest-clean (vitest) para o modelo schema-per-worker (Playwright).

---

## Decisão 1: Propagação do schema para a aplicação Next.js

**Decisão**: Usar connection string com `options=-c%20search_path%3D<schema>` para forçar o `search_path` em toda conexão que o `Pool` do `pg` abrir. Não haverá mudança em [src/lib/db/index.ts](src/lib/db/index.ts) — a mesma URL é interpretada automaticamente.

**Rationale**:
- `src/lib/db/index.ts` constrói o `Pool` uma única vez no bootstrap. Não há ponto natural para setar `search_path` por request sem um middleware intrusivo.
- O driver `pg` respeita `options` nativamente; o Postgres aplica `SET search_path=<schema>` em cada conexão nova que o Pool abrir.
- Zero mudança em código de domínio ou de repositório.

**Alternatives considered**:
- **Middleware Next.js que injeta `SET search_path` por request**: adiciona round-trip por request e acopla domain a detalhes de teste. Rejeitado.
- **Header/cookie com schema-name lido pelo Pool**: exige um wrapper no `db` que leia o contexto por request. Invasivo e frágil. Rejeitado.
- **Uma base Postgres separada por worker (em vez de schema)**: custoso (cria/dropa bases é lento, muitas conexões) e não atende à preferência do usuário de usar schemas. Rejeitado.

**Exemplo de URL gerada**:
```
postgresql://postgres:postgres@localhost:5432/audiobook_track_test?options=-c%20search_path%3De2e_w0_abc123de
```

---

## Decisão 2: Aplicação de migrations Drizzle em schema arbitrário

**Decisão**: Ampliar [src/lib/db/migrate.ts](src/lib/db/migrate.ts) para aceitar `--url` e `--schema` via argv. Quando `--schema` é passado, a conexão usa `options=-c search_path=<schema>` e a `__drizzle_migrations` é criada automaticamente dentro desse schema. O mesmo binário é reutilizado pela fixture do worker.

**Rationale**:
- `drizzle-orm/node-postgres/migrator` executa as migrations no schema atual da conexão. Setar `search_path` antes basta.
- Cada schema de worker passa a ter sua própria `__drizzle_migrations`, isolada.
- Mantém a política da constituição: `generate` + `migrate`, nunca `push`.

**Alternatives considered**:
- **Executar `CREATE SCHEMA; SET search_path; \i drizzle/*.sql` manualmente via `pg`**: reinventa o que o migrator já faz e perde o journal. Rejeitado.
- **Reset via `pg_dump` de um schema template**: mais rápido em schemas grandes, mas exige manter um template sincronizado. Prematuro para o volume atual. Descartado por YAGNI.

**Invocação**:
```bash
bun run src/lib/db/migrate.ts --url "$TEST_DATABASE_URL" --schema "e2e_w0_abc123de"
```

---

## Decisão 3: Nome do schema por worker

**Decisão**: Formato `e2e_w{index}_{shortUuid}`, onde `index` é `process.env.TEST_PARALLEL_INDEX` e `shortUuid` são 8 chars de `randomUUID()` gerados no início da sessão (por worker).

**Rationale**:
- Índice determinístico facilita debug ("quem é o schema do worker 2?").
- Sufixo UUID elimina colisão com schemas órfãos de execuções anteriores (se um processo morreu antes do teardown).
- Padrão alinhado com o que o `nest-clean` faz (UUID puro), mas com prefixo legível para humanos.

**Alternatives considered**:
- **UUID puro**: legível só para máquinas. Debug ruim.
- **Apenas `e2e_w{index}`**: colide com schemas órfãos. Forçaria DROP antes de CREATE, o que é OK mas perde resiliência se dois processos Playwright rodarem no mesmo banco (raro, mas possível em dev).

---

## Decisão 4: Limpeza de schemas órfãos

**Decisão**: Rodar `scripts/db/clean-orphan-schemas.ts` no início da suíte E2E (via `globalSetup` do Playwright). Ele dá `DROP SCHEMA IF EXISTS` em qualquer schema que combine com `e2e_%` e tenha mais de 1 hora de idade (via `pg_namespace` + heurística). Schemas recentes de outro processo ativo são preservados.

**Rationale**:
- Garante que dev local, que pode ter sessões mortas por Ctrl+C, não acumule schemas indefinidamente.
- Heurística de 1h é conservadora o suficiente para nunca matar um schema em uso.
- Roda uma única vez por execução, não por worker.

**Alternatives considered**:
- **Teardown agressivo a cada run**: risco em dev quando há múltiplos `playwright test` concorrentes. Rejeitado.
- **Nada (confiar apenas em afterAll)**: quebra na primeira vez que o processo é morto. Rejeitado.

---

## Decisão 5: Arquitetura de fixtures Playwright (substituindo `webServer`)

**Decisão**: Remover `webServer` de [playwright.config.ts](playwright.config.ts). Criar fixture **worker-scoped** em `__tests__/e2e/fixtures/app-server.ts` que:

1. No primeiro uso dentro do worker:
   - Gera `schemaName` determinístico + random.
   - `CREATE SCHEMA "<schemaName>"` na base de teste.
   - Aplica migrations no schema via `migrate.ts --schema`.
   - Aplica seed-test (apenas admin).
   - Aloca porta livre (`3100 + index` com fallback incremental).
   - Spawn `next dev --port <port>` com `DATABASE_URL=<test url com search_path=schemaName>`.
   - Aguarda `GET /api/health` responder 200.
   - Retorna `{ baseURL, schemaName }` pros testes.

2. Ao final do worker (`afterWorker`):
   - Mata o processo Next.js (SIGTERM + espera + SIGKILL em timeout).
   - `DROP SCHEMA "<schemaName>" CASCADE`.

3. `test.use({ baseURL })` é aplicado via `test.extend` para que `page.goto('/')` resolva pra porta correta.

**Rationale**:
- `webServer` do Playwright só permite um servidor compartilhado. Fixture resolve o problema.
- Worker-scoped garante que todos os testes do mesmo worker reusam o mesmo servidor (bootstrap não acontece por teste).
- `test.extend` é a API padrão do Playwright para estender fixtures — sem hacks.

**Alternatives considered**:
- **`webServer` array com N entradas estáticas**: funciona, mas `workers` é dinâmico (varia entre local e CI). Rejeitado.
- **Um único servidor + header `X-Test-Schema` roteando pra schema por request**: middleware intrusivo e ataca o modelo de conexão-pool da app. Rejeitado.

---

## Decisão 6: Reset entre testes (FR-010)

**Decisão**: Helper `truncateDomainTables(db, schemaName)` em [__tests__/e2e/helpers/reset.ts](__tests__/e2e/helpers/reset.ts). Ele consulta `information_schema.tables` do schema, filtra as tabelas de domínio (hoje: `userPreference`, `verification` — futuramente: `studio`, `book`, `chapter`, `narrator`, `editor`), e executa um único `TRUNCATE ... RESTART IDENTITY CASCADE`. As tabelas `user`, `account`, `session` são preservadas para manter as linhas do admin.

**Rationale**:
- `TRUNCATE` é atômico, rápido (< 5ms em schemas pequenos), reseta sequences.
- Filtragem dinâmica pelo information_schema evita manutenção: quando uma nova tabela de domínio é adicionada, ela é incluída automaticamente.
- Preserva o padrão da clarificação Q1 (admin não é apagado nem recriado).

**Alternatives considered**:
- **Lista hardcoded de tabelas**: obriga atualizar a cada migration. Rejeitado.
- **DELETE em vez de TRUNCATE**: não reseta sequences, 10x mais lento. Rejeitado.
- **DROP + recreate schema por teste**: custo ≥ 500ms por teste, amplifica suite em 100x+. Rejeitado.

---

## Decisão 7: Integration tests migrando para base de teste

**Decisão**: [__tests__/integration/setup.ts](__tests__/integration/setup.ts) passa a ler `TEST_DATABASE_URL` em vez de `DATABASE_URL`. Migrations são aplicadas no schema `public` da `audiobook_track_test` uma única vez no bootstrap da suíte integration (via novo arquivo `__tests__/integration/global-setup.ts` — um hook `globalSetup` do Vitest).

**Rationale**:
- Mantém o isolamento `BEGIN`/`ROLLBACK` já existente.
- `public` da base de teste coexiste com schemas `e2e_w*` sem interferência (namespaces distintos).
- Sem mudança na lógica dos testes integration.

**Alternatives considered**:
- **Schema `integration` dedicado**: uniforme com E2E, mas sem ganho prático e com overhead de setup. Rejeitado (clarificação Q3).
- **Schema por arquivo integration** (padrão nest-clean): BEGIN/ROLLBACK já dá isolamento perfeito; schema-por-arquivo é overkill aqui. Rejeitado.

---

## Decisão 8: Split do seed

**Decisão**: Criar [src/lib/db/seed-test.ts](src/lib/db/seed-test.ts) que contém APENAS o usuário admin (via `better-auth`). [src/lib/db/seed.ts](src/lib/db/seed.ts) continua apontando para dev e fica livre para crescer com fixtures de exemplo (livros, capítulos) no futuro. A decisão de não atualizar `seed-test.ts` a cada nova entidade é parte do contrato: novos testes usam factories (padrão em [__tests__/helpers/factories.ts](__tests__/helpers/factories.ts)), nunca seed.

**Rationale**:
- Seed-test estável → custo de manutenção zero ao longo do tempo.
- Factories tornam cada teste autodocumentado sobre seus próprios dados.
- Alinhado com FR-013, FR-014, FR-015.

**Alternatives considered**:
- **Seed compartilhado com flag `--test`**: invita branching lógico e drift. Rejeitado.
- **Popular seed-test com exemplos de domínio**: quebra FR-014. Rejeitado.

---

## Decisão 9: 4 workers no CI

**Decisão**: `playwright.config.ts` passa a definir `workers: process.env.CI ? 4 : undefined`. Local usa default Playwright (baseado em CPU). CI força 4.

**Rationale**:
- Meta de 40% de redução (SC-005) com runner de 2 vCPU exige paralelismo > 2x.
- Next.js dev consome ~200-400 MB residente; 4 × 400 = 1.6 GB, dentro do envelope de 7 GB do runner.
- Postgres suporta até 100 conexões default; 4 workers × ~5 conexões cada = 20 conexões. Folgado.

**Alternatives considered**:
- **2 workers**: reduz risco mas não atinge meta. Rejeitado.
- **CPU-based (undefined)**: runner default tem 2 CPU → Playwright escolheria 1 worker (conservador). Força é necessária.
- **8 workers**: memória insuficiente. Rejeitado.

Se a meta SC-005 não for atingida com 4 workers, o número pode ser ajustado sem alterar o resto do design.

---

## Decisão 10: Inspiração do nest-clean e divergências

**Padrão copiado**:
- `randomUUID()` como sufixo do schema name.
- Mutar `URL` via `searchParams.set(...)` para propagar o schema para processos filhos.
- `DROP SCHEMA IF EXISTS ... CASCADE` no teardown.
- `.env.test` com override para isolar envs de teste.

**Divergências justificadas**:

| Aspecto | nest-clean | audio-book-track |
|---|---|---|
| Granularidade | Schema por arquivo de teste (`beforeAll`) | Schema por worker Playwright (`beforeWorker`) |
| Por quê | Vitest gera processo por arquivo; custo de setup amortizado | Playwright worker comporta múltiplos testes; amortizar por worker reduz overhead |
| Framework | NestJS + supertest (Node puro) | Next.js + Playwright (browser real) |
| Por quê | Testes de controller; não há browser envolvido | Fluxos reais de usuário exigem browser |
| Migrations | `prisma db push --skip-generate` | `drizzle-kit migrate` com `search_path` explícito |
| Por quê | Prisma schema-first com push simples | Drizzle com constituição que proíbe `push` |
| Reset entre testes | N/A (schema descartado por arquivo) | `TRUNCATE` seletivo preservando admin |
| Por quê | Cada arquivo isola tudo | Workers têm vários testes; reset por teste é necessário |

---

## Referências

- [nest-clean/test/setup-e2e.ts](https://github.com/oThinas/nest-clean/blob/main/test/setup-e2e.ts) — padrão schema-per-file com UUID
- [Postgres docs — search_path and options](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-SEARCH-PATH)
- [Playwright test fixtures — worker scope](https://playwright.dev/docs/test-fixtures#worker-scoped-fixtures)
- [Drizzle migrator — node-postgres](https://orm.drizzle.team/docs/migrations)

Todas as `NEEDS CLARIFICATION` do Technical Context foram resolvidas. Pronto para Phase 1.
