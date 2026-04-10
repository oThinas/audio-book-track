# Tasks: Dark Mode & Primary Color Theming Refactor

**Input**: Design documents from `/specs/009-dark-mode-theming/`
**Prerequisites**: plan.md (required), spec.md (required), research.md (token mapping reference)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependencias)
- **[Story]**: Qual user story esta tarefa pertence (US1, US2, US3, US4)

---

## Phase 1: Setup

**Purpose**: Nenhum setup de projeto necessario — todos os arquivos ja existem. Esta fase valida que a infraestrutura de theming esta funcional.

- [ ] T001 Verificar que `src/app/globals.css` contem todos os tokens semanticos necessarios (`:root`, `.dark`, `[data-primary-color]` para as 5 cores) — somente leitura, sem alteracao

**Checkpoint**: Tokens confirmados, implementacao pode iniciar.

**Quality Gate**: `bun run lint` e `bun run build` — DEVEM passar antes de prosseguir.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Refatorar o layout autenticado e a sidebar — componentes compartilhados que afetam TODAS as paginas autenticadas. DEVEM ser concluidos antes das user stories individuais.

**CRITICAL**: Nenhuma user story pode iniciar ate esta fase estar completa.

- [ ] T002 Substituir classes hardcoded no layout autenticado em `src/app/(authenticated)/layout-client.tsx`: `bg-slate-50` → `bg-background`
- [ ] T003 [P] Substituir classes hardcoded na sidebar em `src/components/layout/sidebar.tsx`: `bg-slate-800` → `bg-sidebar`, `text-blue-500` → `text-sidebar-primary`, `text-white` → `text-sidebar-foreground`, `bg-blue-600` → `bg-sidebar-primary`, `text-white` (sobre acento) → `text-sidebar-primary-foreground`, `text-slate-400` → `text-sidebar-foreground/70`, `hover:bg-slate-700` → `hover:bg-sidebar-accent`, `hover:text-white` → `hover:text-sidebar-accent-foreground`, `text-red-400` → `text-destructive`, `hover:text-red-300` → `hover:text-destructive/80`
- [ ] T004 [P] Substituir classes hardcoded no sidebar toggle em `src/components/layout/sidebar-toggle.tsx`: `text-slate-400` → `text-sidebar-foreground/70`, `hover:text-white` → `hover:text-sidebar-accent-foreground`

**Checkpoint**: Sidebar e layout autenticado adaptam-se corretamente a dark mode e primary color. Verificar visualmente alternando tema e cor primaria.

**Quality Gate**: `bun run lint`, `bun run test:unit`, e `bun run build` — todos devem passar antes de prosseguir.

---

## Phase 3: User Story 1 — Dark mode consistente em todas as paginas (Priority: P1)

**Goal**: Todas as paginas renderizam corretamente em dark mode com tokens semanticos. Inclui a pagina de login (US4 compartilha os mesmos arquivos).

**Independent Test**: Alternar o seletor de tema entre Claro, Escuro e Sistema e verificar que todas as superficies visiveis se adaptam — incluindo a pagina de login.

### Implementation for User Story 1 + User Story 4

- [ ] T005 [P] [US1] Substituir classes hardcoded na pagina de login em `src/app/(auth)/login/page.tsx`: `bg-slate-800` → `bg-sidebar`, `text-blue-500` → `text-primary`, `text-white` (titulo) → `text-sidebar-foreground`, `bg-slate-50` → `bg-background`, `bg-white` → `bg-card`, `text-slate-800` → `text-foreground`, `text-slate-500` → `text-muted-foreground`
- [ ] T006 [P] [US1] Substituir classes hardcoded no formulario de login em `src/components/features/auth/login-form.tsx`: `text-slate-700` → `text-foreground` (2 ocorrencias)

**Checkpoint**: Pagina de login e area autenticada funcionam corretamente em ambos os temas. Verificar visualmente em modo claro e escuro, incluindo com dark mode do SO.

**Quality Gate**: `bun run lint`, `bun run test:unit`, e `bun run build` — todos devem passar antes de prosseguir.

---

## Phase 4: User Story 2 + User Story 3 — Primary color e settings adaptados (Priority: P1/P2)

**Goal**: Todos os elementos interativos refletem a cor primaria escolhida E todas as secoes da pagina de settings sao legiveis em ambos os temas. US2 e US3 sao combinadas porque editam os mesmos arquivos (theme-selector.tsx, font-size-selector.tsx).

**Independent Test**: Selecionar cada uma das 5 cores primarias e verificar que sidebar ativa, seletores checked e icone de marca mudam de cor. Abrir settings em modo claro e escuro e verificar que labels, descricoes, separadores e bordas sao legiveis.

### Implementation for User Story 2 + User Story 3

- [ ] T007 [US2+US3] Substituir classes hardcoded na pagina de settings em `src/app/(authenticated)/settings/page.tsx`: `bg-slate-100` → `bg-border` (4 separadores), `text-slate-800` → `text-foreground` (4 labels), `text-slate-500` → `text-muted-foreground` (4 descricoes)
- [ ] T008 [P] [US2+US3] Substituir TODAS as classes hardcoded no seletor de tema em `src/components/features/settings/theme-selector.tsx`: `border-slate-200` → `border-border`, `text-slate-500` → `text-muted-foreground`, `has-checked:bg-blue-600` → `has-checked:bg-primary`, `has-checked:text-white` → `has-checked:text-primary-foreground`
- [ ] T009 [P] [US2+US3] Substituir TODAS as classes hardcoded no seletor de tamanho de fonte em `src/components/features/settings/font-size-selector.tsx`: `border-slate-200` → `border-border`, `text-slate-500` → `text-muted-foreground`, `has-checked:bg-blue-600` → `has-checked:bg-primary`, `has-checked:text-white` → `has-checked:text-primary-foreground`
- [ ] T010 [P] [US3] Substituir classes hardcoded no seletor de pagina favorita em `src/components/features/settings/favorite-page-selector.tsx`: `border-slate-200` → `border-border`, `bg-slate-50` → `bg-background`, `text-slate-400` → `text-muted-foreground` (2 ocorrencias)

**Checkpoint**: Pagina de settings renderiza corretamente em ambos os temas. Ao selecionar cada cor primaria, todos os elementos de destaque mudam corretamente. Todos os controles sao legiveis e funcionais.

**Quality Gate**: `bun run lint`, `bun run test:unit`, e `bun run build` — todos devem passar antes de prosseguir.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verificacao final e validacao de nao-regressao.

- [ ] T011 Verificacao visual completa: navegar por todas as paginas (login, dashboard, settings) em ambos os temas (claro e escuro) com cada uma das 5 cores primarias
- [ ] T012 Verificar score de acessibilidade do Lighthouse nas paginas de login e settings em ambos os temas — confirmar que ratios de contraste sao mantidos (SC-006)
- [ ] T013 Rodar `bun run lint` — resolver qualquer erro ou warning
- [ ] T014 Rodar `bun run test:unit` — garantir que todos os testes passam
- [ ] T015 Rodar `bun run build` — garantir que o build de producao compila sem erros
- [ ] T016 Executar validacao de quickstart.md — seguir o guia de verificacao rapida em `specs/009-dark-mode-theming/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependencias — pode iniciar imediatamente
- **Foundational (Phase 2)**: Depende de Phase 1 — BLOQUEIA todas as user stories
- **US1+US4 (Phase 3)**: Depende de Phase 2
- **US2+US3 (Phase 4)**: Depende de Phase 2 (pode rodar em paralelo com Phase 3)
- **Polish (Phase 5)**: Depende de Phase 3 e Phase 4 concluidas

### User Story Dependencies

- **US1+US4 (P1/P2)**: Pode iniciar apos Phase 2 — arquivos independentes de US2+US3
- **US2+US3 (P1/P2)**: Pode iniciar apos Phase 2 — arquivos independentes de US1+US4

### Within Each Phase

- Tarefas marcadas [P] podem rodar em paralelo
- Tarefas sem [P] devem seguir ordem sequencial
- Phase completa antes de avancar para Polish

### Parallel Opportunities

```text
# Phase 2 — T003 + T004 em paralelo (arquivos diferentes)
T003 (sidebar.tsx) | T004 (sidebar-toggle.tsx)

# Phase 3 — T005 + T006 em paralelo (arquivos diferentes)
T005 (login/page.tsx) | T006 (login-form.tsx)

# Phase 4 — T008 + T009 + T010 em paralelo (arquivos diferentes)
T008 (theme-selector.tsx) | T009 (font-size-selector.tsx) | T010 (favorite-page-selector.tsx)

# Phase 3 e Phase 4 podem rodar em paralelo entre si (sem arquivos compartilhados)
```

---

## Implementation Strategy

### MVP First (Phase 3 Only)

1. Completar Phase 1: Setup (validacao de tokens)
2. Completar Phase 2: Foundational (sidebar + layout)
3. Completar Phase 3: US1+US4 (dark mode em todas as paginas, incluindo login)
4. **STOP e VALIDAR**: Testar dark mode em todas as paginas
5. Deploy/demo se pronto

### Execucao completa (recomendada)

1. Phase 1 (setup)
2. Phase 2 (foundational — sidebar + layout)
3. Phase 3 + Phase 4 **em paralelo** (US1+US4 e US2+US3 editam arquivos independentes)
4. Phase 5 (polish — verificacao final)

---

## Notes

- [P] tasks = arquivos diferentes, sem dependencias
- [Story] label mapeia tarefa para user story especifica
- Cada phase deve ser independentemente completavel e testavel
- Commit apos cada tarefa ou grupo logico
- Pare em qualquer checkpoint para validar independentemente
- Total de arquivos editados: 9 (primary-color-selector.tsx nao requer mudancas)
- Total de tarefas: 16 (10 de implementacao, 6 de verificacao/quality gate)