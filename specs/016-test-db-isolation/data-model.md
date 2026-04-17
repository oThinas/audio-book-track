# Data Model: Test Database Isolation

**Feature**: 016-test-db-isolation
**Date**: 2026-04-17

Esta feature não introduz entidades de domínio. O "modelo" aqui descreve os **recursos de infraestrutura** criados, seus nomes canônicos, relações e ciclos de vida.

---

## Recurso: Dev Database

- **Nome**: `audiobook_track`
- **Servidor**: mesma instância Postgres local / CI
- **Schema usado**: `public`
- **Fonte de verdade**: [src/lib/env/index.ts](src/lib/env/index.ts) `DATABASE_URL`
- **Ciclo de vida**: criado manualmente pelo desenvolvedor (`createdb audiobook_track`) ou pelo step de provisionamento do CI. Persistente.
- **População**: `bun run db:migrate` + `bun run db:seed`
- **Acesso**: somente pela aplicação em dev (`bun run dev`) e por `db:migrate`, `db:seed`. Testes NUNCA acessam.

## Recurso: Test Database

- **Nome**: `audiobook_track_test`
- **Servidor**: mesma instância do dev
- **Schema default**: `public` (usado pelos testes integration)
- **Schemas adicionais**: `e2e_w{index}_{shortUuid}` criados dinamicamente por worker Playwright
- **Fonte de verdade**: `TEST_DATABASE_URL`
- **Ciclo de vida**: criado pelo script `bun run db:test:setup` (idempotente). Schemas de worker têm ciclo próprio.
- **População**: `db:test:setup` aplica migrations em `public` e em cada schema de worker no início da suíte; executa `seed-test` em cada um.
- **Acesso**: apenas comandos de teste (`test:integration`, `test:e2e`) e `db:test:*`. Aplicação em dev ignora.

### Regra de segregação

- Aplicação em dev MUST usar apenas `DATABASE_URL`.
- Testes MUST usar apenas `TEST_DATABASE_URL`.
- Se `NODE_ENV === 'test'`, `TEST_DATABASE_URL` é obrigatório; `env.ts` aborta com erro claro na ausência.

---

## Recurso: Worker Schema

- **Nome**: `e2e_w{index}_{shortUuid}` — ex: `e2e_w0_3f8a1c2d`
  - `index`: `process.env.TEST_PARALLEL_INDEX` (Playwright, 0-based)
  - `shortUuid`: primeiros 8 chars de `randomUUID()`, gerados na inicialização do worker
- **Dono**: um e apenas um worker Playwright
- **Conteúdo**: cópia completa do schema público da aplicação (todas as migrations aplicadas)
- **Ciclo de vida**:
  1. `CREATE SCHEMA` antes do primeiro teste do worker (fixture `beforeWorker`)
  2. Migrations aplicadas via `migrate.ts --schema=<name>`
  3. `seed-test` aplicado no schema (cria admin)
  4. Durante a vida do worker: `TRUNCATE` seletivo entre testes (preservando admin)
  5. `DROP SCHEMA ... CASCADE` ao fim do worker (fixture `afterWorker`)
  6. Cleanup defensivo: schemas com prefixo `e2e_` e idade > 1h são removidos no `globalSetup` da próxima execução

### Invariantes

- Nenhum schema de worker pode ser compartilhado entre workers.
- `TRUNCATE` entre testes NUNCA toca `user`, `account`, `session` (admin preservado).
- O schema é sempre dropado ao fim, mesmo em falha (`try/finally` na fixture).

---

## Recurso: Admin Seed User

- **Escopo**: cada schema que contém as tabelas `user`/`account`/`session` (ou seja: `public` da test DB e todos os schemas `e2e_w*`)
- **Criação**: [src/lib/db/seed-test.ts](src/lib/db/seed-test.ts), idempotente (skip se já existe)
- **Credenciais**: `admin` / `admin123`, email `admin@audiobook.local`
- **Imutabilidade**: a linha existe enquanto o schema existe; `TRUNCATE` entre testes preserva.
- **Uso**: login default em todo helper E2E ([__tests__/e2e/helpers/auth.ts](__tests__/e2e/helpers/auth.ts))

### Regra de evolução

Se uma feature futura demandar outra conta fixa (ex: usuário sem permissão), a opção certa é **adicionar uma factory** (`createTestReadOnlyUser`), não expandir o seed-test.

---

## Recurso: Test Factory

- **Localização**: [__tests__/helpers/factories.ts](__tests__/helpers/factories.ts)
- **Existentes hoje**: `createTestUser`, `createTestSession`
- **Contrato**: cada factory recebe `TestDb` e overrides opcionais, retorna a entidade criada. Valores default são razoáveis para a maioria dos casos.
- **Evolução**: toda nova entidade de domínio (studio, book, chapter, narrator, editor) ganha sua factory aqui. O ponto único de manutenção.

### Convenção

```ts
export async function createTestBook(
  db: TestDb,
  overrides: { studioId: string; pricePerHour?: string; title?: string } = {},
): Promise<{ book: typeof book.$inferSelect }>;
```

---

## Recurso: Environment Variable — `TEST_DATABASE_URL`

- **Tipo**: string Postgres URL (`postgresql://user:pass@host:port/dbname`)
- **Obrigatoriedade**:
  - `NODE_ENV=development`: opcional (ignorada)
  - `NODE_ENV=test`: obrigatória; ausência falha a validação Zod em `env/index.ts`
- **Default em `.env.example`**: `postgresql://postgres:postgres@localhost:5432/audiobook_track_test`
- **Validação**: schema Zod em [src/lib/env/index.ts](src/lib/env/index.ts) — requer formato URL válido

---

## Relações

```text
┌──────────────────────────┐            ┌──────────────────────────────┐
│ audiobook_track (dev DB) │            │ audiobook_track_test         │
│ └── public               │            │ ├── public                   │
│     └── (dados de dev)   │            │ │   └── (integration tests)  │
└──────────────────────────┘            │ ├── e2e_w0_3f8a1c2d          │
                                        │ │   ├── user (admin)         │
                                        │ │   ├── session              │
                                        │ │   ├── account              │
                                        │ │   └── (domínio, truncado)  │
                                        │ ├── e2e_w1_7b2e9f01          │
                                        │ ├── e2e_w2_...               │
                                        │ └── e2e_w3_...               │
                                        └──────────────────────────────┘
```

Nenhuma FK cruza schemas. Cada schema é um universo fechado que contém uma cópia completa do modelo da aplicação.

---

## Transições de estado — Worker Schema

```text
     (não existe)
          │
          │ fixture beforeWorker
          ▼
   [criado + migrado + seed aplicado]
          │
          │ TRUNCATE domínio entre testes
          ├─────────► [limpo, admin preservado] ─┐
          │                                       │
          │                                       │ próximo teste
          │ ◄─────────────────────────────────────┘
          │
          │ fixture afterWorker (finally)
          ▼
   DROP SCHEMA CASCADE
          │
          ▼
     (removido)
```

Se o processo morre antes do `afterWorker`, o schema fica órfão e é coletado na próxima execução pelo `clean-orphan-schemas`.
