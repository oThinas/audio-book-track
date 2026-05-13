---

description: "Task list — 024 Chapter Grouping"
---

# Tasks: Agrupamento de capítulos por editor/narrador/status

**Input**: Design documents from `/specs/024-chapter-grouping/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`
**Tests**: Obrigatórios (Princípio V — TDD não-negociável). Tests vêm ANTES da implementação em cada par RED/GREEN. Cobertura ≥ 80% no diff; 100% nas funções de cálculo de ganho.

**Organization**: Tasks são agrupadas por user story (P1-P3). MVP = P1 (Stories 1 e 2 — agrupar por editor e por narrador).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências de tasks incompletas).
- **[Story]**: Mapeia ao user story do spec (US1..US5). Setup/Foundational/Polish não têm label.
- Caminhos de arquivo absolutos no description.

## Path Conventions

- App code: `src/...` (relativo à raiz do repo)
- Tests: `__tests__/{unit,integration,e2e}/...`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Garantir primitivas e dependências necessárias antes da feature começar.

- [X] T001 [P] Verificar presença de `src/components/ui/dropdown-menu.tsx`; se ausente, adicionar via `bunx --bun shadcn@latest add dropdown-menu` (flag `--bun` obrigatória — constituição XV)
- [X] T002 [P] Verificar/adicionar helper `chapterStatusLabel(status: ChapterStatus): string` retornando rótulo PT-BR ("Pendente", "Em edição", "Em revisão", "Retake", "Concluído", "Pago") em `src/lib/domain/chapter.ts`; se já existir equivalente, reutilizar

**Checkpoint**: Stack de UI pronto, helpers de label disponíveis.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura que TODA user story depende: agregações, parser, hook de URL, feature flag e migração da `chapters-table` para TanStack Table.

**⚠️ CRITICAL**: Nenhuma user story começa até esta fase concluir.

- [X] T003 [P] Criar `src/lib/config/feature-flags.ts` com `export const featureFlags = { SHOW_EARNINGS_IN_NARRATOR_GROUPS: true } as const;` + comentário JSDoc explicando propósito (referência R-010 do research)
- [X] T004 [P] TDD RED — escrever `__tests__/unit/lib/url/parse-grouping-param.spec.ts` cobrindo casos U-1 a U-9 do contrato `contracts/url-state.md` (input válido, duplicata, valor desconhecido, vazio); validar imutabilidade e ausência de throws
- [X] T005 GREEN — implementar `parseGroupingParam` e `serializeGroupingParam` em `src/lib/url/grouping-param.ts` conforme assinaturas em `data-model.md` §3
- [X] T006 [P] TDD RED — escrever `__tests__/unit/lib/domain/chapter-aggregation.spec.ts` cobrindo `sumCentsRounded` (arredondamento half-away-from-zero por capítulo antes de somar — Princípio II), `countByStatus` (record completo com todos os status), `formatStatusBreakdown` (renderiza apenas status > 0 em ordem do enum em PT-BR; quando `groupingDimensionAtLevel === "status"`, retorna apenas "N capítulos") e `computeChapterEarningsCents(chapter, book)` (cálculo individual)
- [X] T007 GREEN — implementar `src/lib/domain/chapter-aggregation.ts` exportando `computeChapterEarningsCents`, `sumCentsRounded`, `countByStatus`, `formatStatusBreakdown` conforme `data-model.md` §2 e `contracts/ui-group-row.md` §Formatação
- [X] T008 [P] TDD RED — escrever `__tests__/unit/lib/utils/format-grouped-seconds.spec.ts` cobrindo: 0s → "0min", < 1h → "Ymin", múltiplo de hora → "Xh", misto → "Xh Ymin"
- [X] T009 GREEN — adicionar `formatGroupedSeconds(totalSeconds: number): string` em `src/lib/utils.ts` ao lado do `formatSecondsAsHHMMSS` existente (sem mudar APIs existentes)
- [X] T010 [P] TDD RED — escrever `__tests__/unit/components/features/chapters/hooks/use-chapters-grouping-state.spec.tsx` usando `renderHook` (`@testing-library/react`) + mocks de `useSearchParams`/`useRouter`/`usePathname` (em `__tests__/unit/setup.ts` já há padrão para mockar `next/navigation`); validar parse de param, set+remover, `scroll: false`, preservação de outros params
- [X] T011 GREEN — implementar `src/components/features/chapters/hooks/use-chapters-grouping-state.ts` retornando `{ grouping: GroupingDimension[], setGrouping: (next) => void }` conforme R-007 do research
- [X] T012 Migração pura (M0) — refatorar `src/components/features/chapters/chapters-table.tsx` para usar `useReactTable` (`@tanstack/react-table` v8) seguindo padrão de `src/components/features/books/books-table.tsx`: definir `ColumnDef<ChapterRowEntity>[]` (number, status, narrator, editor, editedSeconds, ações), `getCoreRowModel`, `getSortedRowModel`. **Renderização**: iterar `table.getRowModel().rows`; cada row continua renderizada por `<ChapterRow chapter={row.original} ... />`. Bulk select, dialogs e modos de edit permanecem inalterados. NÃO adicionar grouping/expansion ainda — esta task é refactor puro sem mudança de UX
- [X] T013 [P] Criar `src/components/features/chapters/hooks/use-chapters-table.ts` extraindo a config de `useReactTable` (recebe `chapters`, `columns`, e retorna `{ table }`) — espelha o padrão de `use-books-table.ts`. Ajustar `chapters-table.tsx` para consumir o hook
- [X] T014 Rodar `bun run test:e2e` para os specs já existentes que tocam `/books/[id]` (chapters edit inline, narrator/editor delete with active books, etc.) e confirmar que TODOS continuam verdes após T012/T013 — se algum quebrar, corrigir antes de prosseguir; **gate**: zero regressões antes de US1

**Checkpoint**: Foundation pronta — `chapters-table` agora dirigida por TanStack; agregações, parser, formatter, hook de URL e flag prontos. US1 pode começar.

---

## Phase 3: User Story 1 — Agrupar por editor com totais (Priority: P1) 🎯 MVP

**Goal**: Usuário em `/books/<id>` ativa "Editor" no controle; tabela colapsa em grupos com qtd, minutagem, ganho BRL e breakdown por status; "Sem atribuição" no fim; URL sincronizada.

**Independent Test**: Spec.md Story 1 — `Given` livro com 10 capítulos em 2 editores + 2 sem editor, `When` agrupa por Editor, `Then` 3 grupos colapsados ordenados por minutagem desc com "Sem atribuição" no fim.

### Tests for User Story 1 ⚠️ (TDD obrigatório — escrever ANTES da implementação e ver FALHAR)

- [X] T015 [P] [US1] Escrever `__tests__/e2e/chapters-grouping-by-editor.spec.ts` cobrindo: criar livro com fixtures de 2 editores + capítulos com `edited_seconds`/`status` variados + 2 caps sem editor; navegar para `/books/<id>`; abrir trigger `chapter-grouping-trigger`; clicar `chapter-grouping-item-editor`; validar via testids: 3 group rows (com order esperada), bucket "Sem atribuição" no fundo; **asserção de totais**: computar valores esperados no test via `chapters.reduce(...)` sobre a fixture (não hardcoded) e comparar com texto renderizado da linha-resumo, garantindo SC-003; expandir um grupo e validar capítulos por número asc; copiar URL e abrir nova page → estado preserva agrupamento; clicar `chapter-grouping-clear` → tabela flat e param removido. **Asserção de performance (SC-005)**: medir `performance.now()` antes do click em `chapter-grouping-item-editor` e depois da primeira linha-resumo estar visível; esperar < 300 ms (`expect(elapsed).toBeLessThan(300)`); marcar como soft assertion ou pular em CI lento se necessário. **RED**: deve falhar agora (componentes não existem)

### Implementation for User Story 1

- [X] T016 [P] [US1] Implementar `src/components/features/chapters/chapter-grouping-control.tsx` conforme `contracts/ui-grouping-control.md`: shadcn `DropdownMenu` + `DropdownMenuCheckboxItem` para Narrador/Editor/Status; item "Sem agrupamento" no topo; badge de ordem 1-based; data-testids; mobile-first; dark mode via tokens
- [X] T017 [P] [US1] Implementar `src/components/features/chapters/chapter-group-row.tsx` conforme `contracts/ui-group-row.md`: célula de label (StatusBadge ou nome ou "Sem atribuição"), botão expand/collapse via `row.getToggleExpandedHandler()`, células de count/seconds/earnings/breakdown via `aggregatedCell`; padding-left por `row.depth`; data-testids; respeita prop `showEarningsColumn` (esta task NÃO implementa o gate da flag — é só o prop)
- [X] T018 [US1] Em `src/components/features/chapters/chapters-table.tsx` (já dirigida por TanStack após T012/T013): adicionar `enableGrouping` em colunas `narrator`/`editor`/`status` com `accessorFn` mapeando `null` para `UNASSIGNED_GROUP_KEY` (importado de `chapter-aggregation.ts`); configurar `aggregationFn: "sum"` na coluna `editedSeconds`; adicionar coluna virtual `earnings` com aggregation custom `sumCentsRounded` (registrar via opção `aggregationFns` do `useReactTable`); adicionar coluna virtual `statusBreakdown` com aggregation `countByStatus`; ativar `getGroupedRowModel`, `getExpandedRowModel`; estado `expanded` em `useState` local; estado `grouping` injetado via prop (vem do `useChaptersGroupingState` no nível acima); `sortingFn` custom por coluna agrupada que empurra `UNASSIGNED_GROUP_KEY` para o fim + ordena demais por `editedSeconds` desc; renderização condicional: `row.getIsGrouped()` → `<ChapterGroupRow row={row} groupingDimension={...} showEarningsColumn={...} columnCount={...} />`; senão → `<ChapterRow chapter={row.original} ... />`
- [X] T019 [US1] Em `src/components/features/books/book-detail-client.tsx`: chamar `useChaptersGroupingState()`; passar `grouping`/`setGrouping` para `<ChaptersTable>`; renderizar `<ChapterGroupingControl grouping={grouping} onGroupingChange={setGrouping} />` acima da tabela (ou em barra de ações apropriada). Garantir que o trigger não compete com `<ChaptersBulkDeleteBar>` quando em selection mode (esconder controle de agrupamento durante selection mode, ou desabilitar)
- [X] T020 [US1] Rodar `__tests__/e2e/chapters-grouping-by-editor.spec.ts` — agora deve passar (**GREEN**). Se falhar, iterar tasks T016–T019 sem rodar a suíte completa. **Sub-cenário FR-020 (mutação atualiza totais)**: adicionar ao mesmo spec um caso onde, após agrupar por editor e expandir um grupo, edita-se inline o `editedSeconds` de um capítulo dentro do grupo (UI existente em `ChapterRowEditMode`); após salvar, validar que (a) o total de minutagem/ganho da linha-resumo do grupo atualizou refletindo a nova soma calculada via `reduce` no test, (b) o estado de expansão permaneceu (grupo continua expandido), (c) nenhum outro grupo foi afetado

**Checkpoint**: P1 (Editor) funcional. Demo possível.

---

## Phase 4: User Story 2 — Agrupar por narrador com totais (Priority: P1) 🎯 MVP

**Goal**: Mesma UX da US1 com dimensão `narrator`; valida bucket "Sem atribuição" para capítulos `pending`.

**Independent Test**: Spec.md Story 2 — `Given` livro com 8 capítulos em 3 narradores + 1 cap `pending` sem narrador, `When` agrupa por Narrador, `Then` 4 grupos (3 narradores + "Sem atribuição" no fim).

### Tests for User Story 2 ⚠️

- [X] T021 [P] [US2] Escrever `__tests__/e2e/chapters-grouping-by-narrator.spec.ts`: fixtures com 3 narradores + 1 cap `pending` sem narrador; navegar; clicar `chapter-grouping-item-narrator`; validar 4 grupos com ordenação esperada e bucket "Sem atribuição" como último; expandir bucket e ver o cap pending; validar que cap com `editedSeconds = 0` incrementa count mas contribui 0 à minutagem/ganho. **Asserção de totais**: computar valores esperados via `chapters.reduce(...)` no test (não hardcoded) e comparar com texto renderizado — garantindo SC-003 também aqui

### Implementation for User Story 2

- [X] T022 [US2] Verificar que a coluna `narrator` configurada em T018 já satisfaz US2 (mesma infraestrutura). Caso aparecem ajustes específicos (ex: label correta da célula de grupo de narrador puxando `narrator.name` da primeira folha), corrigir em `chapter-group-row.tsx` (mesmo arquivo de T017 — sequencial)
- [X] T023 [US2] Rodar `__tests__/e2e/chapters-grouping-by-narrator.spec.ts` — **GREEN**

**Checkpoint**: MVP completo (P1 inteiro). Pronto para demo aos stakeholders.

---

## Phase 5: User Story 3 — Agrupar por status (Priority: P2)

**Goal**: Dimensão `status` agrupa capítulos; rótulo de grupo via `<StatusBadge>`; breakdown na linha-resumo é substituído por contagem total (FR-015).

**Independent Test**: Spec.md Story 3 — `Given` livro com capítulos em 4 status, `When` agrupa por Status, `Then` 4 grupos com labels PT-BR; coluna de breakdown mostra apenas "N capítulos".

### Tests for User Story 3 ⚠️

- [X] T024 [P] [US3] Escrever `__tests__/e2e/chapters-grouping-by-status.spec.ts`: fixtures com caps em 4 status distintos; clicar `chapter-grouping-item-status`; validar labels PT-BR via `<StatusBadge>`; validar célula de breakdown = "N capítulos" (sem listagem redundante)

### Implementation for User Story 3

- [X] T025 [US3] Em `src/components/features/chapters/chapter-group-row.tsx`: ajustar renderização do `aggregatedCell` de `statusBreakdown` para consultar `groupingDimension` do nível e chamar `formatStatusBreakdown(breakdown, groupingDimension)` — quando dimensão é `"status"`, o helper retorna "N capítulos" (já implementado em T007); garantir que a prop `groupingDimension` reflita a dimensão da row (via `row.column.id` do TanStack quando agrupado, ou via lookup em `grouping[row.depth]`)
- [X] T026 [US3] Rodar `__tests__/e2e/chapters-grouping-by-status.spec.ts` — **GREEN**

**Checkpoint**: P2 parte 1 funcional.

---

## Phase 6: User Story 4 — Agrupamento multi-nível (Priority: P2)

**Goal**: Usuário compõe hierarquia por sequência de cliques (ex: Narrador → Editor); URL preserva ordem; reordenação via desmarcar+remarcar.

**Independent Test**: Spec.md Story 4 — `Given` controle, `When` clica em Narrador depois em Editor, `Then` URL `?groupBy=narrator,editor` + hierarquia de 2 níveis; totais de sub-grupos somam ao total do nível externo.

### Tests for User Story 4 ⚠️

- [X] T027 [P] [US4] Escrever `__tests__/e2e/chapters-grouping-multi-level.spec.ts`: clicar narrator depois editor; validar URL = `?groupBy=narrator,editor`; validar hierarquia visual (Narrador A com sub-grupos por Editor); somar manualmente sub-grupos e comparar com linha-resumo do nível Narrador; desmarcar ambos e re-marcar em ordem `editor → narrator` → URL atualiza e hierarquia se reorganiza; abrir URL `/books/<id>?groupBy=narrator,editor,status` em nova aba → mesmo estado

### Implementation for User Story 4

- [X] T028 [US4] Verificar comportamento da `sortingFn` custom em níveis aninhados (TanStack aplica recursivamente). Se grupos internos ordenam corretamente por minutagem desc com "Sem atribuição" no fim em CADA nível, nenhuma mudança necessária. Caso ajuste seja preciso, modificar `chapters-table.tsx` (mesma área de T018 — sequencial dentro do mesmo arquivo)
- [X] T029 [US4] Rodar `__tests__/e2e/chapters-grouping-multi-level.spec.ts` — **GREEN**

**Checkpoint**: P2 completo.

---

## Phase 7: User Story 5 — Feature flag de ganho em grupo de narrador (Priority: P3)

**Goal**: Constante `SHOW_EARNINGS_IN_NARRATOR_GROUPS` controla coluna de ganho APENAS em linhas-resumo de grupos de narrador; demais dimensões e folhas intactas.

**Independent Test**: Spec.md Story 5 — `Given` flag `false`, `When` agrupa por narrador, `Then` cell de ganho some das linhas-resumo de narrador; agrupando por editor/status, ganho continua visível; folhas continuam mostrando ganho.

### Tests for User Story 5 ⚠️

- [X] T030 [P] [US5] Escrever `__tests__/e2e/chapters-grouping-flag-narrator-earnings.spec.ts`: testar com flag `true` (default) → grupo de narrador mostra cell de ganho; estratégia para flag `false`: usar **module mock no Playwright via fixture customizada** OU executar um spec dedicado com `vi.mock` (alternativa: adicionar prop opcional `featureFlagsOverride` no `BookDetailClient` apenas em build de teste — última opção é menos invasiva mas adiciona código condicional; **decisão**: usar o cenário com flag `true` (default real) e cobrir o cenário `false` via unit test em T032 abaixo)
- [X] T031 [P] [US5] Escrever unit test `__tests__/unit/components/features/chapters/chapter-group-row.spec.tsx` renderizando `<ChapterGroupRow>` mockado com `showEarningsColumn={false}` (grupo de narrador) e `showEarningsColumn={true}` — validar que a célula de ganho aparece/some conforme a prop. Esse unit cobre o gate sem depender do valor da constante real

### Implementation for User Story 5

- [X] T032 [US5] Em `src/components/features/chapters/chapters-table.tsx` (área já tocada por T018): calcular `showEarningsColumn` por row de grupo: `const dimAtLevel = grouping[row.depth]; const isNarratorGroup = dimAtLevel === "narrator"; const showEarningsColumn = !isNarratorGroup || featureFlags.SHOW_EARNINGS_IN_NARRATOR_GROUPS;` e passar como prop para `<ChapterGroupRow>`
- [X] T033 [US5] Rodar T030 (E2E com flag default) e T031 (unit) — ambos **GREEN**

**Checkpoint**: P3 completo. Feature inteira coberta.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, smoke tests, verificação final, PR.

- [X] T034 [P] Escrever teste unit no spec do parser (T004) garantindo que `parseGroupingParam("foo")`, `parseGroupingParam("editor,editor")` e `parseGroupingParam("")` retornem `[]` (já coberto se T004 seguiu U-1..U-9; caso não, adicionar)
- [X] T035 [P] Escrever E2E `__tests__/e2e/chapters-grouping-invalid-url.spec.ts`: navegar diretamente para `/books/<id>?groupBy=foo` → tabela renderiza flat; após primeira interação com o controle, URL é normalizada (param removido) — confirma FR-003
- [X] T036 [P] Adicionar verificação mobile (viewport < 640px) em pelo menos UM dos specs E2E acima (`{ viewport: { width: 375, height: 812 } }` no `test.use()`): controle abre, agrupamento aplica, linha-resumo cabe no ScrollArea
- [X] T037 [P] Smoke de dark mode: rodar dev server, abrir `/books/<id>` em ambos os temas (toggle de tema do app), visualmente conferir que `<ChapterGroupingControl>` e `<ChapterGroupRow>` funcionam — capturar screenshot para anexar à PR (manual)
- [X] T038 Self-review: percorrer o checklist da constituição (princípios I-XVI) listado em `CLAUDE.md` "Self-Review antes de qualquer entrega" — confirmar cada item; documentar exceções na PR description se houver
- [X] T039 Atualizar `CLAUDE.md` se necessário: adicionar entrada em "Recent Changes" descrevendo a feature (1-2 frases); incluir em "Active Technologies" caso uma nova dep tenha sido adicionada (não esperamos nenhuma)
- [X] T040 Rodar `bun run lint` — zero warnings (constituição XVI obriga)
- [X] T041 Rodar `bun run test:unit` — todos verdes; cobertura ≥ 80% no diff
- [X] T042 Rodar `bun run test:integration` — todos verdes (sanity; nenhum teste novo adicionado)
- [X] T043 Rodar `bun run test:e2e` — todos verdes (incluindo os 5+ novos specs)
- [X] T044 Rodar `bun run build` — compila sem erro
- [X] T045 Invocar `/finish-task` para criar PR contra `main` com title `feat(024): ✨ agrupar capítulos por editor/narrador/status com totais` (conventional commit) + body descrevendo escopo, screenshots de ambos os temas, lista de stories cobertas, e referência à spec

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: sem dependência — pode começar imediatamente
- **Phase 2 (Foundational)**: depende de Phase 1; bloqueia todas as user stories
- **Phase 3 (US1)**: depende de Phase 2
- **Phase 4 (US2)**: depende de Phase 3 (US1 já configura todas as colunas)
- **Phase 5 (US3)**: depende de Phase 4
- **Phase 6 (US4)**: depende de Phase 5
- **Phase 7 (US5)**: depende de Phase 6
- **Phase 8 (Polish)**: depende de todas as anteriores

### User Story Dependencies (logical)

- **US1 (P1, Editor)**: depende apenas de Foundational
- **US2 (P1, Narrador)**: compartilha infraestrutura com US1 (T018 configura todas as 3 dimensões); na prática, T022 é principalmente verificação
- **US3 (P2, Status)**: depende de US2 para garantir o pipeline; T025 adiciona o gate de breakdown collapse
- **US4 (P2, Multi-nível)**: depende de US3; o multi-nível é emergente da infra, mas precisa ser exercitado
- **US5 (P3, Flag)**: depende de US2 (precisa de grupo de narrador existindo)

### Within Each User Story

- Tests (TDD) ANTES da implementação — princípio V, não-negociável
- Componentes auxiliares (`ChapterGroupingControl`, `ChapterGroupRow`) podem ir em paralelo dentro de US1 (T016/T017 [P])
- Wiring na tabela (`chapters-table.tsx`) é sequencial por ser o mesmo arquivo
- Cada story só fecha quando E2E correspondente está GREEN

### Parallel Opportunities

**Foundational** (após Setup):
- T003 (feature flag) ∥ T004 (parser test) ∥ T006 (aggregation test) ∥ T008 (formatter test) ∥ T010 (hook test) — tudo arquivos diferentes
- Após RED green-pairs: T005 (parser impl) ∥ T007 (aggregation impl) ∥ T009 (formatter impl) ∥ T011 (hook impl) — arquivos distintos
- T012 (migração) é sequencial e crítica; T013 (extração do hook) pode ser combinada com T012 ou logo após

**US1**:
- T015 (E2E test) ∥ T016 (control) ∥ T017 (group row) — arquivos distintos, podem rodar em paralelo
- T018 (wiring) e T019 (book-detail-client) são sequenciais (último wiring topo-down)

**Polish**:
- T034 ∥ T035 ∥ T036 ∥ T037 — testes/specs independentes
- Final: T040–T044 sequencial (cada um valida o anterior)

---

## Parallel Example: Foundational

```text
# Após Setup, lançar em paralelo:
Task T003: Criar src/lib/config/feature-flags.ts
Task T004: Escrever __tests__/unit/lib/url/parse-grouping-param.spec.ts
Task T006: Escrever __tests__/unit/lib/domain/chapter-aggregation.spec.ts
Task T008: Escrever __tests__/unit/lib/utils/format-grouped-seconds.spec.ts
Task T010: Escrever __tests__/unit/components/features/chapters/hooks/use-chapters-grouping-state.spec.tsx
```

## Parallel Example: User Story 1

```text
# Após Foundational concluir, lançar em paralelo:
Task T015: __tests__/e2e/chapters-grouping-by-editor.spec.ts (RED)
Task T016: chapter-grouping-control.tsx
Task T017: chapter-group-row.tsx

# Depois, sequencial:
Task T018: integrar grouping em chapters-table.tsx
Task T019: integrar control em book-detail-client.tsx
Task T020: rodar E2E (GREEN)
```

---

## Implementation Strategy

### MVP First (User Stories 1 e 2 — ambos P1)

1. **Phase 1** Setup (T001-T002)
2. **Phase 2** Foundational completa (T003-T014) — incluindo migração crítica da `chapters-table` para TanStack Table
3. **Phase 3** US1 — Agrupar por Editor (T015-T020)
4. **STOP e valide**: cenário Story 1 manualmente
5. **Phase 4** US2 — Agrupar por Narrador (T021-T023)
6. **STOP e valide**: cenário Story 2 manualmente
7. **Demo / merge possível como MVP**

### Incremental Delivery (após MVP)

8. Phase 5 US3 (status) → demo
9. Phase 6 US4 (multi-nível) → demo
10. Phase 7 US5 (feature flag) → fechamento
11. Phase 8 Polish → PR

### Parallel Team Strategy

- Dev A (frontend foundations): T003 → T005 → T007 → T009 → T011 (impls após RED)
- Dev B (TDD writer): T004 → T006 → T008 → T010 (todos os RED em paralelo)
- Dev C (TanStack migration): T012 → T013 → T014 (única task crítica)
- Após Foundation: Dev A pega US1+US2, Dev B pega US3+US4, Dev C pega US5+Polish

---

## Notes

- **TDD não é opcional**: princípio V da constituição. Cada par RED/GREEN é uma unidade indivisível.
- **Cobertura**:
  - Agregações financeiras (`computeChapterEarningsCents`, `sumCentsRounded`): 100%
  - Hook `useChaptersGroupingState` e parser: ≥ 80% no diff
  - Componentes apresentacionais: cobertos por E2E
- **Verificação intermediária**: durante fases 1-7, rodar APENAS o arquivo de teste da mudança atual. NÃO rodar a suíte completa de E2E a cada task — isso é ruído desproporcional (constituição XVI).
- **Verificação final (T040-T044)**: única vez que rodamos `lint + unit + integration + e2e + build` por completo.
- **Commits**: usar `/conventional-commits` por checkpoint (após cada `Checkpoint:` marcado acima). Convenção: `feat(024): ✨ ...` para features, `refactor(024): ♻️ ...` para T012, `test(024): ✅ ...` para tests-only commits.
- **Migração T012 deve ir em commit separado** (`refactor(024): ♻️ migrate chapters-table to TanStack Table`) para tornar o diff revisável; agrupamento entra em commits subsequentes.
- **Não criar `_components/` dentro de `src/app/`**: todos os componentes de feature vão em `src/components/features/chapters/` (Princípio VII).
- **Sem `toast.success`**: feedback de sucesso vem da própria UI atualizando (mudança de agrupamento já é visível na tabela).
- **Atenção**: T030 marca a estratégia escolhida (cobrir flag=false via unit test em T031 em vez de E2E) — documentar na PR. Se no futuro quisermos cobrir via E2E, basta adicionar suporte a query param override em test mode.
- **Cobertura derivada após `/speckit-analyze`**: T015 e T021 agora computam totais esperados via `reduce` na fixture (não hardcoded) — fecha SC-003 com força. T015 mede tempo de troca de agrupamento para SC-005. T020 cobre FR-020 (mutação atualiza totais; expansão sobrevive) via sub-cenário no mesmo spec.
