---

description: "Task list for 037-list-row-animations"
---

# Tasks: List Row Enter/Exit Animations (Fase A)

**Input**: Design documents from `/specs/037-list-row-animations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUÍDOS — TDD obrigatório (Princípio V). Testes RED antes da implementação.

**Organization**: Tarefas agrupadas por user story (US1/US2/US3 da spec), espelhando o faseamento A.1→A.4 do plan.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 (entrada), US2 (saída), US3 (reduced-motion/tema)
- Caminhos de arquivo são exatos.

## Path Conventions

Web app single-project (Next.js App Router): código em `src/`, testes em `__tests__/` na raiz.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Estrutura compartilhada e constantes de animação consistentes (FR-009, Princípio IX).

- [X] T001 [P] Criar diretório `src/hooks/` e o módulo de constantes `src/hooks/row-animation.ts` exportando `ROW_ENTER_CLASS` (`animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none`), `ROW_EXIT_CLASS` (`animate-out fade-out-0 slide-out-to-top-2 duration-200 motion-reduce:animate-none`), `ROW_ANIMATION_DURATION_MS = 200` e o tipo `RowState = "entering" | "exiting" | "idle"`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Hook reutilizável `useRowPresence` — pré-requisito de US1 e US2.

**⚠️ CRITICAL**: Nenhuma user story pode começar antes desta fase.

- [X] T002 [P] Escrever teste unit RED de ENTRADA + reduced-motion de `useRowPresence` em `__tests__/unit/hooks/use-row-presence.spec.tsx`: (a) ids do primeiro render NÃO entram em "entering"; (b) id novo em `items` → `rowState==="entering"`; (c) `onRowAnimationEnd(id)` zera para "idle"; (d) com `matchMedia('(prefers-reduced-motion: reduce)')` → entrada é no-op. Mockar `matchMedia`.
- [X] T003 Implementar `useRowPresence` (entrada + detecção de reduced-motion via `matchMedia` em `useEffect`) em `src/hooks/use-row-presence.ts` até passar T002. Retornos imutáveis; `getId` parametrizável (contrato em `contracts/use-row-presence.md`).
- [X] T004 [P] Escrever teste unit RED de SAÍDA (reter-e-adiar) em `__tests__/unit/hooks/use-row-presence.spec.tsx`: (a) após `remove(id, commit)` a linha permanece em `renderItems` com `rowState==="exiting"` e `commit` é chamado; (b) sai de `renderItems` só no `onRowAnimationEnd`; (c) sob reduced-motion a remoção é imediata; (d) posição preservada durante a saída.
- [X] T005 Implementar SAÍDA (reter-e-adiar: `exitingRows`, merge `live + exiting` em `renderItems` preservando posição, drop no `onRowAnimationEnd`, caminho instantâneo sob reduced-motion) em `src/hooks/use-row-presence.ts` até passar T004.
- [X] T006 Refatorar e validar `useRowPresence` (imutabilidade, estabilidade de handlers com `useCallback`, compatibilidade React Compiler) e rodar `bun run test:unit __tests__/unit/hooks/use-row-presence.spec.tsx`.

**Checkpoint**: Hook completo, testado e isolado. US1/US2 podem começar.

---

## Phase 3: User Story 1 - Entrada animada ao adicionar (Priority: P1) 🎯 MVP

**Goal**: A nova linha entra animada nas quatro listas; a carga inicial não anima.

**Independent Test**: Criar um item em cada lista → a nova linha entra com transição; recarregar/navegar → nenhuma linha existente anima.

### Tests for User Story 1 (RED first) ⚠️

- [ ] T007 [P] [US1] Teste unit RED: `narrator-row` aplica `ROW_ENTER_CLASS` + `data-row-state="entering"` quando `isEntering`, e chama `onAnimationEnd` — em `__tests__/unit/components/features/narrators/narrator-row.spec.tsx`.
- [ ] T008 [P] [US1] Teste unit RED: `editor-row` idem em `__tests__/unit/components/features/editors/editor-row.spec.tsx`.
- [ ] T009 [P] [US1] Teste unit RED: `studio-row` idem em `__tests__/unit/components/features/studios/studio-row.spec.tsx`.
- [ ] T010 [P] [US1] Teste unit RED: `chapter-row` idem em `__tests__/unit/components/features/chapters/chapter-row.spec.tsx` (group rows não animam).

### Implementation for User Story 1

- [ ] T011 [US1] Integrar `useRowPresence` (entrada) em `src/components/features/narrators/hooks/use-narrators-list.ts`, expondo `renderItems`, `rowState`, `onRowAnimationEnd`.
- [ ] T012 [US1] `src/components/features/narrators/narrators-table.tsx`: renderizar `renderItems` e passar `rowState`/`onRowAnimationEnd` por linha.
- [ ] T013 [US1] `src/components/features/narrators/narrator-row.tsx`: aplicar `ROW_ENTER_CLASS` + `data-row-state` + `onAnimationEnd` (presentacional, via prop) → passa T007.
- [ ] T014 [US1] Editores: integrar entrada em `src/components/features/editors/hooks/use-editors-list.ts`, `editors-table.tsx` e `editor-row.tsx` → passa T008.
- [ ] T015 [US1] Estúdios: integrar entrada em `src/components/features/studios/hooks/use-studios-list.ts`, `studios-table.tsx` e `studio-row.tsx` → passa T009.
- [ ] T016 [US1] Capítulos: integrar entrada em `src/components/features/books/hooks/use-book-detail.ts`, `src/components/features/chapters/chapters-table.tsx` e `chapter-row.tsx` (sem animar `chapter-group-row.tsx`) → passa T010.
- [ ] T017 [P] [US1] E2E: criar item em cada lista mostra a linha com `data-row-state` ciclando entering→idle; carga inicial não anima — em `__tests__/e2e/list-row-animations.spec.ts`.

**Checkpoint**: Entrada animada funcional nas 4 listas (MVP entregável).

---

## Phase 4: User Story 2 - Saída animada ao remover (Priority: P2)

**Goal**: A linha sai animada antes de desmontar nas quatro listas, incluindo bulk-delete de capítulos; falha faz rollback limpo.

**Independent Test**: Remover um item em cada lista → a linha anima a saída e só então some; bulk-delete de capítulos anima todas; falha de remoção reinsere a linha.

### Tests for User Story 2 (RED first) ⚠️

- [ ] T018 [P] [US2] Adicionar casos unit RED de SAÍDA (`ROW_EXIT_CLASS` + `data-row-state="exiting"`) aos specs de linha: `__tests__/unit/components/features/narrators/narrator-row.spec.tsx`, `.../editors/editor-row.spec.tsx`, `.../studios/studio-row.spec.tsx`, `.../chapters/chapter-row.spec.tsx`.

### Implementation for User Story 2

- [ ] T019 [US2] Converter remoção para reter-e-adiar via `useRowPresence.remove(id, commit)` em `src/components/features/narrators/hooks/use-narrators-list.ts` (DELETE dispara imediato; remoção do array no `animationend`; rollback em erro).
- [ ] T020 [US2] `narrators-table.tsx` + `narrator-row.tsx`: renderizar linhas `exiting` e aplicar `ROW_EXIT_CLASS` → passa o caso narrador de T018.
- [ ] T021 [US2] Editores: reter-e-adiar em `use-editors-list.ts` + `editors-table.tsx` + `editor-row.tsx` → passa o caso editor de T018.
- [ ] T022 [US2] Estúdios: reter-e-adiar em `use-studios-list.ts` + `studios-table.tsx` + `studio-row.tsx` → passa o caso estúdio de T018.
- [ ] T023 [US2] Capítulos (remoção individual): reter-e-adiar em `use-book-detail.ts` (`handleChapterDeleted`) + `chapters-table.tsx` + `chapter-row.tsx` → passa o caso capítulo de T018.
- [ ] T024 [US2] Capítulos (bulk-delete): em `use-book-detail.ts` (`handleBulkDeleteConfirm`), animar a saída de todas as linhas selecionadas antes de removê-las do render.
- [ ] T025 [P] [US2] E2E: remover item em cada lista (linha sai e some); bulk-delete de capítulos anima todas; falha de remoção reinsere a linha — em `__tests__/e2e/list-row-animations.spec.ts`.

**Checkpoint**: Saída animada funcional nas 4 listas + bulk-delete.

---

## Phase 5: User Story 3 - Reduced-motion e tema (Priority: P3)

**Goal**: Sob `prefers-reduced-motion` nada anima; entrada/saída corretas em tema claro/escuro; reordenação permanece neutra.

**Independent Test**: Alternar reduced-motion e tema, repetir criar/remover; reordenar capítulos.

### Tests for User Story 3 (RED first) ⚠️

- [ ] T026 [P] [US3] E2E: com `page.emulateMedia({ reducedMotion: 'reduce' })`, criar e remover é instantâneo (linha aparece/some sem estado "entering"/"exiting" persistente) — em `__tests__/e2e/list-row-animations.spec.ts`.
- [ ] T027 [P] [US3] E2E: reordenar capítulos (botões ↑/↓) NÃO marca linhas como entering/exiting — em `__tests__/e2e/list-row-animations.spec.ts`.

### Implementation for User Story 3

- [ ] T028 [US3] Confirmar `motion-reduce:animate-none` presente nas 4 linhas (via `ROW_ENTER_CLASS`/`ROW_EXIT_CLASS`) e o curto-circuito do hook sob reduced-motion (T003/T005); ajustar se algum caminho animar.
- [ ] T029 [US3] Verificação visual de tema claro/escuro nas 4 listas (quickstart passos 9–10); corrigir qualquer flash de cor (deve usar só opacity/transform, sem cor hardcoded).

**Checkpoint**: Acessibilidade e consistência de tema garantidas.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T030 [P] Revisar consistência de duração/estilo entre as 4 listas (FR-009) e eliminar duplicação residual (tudo via `src/hooks/row-animation.ts`).
- [ ] T031 Code review de conformidade (Princípios IV/VII/VIII/IX/XII) + self-review checklist do CLAUDE.md.
- [ ] T032 Rodar `quickstart.md` ponta a ponta (validação manual das 4 listas).
- [ ] T033 Verificação final (antes do PR): `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`, `bun run build`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup. **BLOQUEIA** US1 e US2.
- **US1 (Phase 3)**: depende da Foundational. MVP.
- **US2 (Phase 4)**: depende da Foundational; toca os mesmos arquivos de tabela/linha de US1, então roda **após** US1 (sequencial, não paralelo entre stories).
- **US3 (Phase 5)**: depende de US1 e US2 (verifica o comportamento agregado).
- **Polish (Phase 6)**: depende de todas as stories desejadas.

### Within Each User Story

- Testes RED antes da implementação (verificar que falham).
- Hook (Foundational) antes da integração nos hooks de lista.
- Hook de lista → tabela → linha (presentacional por último).

### Parallel Opportunities

- T002 e T004 (specs do hook) podem ser escritos em paralelo, mas T003 depende de T002 e T005 de T004.
- US1: T007–T010 (specs de linha) todos [P]; as integrações por lista (T013/T014/T015/T016) são em arquivos distintos e podem ser paralelizadas entre si **após** T011/T012 estabelecerem o padrão narrador.
- US2: T018 [P]; T019–T024 por lista; T025 [P] no fim.

---

## Parallel Example: User Story 1 (tests RED)

```bash
# Escrever em paralelo os specs de linha (arquivos distintos):
Task: "T007 narrator-row.spec.tsx"
Task: "T008 editor-row.spec.tsx"
Task: "T009 studio-row.spec.tsx"
Task: "T010 chapter-row.spec.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) → Phase 2 (Foundational: hook) → Phase 3 (US1 entrada).
2. **PARAR e VALIDAR**: criar item nas 4 listas, confirmar entrada animada e carga inicial sem animação.
3. Entregável como MVP.

### Incremental Delivery

1. Setup + Foundational → hook pronto.
2. US1 (entrada) → validar → demo (MVP).
3. US2 (saída) → validar → demo.
4. US3 (reduced-motion/tema) → validar → demo.

---

## Notes

- [P] = arquivos diferentes, sem dependência pendente.
- US1 e US2 compartilham os arquivos de tabela/linha → tratados sequencialmente (P1 antes de P2).
- Verificar testes RED antes de implementar (Princípio V).
- `chapter-group-row.tsx` (linhas de agrupamento) NÃO anima entrada/saída.
- Sem dependência nova; tudo via `tw-animate-css` + `src/hooks/`.
- Commits: somente sob pedido explícito do usuário (não commitar automaticamente).
