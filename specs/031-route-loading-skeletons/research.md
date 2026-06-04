# Research: Skeletons de Carregamento nas Rotas Autenticadas

**Feature**: 031-route-loading-skeletons | **Date**: 2026-06-04

Nenhum NEEDS CLARIFICATION restante na spec (sessão de clarificação 2026-06-04 resolveu 8 decisões). Esta pesquisa consolida as decisões técnicas e suas fontes.

## R1. Mecanismo de loading: `loading.tsx` por rota

**Decision**: Adicionar `loading.tsx` em cada um dos 6 segmentos de rota (`books/`, `books/[id]/`, `narrators/`, `editors/`, `studios/`, `settings/`).

**Rationale** (confirmado via Context7, doc oficial Next.js 16):

- `loading.tsx` cria a Suspense boundary do segmento e é **pré-buscado junto aos `<Link>`s** em produção — a navegação é imediata e o fallback aparece sem round-trip.
- A doc lista explicitamente "Dynamic routes without loading.tsx" como causa de transições lentas — exatamente o sintoma atual (todas as 6 páginas usam `force-dynamic` ou fetch dinâmico).
- Em rotas dinâmicas, o prefetch é parcial "até o segmento mais próximo com `loading.js`" — ter o arquivo melhora também o prefetch.
- Segmentos aninhados precisam de arquivos próprios: `books/loading.tsx` cobre a listagem; `books/[id]/loading.tsx` cobre o detalhe (estruturas distintas, conforme Clarifications).

**Alternatives considered**:

- **`loading.tsx` único no route group `(authenticated)/`**: rejeitado — fallback genérico viola FR-002 (estrutura por tipo de página) e interceptaria também o dashboard (fora do escopo).
- **`<Suspense>` manual dentro de cada `page.tsx`**: rejeitado — exigiria refatorar o data fetching de cada página em componentes async separados; `loading.tsx` entrega o mesmo resultado pela convenção do framework, sem refactor (YAGNI).
- **Biblioteca de skeleton (boneyard)**: rejeitada na análise pré-spec — captura em build-time via plugin Vite (incompatível com Turbopack/Bun), wrapper client-oriented em app Server-Component-first, e criaria sistema paralelo ao primitivo shadcn existente.

## R2. Componente compartilhado: `components/layout/page-loading.tsx`

**Decision**: Criar `ListPageLoading` (moldura de listagem parametrizada por strings) + `LoadingStatus` (região `role="status"`) em `src/components/layout/page-loading.tsx`. Detalhe do livro e settings compõem inline nos seus `loading.tsx`.

**Rationale**:

- Usado por 4 features distintas (books, narrators, editors, studios) — pela convenção do projeto (constituição, Princípio VII), componente multi-feature vive em `components/layout/`, mesmo critério do `page-container.tsx`. `src/lib/hooks/`-style "promoção" só ocorre com ≥ 2 features; aqui são 4.
- Props **apenas de conteúdo** (`title`, `description`, `actionLabel`, `searchPlaceholder`, `searchLabel`) — a estrutura é fixa, alinhada a "composição sobre configuração" (/frontend-patterns) e ao FR-007.
- Detalhe e settings têm estruturas únicas sem perspectiva de reuso → inline no próprio `loading.tsx` (YAGNI; arquivos de convenção do App Router podem compor JSX diretamente, como `page.tsx` faz).

**Alternatives considered**:

- **Um componente skeleton por feature em `features/<feature>/`**: rejeitado — 4 cópias da mesma estrutura, viola DRY/FR-007.
- **Componente genérico configurável para os 3 tipos de página** (listagem + detalhe + settings): rejeitado — boolean/variant props para 3 layouts não relacionados é complexidade especulativa.

## R3. Moldura híbrida: conteúdo estático real + bloco único de skeleton

**Decision**: Renderizar real tudo que é conhecido estaticamente (título, descrição, botão de ação `disabled`, busca `disabled`) e um único `<Skeleton>` grande na região da tabela (~`h-96`, ajustado na implementação). Detalhe do livro: 3 barras (título `h-9 w-64`, meta `h-5 w-48`, stats `h-5 w-full max-w-md`) + bloco único para toolbar+tabela. Settings: título real + 2 blocos.

**Rationale**: Decisões 1–4 da sessão de clarificação. A moldura idêntica entre loading e página real zera o layout shift da moldura por construção (SC-003). As strings (título, descrição, labels) são **copiadas da moldura real** de cada `*-client.tsx` — drift aceito como risco documentado (Assumptions da spec).

**Alternatives considered**: tudo-em-barras (rejeitado — joga fora informação conhecida, aumenta percepção de espera); réplica fiel com colunas e linhas (rejeitada — acoplamento e custo de manutenção sem ganho proporcional).

## R4. Movimento reduzido: `motion-reduce:animate-none` no primitivo

**Decision**: Editar `src/components/ui/skeleton.tsx` adicionando a variant `motion-reduce:animate-none` ao lado de `animate-pulse`.

**Rationale**:

- Tailwind CSS 4 expõe a variant `motion-reduce:` nativamente (media query `prefers-reduced-motion: reduce`) — solução zero-JS.
- Editar o primitivo é o caminho esperado do shadcn/ui (o arquivo pertence ao projeto; customização via className é a via sancionada pela constituição).
- Corrige de uma vez todos os skeletons existentes (dashboard, dialogs) — FR-009.
- Bloco permanece visível (cinza estático) — o placeholder continua comunicando "conteúdo a caminho" sem animação.

**Alternatives considered**: wrapper novo por cima do `Skeleton` (rejeitado — duplicaria o primitivo); CSS global `@media` (rejeitado — Tailwind variant é o idioma do projeto).

## R5. Acessibilidade: `role="status"` + sr-only, blocos `aria-hidden`

**Decision**: `LoadingStatus` renderiza `<output>`-equivalente via `<div role="status">` com `<span className="sr-only">Carregando…</span>`; todos os blocos `<Skeleton>` decorativos recebem `aria-hidden="true"`.

**Rationale**:

- `role="status"` é live region educada (`aria-live="polite"` implícito) — anuncia uma vez sem interromper; padrão WAI-ARIA consolidado para "conteúdo carregando".
- Blocos pulsantes são `<div>`s vazios — sem `aria-hidden` viram ruído de navegação para leitores de tela.
- A moldura real (título, busca desabilitada) permanece na árvore de acessibilidade — comportamento correto: ela **é** conteúdo real.
- Verificável em unit test (querias `getByRole("status")`) e compatível com o helper axe existente (`__tests__/e2e/helpers/accessibility.ts`).

**Alternatives considered**: `aria-busy` no container (rejeitado — suporte inconsistente entre leitores de tela); sem anúncio (rejeitado na clarificação — Q6).

## R6. E2E determinístico: interceptação Playwright do fetch RSC

**Decision**: Um único teste E2E (`books-loading-skeleton.spec.ts`): login → interceptar requests da navegação para `/books` cujo header `RSC: 1` esteja presente, atrasando a resposta (~1.5s) → clicar no link da sidebar → asserts: (1) bloco de skeleton (`data-testid="page-loading-skeleton"`) e heading real "Livros" visíveis **durante** o atraso; (2) após liberar, tabela/empty-state visível e skeleton ausente.

**Rationale**:

- Na navegação client-side, o App Router busca o payload RSC via fetch com header `RSC: 1` — interceptável e atrasável por `page.route()`, tornando a janela de loading determinística (sem flakiness de timing).
- A suíte E2E roda `next start` (produção) por worker — prefetch ativo, fiel ao comportamento real.
- Decisão 7 da clarificação: o mecanismo é um só; provado em `/books`, as demais rotas diferem apenas no conteúdo (coberto por unit tests).

**Alternatives considered**: E2E nas 6 rotas (rejeitado — Q7, superfície de manutenção desproporcional); throttling de rede global do CDP (rejeitado — atrasa tudo, inclusive login e assets, teste lento e frágil).

## R7. Classificação e ordem dos testes (TDD)

**Decision**: Seguindo a constituição (Princípio V) e a skill /tdd:

1. **RED**: `page-loading.spec.tsx` (contrato do componente compartilhado: moldura real, controles desabilitados, `role="status"`, `aria-hidden`, bloco único) + `route-loading-states.spec.tsx` (cada `loading.tsx` exporta componente que renderiza o título/estrutura corretos) — falham porque os arquivos não existem. Commit `test:`.
2. **GREEN**: implementar `page-loading.tsx`, os 6 `loading.tsx` e a edição do `skeleton.tsx` — mínimo para passar. Commit `feat:`.
3. **REFACTOR**: dedupe/polish com testes verdes. Commit `refactor:` (se necessário).
4. E2E escrito após GREEN dos units (depende dos `data-testid` reais), validado contra o servidor de produção do harness E2E.

**Rationale**: render tests são unit (componentes puros, sem `vi.mock`, jsdom via pragma — convenção existente em `__tests__/unit/components/`); zero integração com DB. Cobertura: componente compartilhado e loading files são JSX puro — meta ≥ 80% trivialmente atingida; a regra de 100% para cálculo de ganho não se aplica (nenhum cálculo).

## R8. Strings da moldura por rota (inventário para implementação)

| Rota | Título | Fonte da moldura real |
|------|--------|----------------------|
| `/books` | "Livros" | `books-client.tsx` (descrição + "Novo Livro" + busca "Buscar por título ou estúdio") |
| `/narrators` | "Narradores" | `narrators-client.tsx` (copiar descrição/labels exatos na implementação) |
| `/editors` | "Editores" | `editors-client.tsx` (idem) |
| `/studios` | "Estúdios" | `studios-client.tsx` (idem) |
| `/books/[id]` | — (barras) | `book-header.tsx` (silhueta: título/meta/stats) |
| `/settings` | "Configurações" | `settings/page.tsx` (título real + card Aparência + seção widgets) |

**Nota**: os textos exatos de narrators/editors/studios serão copiados dos respectivos `*-client.tsx` durante a implementação (mesmo padrão verificado em books). Qualquer listagem que não tenha descrição ou botão simplesmente omite a prop correspondente.
