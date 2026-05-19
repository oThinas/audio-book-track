---
description: "Task list for feature 028: Dashboards do Operador com Widgets Configuráveis"
---

# Tasks: Dashboards do Operador com Widgets Configuráveis

**Input**: Design documents from `/specs/028-operator-dashboards/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required (Princípio V do projeto exige TDD; coverage 100% para `earnings-aggregations.ts` e `dashboard-period.ts`; ≥ 80% geral). Cada task de implementação `*-impl` é precedida por sua task de teste `*-test` correspondente — **a task de teste DEVE estar VERMELHA (FAIL)** antes da task de impl começar (D12 do research).

**Organization**: Tasks agrupadas por user story para implementação e teste independentes. US1–US3 são P1 e formam o MVP; US4–US7 (P2/P3) são incrementais.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: US1, US2, US3, US4, US5, US6 ou US7 — mapeia para a user story
- Caminhos completos para cada task

## Path Conventions

Single Next.js app:
- Backend code: `src/lib/{domain,services,repositories,factories}/`, `src/app/api/v1/...`
- Frontend code: `src/app/(authenticated)/dashboard/`, `src/components/features/dashboard/`, `src/components/features/settings/`
- Tests: `__tests__/{unit,integration,e2e}/`

---

## Phase 1: Setup

**Purpose**: instalar dependência nova, consultar referências externas obrigatórias, preparar catálogo de erros.

- [ ] T001 [P] Instalar componente Chart do shadcn via `bunx --bun shadcn@latest add chart` (gera `src/components/ui/chart.tsx`)
- [ ] T002 [P] Consultar `design.pen` via Pencil MCP para referência visual da página `/dashboard` — anotar tokens, espaçamentos e hierarquia tipográfica em comentário inline em `src/components/features/dashboard/dashboard-page-content.tsx` (criar arquivo vazio se necessário, com nota de referência)
- [ ] T003 [P] Consultar docs de Recharts 2.x via Context7 MCP (`resolve-library-id` → `query-docs` com query "Recharts LineChart Tooltip Custom Component shadcn"). Salvar trecho relevante em `specs/028-operator-dashboards/research.md` se necessário
- [ ] T004 [P] Adicionar `fast-check` ^3.x como devDependency em `package.json` (necessária para property-based test do D12); rodar `bun install`

**Checkpoint**: deps externas resolvidas; assets de referência carregados.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema de DB, helpers de domínio, error catalog, esqueletos de repo/service. Nenhuma US pode começar sem esta fase.

**⚠️ CRITICAL**: Nenhuma task de user story (US1+) pode começar até `T031` ser marcada concluída.

### Schema & Migration

- [ ] T005 Editar `src/lib/db/schema/chapter.ts` para adicionar `completedAt: timestamp({ withTimezone: true })` (nullable), `paidAt: timestamp({ withTimezone: true })` (nullable), e índices parciais `chapter_completed_at_idx` e `chapter_paid_at_idx` (`WHERE … IS NOT NULL`) conforme data-model.md
- [ ] T006 Editar `src/lib/db/schema/user-preference.ts` para adicionar `dashboardWidgets: jsonb(...).$type<DashboardWidgetKey[]>().notNull().default(...)` com default contendo as 9 chaves (ver data-model.md). Import do tipo `DashboardWidgetKey` ficará pendente até T013
- [ ] T007 Rodar `bun run db:generate` para emitir o arquivo de migration em `src/lib/db/migrations/`. **Editar manualmente** o SQL gerado para incluir o backfill `UPDATE chapter SET completed_at = updated_at WHERE status IN ('completed','paid') AND completed_at IS NULL; UPDATE chapter SET paid_at = updated_at WHERE status='paid' AND paid_at IS NULL;` (conforme data-model.md)
- [ ] T008 Documentar o down migration manualmente em comentário no topo do SQL (Drizzle não gera down, mas mantemos o script reversível em comentário — Princípio XI)

### Domain helpers — Tests FIRST (RED)

- [ ] T009 [P] Escrever `__tests__/unit/domain/dashboard-widget.spec.ts` cobrindo: (a) `dashboardWidgetSchema` valida cada chave de `DASHBOARD_WIDGETS`; (b) chave desconhecida lança ZodError; (c) `dashboardWidgetsArraySchema` deduplica entradas; (d) `DEFAULT_DASHBOARD_WIDGETS` contém todas as 9 chaves; (e) `DASHBOARD_WIDGET_META` tem entry para cada key com `titlePtBr`/`descriptionPtBr`/`section` não vazios
- [ ] T010 [P] Escrever `__tests__/unit/domain/dashboard-period.spec.ts` cobrindo: (a) `getPresetRange('today', '2026-05-19')` → `{ fromIso: '2026-05-19', toIso: '2026-05-19', preset: 'today' }`; (b) `'this-week'` retorna segunda-domingo da semana civil em SP; (c) `'this-month'` retorna primeiro–último dia do mês civil; (d) `'this-quarter'` retorna primeiro dia do trimestre até hoje (ou último do trimestre se passado); (e) `'this-year'` retorna 01-01 até 12-31; (f) `parsePeriodSearchParams` retorna preset quando `preset` informado, range customizado quando `from`+`to` informados, fallback `this-month` quando vazio ou inválido; (g) `from > to` força fallback
- [ ] T011 [P] Escrever `__tests__/unit/domain/dashboard-bucketing.spec.ts` cobrindo: (a) `inferGranularity` retorna `'day'` para `to - from ≤ 31`, `'week'` para `[32, 180]`, `'month'` para `≥ 181`; (b) `bucketDates` gera lista densa de buckets sem gaps; (c) labels PT-BR formatadas corretamente para cada granularidade; (d) buckets respeitam fuso `America/Sao_Paulo` (caso teste com DST não-aplicável em SP, validar limite de mês)
- [ ] T012 [P] Escrever `__tests__/unit/domain/earnings-aggregations.spec.ts` cobrindo: (a) `densifyBuckets` preenche zeros em buckets sem dado; (b) preserva ordem dos buckets; (c) `ticketMedioCents` retorna `Math.round(total / count)` quando `count > 0`; (d) `ticketMedioCents(_, 0)` retorna `0` (sem divisão por zero, FR-015)
- [ ] T013 Rodar `bun run test:unit -- dashboard-widget dashboard-period dashboard-bucketing earnings-aggregations` e **confirmar que todos falham** (RED gate). Se algum passar antes da impl, a task de teste está errada — voltar ao item correspondente.

### Domain helpers — Implementation (GREEN)

- [ ] T014 [P] Implementar `src/lib/domain/dashboard-widget.ts` conforme assinaturas em data-model.md: `DASHBOARD_WIDGETS` array, `DashboardWidgetKey` type, `dashboardWidgetSchema`, `dashboardWidgetsArraySchema` (com dedup via transform), `DEFAULT_DASHBOARD_WIDGETS`, `DASHBOARD_WIDGET_META` (9 entries com PT-BR). Rodar `bun run test:unit -- dashboard-widget` até ficar verde.
- [ ] T015 [P] Implementar `src/lib/domain/dashboard-period.ts`: `PERIOD_PRESETS`, `PeriodPreset`, `DateRangeIso`, `periodSearchParamsSchema`, `getPresetRange()` (usa `date-fns` + `date-fns-tz` no fuso `APP_TIMEZONE`), `parsePeriodSearchParams()`. Rodar test até verde.
- [ ] T016 [P] Implementar `src/lib/domain/dashboard-bucketing.ts`: `inferGranularity()`, `bucketDates()`, `formatBucketLabel()`. Rodar test até verde.
- [ ] T017 [P] Implementar `src/lib/domain/earnings-aggregations.ts`: `BucketAmount` type, `densifyBuckets()`, `ticketMedioCents()`. Rodar test até verde.

### Chapter type & domain extensions

- [ ] T018 Editar `src/lib/domain/chapter.ts` para adicionar `completedAt: Date | null` e `paidAt: Date | null` no tipo `Chapter`. Estender `PAID_LOCKED_FIELDS` para incluir `"completedAt"` e `"paidAt"`. Rodar testes existentes de chapter para garantir que não quebrou nada.

### Chapter service — write timestamps on transitions

- [ ] T019 Escrever `__tests__/integration/services/chapter-service-timestamps.spec.ts` cobrindo (com DB real): (a) transição `reviewing → completed` preenche `completed_at` se `IS NULL`; (b) transição `completed → paid` preenche `paid_at`; (c) reversão `completed → reviewing` **mantém** `completed_at` (auditoria); (d) re-transição `reviewing → completed` quando já tinha `completed_at` **não sobrescreve** (idempotência por `IS NULL` guard); (e) escrita ocorre na MESMA transação do `recomputeBookStatusAndBumpVersion` (verificar via fake `UnitOfWork` que envolve a operação)
- [ ] T020 Rodar `bun run test:integration -- chapter-service-timestamps` e confirmar **FAIL**.
- [ ] T021 Editar `src/lib/services/chapter-service.ts` para escrever `completed_at` e `paid_at` na transição. Adicionar SET no UPDATE existente quando a nova status é `completed` ou `paid` e o timestamp ainda está `NULL`. Manter na mesma transação. Rodar T019 até verde.

### Migration backfill verification

- [ ] T022 Escrever `__tests__/integration/migrations/backfill-completed-paid-at.spec.ts` que: (a) cria DB de teste com schema antes da migration; (b) insere 3 capítulos legados (`status='completed'` sem `completed_at`; `status='paid'` sem `completed_at`/`paid_at`; `status='pending'` sem nada); (c) aplica a migration; (d) verifica que `completed_at = updated_at` para os dois primeiros; `paid_at = updated_at` para o segundo; `pending` permanece NULL nos dois campos
- [ ] T023 Rodar `bun run test:integration -- backfill` e confirmar **FAIL** se necessário (PASS já é OK porque migration ainda não corre no test setup; depende do isolamento de banco — ajustar se preciso).
- [ ] T024 Aplicar `bun run db:migrate` localmente e validar manualmente via psql que o backfill funcionou. Rodar T022 até verde.

### Error catalog

- [ ] T025 Editar `src/lib/api/error-codes.ts` adicionando: (a) `"dashboard:invalid-period"` (status 422, message "Período inválido. Verifique as datas selecionadas."); (b) `"dashboard-widgets:invalid-key"` (status 422, message "Uma das chaves de widget enviadas é inválida.")

### Repo, Factory, Service skeletons

- [ ] T026 Criar `src/lib/repositories/dashboard-repository.ts` (port/interface). Métodos: `getAReceberAgoraCents()`, `getReceitaPeriodoCents(range)`, `getChaptersPagosCount(range)`, `getRankingByStudio(range, limit)`, `getRankingByNarrator(range, limit)`, `getRankingByEditor(range, limit)`, `getStatusFunnel()`, `getOverdueSummary(todayIso)`, `getRevenueBuckets(range, granularity)` — todos `async` retornando os tipos apropriados; arquivo só com interface, sem impl
- [ ] T027 Criar `src/lib/repositories/drizzle/drizzle-dashboard-repository.ts` com classe `DrizzleDashboardRepository implements DashboardRepository` — métodos lançam `new Error("not implemented")` por enquanto. Construtor recebe `db: Database` por injeção
- [ ] T028 Criar `src/lib/factories/dashboard.ts` exportando `createDashboardService(db: Database): DashboardService` — composition root
- [ ] T029 Criar `src/lib/services/dashboard-service.ts` com classe `DashboardService` recebendo `DashboardRepository` no construtor. Métodos `getFinancial()`, `getOperational()`, `getRetrospective()` lançam `new Error("not implemented")` por enquanto
- [ ] T030 Criar `src/lib/repositories/user-preference-repository.ts` extensão (verificar se já existe; se sim, adicionar método `updateDashboardWidgets(userId, keys)`). Atualizar `DrizzleUserPreferenceRepository` para suportar a nova coluna em `findByUserId` e expor método de update

### Foundational gate

- [ ] T031 Rodar `bun run test:unit` (toda a suíte unitária) e `bun run test:integration -- chapter-service-timestamps backfill` — devem passar. Fim do Phase 2.

**Checkpoint**: schema migrado, helpers de domínio prontos, repo/service esqueleto pronto. US1+ podem começar.

---

## Phase 3: User Story 1 — A receber agora (Priority: P1) 🎯 MVP

**Goal**: operador autenticado vê a página `/dashboard` com o KPI **"A receber agora"** exibindo a soma de receita de capítulos `completed` ainda não pagos.

**Independent Test**: criar (via seed) 5 capítulos `completed` somando R$ 1.234,56; abrir `/dashboard`; KPI mostra "R$ 1.234,56".

### Tests for US1 (RED first)

- [ ] T032 [P] [US1] Escrever `__tests__/integration/repositories/dashboard-repository.spec.ts::getAReceberAgoraCents` com DB real: setup com 3 capítulos `completed` (soma esperada X) + 2 `paid` (devem ser ignorados); verificar `repo.getAReceberAgoraCents()` retorna exatamente X
- [ ] T033 [P] [US1] Escrever `__tests__/unit/services/dashboard-service.spec.ts::getFinancial-only-a-receber-agora` com `InMemoryDashboardRepository` fake: `service.getFinancial(period, ['a-receber-agora'])` retorna `aReceberAgoraCents` correto e demais campos como 0/[] (com `computedWidgets = ['a-receber-agora']`)
- [ ] T034 [P] [US1] Escrever `__tests__/unit/api/dashboard-routes.spec.ts::financial-validates-zod` testando a route handler com fetch mock: GET sem cookie de sessão → 401; com preset inválido → 422 com code `dashboard:invalid-period`; com `from > to` → 422
- [ ] T035 [P] [US1] Escrever `__tests__/e2e/dashboard-loads.spec.ts` (Playwright): login admin → navega para `/dashboard` → vê texto "A receber agora" e um valor BRL (`R$ \d`). Skeleton aparece em < 1s; conteúdo final em < 2s (Sm-002).
- [ ] T036 [US1] Rodar `bun run test:unit -- dashboard-routes dashboard-service`, `bun run test:integration -- dashboard-repository`, e Playwright preview de T035; **confirmar todos falham** (RED gate).

### Implementation for US1

- [ ] T037 [P] [US1] Implementar `DrizzleDashboardRepository.getAReceberAgoraCents()`: `SELECT COALESCE(SUM(ROUND(c.edited_seconds * b.price_per_hour_cents / 3600.0)), 0)::bigint FROM chapter c JOIN book b ON b.id = c.book_id WHERE c.status = 'completed'`. Retorna `number`. Rodar T032 até verde.
- [ ] T038 [P] [US1] Implementar `DashboardService.getFinancial(period, enabledWidgets)`: por enquanto só processa `'a-receber-agora'`; demais campos ficam em zero/array vazio. Retorna `FinancialSnapshot`. Rodar T033 até verde.
- [ ] T039 [US1] Implementar `src/app/api/v1/dashboard/financial/route.ts`: handler GET com `withApiErrorHandler`; valida `searchParams` via `periodSearchParamsSchema`; resolve período via `parsePeriodSearchParams`; chama `createDashboardService(db).getFinancial(period, enabledWidgets)`; retorna `{ data: snapshot }` com header `Cache-Control: no-store`. Rodar T034 até verde.
- [ ] T040 [P] [US1] Implementar `src/components/features/dashboard/section-skeleton.tsx` — átomo de skeleton (`<Card>` + `<Skeleton>` do shadcn); aceita prop `lines?: number`
- [ ] T041 [P] [US1] Implementar `src/components/features/dashboard/section-error.tsx` — átomo de erro local (mensagem PT-BR + opcional botão "Tentar novamente")
- [ ] T042 [P] [US1] Implementar `src/components/features/dashboard/financial-kpi-card.tsx` como compound component (D14): `FinancialKpiCard`, `FinancialKpiCard.Label`, `FinancialKpiCard.Value`, `FinancialKpiCard.Hint`. Sem boolean props para variantes. JSX usa apenas tokens semânticos (`bg-card`, `text-foreground`, `text-muted-foreground`) — dark mode automático
- [ ] T043 [US1] Implementar `src/components/features/dashboard/financial-section.tsx` (Server Component): recebe `period` e `enabledWidgets`; chama `DashboardService.getFinancial` diretamente (sem HTTP roundtrip); renderiza um `<FinancialKpiCard>` para "A receber agora" (depende de T042). Pula renderização do KPI se `'a-receber-agora'` não estiver em `enabledWidgets`
- [ ] T044 [US1] Implementar `src/components/features/dashboard/dashboard-page-content.tsx` (Server Component): compõe `<PageContainer>` + `<PageHeader>` + `<FinancialSection>` (com `<Suspense fallback={<SectionSkeleton />}>`). Recebe `period` + `enabledWidgets` como props
- [ ] T045 [US1] Implementar `src/app/(authenticated)/dashboard/page.tsx`: Server Component que (a) lê `searchParams` via `parsePeriodSearchParams` (default "this-month" — antecipa US2 mas precisa do tipo aqui); (b) lê `userPreference.dashboardWidgets` do usuário logado via repo (T030); (c) renderiza `<DashboardPageContent period={period} enabledWidgets={enabledWidgets} />`
- [ ] T046 [US1] Confirmar via Playwright manual que T035 passa (login → /dashboard → KPI visível). Marcar T035 como GREEN.

**Checkpoint**: US1 funcional. `/dashboard` carrega e mostra o KPI "A receber agora". MVP entregue.

---

## Phase 4: User Story 2 — Receita realizada no período (Priority: P1)

**Goal**: filtro global de período aparece no topo; KPI "Receita realizada no período" reflete capítulos pagos no recorte.

**Independent Test**: alterar filtro de "Este mês" para "Este ano" e ver o KPI recalcular (assumindo dados em ambos os recortes).

### Tests for US2 (RED first)

- [ ] T047 [P] [US2] Estender `__tests__/integration/repositories/dashboard-repository.spec.ts` com `getReceitaPeriodoCents` e `getChaptersPagosCount`: setup com 4 capítulos `paid` no período + 2 fora; valida soma e count
- [ ] T048 [P] [US2] Escrever `__tests__/unit/domain/earnings-sql-equivalence.spec.ts` usando `fast-check`: gera 1000 pares aleatórios `(edited_seconds ∈ [0, 3_600_000], price_per_hour_cents ∈ [0, 10_000_000])`; para cada par, calcula `computeEarningsCents(...)` em JS e compara com `Math.round(seconds * price / 3600)` (mock do SQL). Garantia: diferença = 0 para 100% dos casos
- [ ] T049 [P] [US2] Estender `__tests__/unit/services/dashboard-service.spec.ts` com cenário `getFinancial` calculando `receitaPeriodoCents` e `chaptersPagosCount` baseado no período passado
- [ ] T050 [P] [US2] Escrever `__tests__/e2e/dashboard-period-filter.spec.ts`: (a) abre `/dashboard`, preset default é "Este mês"; (b) clica em "Este ano" → URL muda para `?preset=this-year`, KPI recalcula; (c) abre date picker, escolhe range customizado → URL `?from=...&to=...`; (d) refresh F5 mantém estado
- [ ] T051 [US2] Rodar suítes correspondentes e confirmar **RED**.

### Implementation for US2

- [ ] T052 [P] [US2] Implementar `DrizzleDashboardRepository.getReceitaPeriodoCents(range)` e `.getChaptersPagosCount(range)`: query usa `WHERE c.status='paid' AND c.paid_at >= $from AND c.paid_at <= $to` (cast `paid_at` para fuso SP no `WHERE`). Rodar T047 até verde.
- [ ] T053 [P] [US2] Estender `DashboardService.getFinancial` para processar `'receita-periodo'` (chama `getReceitaPeriodoCents` + `getChaptersPagosCount`). Rodar T049 até verde.
- [ ] T054 [US2] Rodar T048 (property-based equivalence test) e ajustar `computeEarningsCents` ou a query SQL se houver divergência. **Crítico** — Princípio II. T048 vira verde.
- [ ] T055 [P] [US2] Implementar `src/components/features/dashboard/hooks/use-period-filter.ts`: hook client que lê/escreve URL search params (`router.replace`, `scroll: false`). Retorna `{ period: DateRangeIso, setPreset, setRange }`
- [ ] T056 [US2] Implementar `src/components/features/dashboard/period-filter.tsx` (`"use client"`): renderiza `<Tabs>` (shadcn) com 5 presets + `<Popover>` com `<Calendar>` (shadcn `react-day-picker`) para range customizado. Usa hook T055. Validação client-side: bloqueia `from > to`. Mobile: tabs colapsam em scroll horizontal
- [ ] T057 [US2] Atualizar `<DashboardPageContent>` (T044) para incluir `<PeriodFilter />` no header; passar `period` resultante para `<FinancialSection>`
- [ ] T058 [US2] Atualizar `<FinancialSection>` para renderizar o KPI "Receita realizada no período" usando outro `<FinancialKpiCard>` compound. Pular se `'receita-periodo'` desabilitado
- [ ] T059 [US2] Validar via Playwright (T050) — marcar verde.

**Checkpoint**: US2 funcional. Filtro de período altera o KPI "Receita realizada".

---

## Phase 5: User Story 3 — Funil de status e capítulos atrasados (Priority: P1)

**Goal**: seção operacional exibe funil de 6 status (contagem atual) e card "Capítulos atrasados" com link para o livro com o atraso mais antigo.

**Independent Test**: criar capítulos em vários status, abrir `/dashboard`, verificar contagens; criar capítulo com `deadline < hoje` em status ativo, ver contagem aumentar e link funcionando.

### Tests for US3 (RED first)

- [ ] T060 [P] [US3] Estender `__tests__/integration/repositories/dashboard-repository.spec.ts` com `getStatusFunnel()` e `getOverdueSummary(todayIso)`: setup com mix de status e deadlines; verifica contagens por status e o `firstOverdueBookId` (com tiebreaker `book.title` ASC quando deadlines empatam entre livros)
- [ ] T061 [P] [US3] Escrever `__tests__/unit/services/dashboard-service.spec.ts::getOperational` com fake repo: verifica que `getOperational(['funil-status', 'atrasados'])` retorna ambos os dados; com `['atrasados']` retorna funnel zerado e só atrasados
- [ ] T062 [P] [US3] Escrever `__tests__/e2e/dashboard-overdue-nav.spec.ts`: (a) criar capítulo atrasado conhecido via seed; (b) abrir `/dashboard`; (c) clicar em "Ver lista" no card de atrasados; (d) assertar que URL final é `/books/<expected-book-id>?focus=week`
- [ ] T063 [US3] Rodar suítes e confirmar **RED**.

### Implementation for US3

- [ ] T064 [P] [US3] Implementar `DrizzleDashboardRepository.getStatusFunnel()`: `SELECT status, COUNT(*) FROM chapter GROUP BY status`. Retorna `Record<ChapterStatus, number>` (preencher zeros para status ausentes). Rodar T060 (parte funnel) até verde
- [ ] T065 [P] [US3] Implementar `DrizzleDashboardRepository.getOverdueSummary(todayIso)`: query com `SELECT COUNT(*)` total + subquery `SELECT c.book_id FROM chapter c JOIN book b ON b.id=c.book_id WHERE c.deadline < $today AND c.status NOT IN ('completed','paid') ORDER BY c.deadline ASC, b.title ASC LIMIT 1`. Retorna `{ overdueCount, firstOverdueBookId | null }`. Rodar T060 (parte overdue) até verde
- [ ] T066 [US3] Implementar `DashboardService.getOperational(enabledWidgets)` orquestrando T064 + T065 (usar `todayInAppTimezone()` da feature 025). Rodar T061 até verde
- [ ] T067 [US3] Criar `src/app/api/v1/dashboard/operational/route.ts` análogo ao financial (sem params de período; sem 422 possível)
- [ ] T068 [P] [US3] Implementar `src/components/features/dashboard/status-funnel.tsx` (Server Component): recebe `funnel: Record<ChapterStatus, number>`; renderiza chips horizontais em uma linha (wrap em mobile) com label PT-BR (`Pendente`, `Em edição`, ...) e contagem. Token: `border-border/40`, `bg-card`
- [ ] T069 [P] [US3] Implementar `src/components/features/dashboard/overdue-card.tsx` (`"use client"`): recebe `{ count, firstOverdueBookId }`; mostra contagem; `<Button>` "Ver lista" desabilitado quando `count === 0`, senão `<Link href={`/books/${firstOverdueBookId}?focus=week`}>`. Aplicar `bg-destructive/10` apenas quando `count > 0` (D11)
- [ ] T070 [US3] Implementar `src/components/features/dashboard/operational-section.tsx` (Server Component): chama `DashboardService.getOperational`; renderiza `<StatusFunnel />` e `<OverdueCard />` em `<Suspense>` próprio. Pula renderização individual conforme `enabledWidgets`
- [ ] T071 [US3] Atualizar `<DashboardPageContent>` para incluir `<OperationalSection>` após `<FinancialSection>`. Validar T062 — marcar verde

**Checkpoint**: US3 funcional. Funil + atrasados visíveis e navegação correta.

---

## Phase 6: User Story 4 — Gráfico temporal (Priority: P2)

**Goal**: seção retrospectiva exibe um gráfico de linha com receita realizada por bucket (dia/semana/mês conforme granularidade automática).

**Independent Test**: alterar período e ver granularidade do gráfico mudar.

### Tests for US4 (RED first)

- [ ] T072 [P] [US4] Estender `__tests__/integration/repositories/dashboard-repository.spec.ts` com `getRevenueBuckets(range, granularity)`: setup 5 capítulos `paid` em datas conhecidas; verifica que cada bucket contém a soma esperada e buckets vazios não aparecem na resposta esparsa
- [ ] T073 [P] [US4] Estender `__tests__/unit/services/dashboard-service.spec.ts::getRetrospective` com fake repo: verifica que o service infere granularidade via `inferGranularity`, gera buckets via `bucketDates`, e densifica o resultado via `densifyBuckets` (zerando buckets sem receita — FR-024)
- [ ] T074 [P] [US4] Escrever `__tests__/e2e/dashboard-retrospective-granularity.spec.ts`: troca preset entre "Hoje", "Este mês", "Este trimestre", "Este ano" e verifica número aproximado de pontos no gráfico (via DOM count de elementos SVG) e que tooltip aparece em hover com label correto
- [ ] T075 [US4] Rodar suítes e confirmar **RED**.

### Implementation for US4

- [ ] T076 [US4] Implementar `DrizzleDashboardRepository.getRevenueBuckets(range, granularity)`: query com `date_trunc('day'|'week'|'month', c.paid_at AT TIME ZONE 'America/Sao_Paulo')` como bucket key + `SUM(ROUND(...))::bigint` + `GROUP BY` + `WHERE c.status='paid' AND paid_at BETWEEN ... AND ...`. Retorna `Array<{ startIso, cents }>` esparsa. Rodar T072 até verde
- [ ] T077 [US4] Implementar `DashboardService.getRetrospective(period, enabledWidgets)`: chama `inferGranularity` + `bucketDates` + repo + `densifyBuckets`. Aplica `formatBucketLabel` para cada bucket. Rodar T073 até verde
- [ ] T078 [US4] Criar `src/app/api/v1/dashboard/retrospective/route.ts` análogo ao financial
- [ ] T079 [US4] Implementar `src/components/features/dashboard/revenue-chart.tsx` (`"use client"` + lazy export default): usa `<ChartContainer>` (shadcn) + Recharts `<LineChart>`. Linha única; tooltip customizado com `labelPtBr` + BRL; eixo Y só em valores não-decimais; cor via token `var(--chart-1)`. Sem gradient fill (D11). Suporta dark mode automaticamente
- [ ] T080 [US4] Implementar `src/components/features/dashboard/retrospective-section.tsx` (Server Component): chama `DashboardService.getRetrospective`; renderiza `<Suspense fallback={<SectionSkeleton lines={6} />}>` envolvendo `<RevenueChart data={buckets} />` (importado via `React.lazy(() => import("./revenue-chart"))` em wrapper client-side). Estado vazio quando `buckets.every(b => b.cents === 0)`
- [ ] T081 [US4] Atualizar `<DashboardPageContent>` para incluir `<RetrospectiveSection>` após `<OperationalSection>`. Validar T074 — verde

**Checkpoint**: US4 funcional. Gráfico temporal renderiza nas 3 granularidades.

---

## Phase 7: User Story 5 — Rankings por estúdio, narrador, editor (Priority: P2)

**Goal**: dentro da seção financeira, três tabs de ranking exibem top 10 por receita gerada no período.

**Independent Test**: trocar tabs e ver ranking recalcular; verificar entidades soft-deleted exibindo badge.

### Tests for US5 (RED first)

- [ ] T082 [P] [US5] Estender `__tests__/integration/repositories/dashboard-repository.spec.ts` com `getRankingByStudio`/`getRankingByNarrator`/`getRankingByEditor`: setup com várias entidades; verifica top 10 ordenado descendente, capítulos sem narrador/editor excluídos, soft-deleted retorna com `archived: true`
- [ ] T083 [P] [US5] Estender `__tests__/unit/services/dashboard-service.spec.ts` com cenário que `getFinancial(period, ['ranking-estudio', 'ranking-narrador', 'ranking-editor'])` chama os três métodos do repo e retorna os 3 arrays. Quando só 1 ranking está enabled, só ele é calculado (FR-032)
- [ ] T084 [P] [US5] Escrever `__tests__/e2e/dashboard-rankings.spec.ts`: clica nas 3 tabs sequencialmente, valida que ranking atualiza e badge "(arquivado)" aparece em entidades soft-deleted conhecidas
- [ ] T085 [US5] Rodar e confirmar **RED**.

### Implementation for US5

- [ ] T086 [P] [US5] Implementar `DrizzleDashboardRepository.getRankingByStudio(range, limit=10)`: LEFT JOIN `chapter → book → studio`; `WHERE chapter.status='paid' AND chapter.paid_at BETWEEN ...`; `GROUP BY studio.id, studio.name, studio.deleted_at`; `ORDER BY SUM(...) DESC LIMIT $limit`. Retorna `RankingEntry[]` com `archived: studio.deleted_at IS NOT NULL`. Rodar T082 (parte estúdio) até verde
- [ ] T087 [P] [US5] Implementar `DrizzleDashboardRepository.getRankingByNarrator(range, limit=10)` análogo (LEFT JOIN narrador via `chapter.narrator_id`; `WHERE narrator_id IS NOT NULL`). Rodar T082 (parte narrador) até verde
- [ ] T088 [P] [US5] Implementar `DrizzleDashboardRepository.getRankingByEditor(range, limit=10)` análogo. Rodar T082 (parte editor) até verde
- [ ] T089 [US5] Estender `DashboardService.getFinancial` para processar `ranking-estudio`/`ranking-narrador`/`ranking-editor` conforme `enabledWidgets`. Rodar T083 até verde
- [ ] T090 [P] [US5] Implementar `src/components/features/dashboard/hooks/use-ranking-tab.ts`: estado local (`useState`) do tab atual (`'estudio' | 'narrador' | 'editor'`). Default `'estudio'`. Pure client state — não vai pra URL (rankings mudam rápido em sessão)
- [ ] T091 [US5] Implementar `src/components/features/dashboard/financial-ranking-tabs.tsx` (`"use client"`): compound component em cima de `<Tabs>` shadcn (D14). Sub-componentes `RankingTabs.List`, `RankingTabs.Trigger`, `RankingTabs.Content`. Cada `<Content>` renderiza uma `<Table>` shadcn com 10 linhas (nome, capítulos pagos, receita BRL). Linhas com `archived` mostram `<Badge>` "Arquivado"
- [ ] T092 [US5] Atualizar `<FinancialSection>` para incluir `<RankingTabs>` abaixo dos KPIs quando ao menos 1 ranking estiver em `enabledWidgets`. Validar T084 — verde

**Checkpoint**: US5 funcional. 3 rankings em tabs, suporte a soft-deletes.

---

## Phase 8: User Story 6 — Configuração de widgets em /settings (Priority: P2)

**Goal**: cada admin marca/desmarca widgets em `/settings`; preferência persiste e afeta apenas seu próprio dashboard.

**Independent Test**: desligar um widget, salvar, abrir `/dashboard` em outra aba e verificar ausência; outro admin não é afetado.

### Tests for US6 (RED first)

- [ ] T093 [P] [US6] Escrever `__tests__/integration/repositories/user-preference-repository.spec.ts::updateDashboardWidgets`: setup user; `updateDashboardWidgets(userId, ['a-receber-agora'])`; verifica que `findByUserId` retorna a lista atualizada. Edge cases: array vazio aceito; duplicatas deduplicadas; chave inválida rejeitada (via Zod no service)
- [ ] T094 [P] [US6] Escrever `__tests__/unit/services/user-preference-service.spec.ts` (extensão) testando a validação Zod do `dashboardWidgets` field
- [ ] T095 [P] [US6] Escrever `__tests__/unit/api/dashboard-routes.spec.ts::respects-widgets-param`: verifica que `?widgets=a-receber-agora,receita-periodo` passa apenas essas chaves para o service (otimização FR-032)
- [ ] T096 [P] [US6] Escrever `__tests__/e2e/dashboard-widget-config.spec.ts`: login como admin A → `/settings` → desmarca "Ranking por editor" → salva → `/dashboard` (tab editor sumiu); login como admin B → `/dashboard` (tab editor permanece para ele)
- [ ] T097 [P] [US6] Escrever `__tests__/e2e/dashboard-empty-state.spec.ts`: desmarca todos → `/dashboard` → vê empty state com link para `/settings`
- [ ] T098 [US6] Rodar e confirmar **RED**.

### Implementation for US6

- [ ] T099 [US6] Estender `src/lib/domain/user-preference.ts` com `dashboardWidgets: DashboardWidgetKey[]` em `UserPreference` interface; estender `updateUserPreferenceSchema` para incluir `dashboardWidgets` opcional (Zod com `dashboardWidgetsArraySchema`); ajustar `DEFAULT_USER_PREFERENCE` para incluir `DEFAULT_DASHBOARD_WIDGETS`
- [ ] T100 [US6] Atualizar `DrizzleUserPreferenceRepository`: `findByUserId` retorna `dashboardWidgets`; novo método `updateDashboardWidgets(userId, keys)` faz UPDATE. Rodar T093 até verde
- [ ] T101 [US6] Atualizar `UserPreferenceService` para suportar update do novo campo (validação Zod já vem de T099). Rodar T094 até verde
- [ ] T102 [US6] Estender API existente de preferências (PATCH `/api/v1/user-preferences` ou rota equivalente do projeto) para aceitar `dashboardWidgets` no body. Garantir error code `dashboard-widgets:invalid-key` retornado em chaves inválidas
- [ ] T103 [US6] Atualizar route handlers de dashboard (T039, T067, T078) para aceitar query param `?widgets=...` (CSV) e passar a lista para o service. Default sem filtro = todos os widgets daquela seção. Rodar T095 até verde
- [ ] T104 [P] [US6] Implementar `src/components/features/settings/hooks/use-dashboard-widgets-form.ts`: hook usando React Hook Form que recebe `defaultValues: DashboardWidgetKey[]` e expõe `onSubmit` chamando PATCH `/api/v1/user-preferences` via `apiFetch`. Em sucesso, NÃO usa `toast.success`; deixa a UI refletir (próximo `/dashboard` mostra mudança)
- [ ] T105 [US6] Implementar `src/components/features/settings/dashboard-widgets-section.tsx` (`"use client"`): renderiza `<Card>` com `<CardHeader>` "Dashboard" e 9 `<Checkbox>` mapeando `DASHBOARD_WIDGET_META`. Cada item: `<Checkbox>` + `<Label>` (título) + `<p>` (descrição em `text-muted-foreground`). Botão "Salvar" desabilitado quando não há mudanças (`form.formState.isDirty`)
- [ ] T106 [US6] Atualizar `src/app/(authenticated)/settings/page.tsx` para incluir `<DashboardWidgetsSection initialWidgets={userPref.dashboardWidgets} />`
- [ ] T107 [P] [US6] Implementar `src/components/features/dashboard/widgets-empty-state.tsx` (Server Component): renderiza mensagem PT-BR + `<Link>` para `/settings#dashboard-widgets` (anchor scroll)
- [ ] T108 [US6] Atualizar `dashboard/page.tsx` (T045) para renderizar `<WidgetsEmptyState />` quando `enabledWidgets.length === 0`. Validar T096 e T097 — verde

**Checkpoint**: US6 funcional. Configuração por usuário persiste, empty state quando tudo off.

---

## Phase 9: User Story 7 — Ticket médio por capítulo pago (Priority: P3)

**Goal**: novo KPI "Ticket médio" calculado como receita do período ÷ capítulos pagos no período.

**Independent Test**: verificar valor médio com 5 capítulos pagos somando X; conferir tratamento de zero.

### Tests for US7 (RED first)

- [ ] T109 [P] [US7] Estender `__tests__/unit/services/dashboard-service.spec.ts` com cenário: 5 capítulos pagos somando 1500 cents totalCents → `ticketMedioCents = 300`; 0 capítulos → `ticketMedioCents = 0` (sem divisão por zero, FR-015)
- [ ] T110 [US7] Confirmar **RED** (T109 falha porque service não calcula o campo ainda).

### Implementation for US7

- [ ] T111 [US7] Estender `DashboardService.getFinancial` para calcular `ticketMedioCents` via `ticketMedioCents(receitaPeriodoCents, chaptersPagosCount)` (helper já existente, T017). Só calcular se `'ticket-medio' ∈ enabledWidgets`. Rodar T109 até verde
- [ ] T112 [US7] Atualizar `<FinancialSection>` para renderizar um terceiro `<FinancialKpiCard>` para "Ticket médio" quando widget habilitado

**Checkpoint**: US7 funcional. 3 KPIs financeiros visíveis (a receber, receita período, ticket médio).

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T113 [P] Auditoria de dark mode: abrir todas as variantes (KPIs, funil, atrasados, rankings, chart) em ambos os temas; verificar contrastes via DevTools / axe-core; ajustar qualquer cor que não respeite token semântico
- [ ] T114 [P] Auditoria mobile (320, 375, 768): garantir que filtros, tabs e chart se adaptam; horizontal scroll só onde for intencional
- [ ] T115 [P] Verificar Lighthouse local em `/dashboard`: LCP < 1s (alvo), CLS < 0.1, INP < 200ms
- [ ] T116 [P] Documentar comportamento do backfill na release note: usuários com dados anteriores ao deploy podem ver precisão de dia em vez de minuto em `completed_at`/`paid_at`
- [ ] T117 Atualizar `docs/CODEMAPS/dashboard.md` (ou equivalente) com a estrutura de camadas e fluxo de dados desta feature
- [ ] T118 Rodar `/simplify` skill no diretório `src/components/features/dashboard/` — remover duplicações, consolidar helpers comuns se houver
- [ ] T119 Rodar `/code-review` sobre os arquivos novos — corrigir achados CRITICAL/HIGH
- [ ] T120 **Fase final de verificação** (Princípio XVI): rodar nesta ordem e exigir verde:
  1. `bun run lint` — zero warnings/erros
  2. `bun run test:unit` — toda a suíte
  3. `bun run test:integration` — toda a suíte
  4. `bun run test:e2e` — toda a suíte (inclusive os novos: dashboard-loads, dashboard-period-filter, dashboard-overdue-nav, dashboard-retrospective-granularity, dashboard-rankings, dashboard-widget-config, dashboard-empty-state)
  5. `bun run build` — build de produção
- [ ] T121 Rodar `quickstart.md` (smoke + edge cases) manualmente; corrigir qualquer divergência
- [ ] T122 Self-review checklist da Constituição (preencher na descrição do PR)
- [ ] T123 Abrir PR via `/finish-task` contra `main`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: sem dependências, pode começar imediatamente
- **Phase 2 (Foundational)**: depende de Phase 1 completa; **bloqueia** todas as US
- **Phase 3 (US1)**: depende de Phase 2; é o MVP — independente de US2-7
- **Phase 4 (US2)**: depende de Phase 2 + de US1 (reaproveita page shell e `<FinancialSection>`)
- **Phase 5 (US3)**: depende de Phase 2 + US1 (page shell); independente de US2
- **Phase 6 (US4)**: depende de Phase 2 + US1; independente de US2 e US3
- **Phase 7 (US5)**: depende de Phase 2 + US1 + US2 (precisa do filtro de período já funcional)
- **Phase 8 (US6)**: depende de Phase 2 + US1 (estrutura de `enabledWidgets` já é lida em T045); independente das outras
- **Phase 9 (US7)**: depende de Phase 2 + US2 (precisa do count de capítulos pagos no período)
- **Phase 10 (Polish)**: depende de todas as US implementadas que se queira na release

### Within Each User Story

- Tasks `*-test` MUST estar VERMELHAS (rodar e ver FAIL) antes da `*-impl` correspondente (D12 / Princípio V)
- Tasks marcadas `[P]` dentro de uma US podem rodar em paralelo (arquivos distintos)
- Sequência típica: teste(s) RED → impl repository → impl service → impl route → impl componentes → e2e

### Parallel Opportunities

- **Phase 1**: T001-T004 todas em paralelo
- **Phase 2 — Domain tests**: T009-T012 paralelos (arquivos distintos)
- **Phase 2 — Domain impl**: T014-T017 paralelos
- **Phase 3 (US1) — Tests**: T032-T035 paralelos
- **Phase 3 (US1) — Impl atoms/components**: T040-T042 paralelos
- **Phase 5 (US3) — Rankings repo**: T086-T088 paralelos (queries distintas no mesmo arquivo se conflito, então sequencial; mas teste pode rodar em paralelo)
- **Phase 8 (US6) — Tests**: T093-T097 paralelos
- **Phase 10 (Polish)**: T113-T119 paralelos

---

## Parallel Example: User Story 1

```bash
# Testes RED de US1 (paralelo, arquivos distintos):
Task: "T032 [US1] Integration test getAReceberAgoraCents in __tests__/integration/repositories/dashboard-repository.spec.ts"
Task: "T033 [US1] Unit test DashboardService.getFinancial in __tests__/unit/services/dashboard-service.spec.ts"
Task: "T034 [US1] Route validation test in __tests__/unit/api/dashboard-routes.spec.ts"
Task: "T035 [US1] E2E dashboard-loads in __tests__/e2e/dashboard-loads.spec.ts"

# Atoms/Cards em paralelo após testes RED:
Task: "T040 [US1] section-skeleton.tsx"
Task: "T041 [US1] section-error.tsx"
Task: "T042 [US1] financial-kpi-card.tsx (compound)"
```

---

## Implementation Strategy

### MVP First (US1 apenas)

1. Phase 1 (Setup) — 1 dia
2. Phase 2 (Foundational) — 2-3 dias (DB migration, helpers, repo skeletons)
3. Phase 3 (US1) — 1-2 dias (página + KPI "A receber agora")
4. **STOP & VALIDATE**: operador entra em `/dashboard`, vê o número. Demo/deploy possível aqui.

### Incremental Delivery (P1 completo)

5. Phase 4 (US2) — filtro de período + KPI receita realizada
6. Phase 5 (US3) — funil + atrasados

Após Phase 5, P1 está fechado. Cobertura de spec ~50% de US, mas 100% das US críticas.

### Incremental Delivery (P2 + P3)

7. Phase 6 (US4) — gráfico temporal
8. Phase 7 (US5) — rankings
9. Phase 8 (US6) — configuração de widgets
10. Phase 9 (US7) — ticket médio

### Final

11. Phase 10 — polish + verificação final + PR

### Parallel Team Strategy

Após Phase 2:
- Dev A: US1 (P1, bloqueio do shell)
- Dev B (paralelo): US3 (operacional, independente de US2)
- Dev C (paralelo): US6 (configuração, independente das outras)

Após Phase 3 (US1):
- Dev A: US2 (filtro)
- Dev B: US4 (chart, paralelo com US2)
- Dev C: continua US6

Após Phase 4 (US2):
- Dev A: US5 (rankings, precisa do filtro)
- Dev B: US7 (ticket médio, precisa do count)

---

## Notes

- `[P]` = arquivo diferente, sem conflito
- `[Story]` = rastreabilidade até spec.md
- Cada US deve ser **independentemente completável** e **independentemente testável**
- **RED-first é não-negociável** (Princípio V + D12): cada `*-impl` PRECISA ter visto sua `*-test` falhar
- Commit por task ou por par RED/GREEN (não acumular muitas mudanças sem commit)
- Em qualquer checkpoint, parar e validar a US antes de seguir
- Evitar: tasks vagas, conflito no mesmo arquivo em paralelo, dependência cruzada entre US que quebre a independência
