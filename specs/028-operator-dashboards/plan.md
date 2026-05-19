# Implementation Plan: Dashboards do Operador com Widgets Configuráveis

**Branch**: `028-operator-dashboards` | **Date**: 2026-05-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/028-operator-dashboards/spec.md`

## Summary

Construir a página `/dashboard` (home pós-login) com três seções verticais — **Financeira**, **Operacional**, **Retrospectiva** — alimentadas por agregações server-side de capítulos. Adicionar dois timestamps (`chapter.completed_at`, `chapter.paid_at`) com backfill via `updated_at` para suportar recortes temporais. Persistir preferências de visibilidade por usuário em `user_preference.dashboard_widgets` (jsonb). Reaproveitar `useFocusWeekFilter` (feature 025) como destino do botão "Ver lista" do card de atrasados, evitando rota nova.

Abordagem técnica: Server Components SSR-first lendo `searchParams` para período; `DashboardService` orquestra três queries agregadas (uma por seção) via repositórios novos sob `lib/repositories/`; rotas HTTP `/api/v1/dashboard/*` expõem o mesmo serviço para satisfazer Princípio XIII (API route dedicada) e habilitar consumidores externos futuros; client components apenas para interatividade (filtro de período via URL, tabs de ranking, tooltip de chart). Gráficos via shadcn Charts (Recharts).

## Skills Consultadas (v2 do plano)

Esta segunda passada do plano integra orientações de 6 skills do Princípio XV. Cada uma adicionou refinamento específico — abaixo está o resumo de **o que cada skill mudou** em relação à v1 do plano.

| Skill | Principal aplicação nesta feature |
|---|---|
| `/tdd` | Ordenação estrita RED → GREEN → REFACTOR nas tasks (Phase 2). Coverage gate 100% para `earnings-aggregations.ts` e `dashboard-period.ts`. Cada teste novo DEVE rodar e **falhar** antes da implementação correspondente. |
| `/api-design` | Adição de `X-Request-Id` (já existente via `withApiErrorHandler`) e `Cache-Control: no-store` nos contratos — dados dinâmicos. Headers de rate limit não foram introduzidos (já há rate limiting global no projeto; dashboard segue o mesmo). Field-level errors com `code` no envelope (`validation_error` para 422). |
| `/backend-patterns` | Reforço do Repository Pattern com interface (port) na raiz + adapter Drizzle em subpasta — já alinhado com Princípio VI. Centralized error handler via `withApiErrorHandler` (existente, sem mudança). N+1 prevention com batch fetch + LEFT JOIN nas queries de ranking. Logging estruturado segue a infra existente (não inventar nova). |
| `/frontend-design` | **Direção visual** explicitada: "editorial calm, data-dense" — fundo neutro, hierarquia por tipografia (não por bordas), KPIs em destaque com tipografia displayfontWeight, rankings em densidade moderada. SEM gradient bobo, SEM card pile genérico. Detalhe em [D11](research.md#d11). |
| `/frontend-patterns` | Compound components para `<Tabs>` de ranking (já em uso via shadcn). `useMemo` para listas derivadas no client. `React.lazy` + `Suspense` para o chart (lazy loading mandatório por Princípio VIII). Custom hooks específicos por escopo (`use-period-filter`, `use-ranking-tab`, `use-dashboard-widgets-form`). |
| `/vercel-composition-patterns` | **Avoid boolean props**: KPI cards usam composição (children + componentes filhos nomeados), NÃO `variant="primary"` ou `large`/`small`. RankingTabs implementado como compound (`<Tabs.List>`, `<Tabs.Trigger>`, `<Tabs.Content>`). React 19: usar `use()` em vez de `useContext()` onde aplicável; sem `forwardRef`. Detalhe em [D14](research.md#d14). |

## Technical Context

**Language/Version**: TypeScript 5.9.3, Bun 1.2 (runtime + test runner + package manager)
**Primary Dependencies**: Next.js 16.2.1 (App Router + Turbopack), React 19.2.4, Drizzle ORM 0.45.2, Zod 4.3.6, better-auth 1.5.6, React Hook Form 7.72.1, `@tanstack/react-table` 8.21.3, shadcn/ui 4.1.2, Tailwind CSS 4.2, `sonner` 2.0.7, `lucide-react`, `date-fns` 4.1, `date-fns-tz` 3.2
**New Dependencies**: `recharts` 2.x via `bunx --bun shadcn@latest add chart` (shadcn ships componente Chart com Recharts integrado; bundle aprox. 90kb gzipped sob `next.js` tree-shaking — abaixo do budget de 300kb app-page do projeto). Lazy-loaded via `React.lazy` + `Suspense` (frontend-patterns) — não entra no bundle de outras rotas.
**Storage**: PostgreSQL 15+ via Drizzle ORM (`audiobook_track` dev/prod; `audiobook_track_test` para testes)
**Testing**: Vitest (`bun run test:unit`, `bun run test:integration`), Playwright (`bun run test:e2e`); fakes manuais via construtor + `vi.fn()`; `vi.mock()` apenas para módulos da allowlist (`next/navigation`, `next/headers`, `@/lib/db`, `@/lib/env`)
**Target Platform**: Next.js Server Components (Node runtime), navegadores modernos (mobile + desktop)
**Performance Goals**:
- LCP da página `/dashboard` < 1s (Princípio VIII — render do skeleton inicial)
- Carga completa de todos os widgets < 2s em 5k capítulos / < 5s em 50k capítulos (SC-002 da spec)
- Mudança de filtro de período < 1s (SC-003)
**Constraints**:
- Sem `useEffect` para fetch (data fetching em Server Components)
- Mobile first com breakpoints `sm:`/`md:`/`lg:` (Princípio VII)
- Dark mode obrigatório via tokens semânticos
- Cálculo determinístico em centavos (Princípio II); zero arredondamento intermediário em float
- Toda agregação no banco via SQL (LEFT JOIN + GROUP BY) — proibido pull-all para o client
- Bundle Recharts é a única dependência client adicional aceitável (justificada por Princípio XIII "Gráficos servidos via API route com agregação no banco")
- **Sem boolean props para variantes** (vercel-composition): KPI cards e widgets usam composição, não `<KpiCard variant="big">`.
- **Compound components** para qualquer UI com sub-elementos relacionados (`<Tabs>`, `<RankingTable>`)
**Scale/Scope**:
- ~10 usuários autenticados (multi-admin homogêneo)
- ~5.000 capítulos no horizonte de 1 ano; 50.000 no de 5 anos
- 9 widgets configuráveis individualmente
- 1 página nova (`/dashboard`) + 3 endpoints API + 1 seção em `/settings` + 2 colunas DB

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Justificativa |
|---|-----------|--------|---------------|
| I | Capítulo como Unidade de Trabalho | ✅ Pass | Todas as agregações operam sobre `chapter.*`; livros e estúdios só entram como agrupamento de ranking. |
| II | Precisão Financeira | ✅ Pass | Reusa `computeEarningsCents` / `sumEarningsCents` existentes em `lib/domain/earnings.ts`. Agregação por GROUP BY mantém aritmética inteira em centavos no banco (PostgreSQL `bigint` para evitar overflow em soma de muitos cents). 100% cobertura unitária nos novos helpers de agregação. **Skill `/tdd`**: equivalência SQL ↔ JS testada via property-based test (1000 pares aleatórios). |
| III | Ciclo de Vida do Capítulo | ✅ Pass | Nenhuma transição nova nem regra removida. Adiciona apenas escrita automática de `completed_at` / `paid_at` em transições existentes (em `chapter-service.ts`) dentro da MESMA transação do recompute (Princípio XI). |
| IV | Simplicidade (YAGNI) | ⚠️ Justificado | Spec adiciona widgets (funil, atrasados, ranking de narrador, ticket médio, preferência por widget) além dos KPIs/gráficos enumerados na Constituição XIII. Cada widget responde a um caso de uso explicitado em rodada de `/grill-me` — ver [Complexity Tracking](#complexity-tracking) abaixo. |
| V | TDD | ✅ Pass | Plano de tarefas (Phase 2) começa por testes RED. Cobertura ≥ 80% geral; 100% em helpers de agregação financeira (extensão de `earnings.ts`). **Skill `/tdd`**: RED gate explícito antes de cada GREEN — task `T-XXX-test-*` PRECEDE task `T-XXX-impl-*`. |
| VI | Arquitetura Limpa Backend | ✅ Pass | Camadas: controller fino (`app/api/v1/dashboard/*/route.ts` via `withApiErrorHandler`) → factory (`lib/factories/dashboard.ts`) → service (`lib/services/dashboard-service.ts`) → repository (port em `lib/repositories/dashboard-repository.ts`, adapter `lib/repositories/drizzle/drizzle-dashboard-repository.ts`) → domain helpers puros (`lib/domain/earnings-aggregations.ts`, `lib/domain/dashboard-period.ts`, `lib/domain/dashboard-bucketing.ts`). **Skill `/backend-patterns`**: N+1 prevention via batch fetch nos rankings (single LEFT JOIN com GROUP BY); SELECT explícito, nunca `*`. |
| VII | Frontend Composição/Atomicidade/Mobile First | ✅ Pass | Componentes em `src/components/features/dashboard/`; hooks em `src/components/features/dashboard/hooks/`; uso obrigatório de `<PageContainer>`, `<Card>`, `<Button>`, `<Tabs>`, `<Chart>` (shadcn); mobile first com breakpoints; dark mode via tokens. **Skill `/vercel-composition-patterns`**: zero boolean props em variantes; compound components onde aplicável. **Skill `/frontend-patterns`**: `React.lazy` + `Suspense` para o chart, `useMemo` para listas derivadas. |
| VIII | Performance | ⚠️ Justificado | Spec SC-002 fala "≤ 2s para carga completa"; Princípio VIII pede LCP < 1s. Conciliação: a página renderiza o **shell + skeletons** em < 1s (LCP), e os widgets streamam via Suspense conforme cada agregação retorna. Métrica de spec mede tudo carregado; métrica de Princípio mede primeira pintura. Ambas atendíveis na arquitetura proposta. |
| IX | Design Tokens | ✅ Pass | Toda cor/spacing via tokens Tailwind + shadcn; cores semânticas (`bg-card`, `text-muted-foreground`, etc.) com fallback dark automático. **Skill `/frontend-design`**: direção visual "editorial calm, data-dense" — sem gradient hero, sem card pile genérico (D11). |
| X | API REST | ✅ Pass | URLs em plural kebab-case (`/api/v1/dashboard/financial`, `.../operational`, `.../retrospective`); Zod valida `from`/`to`; envelope `{ data }`; `withApiErrorHandler` centraliza erros; 401/422 padronizados. **Skill `/api-design`**: 422 para validação semântica (preset inválido, `from > to`); 400 para JSON malformado; `Cache-Control: no-store` em todas as rotas (dados dinâmicos); `X-Request-Id` para correlação (já em `withApiErrorHandler`). |
| XI | PostgreSQL e Banco de Dados | ✅ Pass | Drizzle `generate`+`migrate` (sem `push`); 2 colunas novas + 2 índices parciais + JSONB em user_preference; backfill em SQL inline; FK existentes mantidas; queries com SELECT explícito e LEFT JOIN; `SavepointUnitOfWork` reaproveitado nas transições onde já é usado. |
| XII | Anti-Padrões Proibidos | ✅ Pass | Sem `any`, sem `console.log`, sem fetch em useEffect (Server Components), sem HTML cru (`<Button>`/`<Card>`/`<Tabs>` shadcn), sem `_components/` em `app/`, sem `toast.success`, sem `useState` de domínio em client (vai para hooks). **Skill `/vercel-composition-patterns`**: boolean props para variantes proibidas (D14). |
| XIII | Métricas e KPIs de Produção | ⚠️ Justificado | Spec preserva o **espírito** do Princípio XIII (server-side aggregation, API route dedicada) mas escolhe um **subconjunto diferente** de KPIs/gráficos baseado em decisões de produto explícitas em `/grill-me`. Detalhe em [Complexity Tracking](#complexity-tracking). |
| XIV | Visualização de PDF | N/A | Feature não toca em PDF. |
| XV | Ferramentas e Skills | ✅ Pass | Workflow: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` (v2 com skills consultadas) → `/speckit-tasks` → `/tdd` → `/code-review` → `/conventional-commits` → `/finish-task`. Context7 MCP obrigatório para Recharts e shadcn Chart antes de implementar. Pencil MCP para consultar `design.pen`. |
| XVI | Qualidade de Código e Verificação | ✅ Pass | Fase final única antes do PR roda `bun run lint`, `test:unit`, `test:integration`, `test:e2e`, `build`. Durante as tasks, apenas testes do escopo da task. |

**Resultado**: 2 itens marcados como ⚠️ Justificado, ambos documentados em Complexity Tracking. Nenhum item ❌. Plano segue para Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/028-operator-dashboards/
├── plan.md              # This file (v2: skills consultadas)
├── spec.md              # /speckit-specify + /speckit-clarify output
├── research.md          # Phase 0 output (D1–D15 incluindo skills)
├── data-model.md        # Phase 1 output (this command)
├── quickstart.md        # Phase 1 output (this command)
├── contracts/           # Phase 1 output (this command)
│   ├── dashboard-financial.openapi.yaml
│   ├── dashboard-operational.openapi.yaml
│   ├── dashboard-retrospective.openapi.yaml
│   └── user-preference-widgets.schema.md
├── checklists/
│   └── requirements.md  # /speckit-specify output (already exists)
└── tasks.md             # /speckit-tasks output (NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (authenticated)/
│   │   ├── dashboard/
│   │   │   └── page.tsx                              # NEW · Server Component, lê searchParams, renderiza 3 seções
│   │   └── settings/
│   │       └── page.tsx                              # EDIT · adiciona <DashboardWidgetsSection />
│   └── api/v1/dashboard/
│       ├── financial/route.ts                        # NEW · GET handler com withApiErrorHandler + Cache-Control: no-store
│       ├── operational/route.ts                      # NEW
│       └── retrospective/route.ts                    # NEW
│
├── components/
│   ├── features/
│   │   ├── dashboard/
│   │   │   ├── dashboard-page-content.tsx           # NEW · compõe filtro + 3 seções (server)
│   │   │   ├── period-filter.tsx                    # NEW · client, URL state
│   │   │   ├── widgets-empty-state.tsx              # NEW · quando todas as flags = false
│   │   │   ├── financial-section.tsx                # NEW · server, compõe KPIs + ranking via children
│   │   │   ├── financial-kpi-card.tsx               # NEW · átomo SEM boolean variant (composição via children)
│   │   │   ├── financial-ranking-tabs.tsx           # NEW · client, compound component (Tabs.* compostos)
│   │   │   ├── operational-section.tsx              # NEW · server
│   │   │   ├── status-funnel.tsx                    # NEW · server, 6 cards de contagem
│   │   │   ├── overdue-card.tsx                     # NEW · client, gera link `/books/<id>?focus=week`
│   │   │   ├── retrospective-section.tsx            # NEW · server, passa dados pro chart
│   │   │   ├── revenue-chart.tsx                    # NEW · client, lazy-loaded, shadcn Chart + Recharts
│   │   │   ├── section-error.tsx                    # NEW · átomo para erro local (FR-045)
│   │   │   ├── section-skeleton.tsx                 # NEW · átomo para skeleton (FR-044)
│   │   │   └── hooks/
│   │   │       ├── use-period-filter.ts             # NEW · URL state, presets + range
│   │   │       └── use-ranking-tab.ts               # NEW · estado local da tab atual
│   │   └── settings/
│   │       ├── dashboard-widgets-section.tsx        # NEW · client + form RHF + checkboxes
│   │       └── hooks/
│   │           └── use-dashboard-widgets-form.ts    # NEW · submit logic
│   └── ui/
│       └── chart.tsx                                 # NEW (via shadcn add chart)
│
├── lib/
│   ├── api/
│   │   ├── error-codes.ts                            # EDIT · adicionar `dashboard:invalid-period`, `dashboard-widgets:invalid-key`
│   │   └── with-error-handler.ts                     # UNCHANGED · reusar (já gera X-Request-Id)
│   ├── db/
│   │   └── schema/
│   │       ├── chapter.ts                            # EDIT · +completed_at, +paid_at, +índices
│   │       └── user-preference.ts                    # EDIT · +dashboard_widgets jsonb
│   ├── domain/
│   │   ├── earnings.ts                               # UNCHANGED · reusar fórmula base
│   │   ├── earnings-aggregations.ts                  # NEW · helpers puros (100% cov)
│   │   ├── dashboard-period.ts                      # NEW · preset → DateRange (puro, 100% cov)
│   │   ├── dashboard-bucketing.ts                   # NEW · inferGranularity + bucketDates (puro)
│   │   ├── dashboard-widget.ts                      # NEW · enum/schema de DASHBOARD_WIDGETS + defaults + meta PT-BR
│   │   ├── chapter.ts                                # EDIT · extender PAID_LOCKED_FIELDS + Chapter type
│   │   └── timezone.ts                               # EDIT · expor helpers extras se necessário
│   ├── factories/
│   │   └── dashboard.ts                              # NEW · createDashboardService()
│   ├── repositories/
│   │   ├── dashboard-repository.ts                   # NEW · port (interface)
│   │   └── drizzle/
│   │       └── drizzle-dashboard-repository.ts       # NEW · adapter
│   └── services/
│       ├── dashboard-service.ts                      # NEW · 3 métodos (financial/operational/retrospective)
│       └── chapter-service.ts                        # EDIT · escrever completed_at/paid_at em transições
│
└── __tests__/
    ├── unit/
    │   ├── domain/
    │   │   ├── earnings-aggregations.spec.ts        # NEW (RED-first)
    │   │   ├── earnings-sql-equivalence.spec.ts     # NEW (property-based, 1000 pares)
    │   │   ├── dashboard-period.spec.ts             # NEW
    │   │   ├── dashboard-bucketing.spec.ts          # NEW
    │   │   └── dashboard-widget.spec.ts             # NEW · Zod schema
    │   ├── services/
    │   │   └── dashboard-service.spec.ts            # NEW · fake repository
    │   └── api/
    │       └── dashboard-routes.spec.ts             # NEW · validação Zod das rotas
    ├── integration/
    │   ├── repositories/
    │   │   └── dashboard-repository.spec.ts        # NEW · DB real
    │   ├── services/
    │   │   └── chapter-service-timestamps.spec.ts  # NEW · transições escrevem completed_at/paid_at
    │   └── migrations/
    │       └── backfill-completed-paid-at.spec.ts  # NEW · garante backfill correto
    └── e2e/
        ├── dashboard-loads.spec.ts                  # NEW
        ├── dashboard-period-filter.spec.ts          # NEW
        ├── dashboard-widget-config.spec.ts          # NEW
        └── dashboard-overdue-nav.spec.ts            # NEW · "Ver lista" → /books/<id>?focus=week
```

**Structure Decision**: Single Next.js application (monolito SSR). Diretórios concretos: `src/app/(authenticated)/dashboard/` (rota), `src/app/api/v1/dashboard/` (endpoints), `src/components/features/dashboard/` (componentes + hooks), `src/lib/{domain,services,repositories,factories}/dashboard*` (camadas backend), `__tests__/{unit,integration,e2e}/` (testes por categoria conforme Princípio V).

## Composition rules (do `/vercel-composition-patterns`)

Aplicação concreta nesta feature:

- **`<FinancialKpiCard>`** NÃO recebe `variant="primary"` ou `size="large"`. Em vez disso:
  ```tsx
  <FinancialKpiCard>
    <FinancialKpiCard.Label>A receber agora</FinancialKpiCard.Label>
    <FinancialKpiCard.Value>{formatBrl(cents)}</FinancialKpiCard.Value>
    <FinancialKpiCard.Hint>Capítulos prontos para pagamento</FinancialKpiCard.Hint>
  </FinancialKpiCard>
  ```
  Estilo de "destaque" sai da composição (qual `Label` + `Value` é montado), não de prop booleana.
- **`<RankingTabs>`** é compound component:
  ```tsx
  <RankingTabs defaultValue="estudio">
    <RankingTabs.List>
      <RankingTabs.Trigger value="estudio">Por estúdio</RankingTabs.Trigger>
      <RankingTabs.Trigger value="narrador">Por narrador</RankingTabs.Trigger>
      <RankingTabs.Trigger value="editor">Por editor</RankingTabs.Trigger>
    </RankingTabs.List>
    <RankingTabs.Content value="estudio"><RankingTable rows={estudios} /></RankingTabs.Content>
    <RankingTabs.Content value="narrador"><RankingTable rows={narradores} /></RankingTabs.Content>
    <RankingTabs.Content value="editor"><RankingTable rows={editores} /></RankingTabs.Content>
  </RankingTabs>
  ```
  Implementado em cima de `<Tabs>` do shadcn (que já é compound). Wrapper exposto como compound estendido.
- **`<SectionSkeleton>`** e **`<SectionError>`** são **componentes irmãos**, não props (`<DashboardSection state="loading" />` proibido). Server Component decide qual renderizar.
- **Contexto de React 19**: usar `use(Context)` em vez de `useContext(Context)` onde fizer sentido (e.g., `useRankingTab`). Sem `forwardRef` — passar `ref` como prop normal em React 19.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **9 widgets em vez dos 5 KPIs + 3 gráficos da Constituição XIII** | A spec passou por `/grill-me` onde o usuário descartou 3 KPIs originais (Cap. concluídos, Livros em andamento, Minutagem média) e adicionou 5 (Funil de status, Atrasados, Ranking narrador, Ticket médio, Preferência por widget). Cada adição responde a caso de uso identificado em entrevista; cada remoção foi explícita ("eu quero saber X, não Y"). | Aderir literalmente à Constituição XIII forçaria entregar widgets que o usuário **disse não querer**, violando o Princípio IV (YAGNI). O Princípio XIII descreve "versão inicial" de dashboard genérico; a spec é a evolução com decisões de produto reais. |
| **KPI "A receber agora" usa apenas `status = completed` (não `editing → completed`)** | Constituição XIII KPI 5 ("Previsão de receita a receber") usa range `editing → completed` (pipeline potencial). O usuário decidiu na spec que o KPI deve refletir **somente o que é faturável agora** — `completed` é "pronto pra cobrar", `editing`/`reviewing` é "pode mudar". | Incluir `editing`/`reviewing`/`retake` adiciona ruído ao número que orienta a ação ("o que cobro hoje"). Pipeline broader pode virar widget separado depois ("Previsão de pipeline") sem refatorar o KPI atual. |
| **2 timestamps novos (`completed_at`, `paid_at`) em vez de tabela `chapter_status_history`** | Spec exige recortes temporais por quando o capítulo virou `completed`/`paid`. Tabela de histórico completa permitiria queries mais ricas (ex: "tempo médio em `editing`"), mas a spec **não pede** isso. | YAGNI: 2 colunas resolvem 100% das US de retrospectiva atuais. Histórico vira escopo de feature futura quando tivermos demanda concreta. Migration de 2 colunas é trivial; tabela nova com triggers de transição seria 10× mais código. |
| **Persistência de preferências em coluna JSONB em vez de tabela normalizada** | 9 booleanos por usuário. Padrão JSONB com Zod schema validando chaves é compacto, fácil de evoluir (adicionar widget → adicionar chave no enum) e cabe na linha existente. | Tabela `user_dashboard_widget` (user_id, widget_key, visible) seria mais normalizada mas adiciona JOIN em toda leitura, complica migrations, e não escala dimensão útil — 9 chaves estáticas não precisam de normalização. Colunas booleanas individuais (uma por widget) é a alternativa menos extensível: cada widget novo vira migration. |
