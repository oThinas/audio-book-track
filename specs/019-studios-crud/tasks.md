---

description: "Task list for feature 019-studios-crud — CRUD de Estúdios"
---

# Tasks: CRUD de Estúdios

**Input**: Design documents from `/specs/019-studios-crud/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/studios-api.md](./contracts/studios-api.md), [quickstart.md](./quickstart.md)

**Tests**: INCLUIDOS (Princípio V da constituição — TDD obrigatório, cobertura ≥ 80%).

**Organization**: Tarefas agrupadas por user story (US1–US4 do spec) para permitir implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências pendentes)
- **[Story]**: User story à qual a tarefa pertence (US1, US2, US3, US4)
- Caminhos absolutos quando ambíguos; relativos à raiz do repo quando óbvios

## Path Conventions

Projeto Next.js full-stack em `src/`. Testes em `__tests__/`. Migrações Drizzle em `drizzle/`.

---

## Phase 1: Setup

**Purpose**: Confirmações pré-implementação (referências externas).

- [X] T001 Consultar `design.pen` via Pencil MCP (Node ID `rkZ68`, frame "06 - Estúdios") e registrar em `research.md` se houver divergência visual entre a spec e o design. Confirmar tokens de cor, tipografia e espaçamentos da página `/studios`. **Resultado**: tokens confirmados (bg-page `#F8FAFC`, primary `#2563EB`, text-primary `#1E293B`, text-secondary `#64748B`, border `#E2E8F0`, border-subtle `#F1F5F9`, destructive `#EF4444`). Colunas do design: Nome (fill) / Valor/hora (220) / **Livros (100, fora de escopo)** / Ações (60). Nenhuma divergência em relação ao spec.
- [X] T002 Consultar Context7 MCP para 3 APIs críticas: (a) React 19 `onBeforeInput` — confirmado padrão `e.nativeEvent.data` para interceptar input antes do apply; (b) Drizzle ORM `numeric` — **descoberta relevante**: Drizzle 0.45+ suporta `numeric({ precision, scale, mode: "number" })` para retornar `number` na leitura (o write ainda exige `string`); `research.md §R2` atualizado com a nota — a decisão de conversão explícita foi **mantida** por consistência/simetria; (c) `Intl.NumberFormat` pt-BR — API browser-native padronizada, sem divergência versão-específica; não consultado via Context7.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura obrigatória para qualquer user story funcionar. Schema, domínio, repository, service e factories.

**⚠️ CRITICAL**: Nenhum trabalho de user story pode começar antes desta fase terminar.

### Schema e migração

- [ ] T003 Adicionar tabela `studio` ao schema Drizzle em [src/lib/db/schema.ts](src/lib/db/schema.ts) conforme [data-model.md § Drizzle schema](./data-model.md). Campos: `id` (text PK com `$defaultFn(() => crypto.randomUUID())`), `name` (text notNull), `defaultHourlyRate` (`numeric("default_hourly_rate", { precision: 10, scale: 2 }).notNull()`), `createdAt` e `updatedAt` (timestamptz). Adicionar `uniqueIndex("studio_name_unique").on(table.name)`.
- [ ] T004 Gerar migração: `bun run db:generate`. Inspecionar o arquivo `drizzle/0XXX_<auto-nome>.sql` gerado e confirmar `CREATE TABLE "studio"` + `CREATE UNIQUE INDEX "studio_name_unique"`. Não editar o SQL manualmente.
- [ ] T005 Aplicar migração ao banco de desenvolvimento: `bun run db:migrate`. Verificar via psql que a tabela existe: `\d studio`.

### Domain layer (paralelizável — arquivos independentes)

- [ ] T006 [P] Criar [src/lib/domain/studio.ts](src/lib/domain/studio.ts) com a interface `Studio` e os schemas Zod (`studioFormSchema`, `createStudioSchema`, `updateStudioSchema`) conforme [data-model.md § Zod schemas](./data-model.md). Incluir tipos inferidos (`StudioFormValues`, `CreateStudioInput`, `UpdateStudioInput`). A validação de `defaultHourlyRate` DEVE usar `.min(0.01).max(9999.99).refine(...)` com tolerância `1e-9` para 2 casas decimais — **nunca** `.multipleOf(0.01)` (ver [research.md §R4](./research.md)).
- [ ] T007 [P] Criar [src/lib/domain/studio-repository.ts](src/lib/domain/studio-repository.ts) com a interface `StudioRepository` (`findAll`, `findById`, `findByName`, `create`, `update`, `delete`). Sem prefixo `I`. Sem `findByEmail` (não aplicável).
- [ ] T008 [P] Criar [src/lib/errors/studio-errors.ts](src/lib/errors/studio-errors.ts) com `StudioNameAlreadyInUseError` e `StudioNotFoundError` conforme [data-model.md § Domain errors](./data-model.md).

### Unit tests de schema (TDD — escrever primeiro, garantir que falhem)

- [ ] T009 [P] Escrever [__tests__/unit/domain/studio-schema.spec.ts](__tests__/unit/domain/studio-schema.spec.ts) cobrindo: (a) name trim + validação 2–100 caracteres, (b) `defaultHourlyRate` = 0.01 (aceita), = 0 (rejeita), = 9999.99 (aceita), = 10000 (rejeita), = 85.555 (rejeita via refinement), = `0.07 * 3` arredondado para 0.21 (aceita — teste de robustez floating-point), (c) campo obrigatório ausente. Rodar `bun run test:unit __tests__/unit/domain/studio-schema.spec.ts` — DEVE falhar (schema ainda não importável em T010).

### Repository implementation (depende de T003, T006, T007, T008)

- [ ] T010 Escrever [__tests__/integration/repositories/drizzle-studio-repository.spec.ts](__tests__/integration/repositories/drizzle-studio-repository.spec.ts) cobrindo: CRUD completo, `findByName` (hit/miss), unicidade de `name` (deve lançar `StudioNameAlreadyInUseError` com código `23505`), round-trip `numeric ↔ number` (inserir `85.00`, recuperar como `=== 85` number, não string), `findById` retornando `null` para id inexistente. Usar BEGIN/ROLLBACK do setup integration. Rodar — DEVE falhar.
- [ ] T011 Implementar [src/lib/repositories/drizzle/drizzle-studio-repository.ts](src/lib/repositories/drizzle/drizzle-studio-repository.ts) com `DrizzleStudioRepository implements StudioRepository`. Definir constante `STUDIO_COLUMNS`, duplicar helpers `getUniqueConstraintName`/`extractConstraint` do `DrizzleEditorRepository` (YAGNI — ver [research.md §R3](./research.md)). Mapear `editor_name_unique` → `StudioNameAlreadyInUseError`. Conversão `numeric ↔ number` encapsulada em helpers privados `toDomain()` / `toDrizzleValues()` conforme [research.md §R2](./research.md). `findAll` ordenado por `asc(createdAt)`. Rodar T010 — DEVE passar.

### Service + in-memory repository

- [ ] T012 [P] Criar [__tests__/repositories/in-memory-studio-repository.ts](__tests__/repositories/in-memory-studio-repository.ts) espelhando o `InMemoryEditorRepository` atual — campo `email` trocado por `defaultHourlyRate` (number), única unicidade é em `name`. Preservar comportamento de lançar `StudioNameAlreadyInUseError` em `create`/`update` com nome duplicado.
- [ ] T013 Escrever [__tests__/unit/services/studio-service.spec.ts](__tests__/unit/services/studio-service.spec.ts) injetando `InMemoryStudioRepository`: (a) `create` faz `trim(name)` antes de persistir, (b) `update` idem, (c) `list`/`delete` delegam ao repo, (d) valor numérico passa inalterado ao repo. Rodar — DEVE falhar.
- [ ] T014 Implementar [src/lib/services/studio-service.ts](src/lib/services/studio-service.ts) conforme [data-model.md § Service contract](./data-model.md) — classe `StudioService` com injeção via construtor, `trim(name)` em create/update. Rodar T013 — DEVE passar.
- [ ] T015 Criar [src/lib/factories/studio.ts](src/lib/factories/studio.ts) com `createStudioService()` retornando `new StudioService(new DrizzleStudioRepository(db))`.

### Factory de testes (sem seed — Princípio V)

- [ ] T016 [P] Adicionar função `createTestStudio(db, overrides)` em [__tests__/helpers/factories.ts](__tests__/helpers/factories.ts) seguindo o padrão de `createTestEditor`. Default: `name: Studio ${suffix}`, `defaultHourlyRate: 85`. Retornar `{ studio }` com `defaultHourlyRate` convertido para `number` via `Number(row.defaultHourlyRate)`. **NÃO** tocar [src/lib/db/seed.ts](src/lib/db/seed.ts) nem [src/lib/db/seed-test.ts](src/lib/db/seed-test.ts) (Princípio V "Factory, não seed"; Q4 da sessão de clarificação).

**Checkpoint**: Foundation ready — user stories podem começar.

---

## Phase 3: User Story 1 — Listar estúdios existentes (Priority: P1) 🎯 MVP

**Goal**: Produtor acessa `/studios` e vê a tabela com os estúdios cadastrados, ordenados por `created_at` DESC (mais recente no topo), com "Nome" e "Valor/hora" formatado em BRL. Sorting por clique no cabeçalho funciona nas duas colunas. Estado vazio exibido quando não há estúdios.

**Independent Test**: Popular o banco com 3 estúdios via `createTestStudio` em ordem conhecida; acessar `/studios`; verificar que aparecem 3 linhas, a última criada no topo, valores em `R$ XX,XX`; verificar que clicar em "Nome" ordena alfabeticamente; truncar a tabela e verificar estado vazio.

### Tests para US1

- [ ] T017 [P] [US1] Escrever [__tests__/unit/api/studios-list.spec.ts](__tests__/unit/api/studios-list.spec.ts) — handler `handleStudiosList(deps)` com fake service injetado. Casos: 200 com lista, 200 com lista vazia, 401 sem sessão. Rodar — DEVE falhar.
- [ ] T018 [P] [US1] Escrever [__tests__/e2e/studios-list.spec.ts](__tests__/e2e/studios-list.spec.ts) — usar fixture autenticada, criar 3 estúdios via `createTestStudio` em timestamps distintos, navegar para `/studios`, assert 3 linhas visíveis, assert ordem DESC por `createdAt`, assert valor formatado em BRL (`R$ XX,XX`), assert sort ascendente/descendente por Nome após clique no cabeçalho. Incluir caso de lista vazia (sem `createTestStudio`). Rodar — DEVE falhar.

### Implementation para US1

- [ ] T019 [US1] Implementar `GET /api/v1/studios` em [src/app/api/v1/studios/route.ts](src/app/api/v1/studios/route.ts) espelhando o padrão de `editors/route.ts`: função exportada + handler privado `handleStudiosList(deps)` com `{ studioService, getSession }`. Retornar `{ data: studio[] }` com `Cache-Control: no-store`. Rodar T017 — DEVE passar.
- [ ] T020 [US1] Criar [src/app/(authenticated)/studios/page.tsx](src/app/(authenticated)/studios/page.tsx) como Server Component — `export const dynamic = "force-dynamic"`, `createStudioService().list()`, renderizar `<PageContainer><StudiosClient initialStudios={studios} /></PageContainer>`.
- [ ] T021 [US1] Criar [src/components/features/studios/studios-client.tsx](src/components/features/studios/studios-client.tsx) — `"use client"`, estado local de studios (inicializado com `initialStudios`), `sortedStudios` via `useMemo` com `[...studios].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())` (DESC por `createdAt`, ver [research.md §R5](./research.md)). Renderizar `<PageHeader><PageTitle>Estúdios</PageTitle><PageDescription>Gerencie os estúdios parceiros</PageDescription></PageHeader>` + `<StudiosTable studios={sortedStudios} ... />`. Sem handlers de create/update/delete ainda (ficam para US2–US4).
- [ ] T022 [US1] Criar [src/components/features/studios/studios-table.tsx](src/components/features/studios/studios-table.tsx) usando `@tanstack/react-table`. Colunas: "Nome" (texto, sortable), "Valor/hora" (formatado BRL via `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`, sortable numérico), "Ações" (vazia por enquanto, preenchida nas próximas fases). Suporte a sorting bidirecional (`asc` → `desc` → reset). Empty state com mensagem "Nenhum estúdio cadastrado.". Wrapper em `<ScrollArea>`. Dark mode via tokens semânticos. Rodar T018 — DEVE passar.

**Checkpoint**: US1 funcional — listar estúdios com ordenação DESC padrão e sorting por coluna. Pronto para MVP demo.

---

## Phase 4: User Story 2 — Criar novo estúdio (Priority: P1)

**Goal**: Produtor clica em "+ Novo Estúdio", uma linha editável aparece no topo com inputs de nome e valor/hora (cents-first, inicia em `R$ 0,00`). Preenche, confirma, a linha persiste; valida faixa de valor e duplicidade de nome.

**Independent Test**: Acessar `/studios` com tabela vazia; clicar "+ Novo Estúdio"; digitar nome e `8500` no valor (esperado `R$ 85,00`); confirmar; verificar que registro persiste e aparece na tabela. Tentar criar outro com mesmo nome → erro 409 "Nome já cadastrado". Tentar valor/hora = `R$ 0,00` → erro de validação.

### Tests para US2

- [ ] T023 [P] [US2] Escrever [__tests__/unit/components/money-input.spec.ts](__tests__/unit/components/money-input.spec.ts) usando React Testing Library. Casos: (a) controlled value → display `R$ XX,XX`, (b) digitar `"8"` → onChange com `0.08` e display `R$ 0,08`, (c) digitar sequência `"8500"` → onChange final com `85`, (d) digitar `"999999"` → `R$ 9.999,99`, (e) tentar digitar 7º dígito quando em `R$ 9.999,99` → ignorado, (f) digitar caractere não-numérico (`"a"`, `","`, `"."`) → ignorado, (g) `Backspace` remove último dígito acumulado, (h) paste de `"R$ 1.234,56"` → aceita apenas dígitos `1234` → `R$ 12,34`, (i) respeitar props `min` e `max` (com `max=500`, não acumula além de `R$ 5,00`). Rodar — DEVE falhar.
- [ ] T024 [P] [US2] Escrever [__tests__/unit/api/studios-create.spec.ts](__tests__/unit/api/studios-create.spec.ts) — handler `handleStudiosCreate(deps)`. Casos: 201 com `Location` header, 401 sem sessão, 409 `NAME_ALREADY_IN_USE` quando service lança `StudioNameAlreadyInUseError`, 422 com `details` Zod quando `defaultHourlyRate > 9999.99` ou `< 0.01` ou com 3 decimais ou quando `name` vazio/longo. Rodar — DEVE falhar.
- [ ] T025 [P] [US2] Escrever [__tests__/e2e/studios-create.spec.ts](__tests__/e2e/studios-create.spec.ts) — fluxos: (a) criar com cents-first funcional (digitar `8500` → ver `R$ 85,00` → confirmar → linha persiste no topo), (b) Cancelar remove a linha sem persistir, (c) nome vazio → mensagem de validação, (d) valor = `R$ 0,00` → mensagem de validação, (e) nome duplicado → mensagem "Nome já cadastrado" no campo name (via `setError` do RHF), (f) clicar "+ Novo Estúdio" com linha nova já aberta → foco é transferido para ela (não duplica). Rodar — DEVE falhar.

### Implementation para US2

- [ ] T026 [US2] Implementar [src/components/ui/money-input.tsx](src/components/ui/money-input.tsx) conforme [research.md §R1](./research.md) — `"use client"`, controlled, state em centavos derivado de `Math.round(value * 100)`, display via `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`, handlers `onBeforeInput`/`onKeyDown`/`onPaste`, `onChange` publica number em reais. Props: `value`, `onChange`, `min?`, `max?`, `placeholder?`, `disabled?`, `aria-invalid?`, `aria-describedby?`, `id?`, `name?`, `className?`. Usar classes Tailwind idênticas ao `<Input>` do shadcn para visual consistente. Rodar T023 — DEVE passar.
- [ ] T027 [US2] Implementar `POST /api/v1/studios` em [src/app/api/v1/studios/route.ts](src/app/api/v1/studios/route.ts) — `handleStudiosCreate(deps)` com deps injetáveis. Validar body com `createStudioSchema`, chamar `studioService.create`, retornar `201` com `Location: /api/v1/studios/${id}` e envelope `{ data: studio }`. Mapear `StudioNameAlreadyInUseError` → `409 NAME_ALREADY_IN_USE`. Mapear `ZodError` → `422` com `details`. Rodar T024 — DEVE passar.
- [ ] T028 [US2] Criar [src/components/features/studios/studio-new-row.tsx](src/components/features/studios/studio-new-row.tsx) — linha editável inline com React Hook Form (`zodResolver(createStudioSchema)`). Inputs: `<Input>` para name, `<Controller>` wrap em `<MoneyInput min={0.01} max={9999.99}>` para defaultHourlyRate (inicia em `0`). Botões Cancelar/Confirmar substituem ícones. Ao receber `409 NAME_ALREADY_IN_USE`, `setError("name", { message: "Nome já cadastrado" })`.
- [ ] T029 [US2] Integrar `studio-new-row` em [src/components/features/studios/studios-client.tsx](src/components/features/studios/studios-client.tsx) e [src/components/features/studios/studios-table.tsx](src/components/features/studios/studios-table.tsx): (a) botão "+ Novo Estúdio" no header da tabela, (b) prop `topRow` passada para a table renderizar acima das rows existentes, (c) handler `handleCreate(input)` no client que faz fetch `POST /api/v1/studios`, atualiza estado local e fecha o row em caso de sucesso, exibe toast (sonner) em caso de erro de rede. Se uma linha de criação já existe ao clicar "+ Novo Estúdio", chamar `focus()` em vez de adicionar outra. Rodar T025 — DEVE passar.

**Checkpoint**: US1 + US2 funcionais — listar e criar estúdios via UI.

---

## Phase 5: User Story 3 — Editar estúdio existente (Priority: P2)

**Goal**: Produtor clica no ícone de "Editar" de uma linha; campos viram editáveis (name e valor/hora); confirmar persiste; cancelar restaura valores originais; duplicidade de nome e faixa inválida reportam erros nos campos.

**Independent Test**: Criar um estúdio via `createTestStudio`; acessar `/studios`; clicar Editar; alterar nome e valor; confirmar → valor atualizado persiste. Cancelar → valores originais. Duas linhas em edição simultânea coexistem. Manter valores idênticos e confirmar → idempotente (sem 409 contra si mesmo).

### Tests para US3

- [ ] T030 [P] [US3] Escrever [__tests__/unit/api/studios-update.spec.ts](__tests__/unit/api/studios-update.spec.ts) — handler `handleStudiosUpdate(deps)`. Casos: 200 com body parcial `{ name }` apenas, 200 com body parcial `{ defaultHourlyRate }` apenas, 200 com body completo, 200 com body vazio `{}` (idempotente), 401, 404 (id inexistente), 409 quando name colide, 422. Rodar — DEVE falhar.
- [ ] T031 [P] [US3] Escrever [__tests__/e2e/studios-update.spec.ts](__tests__/e2e/studios-update.spec.ts) — fluxos: (a) editar name e valor com sucesso, (b) cancelar restaura originais, (c) limpar name + confirmar → mensagem obrigatório, (d) zerar valor + confirmar → mensagem faixa inválida, (e) renomear para um existente → "Nome já cadastrado" no campo, (f) editar mantendo valores idênticos → confirma com sucesso (idempotente), (g) duas linhas em edição simultânea são independentes. Rodar — DEVE falhar.

### Implementation para US3

- [ ] T032 [US3] Implementar `PATCH /api/v1/studios/:id` em [src/app/api/v1/studios/[id]/route.ts](src/app/api/v1/studios/[id]/route.ts) — `handleStudiosUpdate(deps)` com deps injetáveis. Validar body com `updateStudioSchema`. Mapear `StudioNotFoundError` → `404 NOT_FOUND`. Mapear `StudioNameAlreadyInUseError` → `409`. Rodar T030 — DEVE passar.
- [ ] T033 [US3] Criar [src/components/features/studios/studio-row.tsx](src/components/features/studios/studio-row.tsx) — dois modos (view/edit) controlados por state local. View: renderiza `<TableCell>` com name + valor formatado + ícones Editar/Excluir. Edit: RHF (`zodResolver(updateStudioSchema)`) com `<Input>` name + `<Controller><MoneyInput /></Controller>`, botões Cancelar/Confirmar no lugar dos ícones. Ao confirmar: `fetch PATCH /api/v1/studios/:id`, atualizar state no client ao sucesso, `setError` nos campos apropriados ao 409/422. Cancelar: restaurar valores originais + voltar a view.
- [ ] T034 [US3] Integrar `studio-row` na renderização de cada row da `studios-table`: substituir a renderização placeholder do cell "Ações" pelos ícones Editar/Excluir (Excluir placeholder apenas — funcionalidade em US4). Handler `handleUpdate(id, input)` no `studios-client.tsx` que chama PATCH e atualiza estado local. Rodar T031 — DEVE passar.

**Checkpoint**: US1 + US2 + US3 funcionais — listar, criar e editar.

---

## Phase 6: User Story 4 — Excluir estúdio (Priority: P2)

**Goal**: Produtor clica no ícone de Excluir; modal de confirmação aparece; confirmar remove do banco e da UI; cancelar fecha o modal sem alterar.

**Independent Test**: Criar um estúdio; clicar ícone Excluir; modal abre com texto "Tem certeza que deseja excluir o estúdio X?"; confirmar → registro sumiu do banco e da tabela. Clicar Excluir + Cancelar → nada muda.

### Tests para US4

- [ ] T035 [P] [US4] Escrever [__tests__/unit/api/studios-delete.spec.ts](__tests__/unit/api/studios-delete.spec.ts) — handler `handleStudiosDelete(deps)`. Casos: 204 (sem body), 401, 404 quando id inexistente. Rodar — DEVE falhar.
- [ ] T036 [P] [US4] Escrever [__tests__/e2e/studios-delete.spec.ts](__tests__/e2e/studios-delete.spec.ts) — fluxos: (a) clicar Excluir abre modal com pergunta contendo o name, (b) confirmar remove da tabela, (c) cancelar fecha modal sem alterar, (d) o botão Excluir do modal usa variante `destructive`. Rodar — DEVE falhar.

### Implementation para US4

- [ ] T037 [US4] Implementar `DELETE /api/v1/studios/:id` em [src/app/api/v1/studios/[id]/route.ts](src/app/api/v1/studios/[id]/route.ts) — `handleStudiosDelete(deps)`. Retornar `204` sem body em sucesso. Mapear `StudioNotFoundError` → `404`. Rodar T035 — DEVE passar.
- [ ] T038 [US4] Criar [src/components/features/studios/delete-studio-dialog.tsx](src/components/features/studios/delete-studio-dialog.tsx) — `<AlertDialog>` do shadcn. Título: "Excluir estúdio". Descrição: `Tem certeza que deseja excluir o estúdio ${name}?`. Botão primário "Excluir" com variante `destructive`; botão secundário "Cancelar". Props: `studio`, `open`, `onOpenChange`, `onConfirm`.
- [ ] T039 [US4] Integrar `delete-studio-dialog` em [src/components/features/studios/studio-row.tsx](src/components/features/studios/studio-row.tsx) — state local `deleteOpen`, abre ao clicar ícone Excluir, `onConfirm` chama handler do client que faz `DELETE /api/v1/studios/:id`. Handler `handleDelete(id)` no `studios-client.tsx` remove o studio do estado ao sucesso, exibe toast em erro. Rodar T036 — DEVE passar.

**Checkpoint**: Todas as user stories funcionais — CRUD completo.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cobrir requisitos transversais que não pertencem a uma única user story — a11y, dark mode, responsividade, font-size, concorrência e variantes de cor primária.

Todas as specs abaixo são E2E, independentes entre si e entre arquivos distintos → podem rodar em paralelo.

- [ ] T040 [P] Escrever [__tests__/e2e/studios-accessibility.spec.ts](__tests__/e2e/studios-accessibility.spec.ts) usando `@axe-core/playwright` em estados chave de `/studios` (lista populada, lista vazia, linha em criação, linha em edição, modal de exclusão). Zero violações `critical` ou `serious`.
- [ ] T041 [P] Escrever [__tests__/e2e/studios-dark-mode.spec.ts](__tests__/e2e/studios-dark-mode.spec.ts) validando que `/studios` renderiza corretamente em `data-theme="light"` e `data-theme="dark"` (contrastes, tokens semânticos, ícone destructive destacado em ambos os temas).
- [ ] T042 [P] Escrever [__tests__/e2e/studios-responsive.spec.ts](__tests__/e2e/studios-responsive.spec.ts) cobrindo breakpoints `375` (mobile), `768` (tablet), `1440` (desktop). Sem overflow, sem layout quebrado, `MoneyInput` utilizável em mobile (teclado numérico via `inputMode="numeric"`).
- [ ] T043 [P] Escrever [__tests__/e2e/studios-font-size.spec.ts](__tests__/e2e/studios-font-size.spec.ts) validando que a tabela + modal de exclusão funcionam em `font-size` small/medium/large sem quebrar layout. O ScrollArea DEVE ativar quando o conteúdo exceder a área visível.
- [ ] T044 [P] Escrever [__tests__/e2e/studios-concurrent-ops.spec.ts](__tests__/e2e/studios-concurrent-ops.spec.ts) — fluxos: (a) duas linhas em edição simultânea + uma em criação, (b) criar com linha de edição aberta, (c) ambos confirmados em sequência atualizam corretamente, (d) last-write-wins em edição concorrente do mesmo registro.
- [ ] T045 [P] Escrever [__tests__/e2e/studios-primary-colors.spec.ts](__tests__/e2e/studios-primary-colors.spec.ts) validando que o ícone Excluir e o botão destructive do modal permanecem visualmente distintos em todas as 5 variantes de cor primária (blue, orange, green, red, amber) — especial atenção à variante `red` onde destructive + primary compartilham tonalidade.
- [ ] T046 Atualizar [futuras-features.md](futuras-features.md) removendo o item "CRUD de Estúdios" da lista de "Futuras features" (primeira linha: `- CRUD de Estúdios;`) e mantendo a anotação pendente sobre a coluna "Livros" (segunda entrada, que permanece válida para a feature de Livros).
- [ ] T047 Revisar o checklist de self-review da constituição (§ Self-Review Obrigatório) aplicado ao PR desta feature, marcando cada item com evidência concreta (arquivo/linha).

---

## Final Quality Gate (single, before PR)

Per Constitution Principle XVI, quality checks are NOT run per-phase. Run them once here, before marking the feature done or opening the PR:

- [ ] T048 `bun run lint` — zero erros e zero warnings
- [ ] T049 `bun run test:unit` — toda a suíte passando
- [ ] T050 `bun run test:integration` — toda a suíte passando
- [ ] T051 `bun run test:e2e` — toda a suíte passando
- [ ] T052 `bun run build` — build de produção compila sem erros

Se qualquer verificação falhar, a feature não está pronta. Corrigir antes de abrir o PR.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Sem dependências — pode começar imediatamente.
- **Phase 2 (Foundational)**: Depende de Phase 1 (T001–T002 são informacionais e não bloqueiam; podem rodar em paralelo com T003).
- **Phase 3 (US1)**: Depende de T005 (migração aplicada), T006–T015 (stack backend completa), T016 (factory de teste).
- **Phase 4 (US2)**: Depende de Phase 2 completa + T020–T022 (a UI base de lista existe).
- **Phase 5 (US3)**: Depende de Phase 4 — reusa `MoneyInput`, integra em `studio-row` que também é criado em US3.
- **Phase 6 (US4)**: Depende de Phase 5 — `delete-studio-dialog` é integrado em `studio-row`.
- **Phase 7 (Polish)**: Depende de Phase 6 — valida o CRUD completo.
- **Final Quality Gate**: Depende de Phase 7.

### User Story Dependencies

- **US1 (Listar)**: independente — requer apenas Phase 2. É o MVP demonstrável.
- **US2 (Criar)**: depende de US1 (a linha nova é adicionada à mesma tabela). Adiciona `MoneyInput`, que é reutilizado por US3.
- **US3 (Editar)**: depende de US2 (reuso de `MoneyInput` + `studio-row` compartilha modos view/edit). Pode ser trabalhado em paralelo com US4 se `studio-row` for dividido.
- **US4 (Excluir)**: depende de US3 (integração no `studio-row`). Pode ser trabalhado em paralelo com US3 se as mudanças em `studio-row` forem coordenadas.

### Within Each User Story

- Tests escritos primeiro e DEVEM falhar antes da implementação (Princípio V).
- Domain/schema/errors antes de repository.
- Repository antes de service.
- Service antes de API handler.
- API antes de UI.
- UI com testes E2E validando.

### Parallel Opportunities

- **Phase 1**: T001 e T002 podem rodar em paralelo (informacionais).
- **Phase 2 domain layer**: T006 + T007 + T008 são arquivos distintos, paralelizáveis. T009 depende de T006. T012 + T016 são arquivos distintos das implementações, paralelizáveis com o bloco T013–T015.
- **Phase 3 tests**: T017 e T018 são arquivos distintos e paralelizáveis.
- **Phase 4 tests**: T023 + T024 + T025 são arquivos distintos, paralelizáveis.
- **Phase 5 tests**: T030 + T031 paralelizáveis.
- **Phase 6 tests**: T035 + T036 paralelizáveis.
- **Phase 7 (Polish)**: T040 até T045 são arquivos E2E distintos — totalmente paralelizáveis.

### Team strategy (se houver capacidade paralela)

Com 1 dev solo: seguir a ordem numérica T001 → T052 sequencialmente.
Com 2 devs após Phase 2: Dev A pega US1 + US2; Dev B pega US3 após US2 fechar + T030–T034. Dev A pega US4 (T035–T039). Polish distribuído.

---

## Parallel Example: Phase 2 Domain Layer

```bash
# Após T005 (migração aplicada), rodar em paralelo:
Task: "T006 Criar src/lib/domain/studio.ts com Zod schemas"
Task: "T007 Criar src/lib/domain/studio-repository.ts interface"
Task: "T008 Criar src/lib/errors/studio-errors.ts"

# Após T011 (DrizzleStudioRepository implementado), rodar em paralelo:
Task: "T012 Criar __tests__/repositories/in-memory-studio-repository.ts"
Task: "T016 Adicionar createTestStudio em __tests__/helpers/factories.ts"
```

## Parallel Example: Phase 7 Polish

```bash
# Todos em paralelo (arquivos distintos):
Task: "T040 Escrever studios-accessibility.spec.ts"
Task: "T041 Escrever studios-dark-mode.spec.ts"
Task: "T042 Escrever studios-responsive.spec.ts"
Task: "T043 Escrever studios-font-size.spec.ts"
Task: "T044 Escrever studios-concurrent-ops.spec.ts"
Task: "T045 Escrever studios-primary-colors.spec.ts"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Completar Phase 1 (Setup).
2. Completar Phase 2 (Foundational) — bloqueia todas as user stories.
3. Completar Phase 3 (US1 — Listar).
4. **Stop + Validate**: testar US1 independentemente, confirmar que o produtor consegue visualizar estúdios seedados via `createTestStudio`.
5. Demo interna do MVP se apropriado.

### Incremental Delivery

1. Setup + Foundational → foundation pronta.
2. US1 → lista renderiza → demo.
3. US2 → criar estúdios pela UI → demo.
4. US3 → editar estúdios pela UI → demo.
5. US4 → excluir estúdios com confirmação → demo.
6. Polish → qualidade transversal.
7. Final Quality Gate → PR.

### Parallel Team Strategy

Ver seção "Team strategy" em Dependencies acima.

---

## Notes

- `[P]` = arquivos distintos, sem dependências pendentes.
- `[Story]` = mapeia tarefa à user story correspondente.
- Cada user story deve ser independentemente completável e testável.
- Verificar que testes falham antes de implementar (Princípio V — Red → Green → Refactor).
- Commit após cada tarefa ou grupo lógico (convenção `/conventional-commits`).
- Parar em cada checkpoint para validar story independentemente.
- Evitar: tarefas vagas, conflitos no mesmo arquivo simultâneo, dependências cruzadas entre stories que quebrem independência.
