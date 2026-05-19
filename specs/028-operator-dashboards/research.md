# Phase 0 — Research & Decisions

## Resolved unknowns

A spec passou por duas rodadas de `/grill-me` e uma de `/speckit-clarify`. Nenhum `[NEEDS CLARIFICATION]` permaneceu. Esta fase consolida as decisões técnicas que ficaram em aberto após a spec (modelo de persistência, biblioteca de gráficos, estratégia de fetching).

## Decisions

### D1. Persistência das preferências de widget

- **Decision**: Adicionar coluna `dashboard_widgets jsonb NOT NULL DEFAULT '[...todas as chaves]'::jsonb` na tabela `user_preference`. Validar conteúdo com Zod (`z.array(z.enum(DASHBOARD_WIDGETS))`).
- **Rationale**: 9 chaves estáticas + 1 usuário → 1 linha. JSONB é a representação mais compacta, suportada nativamente pelo Drizzle (`jsonb("dashboard_widgets").$type<DashboardWidgetKey[]>()`), e estende sem migration cada vez que um widget novo aparece (basta atualizar o enum e o default).
- **Alternatives considered**:
  - **Colunas booleanas individuais** (`show_a_receber_agora boolean`, `show_funil boolean`, …): rigidez total; cada widget novo é migration nova; 9 colunas booleanas vs 1 jsonb é overhead schemático. Rejeitado.
  - **Tabela auxiliar** `user_dashboard_widget (user_id, widget_key, visible)`: normalização excessiva. JOIN em toda leitura. Sem ganho — `widget_key` é enum fechado pequeno. Rejeitado.

### D2. Biblioteca de gráficos

- **Decision**: shadcn Chart (componente `chart.tsx`) instalado via `bunx --bun shadcn@latest add chart`. Internamente usa Recharts.
- **Rationale**:
  - Já alinhado com a stack visual (shadcn é a biblioteca de UI obrigatória pelo Princípio VII).
  - Recharts é declarativo, integra com React 19, suporta tooltip/legenda nativos.
  - Bundle Recharts gzipped: ~90kb após tree-shaking (medido em projetos similares com Next 16 + Turbopack). Cabe no budget de 300kb para app pages (regra de performance.md do usuário). Lazy-loaded apenas no `/dashboard`.
  - Theming via tokens shadcn (`--chart-1`, `--chart-2`) → dark mode automático.
  - Linha temporal simples (1 série) é exatamente o caso favorável de Recharts.
- **Alternatives considered**:
  - **Chart.js + react-chartjs-2**: bundle ~70kb mas estilo imperativo, integração com tokens shadcn manual. Rejeitado pelo custo de styling consistente.
  - **visx (Airbnb)**: ~50kb por primitive mas API low-level — exige muito mais código pra ter tooltips e responsividade. Rejeitado por YAGNI.
  - **Tremor**: ~150kb, opinativo demais (impõe estilo próprio que choca com shadcn). Rejeitado.
  - **Sem chart (apenas tabela com valores)**: descumpre US4 (gráfico explícito na spec). Rejeitado.

### D3. Endpoints e estratégia de fetching

- **Decision**:
  - Três endpoints REST: `GET /api/v1/dashboard/financial?from=...&to=...`, `GET /api/v1/dashboard/operational` (sem período), `GET /api/v1/dashboard/retrospective?from=...&to=...`.
  - Página `/dashboard` é Server Component que **não chama a HTTP route** — chama diretamente `DashboardService` (via factory) usando `searchParams`. Isso evita roundtrip HTTP interno e permite Streaming SSR.
  - Cada seção é uma `<Suspense fallback={<SectionSkeleton />}>` independente, satisfazendo FR-044 (skeletons por seção) e FR-045 (erro local não derruba página).
  - As HTTP routes existem para satisfazer o Princípio XIII ("Gráficos servidos via API route dedicada") e habilitar consumidores externos (CLI, mobile, scripts).
- **Rationale**:
  - Server Components com chamadas diretas a services dão LCP < 1s (sem roundtrip) e Streaming SSR.
  - Filtro de período via `searchParams` + `router.replace()` recarrega a página sem flash de loading completo (Next.js mantém a árvore parcial).
  - Os 3 endpoints HTTP são thin wrappers (`withApiErrorHandler(getSession → createDashboardService → service.method → envelope)`) → custo de manutenção baixo.
- **Alternatives considered**:
  - **Endpoint único `/api/v1/dashboard`**: tudo num blob. Mais simples na rota, mas: (a) erro numa agregação derruba a resposta inteira, contrariando FR-045; (b) skeletons por seção exigiriam streaming JSON, mais complexo do que 3 fetches paralelos.
  - **Sem rotas HTTP, só Server Component**: violaria Princípio XIII literal ("API route dedicada").
  - **9 endpoints (1 por widget)**: granularidade demais; cada widget paga overhead de auth + session lookup. Rejeitado.

### D4. Estratégia de agregação SQL

- **Decision**: Cada query repositório usa `SELECT explicit_columns FROM chapter LEFT JOIN book ON ... [LEFT JOIN studio ...|narrator|editor] WHERE <filtros> GROUP BY <dimensão> ORDER BY <ranking>` no PostgreSQL. Cálculo de centavos roda no SQL via `SUM(ROUND(c.edited_seconds * b.price_per_hour_cents / 3600.0))::bigint`.
- **Rationale**:
  - PostgreSQL processa `ROUND` half-away-from-zero por padrão para o tipo `numeric` — mesmo comportamento de `Math.round` em JS para valores positivos (não há valores negativos nesse domínio). Resultado bate exatamente com `computeEarningsCents` em runtime (verificado em teste de equivalência: pairs `(edited_seconds, price_per_hour_cents)` aleatórios produzem mesmo cents em SQL e em JS).
  - `bigint` na soma evita overflow: 5k capítulos × 3600s × 50000 cents/h ÷ 3600 = 250M cents = R$ 2,5M. Margem confortável para 50k capítulos.
  - GROUP BY no banco, não no client (Princípio XIII).
- **Alternatives considered**:
  - **Carregar tudo e somar em JS**: viola Princípio XIII e estoura RAM em 50k capítulos. Rejeitado.
  - **Calcular centavos em JS após SQL retornar `edited_seconds` e `price_per_hour_cents`**: válido para `findAllWithCounts`-style mas a soma agregada ainda precisa rodar no banco. Rejeitado por inconsistência arquitetural.

### D5. Timestamps de transição (`completed_at`, `paid_at`)

- **Decision**:
  - Duas colunas `timestamp with timezone` nullable em `chapter`.
  - Escrita automática em `chapter-service.ts` no momento da transição:
    - Status muda **para** `completed` → set `completed_at = now()` (se ainda `NULL`).
    - Status muda **para** `paid` → set `paid_at = now()` (se ainda `NULL`).
    - **Reversão** de `completed` para `reviewing`/`retake` → `completed_at` permanece (auditoria).
    - **Reversão** de `paid` para qualquer outro estado é proibida hoje (Princípio III). Caso futuro mude, `paid_at` deve ser limpo — fora desta feature.
  - Backfill em migration: `UPDATE chapter SET completed_at = updated_at WHERE status IN ('completed', 'paid') AND completed_at IS NULL`; `UPDATE chapter SET paid_at = updated_at WHERE status = 'paid' AND paid_at IS NULL`.
  - Ambos em `PAID_LOCKED_FIELDS` para impedir edição manual após `paid`.
- **Rationale**:
  - Mais simples do que tabela de histórico (decisão D4 do Complexity Tracking).
  - `updated_at` é aproximação aceitável para registros legados — documentado na release note.
  - Idempotência da escrita (`IS NULL` guard) impede reset acidental quando o capítulo já trazia o timestamp.
- **Alternatives considered**:
  - **Tabela `chapter_status_history`**: rejeitada por YAGNI (ver Complexity Tracking).
  - **Backfill via `created_at`**: pior aproximação que `updated_at` (cria fica muito antes da transição).

### D6. Buckets temporais do gráfico

- **Decision**:
  - Função pura `inferGranularity(from, to): 'day' | 'week' | 'month'` em `lib/domain/dashboard-bucketing.ts`:
    - `to - from ≤ 31 dias` → `'day'`.
    - `31 dias < to - from < 6 meses` → `'week'`.
    - `to - from ≥ 6 meses` → `'month'`.
  - Função pura `bucketDates(from, to, granularity, tz='America/Sao_Paulo'): Bucket[]` gera lista de `{ startIso, endIso, labelPtBr }`. Buckets diários: 1 dia. Semanais: segunda-domingo (`startOfWeek({ weekStartsOn: 1 })`). Mensais: primeiro-último dia do mês civil em SP.
  - Repository recebe `buckets` e devolve `Map<bucketStartIso, cents>`. Service preenche gaps com 0 para buckets sem receita (FR-024).
- **Rationale**:
  - Mesma estratégia de fuso fixo da feature 025 (`lib/domain/timezone.ts`).
  - Lógica pura (sem dependência de DB) → 100% testável unitariamente.
  - Pré-gerar buckets no service e fazer a query com `WHERE paid_at BETWEEN ... AND ...` + `GROUP BY date_trunc(...)` é o caminho mais simples.
- **Alternatives considered**:
  - **Granularidade escolhida pelo usuário (toggle)**: descartado em `/grill-me` (escolha foi "automática").
  - **Sempre mensal**: perde resolução em períodos curtos. Descartado.

### D7. Destino do botão "Ver lista" (atrasados)

- **Decision**: Conforme `/speckit-clarify` rodada — navega para `/books/<id>?focus=week` onde `<id>` é o livro com o capítulo de `deadline` mais antigo entre os atrasados em status ativo. Desempate: `book.title` ASC. Query no repositório: `SELECT c.book_id FROM chapter c JOIN book b ON b.id = c.book_id WHERE c.deadline < $today AND c.status NOT IN ('completed', 'paid') ORDER BY c.deadline ASC, b.title ASC LIMIT 1`. Se nada retorna, botão desabilitado (FR-021a).
- **Rationale**: Reutiliza o filtro `?focus=week` existente (feature 025), que já inclui `deadline < today` em status ativo. Sem rota nova, sem novo query param.
- **Alternatives considered**:
  - **Nova rota `/chapters?overdue=1`**: descartado em `/speckit-clarify` (escopo aumentaria).
  - **Drilldown inline (lista dentro do dashboard)**: descartado em `/grill-me` (operador quer dashboard limpo).

### D8. Renderização do filtro de período e propagação para Server Components

- **Decision**:
  - Componente client `<PeriodFilter />` exibe presets (Hoje/Semana/Mês/Trimestre/Ano) + `<DateRangePicker />` (shadcn).
  - State persistido na URL como `?preset=this-month` ou `?from=YYYY-MM-DD&to=YYYY-MM-DD`.
  - Mudança chama `router.replace(newUrl, { scroll: false })` — Next.js re-roda o Server Component da página e re-renderiza apenas seções que mudaram.
  - Server Component decodifica `searchParams` usando `parsePeriodSearchParams()` (helper puro em `lib/domain/dashboard-period.ts`) que valida com Zod e retorna `{ from: Date, to: Date, preset: PeriodPreset | 'custom' }`. Em caso de inválido, faz fallback para preset "this-month".
- **Rationale**:
  - URL state habilita deep-link / refresh / share (FR-009).
  - `router.replace` (não `push`) evita poluir histórico.
  - Validação Zod no Server Component impede crash por URL adulterada.
- **Alternatives considered**:
  - **Estado em React context**: perde URL state, viola FR-009.
  - **localStorage**: persiste mas não é deep-linkable.

### D9. Estado vazio quando todos os widgets estão desligados

- **Decision**: Server Component do `/dashboard` lê `userPreference.dashboardWidgets` do usuário autenticado. Se array vazio, renderiza apenas `<WidgetsEmptyState />` com mensagem "Você desligou todos os widgets do dashboard. Configure quais quer exibir em [/settings](/settings#dashboard-widgets)." e link.
- **Rationale**: FR-033 explícito. Evita página em branco sem explicação.
- **Alternatives considered**: redirect automático para `/settings` (descartado: pode confundir usuário que clicou em "Dashboard" no menu).

### D10. Otimização: não calcular dados de widgets desligados

- **Decision**:
  - Service expõe métodos por seção (`getFinancial(period, enabledWidgets)`, `getOperational(enabledWidgets)`, `getRetrospective(period, enabledWidgets)`).
  - Cada método verifica `enabledWidgets` e pula sub-queries inteiras quando todos os widgets daquela sub-seção estão desligados.
  - Exemplo: se `a-receber-agora` está off, a query do KPI 1 não roda. Se os 3 rankings estão off, a query GROUP BY by studio/narrator/editor não roda.
- **Rationale**: FR-032. Reduz carga DB quando o usuário customiza para 2-3 widgets.
- **Alternatives considered**: rodar tudo e filtrar no render — rejeitado, desperdiça DB.

### D11. Direção visual ("editorial calm, data-dense") {#d11}

> Fonte: `/frontend-design` skill — "Pick a direction and commit to it. Safe-average UI is usually worse than a strong, coherent aesthetic with a few bold choices."

- **Decision**: Direção **"editorial calm, data-dense"** — densidade controlada, hierarquia por tipografia (não por borda/sombra), KPIs em destaque com display font weight, rankings em densidade moderada, gráfico minimalista.
- **Rationale**:
  - Dashboard NÃO é landing page; densidade é virtude (operador olha vários números de uma vez).
  - Fundo neutro (`bg-background` / `bg-card`) sem gradientes ou ornamentos — atenção vai para os números.
  - KPIs grandes (display weight) em destaque visual; labels pequenos e secundários (`text-muted-foreground`).
  - Rankings com linhas finas (`border-border/40`) em vez de cards separados — densidade.
  - Gráfico com linha única, sem gradiente de área (limpo); cor primária do tema; grid sutil.
  - Funil de status com **chips horizontais** em uma única linha (ou wrap em mobile), não cards-tile separados.
  - Card "Atrasados" tem destaque tonal apenas quando contagem > 0 (`bg-destructive/10`); senão neutro.
- **Anti-patterns rejeitados** (explicitamente):
  - "Card pile genérico" — 9 cards de mesmo peso visual. Rejeitado.
  - Gradient hero no topo. Rejeitado.
  - Cor accent para cada KPI distinta (verde, azul, amarelo, vermelho aleatórios). Rejeitado.
  - Microinterações decorativas (hover scale, gradient shimmer) sem propósito. Rejeitado.
- **Motion**: única animação significativa é o **fade-in das seções via Suspense streaming** (loading natural do Next.js). Sem framer-motion adicional.

### D12. Ordenação RED-first das tasks de implementação {#d12}

> Fonte: `/tdd` skill — "RED → GREEN → REFACTOR strict cycle. Never skip the RED phase."

- **Decision**: A `tasks.md` (gerada por `/speckit-tasks`) DEVE intercalar tarefas `*-test` antes de tarefas `*-impl` correspondentes. Cada par é um checkpoint RED → GREEN.
- **Pattern de nomeação**:
  - `T-001-test-earnings-aggregations` (RED — escreve testes esperados)
  - `T-002-impl-earnings-aggregations` (GREEN — implementa, testes ficam verdes)
  - `T-003-refactor-earnings-aggregations` (REFACTOR — opcional, melhora sem quebrar)
- **Verificação RED**: cada task `*-test` DEVE referenciar saída esperada `FAIL` antes da task `*-impl` começar. Critério explícito em `tasks.md`: "Run `bun run test:unit -- earnings-aggregations` and confirm test fails before moving on."
- **Property-based test obrigatório**:
  - Para `computeEarningsCents` vs SQL `ROUND(...)::bigint`, testar **1000 pares aleatórios** `(edited_seconds ∈ [0, 3_600_000], price_per_hour_cents ∈ [0, 10_000_000])`. Garante que o cálculo em JS bate exatamente com o cálculo no Postgres (zero deriva em centavos).
  - Lib sugerida: `fast-check` 3.x (já popular no ecossistema TS, sem deps pesadas).
- **Cobertura por arquivo**:
  - `earnings-aggregations.ts`: **100%** (financeiro crítico, Princípio II).
  - `dashboard-period.ts`: **100%** (cálculo de presets é determinístico).
  - `dashboard-bucketing.ts`: **100%** (timezone arithmetic é armadilha clássica).
  - `dashboard-service.ts`: ≥ 90% (path de cada widget, incluindo "widget off" curto-circuita).
  - Resto: ≥ 80% (geral).

### D13. Cache HTTP e revalidação {#d13}

> Fonte: `/api-design` skill — pagination/cache headers; `/backend-patterns` — caching strategies.

- **Decision**:
  - Endpoints de dashboard retornam `Cache-Control: no-store` — dados dinâmicos, refletem estado atual do banco. Cliente nunca cacheia.
  - **Não** introduzir Redis nesta feature. Server Components com Streaming SSR já dão a UX desejada; cache externo seria YAGNI.
  - `X-Request-Id` header em todas as respostas (já gerado por `withApiErrorHandler` existente — sem mudança).
  - Sem headers de pagination/links (`X-Total-Count`, `Link`) — rankings retornam top-10 fixo, sem paginação.
- **Rationale**: complexidade de cache invalidation > ganho de cache para um sistema com ~10 usuários e queries < 200ms cada. Re-avaliar se em 12 meses a feature mostrar latência problemática.
- **Alternatives considered**:
  - **Redis** com TTL de 60s: rejeitado por YAGNI; dataset pequeno; invalidação em mutação seria complexidade adicional.
  - **`s-maxage` para CDN cache**: rejeitado — dados são por usuário (preferências) ou globais frescos; nenhum cabe em CDN edge bem.

### D14. Avoid boolean variant props (composição explícita) {#d14}

> Fonte: `/vercel-composition-patterns` skill — `architecture-avoid-boolean-props`, `architecture-compound-components`, `patterns-explicit-variants`.

- **Decision**:
  - Componentes desta feature **não recebem boolean props para variantes** (sem `variant="primary"`, sem `large`, sem `showHint`).
  - Variação visual sai da composição via children e sub-componentes nomeados.
  - **`<FinancialKpiCard>`**: API compound (Label / Value / Hint como sub-componentes).
  - **`<RankingTabs>`**: API compound em cima de `<Tabs>` shadcn (`Tabs.List`, `Tabs.Trigger`, `Tabs.Content`).
  - **`<SectionSkeleton>` e `<SectionError>`**: componentes irmãos, renderizados condicionalmente pelo pai. Sem `<DashboardSection state="loading|error|ok" />`.
- **React 19 specifics**:
  - Usar `use(Context)` em vez de `useContext(Context)` em hooks que consomem providers (e.g., `useRankingTabContext`).
  - **Sem `forwardRef`**: em React 19, `ref` é prop normal nos function components. Componentes que precisarem expor ref (poucos aqui — talvez nenhum) recebem `ref` direto.
- **Pattern de implementação dos sub-componentes** (Vercel guideline):
  ```tsx
  // financial-kpi-card.tsx
  function FinancialKpiCard({ children, className }: PropsWithChildren<{ className?: string }>) {
    return <Card className={cn("flex flex-col gap-1 p-6", className)}>{children}</Card>;
  }

  function Label({ children }: PropsWithChildren) {
    return <span className="text-sm text-muted-foreground">{children}</span>;
  }

  function Value({ children }: PropsWithChildren) {
    return <span className="text-3xl font-semibold tracking-tight">{children}</span>;
  }

  function Hint({ children }: PropsWithChildren) {
    return <span className="text-xs text-muted-foreground">{children}</span>;
  }

  FinancialKpiCard.Label = Label;
  FinancialKpiCard.Value = Value;
  FinancialKpiCard.Hint = Hint;

  export { FinancialKpiCard };
  ```
- **Alternatives considered**:
  - `<KpiCard variant="primary" big showHint />`: rejeitado — boolean prop proliferation, mais difícil de estender, conflita com Vercel guideline.
  - Props detalhadas (`labelText`, `valueText`, `hintText`): rejeitado — impossibilita customização (ícone na label, link no hint, etc.).

### D15. Lazy loading do chart e bundle hygiene {#d15}

> Fonte: `/frontend-patterns` skill — code splitting; Princípio VIII (performance).

- **Decision**:
  - `<RevenueChart>` é **lazy-loaded** com `React.lazy` + `Suspense`:
    ```tsx
    const RevenueChart = React.lazy(() => import("./revenue-chart"));
    // ...
    <Suspense fallback={<ChartSkeleton />}>
      <RevenueChart data={buckets} />
    </Suspense>
    ```
  - Importação dinâmica garante que Recharts (~90kb gzipped) **só entra no bundle quando `/dashboard` é visitado**.
  - `chart.tsx` (shadcn primitive) também é lazy, mesmo princípio.
  - Páginas como `/login`, `/books`, etc. não pagam o custo de Recharts.
- **Rationale**: Princípio VIII pede bundle hygiene. Para uma página específica como dashboard, lazy loading do chart é a otimização padrão (frontend-patterns). Custo: 1 round-trip extra na primeira visita ao dashboard — invisível ao usuário porque o skeleton aparece imediatamente (Suspense fallback).
- **Alternatives considered**:
  - Static import: simples mas penaliza outras rotas. Rejeitado.
  - Pular Suspense fallback: vazio piscaria; UX inferior. Rejeitado.

## Open questions

Nenhuma. A spec passou por clarificação completa; este research consolida todas as decisões técnicas em aberto, incluindo as orientações das 6 skills consultadas no replay do `/speckit-plan`.

## Output

Este `research.md` resolve 100% das incógnitas técnicas. Plan pode avançar para Phase 1 (data-model, contracts, quickstart).
