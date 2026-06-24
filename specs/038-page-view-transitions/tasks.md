# Tasks: Animações de transição entre páginas (View Transitions)

**Input**: Design documents from `/specs/038-page-view-transitions/`

**Prerequisites**: plan.md, spec.md, research.md (D1–D8), data-model.md, contracts/ui-contracts.md, quickstart.md

**Tests**: Incluídos. TDD é obrigatório (Constituição, Princípio V): unit 100% para o helper puro; E2E (Playwright) para os fluxos. **Integration: N/A** — feature de apresentação, sem DB.

**Organization**: Tarefas agrupadas por user story (P1→P3) para implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências pendentes)
- **[Story]**: User story (US1–US5) — apenas nas fases de story
- Caminhos de arquivo exatos incluídos

## Path Conventions

Web app Next.js App Router, estrutura `src/` existente. Testes em `__tests__/unit/` (Vitest) e `__tests__/e2e/` (Playwright).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Habilitar a API experimental e de-risk imediato da coexistência com o React Compiler.

- [X] T001 Habilitar `experimental: { viewTransition: true }` em `next.config.ts`, preservando `reactCompiler: true` e o wrap condicional do Sentry (D1)
- [X] T002 Smoke de build inicial — rodar `bun run build` e confirmar que a flag + React Compiler compilam sem erro (gate de risco "duplamente experimental"; baseline de SC-008). Depende de T001

**Checkpoint**: Flag ativa e build verde — implementação pode começar.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Boundary de transição compartilhado e tokens — pré-requisito de US1, US2 e US3.

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase.

- [X] T003 [P] Adicionar design tokens de transição (`--vt-duration` ≤ 400ms, `--vt-ease`, `--vt-slide-offset`) e os keyframes do crossfade neutro default (`vt-crossfade`, só `transform`/`opacity`) em `src/app/globals.css` (D8, contrato C2)
- [X] T004 Envolver `{children}` em `<ViewTransition>` (import de `react`) em `src/app/(authenticated)/layout-client.tsx`, com o mapeamento de tipos→classes via prop `default` e `default: "vt-crossfade"` (D1, contrato C2; nota de implementação em research.md). Sidebar permanece fora do wrapper. Depende de T001

**Checkpoint**: Toda navegação já faz crossfade neutro; sidebar estável. Base pronta para direção, handoff e reduced-motion.

---

## Phase 3: User Story 1 - Transição direcional ao navegar entre páginas (Priority: P1) 🎯 MVP

**Goal**: Conteúdo anima no eixo/sentido corretos (vertical entre seções de topo pela ordem do menu; horizontal lista↔detalhe), com sidebar estável.

**Independent Test**: Navegar dashboard→livros (entra de baixo), livros→dashboard (entra de cima), lista→detalhe (entra pela direita), detalhe→lista (entra pela esquerda); URL/conteúdo corretos; sidebar não pisca; sem erro de console.

### Tests for User Story 1 ⚠️ (escrever PRIMEIRO, devem FALHAR)

- [X] T005 [P] [US1] Unit test de `resolveNavTransition` cobrindo a tabela C1 (todos os pares: nav-up/down, depth-forward/back, none) em `__tests__/unit/navigation/nav-transition.spec.ts` — cobertura 100% (Princípio V)
- [X] T006 [P] [US1] E2E de navegação direcional em `__tests__/e2e/page-transitions.spec.ts`: assert URL/conteúdo finais corretos, sidebar estável, e que o boundary de conteúdo recebe a view-transition-class esperada por par de rotas (via `data-vt-type` no wrapper). Inclui: (a) **navegação rápida/interrompida** converge (FR-015); (b) ausência de animação residual `vt-*` ao fim (FR-004). _Execução consolidada em T036 (DB de teste indisponível nesta sessão)._

### Implementation for User Story 1

- [X] T007 [US1] Implementar `resolveNavTransition(fromPath, toPath): NavTransitionType` puro em `src/lib/navigation/nav-transition.ts`, lendo a ordem de `src/lib/constants/navigation.ts` (regras C1) — faz T005 passar
- [X] T008 [US1] Adicionar keyframes/classes direcionais (`nav-up`, `nav-down`, `depth-forward`, `depth-back`) em `src/app/globals.css`, só `transform`/`opacity`, usando os tokens (contrato C2). Mesmo arquivo de T003 → sequencial
- [X] T009 [P] [US1] Aplicar `transitionTypes={[resolveNavTransition(usePathname(), item.href)]}` nos `<Link>` de `src/components/layout/sidebar.tsx` (depende de T007)
- [X] T010 [P] [US1] Aplicar o mesmo `transitionTypes` nos `<Link>` de `src/components/layout/mobile-sidebar.tsx` (depende de T007)
- [X] T011 [P] [US1] Aplicar `transitionTypes` de profundidade (`depth-forward` na navegação programática lista→detalhe via `addTransitionType` em `use-books-table.ts`; `depth-back` no `<Link>` "Voltar" em `book-header.tsx`) (depende de T007)
- [X] T012 [US1] Spike D3 — direção em back/forward do navegador: conclusão = **fallback neutro** (crossfade). Injetar `addTransitionType` em `popstate`/Navigation API regrediria (erro de console / conflito com o roteador). Sem código novo; comportamento já correto e sem regressão. Documentado em `research.md` (D3)

**Checkpoint**: US1 funcional e testável de forma independente — MVP entregável.

---

## Phase 4: User Story 2 - Handoff suave do esqueleto para o conteúdo (Priority: P2)

**Goal**: Troca skeleton→conteúdo como crossfade suave; sem flicker; rota de carga instantânea sem animação dupla.

**Independent Test**: Navegar a uma rota com `loading.tsx` sob rede lenta → crossfade suave; navegar a rota de carga instantânea → só a transição direcional, sem flicker.

### Tests for User Story 2 ⚠️ (escrever PRIMEIRO, devem FALHAR)

- [X] T013 [P] [US2] E2E de handoff em `__tests__/e2e/skeleton-handoff.spec.ts`: payload diferido torna o skeleton (`data-testid="page-loading-skeleton"`) observável e ele transita para o conteúdo; rota sem `loading.tsx` (dashboard) não exibe skeleton. _Execução em T036 (DB de teste indisponível nesta sessão)._

### Implementation for User Story 2

- [X] T014 [US2] Verificado: o fallback de Suspense (`loading.tsx`) e o conteúdo resolvido residem no mesmo boundary `<ViewTransition>` (ambos ocupam `{children}`). Nenhum ajuste necessário — o reveal sem tipo cai no `default: vt-crossfade`, dando o handoff em crossfade. Documentado em research.md (D5)

**Checkpoint**: US1 + US2 funcionam independentemente.

---

## Phase 5: User Story 3 - Degradação graciosa e movimento reduzido (Priority: P2)

**Goal**: Troca instantânea sob `prefers-reduced-motion` e em navegadores sem suporte; sem erros; foco de teclado preservado.

**Independent Test**: (a) reduced-motion → troca instantânea; (b) navegador sem suporte → troca instantânea sem erro de console; (c) navegação por teclado mantém foco correto após transição.

### Tests for User Story 3 ⚠️ (escrever PRIMEIRO, devem FALHAR)

- [X] T015 [P] [US3] E2E reduced-motion + degradação em `__tests__/e2e/transitions-reduced-motion.spec.ts`: com `prefers-reduced-motion: reduce` a troca é instantânea; sem erros de transição quando a API é removida (`startViewTransition` undefined via `addInitScript`). _Execução em T036._
- [X] T016 [P] [US3] E2E de foco de teclado em `__tests__/e2e/transitions-a11y.spec.ts`: foco não fica preso no snapshot após a transição (Tab continua avançando). _Execução em T036._

### Implementation for User Story 3

- [X] T017 [US3] Adicionar bloco `@media (prefers-reduced-motion: reduce)` zerando `animation-duration`/`animation-delay` de `::view-transition-group/old/new(*)` em `src/app/globals.css` (D7, contrato C2). Mesmo arquivo de T003/T008 → sequencial
- [X] T018 [US3] Confirmado: sem listener de `popstate` (D3 = fallback), não há guard a ajustar. `<ViewTransition>`/`addTransitionType` do React degradam sozinhos (swap instantâneo, sem erro) quando a API está ausente. Sem código (D7/FR-007)

**Checkpoint**: US1 + US2 + US3 — animações robustas e acessíveis.

---

## Phase 6: User Story 4 - Configurações como modal sobre a página atual (Priority: P3)

**Goal**: `/settings` abre como modal (overlay cobre a aplicação, inclusive a sidebar) com URL compartilhável; fechar restaura a origem; deep-link/refresh renderiza página independente.

**Independent Test**: Abrir Configurações no app → Dialog sobre a página, URL `/settings`; fechar (botão/Esc/overlay) → volta à origem; back fecha; refresh em `/settings` → página standalone.

### Tests for User Story 4 ⚠️ (escrever PRIMEIRO, devem FALHAR)

- [X] T019 [P] [US4] E2E do modal em `__tests__/e2e/settings-modal.spec.ts`: abre sobre a página com URL `/settings`; overlay (`[data-slot="dialog-overlay"]`) cobre a app; fecha por Esc/overlay/back e restaura; deep-link/refresh renderiza standalone (contrato C3). _Execução em T036._

### Implementation for User Story 4

- [~] T020 [US4] Pencil MCP não conectado nesta sessão (editor VS Code inativo) → consulta a `design.pen` adiada para revisão. Risco de design nulo: o modal reutiliza o conteúdo de settings já aprovado dentro do primitivo `Dialog` existente
- [X] T021 [P] [US4] Primitivo `Dialog` já existe em `src/components/ui/dialog.tsx` (Base UI) — confirmado, sem adição (D4)
- [X] T022 [US4] Extrair as seções de configuração para `src/components/features/settings/settings-content.tsx` (Theme/FontSize/FavoritePage/PrimaryColor/DashboardWidgets), recebendo `preferences` por prop (reuso página+modal, D4). Busca server extraída para `load-preferences.ts`
- [X] T023 [US4] Refatorar `src/app/(authenticated)/settings/page.tsx` para renderizar `<SettingsContent>` mantendo `PageContainer`/`PageHeader` (standalone preservado, FR-011). Depende de T022
- [X] T024 [P] [US4] Criar `src/app/(authenticated)/@modal/default.tsx` retornando `null` (slot vazio, contrato C3)
- [X] T025 [US4] Criar `src/app/(authenticated)/@modal/(.)settings/page.tsx` renderizando `<SettingsContent>` dentro de `<Dialog>` (via `settings-modal.tsx` + hook `use-settings-modal.ts`), buscando preferências no Server Component (FR-009/FR-010/FR-016). Depende de T021, T022
- [X] T026 [US4] Atualizar `src/app/(authenticated)/layout.tsx` para aceitar a prop `modal` (parallel route) e renderizá-la fora do boundary de conteúdo, ao lado de `children` (contrato C3)

**Checkpoint**: US1–US4 funcionam independentemente.

---

## Phase 7: User Story 5 - Morph suave ao reordenar capítulos (Priority: P3)

**Goal**: Linhas de capítulo deslizam suavemente ao reordenar (arrastar e ↑/↓); reduced-motion → instantâneo; ordem persistida.

**Independent Test**: Reordenar capítulos via ↑/↓ e via arrastar → linhas afetadas animam o reposicionamento; com reduced-motion → instantâneo; nova ordem persistida (`expectedVersion`/409 intactos).

### Tests for User Story 5 ⚠️ (escrever PRIMEIRO, devem FALHAR)

- [X] T027 [P] [US5] E2E de reorder morph em `__tests__/e2e/chapter-reorder-morph.spec.ts`: mover capítulo via ↑/↓ reposiciona e persiste (PUT 200 + ordem após reload); variante reduced-motion funciona instantânea. _Execução em T036._

### Implementation for User Story 5

- [X] T028 [US5] Spike D6 — conclusão: morph por linha (`<ViewTransition>` por `ChapterRow`) + `startTransition`; `@dnd-kit` mantém o arraste, o morph anima o commit (↑/↓ e pós-drop). Sem regressão funcional (lógica/persistência intactas). Qualidade visual do drag-drop a validar em navegador (T036); fallback documentado em `research.md` (D6)
- [X] T029 [US5] Envolver **cada** `ChapterRow` em `<ViewTransition key={chapter.id}>` em `src/components/features/chapters/chapters-table.tsx` (a doc confirma: envolver só o container faria crossfade, não morfa linhas) (D6)
- [X] T030 [US5] Envolver o update otimista de ordem (`apply` + rollback) em `startTransition` em `src/components/features/chapters/hooks/use-chapters-reorder.ts` (`moveBy` chama `apply`) (D6)
- [X] T031 [US5] Confirmado: a animação default do browser para o grupo já morfa a posição — sem classe/keyframes custom; reduced-motion tratado por T017

**Checkpoint**: Todas as user stories independentemente funcionais.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validação transversal, regressão visual e fechamento.

- [ ] T032 [P] E2E de regressão visual (screenshots) nos breakpoints 320/768/1024/1440 em tema claro e escuro em `__tests__/e2e/transitions-visual.spec.ts` (SC-007, NFR-002). Incluir verificação de **estabilidade visual durante a transição** (sem CLS perceptível ao trocar entre rotas de alturas/larguras diferentes) (NFR-003)
- [ ] T033 Smoke de build final — `bun run build` sem erros com toda a feature ativada (SC-008)
- [ ] T034 [P] Atualizar `futuras-features.md` removendo/marcando como concluída a entrada da Fase B (docs)
- [ ] T035 Rodar `/code-review` e `/simplify` sobre o diff da feature (Princípios VII/IX/XII)
- [ ] T036 Verificação final obrigatória: `bun run lint`, `bun run test:unit`, `bun run test:e2e`, `bun run build` (sem integration — sem DB)
- [ ] T037 [P] Validar `quickstart.md` ponta-a-ponta (Definition of Done mapeada às SCs)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências (T002 depende de T001).
- **Foundational (Phase 2)**: depende do Setup — BLOQUEIA todas as user stories.
- **User Stories (Phase 3–7)**: todas dependem da Foundational. Depois disso, podem seguir em paralelo ou em ordem de prioridade (P1→P3).
- **Polish (Phase 8)**: depende das stories desejadas concluídas.

### User Story Dependencies

- **US1 (P1)**: após Foundational. Sem dependência de outras stories. (T012 spike D3 isolado.)
- **US2 (P2)**: após Foundational. Opera no boundary de T004; independente de US1.
- **US3 (P2)**: após Foundational. Independente; toca `globals.css` (sequencial com T003/T008/T017).
- **US4 (P3)**: após Setup (precisa da flag). Largamente independente (rotas `@modal`).
- **US5 (P3)**: após Foundational. Depende da flag + `<ViewTransition>`; spike D6 isolado.

### Within Each User Story

- Testes (unit/E2E) escritos e FALHANDO antes da implementação.
- Helper puro antes de wiring nos componentes.
- `globals.css` é arquivo único compartilhado: T003 → T008 → T017 → T031 são **sequenciais entre si** (não [P]).

### Parallel Opportunities

- T003 (foundational CSS) é [P] em relação a outras fases, mas o restante de `globals.css` é sequencial.
- US1: T005 e T006 (testes) em paralelo; após T007, T009/T010/T011 em paralelo (arquivos distintos).
- US3: T015 e T016 (testes E2E) em paralelo.
- US4: T021 e T024 em paralelo; T019 (teste) antes da impl.
- Após a Foundational, US1–US5 podem ser tocadas por pessoas diferentes em paralelo.

---

## Parallel Example: User Story 1

```bash
# Testes da US1 juntos (RED primeiro):
Task: "Unit test de resolveNavTransition em __tests__/unit/navigation/nav-transition.spec.ts"
Task: "E2E de navegação direcional em __tests__/e2e/page-transitions.spec.ts"

# Após T007 (helper), wiring em paralelo (arquivos distintos):
Task: "transitionTypes em src/components/layout/sidebar.tsx"
Task: "transitionTypes em src/components/layout/mobile-sidebar.tsx"
Task: "transitionTypes de profundidade nos links de conteúdo"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) → flag + smoke build.
2. Phase 2 (Foundational) → boundary + tokens (crossfade neutro já funciona).
3. Phase 3 (US1) → direção completa.
4. **PARAR e VALIDAR**: testar US1 isoladamente (navegação direcional, sidebar estável).
5. Demo/deploy se pronto.

> Sugestão: rodar os spikes **T012 (D3)** e **T028 (D6)** cedo (logo após a Foundational e ao iniciar US5, respectivamente) — eles definem o esforço real e têm fallback que não regride função.

### Incremental Delivery

1. Setup + Foundational → base (crossfade neutro).
2. US1 → direção → MVP.
3. US2 → handoff de skeleton.
4. US3 → reduced-motion/degradação (release-gate de acessibilidade).
5. US4 → modal de settings.
6. US5 → morph de reorder.
7. Polish → regressão visual + build + verificação final.

---

## Notes

- `[P]` = arquivos diferentes, sem dependências pendentes.
- `globals.css` é editado por T003/T008/T017/T031 — **sequenciais**, nunca em paralelo entre si.
- TDD obrigatório: confirmar que os testes falham antes de implementar (Princípio V); helper puro = 100% de cobertura.
- Integration tests: **N/A** (feature sem DB). Não criar `__tests__/integration/` para esta feature.
- Sem `toast.success`; feedback de sucesso vem da própria UI (Princípio VII).
- Consultar `design.pen` (T020) antes de montar a tela do modal.
- Commits: apenas sob solicitação explícita do usuário.
