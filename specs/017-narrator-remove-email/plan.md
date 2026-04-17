# Implementation Plan: Remoção do campo e-mail de Narradores

**Branch**: `017-narrator-remove-email` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-narrator-remove-email/spec.md`

## Summary

Refactor que remove o campo `email` da entidade Narrador em todas as camadas do sistema e **realoca a constraint de unicidade do `email` para o `name`**: schema Drizzle (drop da coluna `email` + drop de `narrator_email_unique` + criação de `narrator_name_unique`), entidade de domínio, schemas Zod, repository (`findByEmail` → `findByName`), erro customizado (`NarratorEmailAlreadyInUseError` → `NarratorNameAlreadyInUseError`), service, rotas REST (POST/PATCH param `email` some do schema; `409` passa a emitir código `NAME_ALREADY_IN_USE`), componentes React (`NarratorRow`, `NarratorNewRow`, `NarratorsTable`; mensagem "Nome já cadastrado" no campo), factories de teste, repository in-memory, suíte de testes (unit/integration/E2E) e seed de dev. A tabela da UI passa a ter apenas a coluna "Nome". A comparação de unicidade é **case-sensitive e com `trim` apenas**.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (Bun runtime 1.2)
**Primary Dependencies**: Next.js 16.2.1 (App Router), React 19.2.4, Drizzle ORM 0.45.2 + drizzle-kit 0.31.10, Zod 4.3.6, better-auth 1.5.6, React Hook Form 7.72.1 + `@hookform/resolvers` 5.2.2, `@tanstack/react-table` 8.21.3, shadcn/ui 4.1.2, Tailwind CSS 4.2, sonner 2.0.7
**Storage**: PostgreSQL via Drizzle ORM — tabela `narrator` existente, sem FKs entrantes ou saintes (narrador ainda não referencia capítulo)
**Testing**: Vitest 4.1 (unit + integration via BEGIN/ROLLBACK), Playwright 1.59 (E2E schema-per-worker), Testing Library 16.3, `@axe-core/playwright`
**Target Platform**: Web (Next.js SSR + RSC); produção em Node 20+
**Project Type**: Web application (Next.js full-stack em `src/`)
**Performance Goals**: LCP < 1s mantido; criação de narrador < 10s ponta-a-ponta (SC-003)
**Constraints**: Migração destrutiva (drop column) + criação de índice único novo (`narrator_name_unique`) — deve rodar antes do deploy do novo código; dev pode reaplicar sem backup, desde que não haja duas linhas com o mesmo `name` no momento do `CREATE UNIQUE INDEX`; produção (quando existir) exige coordenação manual
**Scale/Scope**: ~15 arquivos de código + ~10 arquivos de teste alterados, 1 migração Drizzle nova (drop column + drop unique index), 0 arquivos novos de produção, 0 novas dependências

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Princípio I — Capítulo como Unidade de Trabalho**: ✅ Narrador continua sendo entidade de suporte; remover o e-mail não afeta a unidade de trabalho capítulo.

**Princípio II — Precisão Financeira**: ✅ Sem impacto. Narrador não participa de cálculos financeiros.

**Princípio III — Ciclo de Vida do Capítulo**: ✅ Sem impacto. Narrador não tem ciclo de vida próprio.

**Princípio IV — Simplicidade (YAGNI)**: ✅ A feature *remove* complexidade (campo, validação de unicidade, erro customizado, método de repository). Reduz superfície.

**Princípio V — TDD**: ✅ Testes unitários/integração/E2E existentes serão atualizados primeiro (removendo asserções sobre `email` e payloads `{ name, email }`), confirmados que falham com o código legado, então código é alterado para reproduzir verde. Seção "Fluxo TDD" detalha a ordem abaixo. Classificação de testes preservada (unit com fakes, integration com DB real via rollback, E2E em Playwright).

**Princípio VI — Arquitetura Limpa Backend**: ✅ Remove ruído mas mantém estrutura: `lib/domain/narrator.ts` (Zod + entidade), `lib/domain/narrator-repository.ts` (interface sem `findByEmail`), `lib/repositories/drizzle/drizzle-narrator-repository.ts` (implementação), `lib/services/narrator-service.ts` inalterado internamente, `lib/factories/narrator.ts` inalterado, `lib/errors/narrator-errors.ts` passa a conter apenas `NarratorNotFoundError`.

**Princípio VII — Frontend: Composição e Mobile First**: ✅ `NarratorRow` e `NarratorNewRow` ficam mais simples — um input a menos. `NarratorsTable` perde a coluna `email`. Dark mode e responsividade preservados (cobertos por testes E2E existentes). Nenhum novo componente shadcn/ui precisa ser adicionado.

**Princípio VIII — Performance**: ✅ Remoção só aligeira bundle e queries. Nenhum impacto negativo.

**Princípio IX — Design Tokens**: ✅ Sem mudança em tokens.

**Princípio X — Padrões REST**: ✅ Endpoints mantêm URL, método e envelope. `POST /api/v1/narrators` e `PATCH /api/v1/narrators/:id` deixam de aceitar o campo `email` no schema Zod. `409 EMAIL_ALREADY_IN_USE` é substituído por `409 NAME_ALREADY_IN_USE` — o handler existente continua tratando conflitos de unicidade, apenas mudando classe de erro e código. Erros continuam usando `validationErrorResponse` / `notFoundResponse` / `unauthorizedResponse` / `conflictResponse`.

**Princípio XI — PostgreSQL**: ✅ Migração via `drizzle-kit generate` + `bun run db:migrate` (nunca `push`). Drop de coluna + drop de índice único antigo + **criação de novo índice único** (`narrator_name_unique`) em uma única migração. Nenhum novo foreign key. `numeric` não se aplica (sem dados financeiros).

**Princípio XII — Anti-padrões**: ✅ Nenhum introduzido. O `catch`-e-rethrow de `POSTGRES_UNIQUE_VIOLATION` é **mantido** (necessário para a nova unicidade em `name`) mas mapeado para a nova classe de erro.

**Princípio XIII — Métricas**: ✅ N/A.

**Princípio XIV — PDF Viewer**: ✅ N/A.

**Princípio XV — Skills**: ✅ Workflow `/speckit.*`, `/tdd`, `/code-review`, `/finish-task`. Sem necessidade de Context7 MCP adicional — APIs afetadas (Drizzle `alterTable`, React Hook Form `register`) são estáveis e já em uso no projeto. `design.pen` não precisa ser consultado: a página existe e só perde uma coluna.

**Princípio XVI — Qualidade/Verificação**: ✅ Fase final única de verificação: `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`, `bun run build`. Durante fases intermediárias, apenas os testes diretamente afetados.

**Self-review esperado no PR**: Checklist completo da constituição (Princípios I–XVI).

**Resultado do gate inicial**: ✅ **PASS** sem violações.

## Project Structure

### Documentation (this feature)

```text
specs/017-narrator-remove-email/
├── plan.md              # This file (/speckit.plan)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── narrators-api.md # Contrato atualizado de POST/PATCH/GET/DELETE /api/v1/narrators[/:id]
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec (já existe)
└── tasks.md             # Phase 2 output (/speckit.tasks — NÃO criado aqui)
```

### Source Code (repository root)

Estrutura do monorepo Next.js mantida; apenas arquivos existentes são editados ou excluídos. Nenhum diretório novo.

```text
src/
├── app/
│   ├── (authenticated)/narrators/
│   │   └── _components/
│   │       ├── narrators-table.tsx       # remove coluna "email"
│   │       ├── narrator-row.tsx          # remove input + label + validação de email
│   │       └── narrator-new-row.tsx      # remove input + label + validação de email
│   └── api/v1/narrators/
│       ├── route.ts                      # remove tratamento de NarratorEmailAlreadyInUseError
│       └── [id]/route.ts                 # remove tratamento de NarratorEmailAlreadyInUseError
├── lib/
│   ├── domain/
│   │   ├── narrator.ts                   # remove campo email do tipo e schemas Zod
│   │   └── narrator-repository.ts        # remove findByEmail
│   ├── errors/narrator-errors.ts         # remove NarratorEmailAlreadyInUseError
│   ├── repositories/drizzle/
│   │   └── drizzle-narrator-repository.ts # remove findByEmail, remove try/catch de unique violation
│   └── db/
│       ├── schema.ts                     # remove coluna email + uniqueIndex narrator_email_unique
│       └── seed.ts                       # se houver referência a email de narrador, remover
│
drizzle/
├── 0003_<auto>.sql                       # nova migration gerada pelo drizzle-kit (ALTER TABLE DROP COLUMN + DROP INDEX)
└── meta/_journal.json                    # atualizado automaticamente
│
__tests__/
├── helpers/factories.ts                  # createTestNarrator perde o override email (se existir)
├── repositories/
│   └── in-memory-narrator-repository.ts  # remove findByEmail + lógica de unicidade
├── unit/
│   ├── domain/narrator*.test.ts          # se existir; remove asserts de email
│   ├── services/narrator-service.test.ts # remove asserts de email
│   └── api/
│       ├── narrators-create.test.ts      # remove email do payload
│       ├── narrators-update.test.ts      # remove email do payload
│       ├── narrators-delete.test.ts      # inalterado (delete não envolve email)
│       └── narrators-list.test.ts        # remove asserts de email
├── integration/repositories/
│   └── drizzle-narrator-repository.test.ts # remove testes de unicidade + findByEmail
└── e2e/
    ├── narrators-create.spec.ts          # remove preenchimento do input email
    ├── narrators-update.spec.ts          # idem
    ├── narrators-list.spec.ts            # remove assert da coluna email
    ├── narrators-accessibility.spec.ts   # revisar labels esperados (a11y)
    ├── narrators-concurrent-ops.spec.ts  # remove referências a email
    ├── narrators-dark-mode.spec.ts       # não deve precisar mudança
    ├── narrators-delete.spec.ts          # não deve precisar mudança
    ├── narrators-font-size.spec.ts       # revisar layout da tabela após remoção de coluna
    ├── narrators-primary-colors.spec.ts  # não deve precisar mudança
    └── narrators-responsive.spec.ts      # revisar breakpoints após remoção de coluna
```

**Structure Decision**: Projeto monorepo Next.js (escolha de estruturas existente; nada novo). Todos os arquivos tocados já existem — é um refactor de exclusão.

## Fluxo TDD (ordem canônica de implementação)

> A ordem abaixo garante que cada mudança seja guiada por testes que falham antes da alteração de código, conforme Princípio V.

1. **Atualizar testes de domínio** (`__tests__/unit/schemas/*`, `__tests__/unit/domain/*`, se existirem): remover `email` dos inputs aceitos por `narratorFormSchema`, `createNarratorSchema`, `updateNarratorSchema`; adicionar asserção de que payload com `email` é **rejeitado ou silenciosamente descartado** (preferido: descartado — o schema não declara mais o campo). Testes ficam vermelhos.
2. **Atualizar testes do service** (`__tests__/unit/services/narrator-service.test.ts`): remover fixtures com `email`, remover teste de unique-email; ajustar o `InMemoryNarratorRepository` para não ter `findByEmail`.
3. **Atualizar testes da API unit** (`__tests__/unit/api/narrators-*.test.ts`): payloads sem `email`; remover casos `409 EMAIL_ALREADY_IN_USE`.
4. **Atualizar teste integration** (`__tests__/integration/repositories/drizzle-narrator-repository.test.ts`): remover suite de unicidade e de `findByEmail`; fixtures só com `name`. Também serve como prova de que a migração aplicada no setup global funciona.
5. **Atualizar E2E** (`__tests__/e2e/narrators-*.spec.ts`): remover passos de preenchimento do input de email e asserts da coluna/label de email.
6. **Alterar o código de produção** para fazer os testes ficarem verdes, na ordem de camadas de dentro para fora:
   a. `src/lib/db/schema.ts` — remover coluna + uniqueIndex.
   b. Gerar migração: `bun run db:generate` (inspecionar SQL gerado — deve conter `DROP INDEX "narrator_email_unique"` e `ALTER TABLE "narrator" DROP COLUMN "email"`). Aplicar com `bun run db:migrate`.
   c. `src/lib/domain/narrator.ts` — remover `email` de `Narrator`, `narratorFormSchema`, `createNarratorSchema`, `updateNarratorSchema`.
   d. `src/lib/domain/narrator-repository.ts` — remover `findByEmail`.
   e. `src/lib/errors/narrator-errors.ts` — remover `NarratorEmailAlreadyInUseError`.
   f. `src/lib/repositories/drizzle/drizzle-narrator-repository.ts` — remover `findByEmail`, remover `try/catch` + helpers de unique violation, remover coluna `email` de `NARRATOR_COLUMNS`, remover `email` dos sets de `create`/`update`.
   g. `__tests__/repositories/in-memory-narrator-repository.ts` — remover `findByEmail` + lógica de unicidade + normalização de email.
   h. `src/app/api/v1/narrators/route.ts` e `[id]/route.ts` — remover imports e `catch` de `NarratorEmailAlreadyInUseError`; remover `conflictResponse`.
   i. `src/app/(authenticated)/narrators/_components/narrators-table.tsx` — remover coluna `email` do `columns`, ajustar layout (se o peso da coluna estava em flex percentages, recalibrar).
   j. `narrator-row.tsx` e `narrator-new-row.tsx` — remover input, label, `register("email")`, mensagem de erro, `defaultValues.email`, handler de `setError("email")`.
   k. Seed (`seed.ts`) — remover `email` de narradores se houver; seed-test permanece intocado.
7. **Executar a suíte completa** (fase final): `bun run lint` → `bun run test:unit` → `bun run test:integration` → `bun run test:e2e` → `bun run build`. Todos verdes antes do PR.

## Complexity Tracking

> Nenhuma violação de constituição — tabela vazia por design.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| —         | —          | —                                   |

## Migration Safety

- **Reversibilidade**: a migração é destrutiva (coluna dropada + índice dropado). Rollback manual exigiria re-adicionar coluna como `text` (sem dados originais) e recriar o índice — aceito pelo produto conforme Assumptions da spec.
- **Ordem de deploy**: DB migration DEVE ser aplicada **antes** do deploy do novo código — se o código novo rodar contra banco antigo, `SELECT` do Drizzle falha por referenciar coluna inexistente no schema TS mas ainda presente no banco (o inverso quebra queries). Drizzle `alterTable drop column` + `drop index` funciona sem downtime para este volume.
- **Ambiente dev**: `bun run db:migrate` aplica direto. Nenhum script auxiliar.
- **Ambiente E2E**: `globalSetup` do Playwright re-aplica migrações no schema do worker — sem ação manual.
- **Ambiente produção (quando existir)**: não há hoje. Se existir antes do merge, o usuário DEVE ser avisado para exportar `SELECT id, email FROM narrator` antes do deploy. Esta coordenação é extra-escopo desta feature.
