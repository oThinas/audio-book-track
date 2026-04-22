# Implementation Plan: CRUD de Estúdios

**Branch**: `019-studios-crud` | **Date**: 2026-04-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-studios-crud/spec.md`

## Summary

Feature aditiva que cria a entidade **Estúdio** com CRUD completo em `/studios`, replicando a estrutura backend de Editor (pós-018) em todas as camadas — domain, repository, service, factory, errors, rotas REST — e adicionando uma coluna financeira `default_hourly_rate` (`numeric(10,2)`) que nenhuma entidade anterior possui. Estúdio tem uma única constraint: `name` único (case-sensitive com `trim`, mesma regra de Narrador/Editor). A diferença chave em relação a 018 é a introdução de um **componente genérico `MoneyInput`** em `components/ui/` com UX cents-first (conforme clarificação Q2 da sessão 2026-04-21), que será reutilizado na futura feature de Livros. No frontend, os componentes de feature residem em `src/components/features/studios/` conforme Princípio VII da constituição v2.11.0 — pastas `_components/` dentro de `src/app/` são proibidas. A ordenação padrão `created_at DESC` é aplicada no client (via `useMemo`) mantendo o repository em `asc(createdAt)`. A migração Drizzle cria a tabela `studio` com 1 `uniqueIndex` (`studio_name_unique`) e nenhum FK (livros referenciarão estúdio em feature futura). Nenhum seed é criado — testes usam factory `createTestStudio(db, overrides)`.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (Bun runtime 1.2)
**Primary Dependencies**: Next.js 16.2.1 (App Router), React 19.2.4, Drizzle ORM 0.45.2 + drizzle-kit 0.31.10, Zod 4.3.6, better-auth 1.5.6, React Hook Form 7.72.1 + `@hookform/resolvers` 5.2.2, `@tanstack/react-table` 8.21.3, shadcn/ui 4.1.2, Tailwind CSS 4.2, sonner 2.0.7
**Storage**: PostgreSQL via Drizzle ORM — tabela `studio` **nova** (não existe no schema atual), sem FKs entrantes ou saintes nesta feature. Um índice único: `studio_name_unique` em `name` (byte-exato). Campo `default_hourly_rate` como `numeric(10,2)` — lidado como `string` no driver do Drizzle, convertido em `number` na borda do repository.
**Testing**: Vitest 4.1 (unit + integration via BEGIN/ROLLBACK), Playwright 1.59 (E2E schema-per-worker), Testing Library 16.3, `@axe-core/playwright`
**Target Platform**: Web (Next.js SSR + RSC); produção em Node 20+
**Project Type**: Web application (Next.js full-stack em `src/`)
**Performance Goals**: LCP < 1s mantido; criação/edição/exclusão de estúdio < 10s ponta-a-ponta (SC-001)
**Constraints**: Nova tabela + 1 índice único em uma única migração; volume inicial zero (feature inaugura a tabela); nenhum risco de conflito com dados existentes. Nenhum FK ainda; livro-para-estúdio virá em feature futura.
**Scale/Scope**: ~18 arquivos de produção novos + ~15 arquivos de teste novos; 1 migração Drizzle; 0 novas dependências (stack 100% reaproveitada de Editor). Volume esperado ≤ dezenas de estúdios — sem paginação nesta feature. Novo primitivo `MoneyInput` em `components/ui/` é o único artefato que NÃO é duplicação de feature anterior.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Princípio I — Capítulo como Unidade de Trabalho**: ✅ Estúdio é entidade de suporte. O vínculo com livro (`book.studio_id`) e, transitivamente, com capítulo (`chapter.book_id`), é explicitamente deferido para a feature de livros. Nenhuma operação financeira passa a ser feita no nível do estúdio.

**Princípio II — Precisão Financeira**: ✅ O campo `default_hourly_rate` NÃO participa de cálculos de ganho — é apenas um valor-padrão/sugestão aplicado **uma única vez** no momento da criação de um livro, copiado para `book.price_per_hour` e nunca mais consultado (ver spec FR-026 e Session 2026-04-21 Q1). Todo cálculo continua usando `livro.preço_por_hora` (imutável quando `pago`). O tipo é `numeric(10,2)` — `float` proibido. Service trata conversão `string↔number` na borda do repository (research §R2).

**Princípio III — Ciclo de Vida do Capítulo**: ✅ N/A.

**Princípio IV — Simplicidade (YAGNI)**: ✅ A feature adiciona complexidade justificada: (a) Estúdio é entidade distinta no domínio (constituição §Domain Model Constraints), (b) `default_hourly_rate` responde a requisito de UX explícito (Q2), (c) `MoneyInput` é genérico desde o nascimento porque o uso futuro em Livros já está contratado no spec (FR-025a). **Não** são adicionados: soft delete, auditoria, paginação, filtros, busca textual, fórmula de média de preço, histórico de alterações. Duplicação vs abstração é decidida no spec (FR-027–031): duplicamos a camada backend de Editor.

**Princípio V — TDD + Isolamento de Testes**: ✅ Testes escritos antes da implementação em todas as camadas. Classificação:
- **Unit** (Vitest): Zod schema, service com `InMemoryStudioRepository`, handlers de API com deps injetadas, `MoneyInput` isolado com React Testing Library.
- **Integration** (Vitest + BEGIN/ROLLBACK): `DrizzleStudioRepository` contra Postgres real + unicidade + round-trip `numeric(10,2) ↔ number`.
- **E2E** (Playwright schema-per-worker): `/studios` completo, uso de `MoneyInput` no browser real, dark mode, a11y, responsivo, concorrência.
Cobertura ≥ 80% (SC-011). **Zero seed** — todos os estúdios são criados por `createTestStudio(db, overrides)` na factory (spec FR-023, constituição §Factory, não seed).

**Princípio VI — Arquitetura Limpa Backend**: ✅ Cada camada em seu lugar:
- `src/lib/domain/studio.ts` — entidade + schemas Zod
- `src/lib/domain/studio-repository.ts` — interface (sem prefixo `I`)
- `src/lib/repositories/drizzle/drizzle-studio-repository.ts` — implementação concreta, prefixo `Drizzle`, conversão `numeric` ↔ `number` encapsulada
- `src/lib/services/studio-service.ts` — use cases + `name.trim()` antes de persistir
- `src/lib/factories/studio.ts` — composition root: `createStudioService()`
- `src/lib/errors/studio-errors.ts` — `StudioNameAlreadyInUseError`, `StudioNotFoundError`
- `src/app/api/v1/studios/route.ts` + `[id]/route.ts` — controllers finos usando helpers de `lib/api/responses.ts`

Controllers não instanciam repo/service diretamente; tudo via factory. Injeção via construtor no `StudioService`.

**Princípio VII — Frontend: Composição, Atomicidade, Mobile First**: ✅
- Página `/studios` usa `<PageContainer>` + componentes de layout (FR-001).
- Componentes de feature em `src/components/features/studios/` (**NÃO em `_components/`**, em conformidade com Princípio VII v2.11.0, FR-024).
- Componentes atômicos de `components/ui/` reaproveitados (Button, Table, ScrollArea, Dialog, Input, Label — FR-027).
- `MoneyInput` **novo** em `components/ui/money-input.tsx` — atômico, sem dependência de domínio, pronto para Livros (FR-025a).
- Componentes de feature duplicados a partir de Editor, trocando `email` por `defaultHourlyRate` e substituindo `<Input>` por `<MoneyInput>` no campo monetário.
- Dark mode obrigatório (FR-021). Mobile first — layout herdado de Editor (já validado).
- `design.pen` (Node ID `rkZ68`) consultado via Pencil MCP antes da implementação.

**Princípio VIII — Performance**: ✅ Server Component na page. `use client` apenas onde há interatividade (row, new-row, table, dialog, `MoneyInput`). Bundle cresce ~1–2 kb (uma tabela a mais e o `MoneyInput`, que é leve — apenas `Intl.NumberFormat` + state controlado). Sem virtualização necessária.

**Princípio IX — Design Tokens**: ✅ Zero cores hardcoded. `MoneyInput` usa os mesmos tokens de `Input` do shadcn. `destructive` para ícone/botão de excluir (FR-022).

**Princípio X — Padrões REST**: ✅ Rotas: `GET/POST /api/v1/studios`, `PATCH/DELETE /api/v1/studios/:id`. Status codes: `200` (GET/PATCH), `201` (POST com `Location`), `204` (DELETE), `401`, `404`, `409` (`NAME_ALREADY_IN_USE`), `422`. Envelope `{ data }` / `{ error: { code, message, details? } }`. Input validado com Zod incluindo faixa `0.01 ≤ defaultHourlyRate ≤ 9999.99` e `multipleOf(0.01)`. `Cache-Control: no-store` em todas as respostas.

**Princípio XI — PostgreSQL**: ✅ Migração via `drizzle-kit generate` + `bun run db:migrate` — nunca `push`. Tabela nova em `src/lib/db/schema.ts`:
```
CREATE TABLE studio (
  id text PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  default_hourly_rate numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX studio_name_unique ON studio (name);
```
Tipos: `text` para strings, `numeric(10,2)` para monetário (**NUNCA** `float`), `timestamptz` para datas, `text` PK com `$defaultFn(() => crypto.randomUUID())`. Nenhum FK. Queries sempre selecionam colunas explícitas (`STUDIO_COLUMNS`) — proibido `SELECT *`.

**Princípio XII — Anti-padrões**: ✅ Nenhum introduzido. Sem `any`, sem elementos HTML crus, sem `_components/`, sem `fetch` em `useEffect`, sem `useEffect` para derivar estado (o cents-first é feito via onChange + state controlado no `MoneyInput`), sem `drizzle-kit push`, sem mutação de parâmetros (service retorna novo objeto).

**Princípio XIII — Métricas**: ✅ N/A — estúdio não gera KPIs nesta feature. KPI 3 ("Livros em andamento agrupados por estúdios distintos") depende da tabela de livros, fora de escopo.

**Princípio XIV — PDF Viewer**: ✅ N/A.

**Princípio XV — Skills**: ✅ Workflow `/speckit.*`. `/shadcn` pode ser consultado se surgir dúvida sobre composição do `MoneyInput` com `Input`. **Context7 MCP**: consultar antes de implementar o cents-first (tópicos `Intl.NumberFormat` pt-BR, behavior de `onBeforeInput`/`onKeyDown` no React 19 para interceptar caracteres não-numéricos) e, se necessário, sobre Drizzle `numeric` mode (confirmação em research §R2). `design.pen` via Pencil MCP (Node ID `rkZ68`) consultado antes da implementação dos componentes React.

**Princípio XVI — Qualidade/Verificação**: ✅ Durante fases intermediárias: apenas os testes TDD diretamente afetados. Fase final única antes do PR: `bun run lint` → `bun run test:unit` → `bun run test:integration` → `bun run test:e2e` → `bun run build`.

**Resultado do gate inicial**: ✅ **PASS** sem violações. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/019-studios-crud/
├── plan.md              # This file (/speckit.plan)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── studios-api.md   # Contrato REST completo de /api/v1/studios[/:id]
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec (já existe)
└── tasks.md             # Phase 2 output (/speckit.tasks — NÃO criado aqui)
```

### Source Code (repository root)

Estrutura do monorepo Next.js **existente**; arquivos novos marcados com **[NOVO]**; modificações com **[MOD]**.

```text
src/
├── app/
│   ├── (authenticated)/studios/
│   │   └── page.tsx                                       # [NOVO] Server Component — list() + <StudiosClient>
│   └── api/v1/studios/                                    # [NOVO]
│       ├── route.ts                                       # GET, POST
│       └── [id]/route.ts                                  # PATCH, DELETE
├── components/
│   ├── ui/
│   │   └── money-input.tsx                                # [NOVO] Cents-first BRL input (genérico, reutilizável em Livros)
│   └── features/studios/                                  # [NOVO] conforme Princípio VII v2.11.0
│       ├── studios-client.tsx                             # Wrapper client: toast, sort DESC via useMemo, orquestra create/update/delete
│       ├── studios-table.tsx                              # TanStack Table — colunas Nome + Valor/hora + ações, sorting client-side
│       ├── studio-row.tsx                                 # Linha com modos view/edit (Input name + MoneyInput defaultHourlyRate)
│       ├── studio-new-row.tsx                             # Linha de criação inline
│       └── delete-studio-dialog.tsx                       # Modal de confirmação destructive
├── lib/
│   ├── domain/
│   │   ├── studio.ts                                      # [NOVO] Studio + studioFormSchema + create/update schemas
│   │   └── studio-repository.ts                           # [NOVO] interface StudioRepository
│   ├── errors/
│   │   └── studio-errors.ts                               # [NOVO] StudioNameAlreadyInUseError, StudioNotFoundError
│   ├── factories/
│   │   └── studio.ts                                      # [NOVO] createStudioService()
│   ├── repositories/drizzle/
│   │   └── drizzle-studio-repository.ts                   # [NOVO] DrizzleStudioRepository + conversão numeric↔number
│   ├── services/
│   │   └── studio-service.ts                              # [NOVO] StudioService (trim name, delegação)
│   └── db/
│       └── schema.ts                                      # [MOD] adicionar tabela `studio` + 1 uniqueIndex
│
drizzle/
├── 0XXX_<auto-nome>.sql                                   # [NOVO] CREATE TABLE studio + CREATE UNIQUE INDEX
└── meta/_journal.json                                     # [MOD] atualizado pelo drizzle-kit
│
__tests__/
├── helpers/factories.ts                                   # [MOD] createTestStudio(db, overrides)
├── repositories/
│   └── in-memory-studio-repository.ts                     # [NOVO] InMemoryStudioRepository
├── unit/
│   ├── domain/studio-schema.spec.ts                       # [NOVO] asserts em studioFormSchema (faixa 0.01–9999.99, multipleOf 0.01, trim name)
│   ├── services/studio-service.spec.ts                    # [NOVO] asserts de trim + delegação
│   ├── components/money-input.spec.ts                     # [NOVO] cents-first UX (digitar/backspace/caracteres inválidos/ceiling 999999)
│   └── api/
│       ├── studios-list.spec.ts                           # [NOVO]
│       ├── studios-create.spec.ts                         # [NOVO] inclui 409 NAME, 422 faixa inválida
│       ├── studios-update.spec.ts                         # [NOVO] inclui 409 NAME, idempotência
│       └── studios-delete.spec.ts                         # [NOVO]
├── integration/repositories/
│   └── drizzle-studio-repository.spec.ts                  # [NOVO] CRUD contra Postgres real + unicidade + round-trip numeric↔number
└── e2e/
    ├── studios-list.spec.ts                               # [NOVO] inclui assert de ordenação DESC por createdAt
    ├── studios-create.spec.ts                             # [NOVO] inclui cents-first UX, faixa, duplicate name
    ├── studios-update.spec.ts                             # [NOVO]
    ├── studios-delete.spec.ts                             # [NOVO]
    ├── studios-accessibility.spec.ts                      # [NOVO] @axe-core/playwright
    ├── studios-concurrent-ops.spec.ts                     # [NOVO]
    ├── studios-responsive.spec.ts                         # [NOVO]
    ├── studios-font-size.spec.ts                          # [NOVO]
    ├── studios-dark-mode.spec.ts                          # [NOVO]
    └── studios-primary-colors.spec.ts                     # [NOVO]
```

**Structure Decision**: Projeto monorepo Next.js mantido. A feature adiciona:
- 1 primitivo genérico em `components/ui/` (`MoneyInput`) — primeira vez que algo assim é adicionado nesta feature branch, justificado por reuso contratado em Livros.
- Feature components em `src/components/features/studios/` (sem `_components/`) — compliance Princípio VII v2.11.0.
- Stack backend duplicada 1:1 de Editor.
- Tabela `studio` nova + 1 `uniqueIndex`.
- Zero alterações em Editor/Narrador/Users/Auth.

## Phase 0: Research

Tópicos que exigem decisão técnica explícita antes da implementação (consolidados em [research.md](./research.md)):

1. **R1 — UX cents-first para `MoneyInput`**: como interceptar input e acumular dígitos como centavos, formatando com `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`. Decisão entre `onChange` + state controlado vs `contentEditable`.
2. **R2 — Drizzle `numeric(10,2)`**: o driver retorna `string` por padrão. Decidir se a conversão para `number` acontece na borda do repository (`Number(row.default_hourly_rate)`) ou se o service opera com `string`. Trade-off de precisão vs ergonomia.
3. **R3 — Mapeamento de unique-violation**: reuso do padrão já consolidado em `DrizzleEditorRepository` (`getUniqueConstraintName` com fallback para `error.cause`). Duplicar ou extrair para `lib/db/postgres-errors.ts`? Decisão YAGNI.
4. **R4 — Zod schema para valor monetário**: `z.number().min(0.01).max(9999.99).multipleOf(0.01)` vs. variantes com `z.number().refine()`. Lidar com edge case de floating-point em `multipleOf(0.01)` (ex: `0.1 + 0.2`).
5. **R5 — Ordenação default no client**: confirmar pattern do `useMemo` usado em `editors-client.tsx` e `narrators-client.tsx`, documentar decisão de manter asc no repo + desc no client.
6. **R6 — Não-uso de seed**: consequências para `/quickstart.md` (produtor cria o primeiro estúdio manualmente) e para E2E (fixture auto-reset TRUNCATE continuará preservando admin-only; studios criados por teste são limpos).
7. **R7 — Localização de `MoneyInput`**: `components/ui/money-input.tsx` (shadcn-style) é a escolha correta? Ou `components/shared/`? Alinhar com convenção existente.

**Output**: research.md consolidando decisões R1–R7 com formato `Decision / Rationale / Alternatives considered`.

## Phase 1: Design & Contracts

**Prerequisites**: `research.md` completo.

1. **Data model** → [data-model.md](./data-model.md):
   - Entidade `Studio` com atributos, tipos, validações.
   - Relacionamentos (nenhum nesta feature; `book.studio_id` deferido).
   - Constraints de banco (unique index, NOT NULL, range via CHECK? — decidido em research.md).
   - Invariantes domain-level.

2. **API contracts** → [contracts/studios-api.md](./contracts/studios-api.md):
   - `GET /api/v1/studios` — 200, 401.
   - `POST /api/v1/studios` — 201 (+ `Location`), 401, 409 (`NAME_ALREADY_IN_USE`), 422.
   - `PATCH /api/v1/studios/:id` — 200, 401, 404, 409, 422.
   - `DELETE /api/v1/studios/:id` — 204, 401, 404.
   - Envelopes e payload schemas em Zod.

3. **Quickstart** → [quickstart.md](./quickstart.md):
   - Como rodar `bun run db:generate && bun run db:migrate` e inspecionar a tabela nova.
   - Como criar o primeiro estúdio manualmente em `/studios` (sem seed).
   - Como usar o `MoneyInput` em uma nova feature (contrato público do componente).
   - Como rodar os testes da feature.

4. **Agent context update**:
   - `.specify/scripts/bash/update-agent-context.sh claude` — registrar "019-studios-crud" no contexto.

**Output**: data-model.md, contracts/studios-api.md, quickstart.md, CLAUDE.md atualizado.

## Fluxo TDD (ordem canônica de implementação)

> A ordem abaixo garante que cada mudança seja guiada por testes que falham antes da alteração de código, conforme Princípio V.

1. **Domínio primeiro (schema DB + entity)**
   - Adicionar tabela `studio` em `src/lib/db/schema.ts` com `id`, `name`, `defaultHourlyRate`, timestamps e 1 `uniqueIndex`.
   - Gerar migração: `bun run db:generate` → inspecionar SQL → aplicar com `bun run db:migrate`.
   - Criar `src/lib/domain/studio.ts` com interface `Studio` e schemas Zod.

2. **Testes unitários de domínio (Zod)**
   - `__tests__/unit/domain/studio-schema.spec.ts`: casos válidos (name trim, valor no meio da faixa); inválidos (name < 2 ou > 100, valor 0, valor 9999.99 + 0.01, valor com 3 decimais via `multipleOf`).
   - Rodar: falham (schema ausente).
   - Criar schema, confirmar verde.

3. **Repository — interface e integration test**
   - Criar `src/lib/domain/studio-repository.ts`.
   - `__tests__/integration/repositories/drizzle-studio-repository.spec.ts`: CRUD + unicidade de nome + round-trip `numeric ↔ number` (persistir `85.00`, recuperar como `85`).
   - Rodar: falham.
   - Criar `src/lib/repositories/drizzle/drizzle-studio-repository.ts` espelhando Editor, trocando `email` por `defaultHourlyRate` e encapsulando `Number(row.default_hourly_rate)` no retorno + `String(input.defaultHourlyRate.toFixed(2))` na escrita (confirmado em research §R2).
   - Confirmar verde.

4. **Errors**
   - `src/lib/errors/studio-errors.ts` com `StudioNameAlreadyInUseError`, `StudioNotFoundError`.

5. **Service + unit tests com fake in-memory**
   - `__tests__/repositories/in-memory-studio-repository.ts` — duplica InMemoryEditor adaptado.
   - `__tests__/unit/services/studio-service.spec.ts`: `create` faz `trim(name)`; `update` também; delegações simples.
   - Rodar: falham.
   - Criar `src/lib/services/studio-service.ts`.
   - Factory `src/lib/factories/studio.ts`.

6. **MoneyInput + unit tests (React Testing Library)**
   - `__tests__/unit/components/money-input.spec.ts`:
     - `"8"` → display `R$ 0,08`, onChange com `0.08`.
     - `"85"` → `R$ 0,85`, onChange com `0.85`.
     - `"8500"` → `R$ 85,00`, onChange com `85`.
     - `"999999"` → `R$ 9.999,99`, bloqueia sétimo dígito.
     - Caracteres não-numéricos ignorados.
     - Backspace remove último dígito.
     - Controlled via prop `value` (em reais, number).
     - `min` / `max` enforçados (props opcionais para Livros ajustarem faixa se necessário).
   - Rodar: falham (componente ausente).
   - Criar `src/components/ui/money-input.tsx` — state interno em centavos (integer), exibição via `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`, `onChange` publicando valor em reais (`number`, ex: `85.00`).

7. **API routes + unit tests**
   - `__tests__/unit/api/studios-list.spec.ts`, `studios-create.spec.ts`, `studios-update.spec.ts`, `studios-delete.spec.ts`:
     - Fakes injetados via `handleStudios*` (seguindo o padrão de `editors/route.ts`).
     - Cobrir 200/201/204/401/404/409/422.
     - Incluir caso 422 com `defaultHourlyRate` fora da faixa.
   - Rodar: falham.
   - Criar `src/app/api/v1/studios/route.ts` e `[id]/route.ts` espelhando Editor, com um único `catch` (apenas `StudioNameAlreadyInUseError`).
   - Confirmar verde.

8. **UI components + E2E**
   - Consultar `design.pen` via Pencil MCP (Node ID `rkZ68`).
   - Duplicar componentes de `src/components/features/editors/` para `src/components/features/studios/`:
     - `studios-client.tsx`: wrapper estado local + toast + `useMemo` para ordenação DESC por `createdAt`.
     - `studios-table.tsx`: TanStack Table, colunas `name`, `defaultHourlyRate` (formatado BRL na view), `actions`, sorting ambas colunas, empty state.
     - `studio-row.tsx`: modos view/edit com RHF (Input name + MoneyInput defaultHourlyRate), `setError` para 409 NAME.
     - `studio-new-row.tsx`: RHF análogo ao row; `MoneyInput` inicia em `R$ 0,00`.
     - `delete-studio-dialog.tsx`: Dialog destructive.
   - Criar `src/app/(authenticated)/studios/page.tsx` (Server Component com `createStudioService().list()`).
   - Duplicar as 10 specs de E2E de editor adaptando rotas, labels, assertions (colunas/valor, cents-first UX, sem duplicate email — apenas name).
   - Adicionar cenário específico de ordenação DESC por createdAt em `studios-list.spec.ts`.
   - Rodar suíte E2E localmente — confirmar verde.

9. **Factory (sem seed)**
   - `__tests__/helpers/factories.ts` — adicionar `createTestStudio(db, overrides)` espelhando `createTestEditor`, com default `defaultHourlyRate: 85` e `name: Studio ${suffix}`.
   - **NÃO tocar `seed.ts` nem `seed-test.ts`** (Q4 da sessão de clarificação, Princípio V).

10. **Fase final única de verificação** (antes do PR):
    - `bun run lint`
    - `bun run test:unit`
    - `bun run test:integration`
    - `bun run test:e2e`
    - `bun run build`
    - Todos verdes ⇒ `/finish-task` para abrir PR contra `main`.

## Post-Design Constitution Re-Check

Executado após Phase 1 (research + data-model + contracts + quickstart):

- Princípios I–XVI continuam em conformidade. Nenhum ajuste de design introduziu violação.
- `default_hourly_rate` como campo informacional no estúdio (não usado em cálculos) foi confirmado pelo usuário em Q1 e reiterado em FR-026 — Princípio II preservado.
- `MoneyInput` é um primitivo atômico (sem `useState` de negócio, sem `fetch`) — compatível com Princípio VII.
- Feature components residem em `src/components/features/studios/` — compliance Princípio VII v2.11.0; zero uso de `_components/`.
- Ordenação client-side via `useMemo` é continuação explícita do padrão de Editor/Narrador — sem divergência arquitetural.
- Conversão `numeric ↔ number` isolada no repository preserva a invariante de Precisão Financeira (Princípio II): service e domain nunca tocam strings numéricas.
- Zero seed implica que E2E precisará sempre criar os estúdios via factory. Fixture auto-reset E2E (TRUNCATE preservando admin) já cobre o cenário sem modificações.

**Resultado pós-design**: ✅ **PASS**.

## Complexity Tracking

> Nenhuma violação de constituição — tabela vazia por design.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| —         | —          | —                                   |

## Migration Safety

- **Reversibilidade**: migração aditiva (`CREATE TABLE studio` + 1 `CREATE UNIQUE INDEX`). Rollback é `DROP TABLE studio;` — totalmente seguro. Nenhum dado existente é perdido (tabela nova, vazia no momento da criação).
- **Ordem de deploy**: DB migration DEVE ser aplicada **antes** do deploy do novo código. O inverso também é seguro (código antigo não referencia a tabela nova; código novo contra banco antigo falha com "relation does not exist", visível e não corruptivo).
- **Ambiente dev**: `bun run db:generate` + `bun run db:migrate`. Nenhum script auxiliar.
- **Ambiente E2E**: `globalSetup` do Playwright aplica a migração no schema de cada worker automaticamente.
- **Ambiente produção**: inexistente hoje. Quando existir, aplicar a migração no janelão de deploy — zero downtime, zero risco de inconsistência.
