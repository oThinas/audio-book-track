---
description: "Tasks for feature 025-chapter-deadline"
---

# Tasks: Data Limite por Capítulo

**Input**: Design documents from `/specs/025-chapter-deadline/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **Mandatory** — Princípio V da constituição exige TDD (RED → GREEN → IMPROVE, cobertura ≥ 80%). Cada tarefa de implementação tem um teste correspondente listado **antes** dela.

**Organization**: Tasks agrupadas por user story para entrega/teste independente. As 3 user stories P1 formam o MVP completo desta feature; US4 (P2) é incremento.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivo diferente, sem dependência em tarefa pendente).
- **[Story]**: Marca tarefa associada a user story específica (US1–US4).
- Cada descrição inclui caminho de arquivo absoluto-de-projeto.

## Path Conventions

Projeto Next.js single-package: código em `src/`, testes em `__tests__/`, migrations em `drizzle/migrations/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependências externas e primitivos de UI ausentes.

- [ ] T001 Instalar dependências `date-fns@4` e `date-fns-tz@3` via `bun add date-fns date-fns-tz`. Não remover libs existentes. Verificar `package.json` e `bun.lock` atualizados.
- [ ] T002 [P] Adicionar primitivo shadcn `Calendar` via `bunx --bun shadcn@latest add calendar` (gera `src/components/ui/calendar.tsx` e instala `react-day-picker` transitivamente).
- [ ] T003 [P] Adicionar primitivo shadcn `Badge` via `bunx --bun shadcn@latest add badge` (gera `src/components/ui/badge.tsx`).

**Checkpoint**: Dependências de UI e datas disponíveis. Pronto para o Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, domínio, repositório, service e API mínimos para que QUALQUER user story possa funcionar.

**⚠️ CRITICAL**: Nenhuma user story (US1–US4) pode iniciar antes desta fase concluir.

### Schema e migration

- [ ] T004 Estender `src/lib/db/schema/chapter.ts` adicionando coluna `deadline: date("deadline", { mode: "string" })` (nullable) e índice parcial `chapter_deadline_active_idx` `.on(table.deadline).where(sql\`${table.deadline} IS NOT NULL\`)`.
- [ ] T005 Gerar migration via `bunx drizzle-kit generate` (deve produzir `drizzle/migrations/0007_chapter_deadline.sql`). Inspecionar SQL gerado: `ALTER TABLE "chapter" ADD COLUMN "deadline" date` + `CREATE INDEX "chapter_deadline_active_idx"`.
- [ ] T006 Aplicar migration em dev (`bun run db:migrate`) e em teste (`bun run db:test:migrate`). Validar com `\d chapter` no psql que coluna e índice existem.

### Helpers puros de domínio (TDD)

- [ ] T007 [P] Escrever testes unitários em `__tests__/unit/lib/domain/timezone.spec.ts`: `todayInAppTimezone(() => UTC X)` retorna ISO em `America/Sao_Paulo`; cobre virada de meia-noite (00:00–02:59 UTC → dia anterior em SP); `currentWeekRangeInAppTimezone` para segunda/quarta/domingo retorna `{ mondayIso, sundayIso }` corretos com `weekStartsOn=1`. Deve FALHAR.
- [ ] T008 Implementar `src/lib/domain/timezone.ts` exportando `APP_TIMEZONE = "America/Sao_Paulo" as const`, `todayInAppTimezone(now?: () => Date): string`, `currentWeekRangeInAppTimezone(now?: () => Date): { mondayIso: string; sundayIso: string }`. Usar `date-fns-tz/toZonedTime` + `date-fns/startOfWeek/endOfWeek` com `weekStartsOn: 1` + `date-fns/format` com `"yyyy-MM-dd"`. Rodar T007 até passar.
- [ ] T009 [P] Escrever testes unitários em `__tests__/unit/lib/domain/chapter-deadline.spec.ts` cobrindo `isOverdue` e `isInFocusWeek` em tabela paramétrica de 6 status × 7 posições de prazo (incluindo `null`, `< hoje`, `= hoje`, `= segunda`, `= domingo`, `= domingo+1`). Deve FALHAR.
- [ ] T010 Implementar `src/lib/domain/chapter-deadline.ts` com `ACTIVE_STATUSES`, `FocusWeekContext`, `isOverdue(chapter, ctx)`, `isInFocusWeek(chapter, ctx)`. Comparações usam strings ISO (não objetos `Date`) para evitar fuso. Rodar T009 até passar.
- [ ] T011 [P] Escrever testes unitários em `__tests__/unit/lib/utils/format-date.spec.ts` para `formatDeadline("2026-06-15")` → `"15/06/2026"`, `formatRelativeDeadline` cobrindo "hoje", "amanhã", "ontem", "em 30 dias", "atrasado há 5 dias". Deve FALHAR.
- [ ] T012 Implementar `src/lib/utils/format-date.ts` com `formatDeadline(iso)` (usa `date-fns/format` + `ptBR`) e `formatRelativeDeadline(iso, ctx)` (usa `date-fns/differenceInCalendarDays` sobre strings ISO comparáveis). Rodar T011 até passar.

### Validação (Zod schema)

- [ ] T013 [P] Atualizar testes em `__tests__/unit/lib/schemas/chapter.spec.ts` (criar se não existir) cobrindo: `deadline` aceita `"2026-06-15"`, `null`, `undefined`; rejeita `"2026-13-01"`, `"21/06/2026"`, `""`, e datas > hoje+10 anos. Deve FALHAR.
- [ ] T014 Atualizar `src/lib/schemas/chapter.ts` adicionando `deadlineSchema` (regex + `isCalendarValid` + `isWithinTenYears`) e inserir como `deadline: deadlineSchema.optional()` em `updateChapterSchema`. Mensagens PT-BR conforme `data-model.md §4`. Rodar T013 até passar.

### Domínio do capítulo

- [ ] T015 Atualizar `src/lib/domain/chapter.ts`: adicionar `readonly deadline: string | null` em `Chapter` e estender `PAID_LOCKED_FIELDS` para `["narratorId", "editorId", "editedSeconds", "deadline"] as const`.

### Repository — port + adapter

- [ ] T016 Atualizar `src/lib/repositories/chapter-repository.ts`: adicionar `deadline?: string | null` em `InsertChapterInput` e `UpdateChapterInput`.
- [ ] T017 [P] Escrever teste de integration em `__tests__/integration/repositories/drizzle-chapter-deadline.spec.ts`: insert com `deadline`, update setando, update para `null`, findById/listByBookId retornam `deadline`. Deve FALHAR.
- [ ] T018 Atualizar `src/lib/repositories/drizzle/drizzle-chapter-repository.ts`: adicionar `deadline: chapter.deadline` em `CHAPTER_COLUMNS`, `deadline` no tipo `ChapterRow`, mapeamento em `toDomain`, e propagação em `insertMany`/`update` (`...(input.deadline !== undefined ? { deadline: input.deadline } : {})`). Rodar T017 até passar.

### Catálogo de erros

- [ ] T019 Atualizar `src/lib/api/error-codes/chapter.ts`: substituir mensagem de `CHAPTER_PAID_LOCKED` por `"Este capítulo já está pago — narrador, editor, duração e prazo não podem ser alterados."`. (Erros de validação de `deadline` saem via `ZodError` → mapeamento existente do `withApiErrorHandler`; sem código novo necessário.)

### Service

- [ ] T020 [P] Escrever teste integration em `__tests__/integration/services/chapter-service-deadline.spec.ts`: update aceita `deadline`, lança `ChapterPaidLockedError` quando capítulo `paid` recebe `deadline`, permite alterar `deadline` em qualquer outro status. Deve FALHAR.
- [ ] T021 Atualizar `src/lib/services/chapter-service.ts`: adicionar `deadline?: string | null` em `UpdateChapterServiceInput`; atualizar a constante local `PAID_LOCKED_FIELDS` para incluir `"deadline"`; propagar `deadline` no `.update({...})` do repo. Rodar T020 até passar.

### API route

- [ ] T022 Atualizar `src/app/api/v1/chapters/[id]/route.ts`: incluir `deadline: chapter.deadline` no objeto `data` retornado pelo handler `handleChapterUpdate`. Validar manualmente com `curl PATCH` que o campo retorna.

### Regressão da criação inline (FR-032)

- [ ] T060 Escrever teste integration em `__tests__/integration/services/book-service-inline-creation-deadline.spec.ts`: criar livro via `BookService.create({ inline: { chapterCount: 5, ... } })` (ou caminho equivalente do fluxo inline existente) e verificar que **todos** os capítulos retornam `deadline === null`. Garante FR-032: criação inline NUNCA propaga `deadline`. Deve passar imediatamente após Foundational (regressão preventiva); rodar.

**Checkpoint**: Migration aplicada, domínio/repo/service/API conhecem `deadline`, paid-lock funciona, criação inline regressão-protegida. Foundational está pronto.

---

## Phase 3: User Story 1 — Definir o prazo de um capítulo (Priority: P1) 🎯 MVP

**Goal**: Gestor consegue definir, alterar e limpar o prazo de um capítulo via UI do modo edição da linha.

**Independent Test**: Abrir um livro qualquer, entrar no modo edição de uma linha, escolher uma data no calendário, salvar. Célula da coluna "Prazo" exibe a data em `DD/MM/YYYY`. Voltar ao modo edição, clicar em "Limpar", salvar. Célula volta a `—`. Recarregar a página: valor persiste.

### Tests for User Story 1

- [ ] T023 [P] [US1] Component test em `__tests__/unit/components/features/chapters/chapter-deadline-picker.spec.tsx` cobrindo: render com `value=null` → texto "Definir prazo"; render com `value="2026-06-15"` → texto "15/06/2026"; clique no botão abre popover; selecionar dia chama `onChange("YYYY-MM-DD")` correto (sem off-by-one); "Limpar" chama `onChange(null)`; `disabled=true` impede abrir popover. Deve FALHAR.
- [ ] T024 [P] [US1] E2E em `__tests__/e2e/chapter-deadline.spec.ts` (criar) — fixture com 1 livro + 1 capítulo `pending`. Cenário "Definir prazo": entrar no modo edição, abrir picker, escolher data futura, salvar, validar célula. Cenário "Limpar": idem invertido. Cenário "Persistência após reload". Deve FALHAR.

### Implementation for User Story 1

- [ ] T025 [P] [US1] Criar `src/components/features/chapters/chapter-deadline-picker.tsx` conforme [contracts/ui-deadline-editor.md](./contracts/ui-deadline-editor.md). Composição: `<Popover>` + `<Calendar locale={ptBR} weekStartsOn={1}>` + footer com "Limpar" e "OK". Props controladas (`value`, `onChange`, `disabled`). Helper interno `formatISODate(date: Date): string` constrói `YYYY-MM-DD` a partir de partes locais. Rodar T023 até passar.
- [ ] T026 [US1] Atualizar `src/components/features/chapters/chapter-row-edit-mode.tsx`: adicionar `deadline` ao form do RHF (com `defaultValue: chapter.deadline ?? null`), inserir `<Controller name="deadline">` envolvendo `<ChapterDeadlinePicker disabled={chapter.status === "paid"} />` dentro de um `<FormItem><FormLabel>Prazo</FormLabel>...</FormItem>`. Garantir que o submit envia `deadline` para o `PATCH` (já suportado server-side por T014/T021/T022).
- [ ] T027 [US1] Atualizar o hook de mutação da linha (provavelmente `use-chapter-row-edit-mode.ts` ou equivalente em `src/components/features/chapters/hooks/`) para incluir `deadline` na chamada `apiFetch<…>("/api/v1/chapters/:id", { method: "PATCH", body: { deadline, ... } })`. Rodar T024 até passar.

**Checkpoint**: US1 funciona end-to-end. Gestor já consegue definir/alterar/limpar prazo. Faltam apresentação visual e filtros.

---

## Phase 4: User Story 2 — Identificar capítulos atrasados sem filtros (Priority: P1)

**Goal**: A célula da coluna "Prazo" destaca capítulos atrasados com cor de risco, ícone e tooltip — sem o gestor precisar ativar nada.

**Independent Test**: Definir prazo no passado em capítulo `pending` (via US1) e abrir o livro. Linha aparece com prazo destacado em vermelho, ícone, `aria-label="Atrasado"` e tooltip "Atrasado há N dias". Mover o capítulo para `completed`. Destaque some.

### Tests for User Story 2

- [ ] T028 [P] [US2] Component test em `__tests__/unit/components/features/chapters/chapter-deadline-cell.spec.tsx` cobrindo: `deadline=null` → `—` sem aria-label; `deadline` futuro → data formatada, sem destaque, tooltip "em N dias"; `deadline` passado + status ativo → classe `text-destructive`, ícone presente, `aria-label="Atrasado"`, tooltip "Atrasado há N dias"; `deadline` passado + status `completed` → data sem destaque; `deadline` passado + status `paid` → idem; `deadline` hoje → tooltip "hoje" sem destaque. Deve FALHAR.
- [ ] T029 [US2] E2E (estender `__tests__/e2e/chapter-deadline.spec.ts`) — cenário "Capítulo atrasado destacado" verificando `text-destructive` ou `aria-label`; cenário "Destaque some ao virar completed". Deve FALHAR.

### Implementation for User Story 2

- [ ] T030 [P] [US2] Criar `src/components/features/chapters/chapter-deadline-cell.tsx` conforme [contracts/ui-deadline-cell.md](./contracts/ui-deadline-cell.md). Props: `deadline`, `status`, `focusContext`. Renderiza 3 casos (null/upcoming/overdue). Tooltip via shadcn `<Tooltip>`. Ícone `AlertCircle` de `lucide-react`. Rodar T028 até passar.
- [ ] T031 [US2] Atualizar `src/components/features/chapters/chapters-table.tsx`: adicionar coluna fixa "Prazo" na definição de colunas (sem `header` clicável; respeitar FR-013). Calcular `focusContext` UMA vez por render via `useMemo`. Passar `focusContext` para cada célula via prop.
- [ ] T032 [US2] Atualizar `src/components/features/chapters/chapter-row.tsx` (modo leitura) para usar `<ChapterDeadlineCell>` na coluna de prazo. Atualizar `src/components/features/chapters/chapter-row-edit-mode.tsx` se houver versão "leitura na mesma célula durante edição" (verificar). Rodar T029 até passar.

**Checkpoint**: US2 funciona. Capítulos atrasados saltam visualmente. Falta filtro e badge.

---

## Phase 5: User Story 3 — Foco da semana (Priority: P1)

**Goal**: Toggle "Foco da semana" em `/books/:id` esconde tudo exceto capítulos `pending/editing/reviewing/retake` com prazo na semana civil OU atrasados. Estado persiste em URL.

**Independent Test**: Em livro com capítulos variados, ativar "Foco da semana": ver apenas atrasados + dentro da semana, em status ativos. Capítulos sem prazo / `completed` / `paid` somem. URL muda para `?focus=week`. Recarregar mantém estado. Coexiste com agrupamento (feature 024).

### Tests for User Story 3

- [ ] T033 [P] [US3] Unit test em `__tests__/unit/lib/url/focus-param.spec.ts`: `parseFocusParam` reconhece `"week"` e rejeita outros; `serializeFocusParam("week")` → `"week"`; `serializeFocusParam(null)` → `null`. Deve FALHAR.
- [ ] T034 [P] [US3] Unit test em `__tests__/unit/components/features/chapters/hooks/use-focus-week-filter.spec.tsx` (mock `next/navigation`): `enabled` reflete `?focus=week`; `toggle` chama `router.replace` adicionando/removendo `focus`; `toggle` preserva `?group=narrator,status` se presente; `applyFilter` retorna lista correta usando `isInFocusWeek`. Deve FALHAR.
- [ ] T035 [P] [US3] Component test em `__tests__/unit/components/features/chapters/chapter-focus-week-toggle.spec.tsx`: render com `enabled=false` → `variant="outline"`, `aria-pressed="false"`; render com `enabled=true` → `variant="default"`, `aria-pressed="true"`; clicar chama `toggle()`. Deve FALHAR.
- [ ] T036 [US3] E2E (estender `__tests__/e2e/chapter-deadline.spec.ts`): cenário "Filtro liga, esconde itens corretos, URL recebe `?focus=week`"; cenário "Recarregar com `?focus=week` mantém filtro ligado"; cenário "Toggle desliga, URL limpa o param". Deve FALHAR.

### Implementation for User Story 3

- [ ] T037 [P] [US3] Criar `src/lib/url/focus-param.ts` exportando `FocusWeekState`, `parseFocusParam(searchParams: URLSearchParams)`, `serializeFocusParam(value)`. Espelhar padrão de `src/lib/url/grouping-param.ts` (feature 024). Rodar T033 até passar.
- [ ] T038 [P] [US3] Criar `src/components/features/chapters/hooks/use-focus-week-filter.ts` exportando `useFocusWeekFilter(): UseFocusWeekFilterResult`. Lê via `useSearchParams()` + `usePathname()` + `useRouter()`. `applyFilter` memoizado retorna lista filtrada por `isInFocusWeek` (já existente de T010). `focusContext` calculado uma vez por mount via `useMemo`. Rodar T034 até passar.
- [ ] T039 [P] [US3] Criar `src/components/features/chapters/chapter-focus-week-toggle.tsx` conforme [contracts/ui-focus-week-filter.md](./contracts/ui-focus-week-filter.md): `<Button variant={enabled ? "default" : "outline"} aria-pressed={enabled}>` com ícone `Target` (`lucide-react`) e label "Foco da semana". Recebe `enabled` e `toggle` por props. Rodar T035 até passar.
- [ ] T040 [US3] Integrar em `src/components/features/chapters/chapters-table.tsx`: chamar `useFocusWeekFilter()` no componente; aplicar `applyFilter(chapters)` ANTES de passar para `useChaptersGroupingState` (feature 024). Renderizar `<ChapterFocusWeekToggle>` na barra de ações, ao lado do controle de grouping. Garantir empty state quando `enabled && filteredChapters.length === 0`. Rodar T036 até passar.

**Checkpoint**: US3 funciona. Filtro persiste em URL, esconde corretamente, coexiste com grouping. Falta apenas a visibilidade externa (badge).

---

## Phase 6: User Story 4 — Coluna "Foco" com badge "Foco da semana" em `/books` (Priority: P2)

**Goal**: Em `/books`, a tabela ganha uma coluna nova "Foco" (entre "Capítulos" e "Status"). A célula dessa coluna exibe badge "Foco da semana · N" quando N > 0; vazia quando N = 0. Calculada server-side via single query. N é exatamente o número que apareceria com o filtro ligado em `/books/:id`.

**Independent Test**: Criar livro + 3 capítulos (1 atrasado pending, 1 dentro da semana editing, 1 paid). Abrir `/books`. Card mostra "Foco da semana · 2". Abrir `/books/:id`, ligar filtro: 2 linhas visíveis.

### Tests for User Story 4

- [ ] T041 [US4] Integration test em `__tests__/integration/repositories/drizzle-book-focus-count.spec.ts`: fixture com 1 livro e 9 capítulos cobrindo combinações (atrasado pending ✅, segunda editing ✅, sábado reviewing ✅, domingo retake ✅, sexta completed ❌, quarta paid ❌, segunda+7 pending ❌, null pending ❌, hoje editing ✅) → `focusThisWeekCount === 5`. Inputs `today`/`monday`/`sunday` injetados explicitamente. Deve FALHAR.
- [ ] T042 [P] [US4] Component test em `__tests__/unit/components/features/books/book-focus-week-badge.spec.tsx`: `count=0` → renderiza `null`; `count=1` → badge com texto exato "Foco da semana · 1", ícone com `aria-hidden`; `count=50` → "Foco da semana · 50". Deve FALHAR.
- [ ] T043 [US4] E2E (estender `__tests__/e2e/chapter-deadline.spec.ts`): cenário "Badge aparece com count correto após definir prazo na semana"; cenário "Badge some quando capítulo move para paid". Deve FALHAR.

### Implementation for User Story 4

- [ ] T044 [US4] Atualizar `src/lib/repositories/book-repository.ts`: adicionar `interface ListSummariesOptions { todayIso: string; mondayIso: string; sundayIso: string }` e `focusThisWeekCount: number` em `BookSummary`. Atualizar assinatura: `listSummaries(opts: ListSummariesOptions, tx?: RepositoryTx): Promise<BookSummary[]>`.
- [ ] T045 [US4] Atualizar `src/lib/repositories/drizzle/drizzle-book-repository.ts`: adicionar agregado SQL conforme [contracts/api-books-list.md](./contracts/api-books-list.md) — `count(*) filter (where chapter.status in (...) and chapter.deadline is not null and (chapter.deadline < :today or chapter.deadline between :monday and :sunday))::int as focus_this_week_count`. Mapear no objeto retornado. Rodar T041 até passar.
- [ ] T046 [US4] Atualizar service de book (provavelmente `src/lib/services/book-service.ts`) na função que chama `listSummaries`: calcular `todayInAppTimezone()` e `currentWeekRangeInAppTimezone()` e injetar no `opts`. Atualizar factory se necessário.
- [ ] T047 [US4] Atualizar `src/app/api/v1/books/route.ts` (GET) para projetar `focusThisWeekCount` no payload de cada item.
- [ ] T048 [P] [US4] Criar `src/components/features/books/book-focus-week-badge.tsx` conforme [contracts/ui-focus-week-badge.md](./contracts/ui-focus-week-badge.md): componente puramente visual; recebe `count: number`; retorna `null` quando `count===0`; senão renderiza `<Badge variant="secondary">` com ícone `Target` (`aria-hidden`) e texto `Foco da semana · {count}`. Rodar T042 até passar.
- [ ] T049 [US4] Atualizar `src/components/features/books/books-table.tsx` adicionando nova coluna `"focusThisWeekCount"` (header "Foco") posicionada entre as colunas existentes `"chapters"` e `"status"`. Coluna é `enableSorting: false`. Célula renderiza `<BookFocusWeekBadge count={row.original.focusThisWeekCount} />`. Atualizar a interface `BookSummaryRow` para incluir `readonly focusThisWeekCount: number`. Consultar `design.pen` via Pencil MCP para validação visual da coluna. Rodar T043 até passar.

**Checkpoint**: US4 funciona. Badge aparece coerente com o filtro da página de detalhe. Feature completa.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verificação final, dark mode, acessibilidade, e quality gate antes do PR.

- [ ] T050 [P] Validar dark mode em todos os artefatos visuais novos (`ChapterDeadlineCell`, `ChapterDeadlinePicker`, `ChapterFocusWeekToggle`, `BookFocusWeekBadge`). Testar manualmente alternando tema. Confirmar tokens (`text-destructive`, `text-muted-foreground`, `bg-secondary`) — zero cores hardcoded.
- [ ] T051 [P] Auditoria de acessibilidade: rodar `bunx playwright test --grep "axe"` se houver suíte axe; caso contrário, verificar manualmente `aria-pressed` no toggle, `aria-label="Atrasado"` na célula, navegação por teclado no calendário.
- [ ] T052 [P] Verificar coverage mínimo dos novos arquivos (`chapter-deadline.ts`, `timezone.ts`, `format-date.ts`, `focus-param.ts`, `use-focus-week-filter.ts`) ≥ 80% via `bun run test:unit --coverage` (ou flag equivalente do Vitest).
- [ ] T061 [P] Auditoria de labels em português brasileiro (FR-035): rodar a aplicação em dev e percorrer os 6 cenários do quickstart, conferindo que **nenhum** texto exibido ao usuário em telas afetadas está em inglês. Verificação explícita: "Prazo", "Definir prazo", "Limpar", "Foco da semana", "Atrasado", "em N dias", "atrasado há N dias", "hoje", "amanhã", "ontem". Documentar achados.
- [ ] T062 Performance benchmark de `BookRepository.listSummaries` (FR-031, SC-008): criar fixture sintético com **100 livros × 50 capítulos cada** (5000 capítulos com prazos e status variados) em `__tests__/integration/repositories/drizzle-book-focus-count-perf.spec.ts`. Medir tempo de execução de `listSummaries({ todayIso, mondayIso, sundayIso })` usando `performance.now()`. Asserção: `duration < 200ms`. Marcar teste com tag `.skip` ou `.slow` para não rodar no CI principal se necessário, mas DEVE ser executável via `bun vitest run __tests__/integration/repositories/drizzle-book-focus-count-perf.spec.ts`.
- [ ] T053 Atualizar `CLAUDE.md` na seção "Active Technologies" adicionando entrada da 025 com `date-fns` + `date-fns-tz` + `react-day-picker` (via shadcn `Calendar`). Validar que `Current plan:` já aponta para esta feature (foi atualizado no `/speckit-plan`).
- [ ] T054 Executar `bun run lint` — zero erros, zero warnings. Corrigir antes de prosseguir.
- [ ] T055 Executar `bun run test:unit` — todos verdes.
- [ ] T056 Executar `bun run test:integration` — todos verdes.
- [ ] T057 Executar `bun run test:e2e` — todos verdes.
- [ ] T058 Executar `bun run build` — produção compila sem erro.
- [ ] T059 Validar walkthrough manual completo conforme [quickstart.md](./quickstart.md) (todos os 6 cenários).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências. Pode começar imediatamente. Tasks T002 e T003 paralelas a T001.
- **Foundational (Phase 2)**: depende de Phase 1 (`date-fns` instalado é pré-requisito de T008). BLOQUEIA todas as user stories.
- **US1 (Phase 3)**: depende de Foundational. Independente de US2/US3/US4.
- **US2 (Phase 4)**: depende de Foundational. Independente de US1/US3/US4 (não precisa do picker do US1, embora a forma mais prática de testar US2 manualmente seja usando US1).
- **US3 (Phase 5)**: depende de Foundational. Filtro aplica sobre lista de capítulos sem precisar do picker; coexiste com agrupamento (feature 024, já em prod).
- **US4 (Phase 6)**: depende de Foundational. Server-side independente; UI só precisa do `BookSummary` estendido.
- **Polish (Phase 7)**: depende das user stories que se quer entregar (mínimo: Foundational + as 3 P1).

### Dependências granulares notáveis

- T005 (migration generate) → T006 (apply).
- T006 (DB pronto) → T017, T020, T041 (integration tests precisam de schema novo).
- T008 (timezone helpers) → T010, T012, T038, T046 (consumidores).
- T010 (chapter-deadline helpers) → T030 (cell), T038 (filter), T045 (repo aggregate via espelhamento lógico).
- T015 (Chapter domain) → T016, T018, T021, T030 (qualquer coisa que tipa Chapter).
- T021 (service) → T022 (route projection).
- T044 (port) → T045 (adapter) → T046 (service) → T047 (route).

### Within Each User Story

- Tests primeiro (RED) → Implementação (GREEN) → Refactor (IMPROVE).
- Cell/picker antes da tabela que os consome.
- Helpers/port antes do adapter, service e route.

### Parallel Opportunities

#### Phase 1
- T002 e T003 em paralelo (componentes shadcn distintos).

#### Phase 2
- Helpers puros são paralelos: T007+T008, T009+T010, T011+T012 podem rodar em 3 trilhas independentes após T006.
- T013 (Zod schema) é paralelo aos helpers (arquivo separado).
- T016 (port) é paralelo a T015 (domain) — arquivos distintos.

#### Phase 3 (US1)
- T023 e T024 em paralelo (component test vs. E2E).
- T025 em paralelo com T026 enquanto separados; T027 depende de T026 estar acessível.

#### Phase 5 (US3)
- T037, T038, T039 em paralelo (arquivos distintos). T040 fecha integrando.

#### Phase 6 (US4)
- T042 em paralelo com T044/T045 (component test isolado).
- T048 em paralelo com T044/T045/T046/T047 (componente sem dependência de backend específico).

### Cross-Story Parallel

Após Foundational concluir, três trilhas de UI podem rodar em paralelo:
- Trilha A (US1): T023→T024→T025→T026→T027
- Trilha B (US2): T028→T029→T030→T031→T032
- Trilha C (US3): T033→T034→T035→T036→T037→T038→T039→T040

US4 (Phase 6) tem dependência backend própria (T044→T045→T046→T047) que é sequencial; sua UI (T048, T049) é paralela à backend.

---

## Parallel Example: User Story 3

```bash
# Trilha em paralelo após Foundational concluir:
Task: "Unit test focus-param parser in __tests__/unit/lib/url/focus-param.spec.ts"          # T033
Task: "Unit test use-focus-week-filter in __tests__/unit/components/features/chapters/hooks/use-focus-week-filter.spec.tsx"  # T034
Task: "Component test ChapterFocusWeekToggle in __tests__/unit/components/features/chapters/chapter-focus-week-toggle.spec.tsx"  # T035

# Depois (uma vez que cada teste RED esteja escrito):
Task: "Implement src/lib/url/focus-param.ts"                                                # T037
Task: "Implement src/components/features/chapters/hooks/use-focus-week-filter.ts"           # T038
Task: "Implement src/components/features/chapters/chapter-focus-week-toggle.tsx"            # T039

# Integração (sequencial):
Task: "Wire filter into chapters-table.tsx"                                                  # T040
```

---

## Implementation Strategy

### MVP escopo

As 3 user stories P1 (US1, US2, US3) formam o MVP — todas têm prioridade máxima na spec. Não há "STOP após US1" porque o produto sem visualização de atrasado ou foco da semana entrega valor muito reduzido.

**MVP = Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5.** Pode ser entregue separadamente de US4.

### Incremental Delivery

1. **Iteração 1**: Phases 1–5 (MVP completo). Deploy/demo: fluxo end-to-end na tela do livro.
2. **Iteração 2**: Phase 6 (US4 badge na lista). Deploy/demo: triagem externa em `/books`.
3. **Iteração 3**: Phase 7 (polish + verificação final). Quality gate → PR para `main`.

### TDD por fase

Dentro de cada user story:

1. Escrever **todos** os testes RED (T023+T024 para US1, etc.) antes da impl.
2. Rodar — devem falhar de forma coerente (arquivo inexistente, função não exportada, etc.).
3. Implementar mínimo para tornar verde.
4. Refatorar mantendo verde.
5. `/conventional-commits` ao final de cada user story (ou logical group dentro dela).

### Parallel Team Strategy

Com 3 devs após Foundational:

- Dev A: US1 (picker + integração no row edit mode).
- Dev B: US2 (cell + integração na tabela).
- Dev C: US3 (filter + URL state + integração na tabela).

US4 começa quando US3 termina (ou em paralelo com Polish, se dev livre).

---

## Notes

- `[P]` em arquivo diferente, sem dependência pendente.
- `[Story]` mapeia para US1–US4 da spec.
- Cada user story é independentemente testável (Independent Test descrito no header de cada phase).
- Não pular o RED do TDD: rodar o teste e confirmar falha antes de implementar.
- Commit após cada task ou logical group (use `/conventional-commits`).
- Stop em qualquer checkpoint para validar o que foi entregue.
- Evitar: tasks vagas, conflito no mesmo arquivo entre trilhas paralelas, dependência cruzada entre stories que quebre independência.
