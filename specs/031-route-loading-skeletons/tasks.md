# Tasks: Skeletons de Carregamento nas Rotas Autenticadas

**Input**: Design documents from `/specs/031-route-loading-skeletons/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/loading-states.md, quickstart.md

**Tests**: TDD é **obrigatório** pela constituição (Princípio V) — todo teste é escrito antes da implementação, com validação de RED antes de qualquer código de produção (skill /tdd). Commits ficam a cargo do usuário — nenhum commit automático por checkpoint.

**Organization**: Tasks agrupadas por user story, conforme prioridades da spec (P1: listagens, P2: detalhe do livro, P3: configurações).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências pendentes)
- **[Story]**: User story da task (US1, US2, US3)
- Caminhos exatos de arquivo em cada descrição

## Path Conventions

Projeto Next.js App Router único: código em `src/`, testes em `__tests__/` na raiz (convenções da constituição: unit em `__tests__/unit/`, E2E em `__tests__/e2e/`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialização — **nenhuma task necessária**: zero dependências novas (FR-006), nenhum scaffolding, nenhuma migration. A branch `031-route-loading-skeletons` já existe com spec e plan commitados.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Primitivo `Skeleton` com suporte a movimento reduzido (FR-009) e `LoadingStatus` (FR-008) — usados por **todas** as user stories.

**⚠️ CRITICAL**: Nenhuma user story pode começar antes desta fase completa.

- [X] T001 [P] Escrever teste unit (RED) do primitivo: `Skeleton` renderiza com classes `animate-pulse` E `motion-reduce:animate-none`, em `__tests__/unit/components/skeleton.spec.tsx` (pragma `// @vitest-environment jsdom`, AAA, títulos em inglês)
- [X] T002 [P] Escrever testes unit (RED) de `LoadingStatus`: renderiza `role="status"` com `data-testid="page-loading-status"` e texto sr-only "Carregando…", única ocorrência, em `__tests__/unit/components/layout/page-loading.spec.tsx`
- [X] T003 Validar RED: rodar `bun run test:unit` — os novos testes DEVEM falhar pelos motivos esperados (componente/classe inexistentes)
- [X] T004 [P] Adicionar `motion-reduce:animate-none` à className do primitivo em `src/components/ui/skeleton.tsx` (1 linha, demais classes intactas)
- [X] T005 [P] Criar `LoadingStatus` (Server Component sem props: `<div role="status" data-testid="page-loading-status">` + `<span className="sr-only">Carregando…</span>`) em `src/components/layout/page-loading.tsx`
- [X] T006 Validar GREEN: rodar `bun run test:unit` — T001/T002 passam, suíte inteira verde

**Checkpoint**: Fundação pronta — user stories podem começar (US1, US2 e US3 são independentes entre si a partir daqui).

---

## Phase 3: User Story 1 - Feedback imediato ao navegar para listagens (Priority: P1) 🎯 MVP

**Goal**: As 4 listagens (`/books`, `/narrators`, `/editors`, `/studios`) exibem moldura real (título, descrição, botão e busca desabilitados) + bloco único de skeleton na região da tabela, no lugar da tela em branco.

**Independent Test**: Navegar para cada listagem com rede lenta simulada (DevTools Slow 4G) e verificar moldura real + bloco pulsante antes do conteúdo; swap sem salto de layout. Automatizado: unit tests das molduras + E2E determinístico em `/books`.

### Tests for User Story 1 (RED antes da implementação) ⚠️

- [X] T007 [US1] Escrever testes unit (RED) do contrato de `ListPageLoading` (props `title`/`description`/`actionLabel`/`searchPlaceholder`/`searchLabel`; título real via `getByRole("heading")`; botão e busca `disabled`; bloco único `data-testid="page-loading-skeleton"` com `aria-hidden="true"`; 1 `LoadingStatus`; props opcionais omitidas → elementos ausentes), estendendo `__tests__/unit/components/layout/page-loading.spec.tsx`
- [X] T008 [P] [US1] Escrever testes unit (RED) dos 4 `loading.tsx` de listagem (cada default export renderiza o título correto — "Livros", "Narradores", "Editores", "Estúdios" — com `role="status"` presente e bloco de skeleton), criando `__tests__/unit/app/route-loading-states.spec.tsx`
- [X] T009 [US1] Validar RED: `bun run test:unit` — novos testes falham por componente/arquivos inexistentes

### Implementation for User Story 1

- [X] T010 [US1] Implementar `ListPageLoading` em `src/components/layout/page-loading.tsx`: composição `PageHeader`/`PageTitle`/`PageDescription` + `Button disabled` (ícone `Plus`) + `Input disabled` (ícone `Search`) + `Skeleton` único + `LoadingStatus`, espelhando a moldura de `src/components/features/books/books-client.tsx` (classes/spacing idênticos para CLS zero na moldura)
- [X] T011 [P] [US1] Criar `src/app/(authenticated)/books/loading.tsx`: `<PageContainer><ListPageLoading …/></PageContainer>` com strings exatas de `books-client.tsx` ("Livros", "Acompanhe capítulos, ganhos e status por livro.", "Novo Livro", "Buscar por título ou estúdio", "Buscar livros")
- [X] T012 [P] [US1] Criar `src/app/(authenticated)/narrators/loading.tsx` com strings exatas copiadas de `src/components/features/narrators/narrators-client.tsx` (omitir props sem equivalente real)
- [X] T013 [P] [US1] Criar `src/app/(authenticated)/editors/loading.tsx` com strings exatas copiadas de `src/components/features/editors/editors-client.tsx`
- [X] T014 [P] [US1] Criar `src/app/(authenticated)/studios/loading.tsx` com strings exatas copiadas de `src/components/features/studios/studios-client.tsx`
- [X] T015 [US1] Validar GREEN: `bun run test:unit` — T007/T008 passam, suíte verde
- [X] T016 [US1] Escrever e validar E2E determinístico em `__tests__/e2e/books-loading-skeleton.spec.ts` — **mecanismo revisado na implementação (ver research R6)**: a interceptação de rede planejada foi invalidada pelo prefetch dinâmico do Next 16 (segment cache entrega o conteúdo completo antes do clique). Implementado: helper TDD `applyE2eDataDelay()` em `src/lib/e2e/data-delay.ts` (no-op sem `E2E_TEST_MODE=1` + cookie `e2e-data-delay-ms`; clamp 5s; unit em `__tests__/unit/lib/e2e/data-delay.spec.ts`) chamado em `books/page.tsx` antes do fetch de dados; no spec: abortar prefetches RSC de `/books` via `page.route()`, setar cookie 1500ms, `page.goto("/dashboard")`, clicar `getByRole("link", { name: "Livros" })`; asserts: durante o atraso heading "Livros" E `page-loading-skeleton` visíveis; após, skeleton ausente E empty-state visível; validado 2× verde contra build fresca via `bun run test:e2e -- books-loading-skeleton`

**Checkpoint**: US1 completa e independentemente testável — MVP entregável.

---

## Phase 4: User Story 2 - Feedback imediato no detalhe do livro (Priority: P2) — ⚠️ REVERTIDA

> **Status (2026-06-05)**: T017/T018 foram implementadas (TDD completo, commit `d4154de`) e **revertidas na Phase 6**: o bug aberto [vercel/next.js#86151](https://github.com/vercel/next.js/issues/86151) (`router.refresh()` trava com `loading.tsx` no segmento) reproduziu consistentemente no E2E `chapter-reorder-then-add` (0/4 com o arquivo; 4/4 sem) — no detalhe, `handleChapterCreated` depende 100% do refresh para o capítulo novo aparecer. Plano de retomada em [futuras-features.md](../../futuras-features.md).

**Goal**: `/books/[id]` exibe silhueta estruturada (3 barras: título, meta, stats) + bloco único na região toolbar+tabela de capítulos.

**Independent Test**: Navegar da listagem para um livro com rede lenta; silhueta aparece antes do conteúdo; swap sem salto. Automatizado: unit test do `loading.tsx` do detalhe.

### Tests for User Story 2 (RED antes da implementação) ⚠️

- [X] T017 [US2] Escrever testes unit (RED) do loading do detalhe (default export renderiza: nenhum heading textual, 4 skeletons `aria-hidden` — 3 barras + 1 bloco —, 1 `role="status"`), estendendo `__tests__/unit/app/route-loading-states.spec.tsx`; validar RED via `bun run test:unit`

### Implementation for User Story 2

- [X] T018 [US2] Criar `src/app/(authenticated)/books/[id]/loading.tsx`: `<PageContainer>` + barras `Skeleton` (~`h-9 w-64` título, `h-5 w-48` meta, `h-5 max-w-md` stats — aproximando a silhueta de `src/components/features/books/book-header.tsx`) + bloco único `data-testid="page-loading-skeleton"` + `LoadingStatus`; validar GREEN via `bun run test:unit`

**Checkpoint**: US1 e US2 funcionais e independentes.

---

## Phase 5: User Story 3 - Feedback imediato nas configurações (Priority: P3)

**Goal**: `/settings` exibe título real "Configurações" + 2 blocos de skeleton (seção aparência e seção widgets).

**Independent Test**: Navegar para `/settings` com rede lenta; título real + 2 blocos antes do formulário; swap sem salto. Automatizado: unit test do `loading.tsx` de settings.

### Tests for User Story 3 (RED antes da implementação) ⚠️

- [X] T019 [US3] Escrever testes unit (RED) do loading de settings (default export renderiza: heading real "Configurações", 2 blocos `aria-hidden`, 1 `role="status"`), estendendo `__tests__/unit/app/route-loading-states.spec.tsx`; validar RED via `bun run test:unit`

### Implementation for User Story 3

- [X] T020 [US3] Criar `src/app/(authenticated)/settings/loading.tsx`: `<PageContainer><PageHeader><PageTitle>Configurações</PageTitle></PageHeader>` + 2 blocos `Skeleton` (alturas aproximadas do card Aparência e da seção widgets de `src/app/(authenticated)/settings/page.tsx`, segundo bloco com `mt-6`) + `LoadingStatus`; validar GREEN via `bun run test:unit`

**Checkpoint**: Todas as user stories funcionais — zero rotas autenticadas sem feedback (SC-001).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Refinamento, verificação manual e gate final de qualidade (Princípio XVI).

- [X] T021 Refactor com testes verdes (IMPROVE): dedupe entre os `loading.tsx`, nomes, alturas consistentes dos blocos; manter `bun run test:unit` verde — extraído `LoadingBlock` compartilhado (testid + aria-hidden + altura padrão) consumido por `ListPageLoading`, detalhe e settings
- [X] T022 Verificação manual conforme `specs/031-route-loading-skeletons/quickstart.md` — **passo de Slow 4G obsoletado** pelo prefetch dinâmico do Next 16 (ver research R6); quickstart atualizado para preview via Next.js DevTools, realizado pelo usuário nas rotas (moldura estável — SC-003); `prefers-reduced-motion` garantido por construção (`motion-reduce:animate-none` + unit test), emulação manual segue documentada como opcional
- [X] T023 Gate final de qualidade (fase única antes do PR): `bun run lint` (zero erros/warnings), `bun run test:unit` (1276), `bun run test:integration` (320), `bun run test:e2e` (229/229), `bun run build` — todos verdes. Descobertas da fase: (1) US2 revertida — bug [vercel/next.js#86151](https://github.com/vercel/next.js/issues/86151) trava `router.refresh()` com `loading.tsx` no segmento (ver research R9 e futuras-features.md); (2) o boundary de `books/loading.tsx` envolvia o segmento filho `[id]` mantendo streaming no detalhe (404 com HTTP 200, race de DOM escondido) — resolvido movendo listagem para route group `books/(list)/` (URL inalterada), restaurando o comportamento pré-031 do detalhe sem adaptar nenhum teste

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: vazia — nada a fazer
- **Foundational (Phase 2)**: bloqueia TODAS as user stories (T001→T003→T004/T005→T006)
- **User Stories (Phase 3–5)**: todas dependem apenas da Phase 2; **US1, US2 e US3 são mutuamente independentes** (US2/US3 usam só `LoadingStatus` + `Skeleton`, não `ListPageLoading`)
- **Polish (Phase 6)**: depende de todas as stories desejadas

### User Story Dependencies

- **US1 (P1)**: após Phase 2 — sem dependência de outras stories
- **US2 (P2)**: após Phase 2 — independente de US1
- **US3 (P3)**: após Phase 2 — independente de US1/US2
- ⚠️ Restrição de arquivo: T008/T017/T019 editam o mesmo `route-loading-states.spec.tsx` — se stories rodarem em paralelo por pessoas diferentes, coordenar appends nesse arquivo (cada story adiciona seu próprio `describe`)

### Within Each User Story

- Testes escritos e **validados em RED** antes de qualquer implementação (gate da skill /tdd)
- Componente compartilhado antes dos arquivos de rota que o consomem (T010 antes de T011–T014)

### Parallel Opportunities

- T001 ∥ T002 (arquivos de teste distintos)
- T004 ∥ T005 (primitivo vs componente novo)
- T007 ∥ T008 (arquivos de teste distintos)
- T011 ∥ T012 ∥ T013 ∥ T014 (4 arquivos de rota distintos, todos após T010)
- Após Phase 2: US1 ∥ US2 ∥ US3 (com a ressalva do arquivo compartilhado acima)

---

## Parallel Example: User Story 1

```bash
# Após T010 (ListPageLoading implementado), criar as 4 rotas em paralelo:
Task: "Criar src/app/(authenticated)/books/loading.tsx"
Task: "Criar src/app/(authenticated)/narrators/loading.tsx"
Task: "Criar src/app/(authenticated)/editors/loading.tsx"
Task: "Criar src/app/(authenticated)/studios/loading.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 2: Foundational (T001–T006)
2. Phase 3: US1 (T007–T016)
3. **STOP e VALIDAR**: listagens com loading + E2E verde — MVP demonstrável
4. US2 e US3 em seguida (incrementos pequenos e independentes)

### Incremental Delivery

1. Foundational → primitivo acessível pronto (já melhora o dashboard)
2. - US1 → 4 rotas com feedback (maior volume de navegação) → validar → MVP
3. - US2 → detalhe do livro → validar
4. - US3 → configurações → validar → SC-001 completo (zero telas em branco)

### Parallel Team Strategy

Trabalho solo é o esperado; se paralelizar, uma pessoa por story após Phase 2, coordenando os appends em `route-loading-states.spec.tsx`.

---

## Notes

- [P] = arquivos diferentes, sem dependência pendente
- Verificar RED antes de implementar — teste que nunca falhou não conta (skill /tdd)
- Commits são responsabilidade do usuário (sem auto-commit); quando solicitados, seguem o formato convencional e nunca usam `--no-verify`
- Strings da moldura copiadas dos `*-client.tsx` reais — qualquer divergência de coluna/label é revisável no mesmo PR (risco de drift aceito na spec)
- Cobertura: componentes novos são JSX puro — ≥ 80% trivialmente atingido; regra de 100% (cálculo de ganho) não se aplica
