# Implementation Plan: CRUD de Editores

**Branch**: `018-editors-crud` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-editors-crud/spec.md`

## Summary

Feature aditiva que cria a entidade **Editor** com CRUD completo em `/editors`, replicando a estrutura de Narradores (pós-017) em todas as camadas — domain, repository, service, factory, errors, rotas REST, componentes React, testes — e adicionando um campo `email` que Narrador não possui. Editor tem duas constraints únicas independentes: `name` (case-sensitive com `trim`, mesma regra de Narrador) e `email` (case-insensitive com `trim`+`lowercase` normalizado no service antes de persistir). A estratégia de "reuso vs duplicação" foi decidida no spec: primitivos de `components/ui/` e layouts são reaproveitados; tudo específico de feature (5 componentes React + domínio + repo + service + factory + errors + 2 rotas API + testes) é duplicado espelhando Narrador, ajustando nomes e adicionando a coluna/campo `email`. Nenhuma abstração genérica do tipo `SimpleNamedEntity<T>` é introduzida. A migração Drizzle cria a tabela `editor` com dois `uniqueIndex` (`editor_name_unique`, `editor_email_unique`) e nenhum FK (capítulos referenciarão editor em feature futura).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (Bun runtime 1.2)
**Primary Dependencies**: Next.js 16.2.1 (App Router), React 19.2.4, Drizzle ORM 0.45.2 + drizzle-kit 0.31.10, Zod 4.3.6, better-auth 1.5.6, React Hook Form 7.72.1 + `@hookform/resolvers` 5.2.2, `@tanstack/react-table` 8.21.3, shadcn/ui 4.1.2, Tailwind CSS 4.2, sonner 2.0.7
**Storage**: PostgreSQL via Drizzle ORM — tabela `editor` **nova** (não existe no schema atual), sem FKs entrantes ou saintes nesta feature. Dois índices únicos: `editor_name_unique` em `name` (byte-exato) e `editor_email_unique` em `email` (sobre o valor já normalizado pelo service).
**Testing**: Vitest 4.1 (unit + integration via BEGIN/ROLLBACK), Playwright 1.59 (E2E schema-per-worker), Testing Library 16.3, `@axe-core/playwright`
**Target Platform**: Web (Next.js SSR + RSC); produção em Node 20+
**Project Type**: Web application (Next.js full-stack em `src/`)
**Performance Goals**: LCP < 1s mantido; criação/edição/exclusão de editor < 10s ponta-a-ponta (SC-001)
**Constraints**: Nova tabela + dois índices únicos em uma única migração; volume inicial zero (feature inaugura a tabela); nenhum risco de conflito com dados existentes. Nenhum FK ainda; capítulo-para-editor virá em feature futura.
**Scale/Scope**: ~17 arquivos de produção novos + ~14 arquivos de teste novos; 1 migração Drizzle; 0 novas dependências (stack 100% reaproveitada de Narrador). Volume esperado ≤ dezenas de editores — sem paginação nesta feature.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Princípio I — Capítulo como Unidade de Trabalho**: ✅ Editor é entidade de suporte. O vínculo com capítulo (`chapter.editor_id`) é explicitamente deferido para a feature de capítulos. Nenhuma operação financeira passa a ser feita no nível do editor nesta feature.

**Princípio II — Precisão Financeira**: ✅ Sem impacto. Editor ainda não participa de cálculos financeiros (a atribuição `editor × capítulo × horas × preço_hora_livro` vem depois). Nenhum campo `numeric` é introduzido.

**Princípio III — Ciclo de Vida do Capítulo**: ✅ Sem impacto. Editor não tem ciclo de vida próprio.

**Princípio IV — Simplicidade (YAGNI)**: ✅ A feature **adiciona** complexidade justificada por um requisito concreto: (a) Editor é entidade distinta no modelo de domínio (constituição §Domain Model Constraints), (b) e-mail é necessário para fluxo operacional de pagamento e comunicação (spec Assumptions). **Não** são adicionados: soft delete, auditoria, paginação, filtros, busca textual, integração com Google Drive. A decisão explícita de duplicar em vez de abstrair (spec FR-027–031) é documentada para evitar generalização prematura — consistente com YAGNI.

**Princípio V — TDD**: ✅ Testes escritos antes da implementação em todas as camadas. Seção "Fluxo TDD" detalha a ordem. Classificação: unit (Zod, service com fake repo, api com deps injetadas), integration (DrizzleEditorRepository contra DB real via BEGIN/ROLLBACK), E2E (Playwright com `/editors` e API). Cobertura ≥ 80% (SC-010).

**Princípio VI — Arquitetura Limpa Backend**: ✅ Cada camada em seu lugar:

- `src/lib/domain/editor.ts` — entidade + schemas Zod
- `src/lib/domain/editor-repository.ts` — interface (sem prefixo `I`)
- `src/lib/repositories/drizzle/drizzle-editor-repository.ts` — implementação concreta, prefixo `Drizzle`
- `src/lib/services/editor-service.ts` — use cases + **normalização de email** (trim + lowercase antes de chamar repo)
- `src/lib/factories/editor.ts` — composition root: `createEditorService()`
- `src/lib/errors/editor-errors.ts` — `EditorNameAlreadyInUseError`, `EditorEmailAlreadyInUseError`, `EditorNotFoundError`
- `src/app/api/v1/editors/route.ts` + `[id]/route.ts` — controllers finos usando helpers de `lib/api/responses.ts`

Controllers não instanciam repo/service diretamente; tudo via factory. Injeção via construtor no `EditorService`.

**Princípio VII — Frontend: Composição e Mobile First**: ✅ Página `/editors` usa `<PageContainer>` + componentes de layout (FR-001). Componentes atômicos de `components/ui/` reaproveitados (Button, Input, Table, ScrollArea, Dialog — FR-027). Componentes de feature duplicados a partir de Narradores (FR-029), adaptados para incluir `email`. Dark mode obrigatório (FR-024). Mobile first — layout herdado do padrão de Narradores (já validado com testes E2E de responsividade e font-size que serão duplicados). `design.pen` será consultado via Pencil MCP antes da implementação dos componentes para confirmar paridade visual com a seção "07 - Editores" (ou equivalente).

**Princípio VIII — Performance**: ✅ Server Component na page (`page.tsx` chama `service.list()` direto via RSC). `use client` apenas nos componentes que precisam de interatividade (row, new-row, table, dialog). Bundle cresce trivialmente (uma única coluna extra e mesmas libs já carregadas). Sem virtualização necessária (volume previsto ≤ dezenas).

**Princípio IX — Design Tokens**: ✅ Zero cores hardcoded. Toda estilização via tokens Tailwind (`bg-background`, `text-foreground`, `text-muted-foreground`, etc.) e classe `destructive` do sistema de design já existente.

**Princípio X — Padrões REST**: ✅ Rotas: `GET/POST /api/v1/editors`, `PATCH/DELETE /api/v1/editors/:id`. Status codes corretos: `201` (POST com `Location`), `204` (DELETE), `200` (GET/PATCH), `401`, `404`, `409` (`NAME_ALREADY_IN_USE` e `EMAIL_ALREADY_IN_USE`), `422` (validação). Envelope `{ data }` / `{ error: { code, message, details? } }`. Input validado com Zod. `Cache-Control: no-store` em todas as respostas.

**Princípio XI — PostgreSQL**: ✅ Migração via `drizzle-kit generate` + `bun run db:migrate` — nunca `push`. Tabela nova em `src/lib/db/schema.ts` com `uniqueIndex` em `name` e `email`. Tipos: `text` para strings, `timestamptz` para datas, `text` PK com `$defaultFn(() => crypto.randomUUID())`. Nenhum FK nesta feature. Queries sempre selecionam colunas explícitas (constante `EDITOR_COLUMNS`) — proibido `SELECT *`.

**Princípio XII — Anti-padrões**: ✅ Nenhum introduzido. `any` inexistente. Elementos HTML crus inexistentes (tudo via `components/ui/`). Página usa `<PageContainer>`. Dark mode funcional. Sem `useEffect` para derivar estado. Sem `fetch` em `useEffect` para dados buscáveis no server. `drizzle-kit push` proibido.

**Princípio XIII — Métricas**: ✅ N/A — editor não gera KPIs nesta feature.

**Princípio XIV — PDF Viewer**: ✅ N/A.

**Princípio XV — Skills**: ✅ Workflow `/speckit.*`. `/shadcn` não necessário (não há componentes novos a adicionar — Table, Input, Dialog, Button, ScrollArea já estão instalados). **Context7 MCP não bloqueia**: as APIs usadas (Drizzle `pgTable`+`uniqueIndex`, Zod `.email()`, React Hook Form `setError`, better-auth session) já estão em uso no projeto e foram validadas em 015/017; consultar Context7 é obrigatório *se* surgir dúvida sobre versão, mas não há ponto de dúvida conhecido. `design.pen` via Pencil MCP será consultado antes da implementação dos componentes React (passo explícito no Fluxo TDD).

**Princípio XVI — Qualidade/Verificação**: ✅ Durante fases intermediárias: apenas os testes TDD diretamente afetados. Fase final única antes do PR: `bun run lint` → `bun run test:unit` → `bun run test:integration` → `bun run test:e2e` → `bun run build`.

**Resultado do gate inicial**: ✅ **PASS** sem violações. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/018-editors-crud/
├── plan.md              # This file (/speckit.plan)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── editors-api.md   # Contrato REST completo de /api/v1/editors[/:id]
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec (já existe)
└── tasks.md             # Phase 2 output (/speckit.tasks — NÃO criado aqui)
```

### Source Code (repository root)

Estrutura do monorepo Next.js **existente**; todos os arquivos de Editor seguem as mesmas convenções dos arquivos de Narrador. Arquivos novos estão marcados com **[NOVO]**.

```text
src/
├── app/
│   ├── (authenticated)/editors/                         # [NOVO]
│   │   ├── page.tsx                                     # Server Component — list() + passa a Client
│   │   └── _components/
│   │       ├── editors-client.tsx                       # Wrapper client com toast/header/table
│   │       ├── editors-table.tsx                        # TanStack Table com colunas Nome + E-mail + ações
│   │       ├── editor-row.tsx                           # Linha com modos view / edit (inputs Nome e E-mail)
│   │       ├── editor-new-row.tsx                       # Linha de criação inline (Nome + E-mail)
│   │       └── delete-editor-dialog.tsx                 # Modal de confirmação destructive
│   └── api/v1/editors/                                  # [NOVO]
│       ├── route.ts                                     # GET, POST
│       └── [id]/route.ts                                # PATCH, DELETE
├── lib/
│   ├── domain/
│   │   ├── editor.ts                                    # [NOVO] Editor + editorFormSchema + createEditorSchema + updateEditorSchema
│   │   └── editor-repository.ts                         # [NOVO] interface EditorRepository
│   ├── errors/
│   │   └── editor-errors.ts                             # [NOVO] EditorNameAlreadyInUseError, EditorEmailAlreadyInUseError, EditorNotFoundError
│   ├── factories/
│   │   └── editor.ts                                    # [NOVO] createEditorService()
│   ├── repositories/drizzle/
│   │   └── drizzle-editor-repository.ts                 # [NOVO] DrizzleEditorRepository implements EditorRepository
│   ├── services/
│   │   └── editor-service.ts                            # [NOVO] EditorService com normalização de email (trim+lowercase)
│   └── db/
│       ├── schema.ts                                    # [MOD] adicionar tabela `editor` + 2 uniqueIndex
│       └── seed.ts                                      # [MOD] criar alguns editores de exemplo para dev
│
drizzle/
├── 000X_<auto-nome>.sql                                 # [NOVO] CREATE TABLE editor + 2 CREATE UNIQUE INDEX
└── meta/_journal.json                                   # [MOD] atualizado pelo drizzle-kit
│
__tests__/
├── helpers/factories.ts                                 # [MOD] createTestEditor(db, overrides)
├── repositories/
│   └── in-memory-editor-repository.ts                   # [NOVO] InMemoryEditorRepository
├── unit/
│   ├── domain/editor-schema.test.ts                     # [NOVO] asserts em editorFormSchema / createEditorSchema / updateEditorSchema
│   ├── services/editor-service.test.ts                  # [NOVO] asserts de normalização + delegação ao repo
│   └── api/
│       ├── editors-list.test.ts                         # [NOVO]
│       ├── editors-create.test.ts                       # [NOVO] inclui caso 409 NAME + 409 EMAIL
│       ├── editors-update.test.ts                       # [NOVO] inclui caso 409 NAME + 409 EMAIL + idempotência
│       └── editors-delete.test.ts                       # [NOVO]
├── integration/repositories/
│   └── drizzle-editor-repository.test.ts                # [NOVO] CRUD contra Postgres real + 2 unicidades
└── e2e/
    ├── editors-list.spec.ts                             # [NOVO]
    ├── editors-create.spec.ts                           # [NOVO] inclui valid/invalid/duplicate name e email
    ├── editors-update.spec.ts                           # [NOVO]
    ├── editors-delete.spec.ts                           # [NOVO]
    ├── editors-accessibility.spec.ts                    # [NOVO] @axe-core/playwright
    ├── editors-concurrent-ops.spec.ts                   # [NOVO] múltiplas edições + criação em paralelo
    ├── editors-responsive.spec.ts                       # [NOVO] breakpoints mobile/tablet/desktop
    ├── editors-font-size.spec.ts                        # [NOVO] small/medium/large
    ├── editors-dark-mode.spec.ts                        # [NOVO]
    └── editors-primary-colors.spec.ts                   # [NOVO] blue/orange/green/red/amber × destructive
```

**Structure Decision**: Projeto monorepo Next.js mantido. A feature adiciona diretórios e arquivos novos espelhando 1:1 a organização de Narrador, mais uma modificação em `schema.ts` (tabela nova) e `seed.ts` (exemplos dev), e uma extensão em `__tests__/helpers/factories.ts` (função `createTestEditor`). Zero migrações destrutivas. Zero alterações em Narrador.

## Fluxo TDD (ordem canônica de implementação)

> A ordem abaixo garante que cada mudança seja guiada por testes que falham antes da alteração de código, conforme Princípio V.

1. **Domínio primeiro (schema DB + entity)**
   - Adicionar tabela `editor` em `src/lib/db/schema.ts` com `id`, `name`, `email`, timestamps e 2 `uniqueIndex`.
   - Gerar migração: `bun run db:generate` → inspecionar SQL gerado → aplicar com `bun run db:migrate`.
   - Criar `src/lib/domain/editor.ts` com interface `Editor` e schemas Zod (`editorFormSchema`, `createEditorSchema`, `updateEditorSchema`).

2. **Testes unitários de domínio (Zod)**
   - `__tests__/unit/domain/editor-schema.test.ts`: casos válidos (name trim, email lower-case), inválidos (name muito curto/longo, email malformado, ausente).
   - Rodar: falham (schema ainda não importável).
   - Confirmar passagem após passo 1 completo.

3. **Repository — interface e integration test**
   - Criar `src/lib/domain/editor-repository.ts` com interface `EditorRepository`.
   - `__tests__/integration/repositories/drizzle-editor-repository.test.ts`: CRUD + 2 casos de unicidade (name duplicado → `EditorNameAlreadyInUseError`; email duplicado → `EditorEmailAlreadyInUseError`) + findById/findByName/findByEmail retornando `null` para inexistente.
   - Rodar: falham (implementação ausente).
   - Criar `src/lib/repositories/drizzle/drizzle-editor-repository.ts`:
     - Importar schema `editor`, definir `EDITOR_COLUMNS`, reutilizar helpers de unique violation (duplicar com o de narrador — NÃO extrair para shared ainda, YAGNI).
     - `findAll` ordenado por `createdAt asc`, `findById`, `findByName`, `findByEmail`.
     - `create` + `update` com `try/catch` mapeando `23505` para **a classe de erro correta** baseando-se no constraint name (`editor_name_unique` → `EditorNameAlreadyInUseError`; `editor_email_unique` → `EditorEmailAlreadyInUseError`). Ver research.md §R3.
   - Confirmar testes verdes.

4. **Errors**
   - `src/lib/errors/editor-errors.ts` com `EditorNameAlreadyInUseError`, `EditorEmailAlreadyInUseError`, `EditorNotFoundError`.

5. **Service + unit tests com fake in-memory**
   - `__tests__/repositories/in-memory-editor-repository.ts` — duplica o de narrador, adiciona campo `email` com normalização (trim+lowercase) e dupla checagem de unicidade.
   - `__tests__/unit/services/editor-service.test.ts`: testes com `InMemoryEditorRepository`:
     - `create` normaliza email antes de persistir (verifica `findByEmail` com lower-cased retorna o registro).
     - `update` normaliza email se presente; idempotência em name/email.
     - `list`, `delete`, `findById` delegam ao repo.
   - Rodar: falham (service ausente).
   - Criar `src/lib/services/editor-service.ts`:
     - `list()` → `repo.findAll()`.
     - `create(input)` → aplica `input.name.trim()`, `input.email.trim().toLowerCase()` e chama `repo.create`.
     - `update(id, input)` → idem para campos presentes; delega ao repo.
     - `delete(id)` → `repo.delete(id)`.
   - Factory: criar `src/lib/factories/editor.ts` com `createEditorService()`.

6. **API routes + unit tests**
   - `__tests__/unit/api/editors-list.test.ts`, `editors-create.test.ts`, `editors-update.test.ts`, `editors-delete.test.ts`:
     - Fakes injetados via `handleEditors*` (seguindo o padrão de `narrators/route.ts`: `NarratorsDeps` style).
     - Cobrir 200/201/204/401/404/409 (dois códigos)/422.
   - Rodar: falham (handlers ausentes).
   - Criar `src/app/api/v1/editors/route.ts` (GET, POST) e `[id]/route.ts` (PATCH, DELETE) espelhando 1:1 os handlers de narrador, com dois `catch` (name e email).
   - Confirmar testes verdes.

7. **UI components + E2E**
   - Consultar `design.pen` via Pencil MCP (seção Editores) para confirmar paridade visual.
   - Duplicar componentes de `src/app/(authenticated)/narrators/_components/` para `.../editors/_components/` renomeando e adicionando coluna/campo `email`:
     - `editors-client.tsx`: wrapper estado local + toast.
     - `editors-table.tsx`: TanStack Table, colunas `name`, `email`, actions, sorting ambas colunas, empty state.
     - `editor-row.tsx`: modos view/edit com RHF (2 inputs), `setError` para 409 NAME e 409 EMAIL.
     - `editor-new-row.tsx`: RHF com 2 inputs, `setError` análogo.
     - `delete-editor-dialog.tsx`: Dialog destructive.
   - Criar `src/app/(authenticated)/editors/page.tsx` (Server Component com `createEditorService().list()`).
   - Duplicar as 9 specs de E2E de narrator adaptando rotas, labels, assertions (adicionar coluna/input email, casos de duplicidade email).
   - Rodar suíte E2E localmente — confirmar verde.

8. **Seed + factories**
   - `__tests__/helpers/factories.ts` — adicionar `createTestEditor(db, overrides)` espelhando `createTestNarrator` + `email`.
   - `src/lib/db/seed.ts` — criar 2-3 editores de exemplo para dev; **não tocar `seed-test.ts`** (regra do projeto).

9. **Fase final única de verificação** (antes do PR):
   - `bun run lint`
   - `bun run test:unit`
   - `bun run test:integration`
   - `bun run test:e2e`
   - `bun run build`
   - Todos verdes ⇒ `/finish-task` para abrir PR contra `main`.

## Post-Design Constitution Re-Check

Executado após Phase 1 (research + data-model + contracts + quickstart):

- Princípios I–XVI continuam em conformidade. Nenhum ajuste de design introduziu violação.
- A duplicação controlada das 5 classes UI + stack backend foi antecipada em spec (FR-027–031) e está alinhada com YAGNI: zero abstração genérica.
- A normalização de e-mail vive no service — não em expressão funcional no índice — mantendo o schema Drizzle simples e a migração direta (sem `lower(email)` no `CREATE UNIQUE INDEX`). Decisão documentada em research.md §R6.
- Helpers de `unique violation` foram conscientemente duplicados entre `DrizzleNarratorRepository` e `DrizzleEditorRepository` (research.md §R3). Extração para `lib/db/postgres-errors.ts` é refactor de baixo custo que pode ser feito numa feature futura quando houver um terceiro consumidor — YAGNI preserva simplicidade agora.

**Resultado pós-design**: ✅ **PASS**.

## Complexity Tracking

> Nenhuma violação de constituição — tabela vazia por design.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| —         | —          | —                                   |

## Migration Safety

- **Reversibilidade**: migração aditiva (`CREATE TABLE editor` + 2 `CREATE UNIQUE INDEX`). Rollback é `DROP TABLE editor;` — totalmente seguro. Nenhum dado existente é perdido (tabela nova, vazia no momento da criação).
- **Ordem de deploy**: DB migration DEVE ser aplicada **antes** do deploy do novo código, mas o inverso também é seguro (código antigo não referencia a tabela nova; código novo contra banco antigo resulta em `SELECT` falhando com "relation does not exist", que é visível e não corrompe dados).
- **Ambiente dev**: `bun run db:generate` + `bun run db:migrate`. Nenhum script auxiliar.
- **Ambiente E2E**: `globalSetup` do Playwright aplica a migração no schema de cada worker automaticamente.
- **Ambiente produção**: inexistente hoje. Quando existir, basta aplicar a migração no janelão de deploy — zero downtime, zero risco de inconsistência.
