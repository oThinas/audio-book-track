---
description: "Task list for 033-double-click-row-edit"
---

# Tasks: Double-Click Row Edit

**Input**: Design documents from `specs/033-double-click-row-edit/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/double-click-row-edit-interaction.md](./contracts/double-click-row-edit-interaction.md)

**Tests**: INCLUÍDOS — TDD é obrigatório (Constituição Princípio V + skill `/tdd`). Helper puro → cobertura 100%; hook ≥ 80%; foco/abertura reais verificados em E2E.

**Organization**: Tarefas agrupadas por user story (P1 → P2 → P3). O scaffolding compartilhado (helper puro + extensão do hook) fica em Foundational. Remediações `/speckit-analyze` aplicadas: **C1** (skip em `paid` alinhado a `PAID_LOCKED_FIELDS`), **N1** (handlers via hook + extração para ≤ 200 LOC), **G1** (E2E de resíduo de seleção).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências pendentes)
- **[Story]**: US1 / US2 / US3 (apenas nas fases de user story)
- Caminhos de arquivo são relativos à raiz do repositório

## Path Conventions

Single project Next.js. Código em `src/components/features/chapters/`; testes em `__tests__/unit/...` e `__tests__/e2e/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Orientação de escopo. **Nenhuma dependência nova, nenhuma mudança de schema/API** (FR-011).

- [X] T001 Confirmar escopo na branch `033-double-click-row-edit`: feature de apresentação apenas — nenhuma dependência a instalar, nenhuma migration/rota nova. Reconfirmar (a) que `@base-ui/react` `Select.Root`/`Popover.Root` aceitam `defaultOpen` (ver [research.md](./research.md) R1) e (b) o conteúdo de `PAID_LOCKED_FIELDS` em `src/lib/domain/chapter.ts` (`narratorId, editorId, editedSeconds, deadline, title`) — fonte de verdade do skip em `paid` (C1).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infra compartilhada por TODAS as user stories — o helper puro de ativação e a extensão do hook.

**⚠️ CRITICAL**: Nenhuma user story pode começar antes desta fase.

- [X] T002 [P] RED: escrever teste unitário do helper puro em `__tests__/unit/components/features/chapters/chapter-row-activation.spec.ts` — `resolveActivation` retorna a flag única correta para cada um dos 6 campos (`title`→`titleAutoFocus`, `status`→`statusOpen`, `narrator`→`narratorOpen`, `editor`→`editorOpen`, `deadline`→`deadlineOpen`, `editedSeconds`→`editedSecondsAutoFocus`); `null` → todas `false`; campos não-alvo sempre `false`. **C1 — em `paid`**: `title`, `narrator`, `editor`, `deadline`, `editedSeconds` → flag `false` (todos travados por `PAID_LOCKED_FIELDS`); **só `status`** → `true`. Garantir que falha (módulo ainda não existe).
- [X] T003 GREEN: criar o helper puro `src/components/features/chapters/chapter-row-activation.ts` exportando o tipo `ChapterEditField`, a interface `ChapterRowActivation` e a função `resolveActivation(field, chapter)`. O bloqueio de `paid` DEVE ser derivado de `PAID_LOCKED_FIELDS` (importado de `@/lib/domain/chapter`) mapeando `ChapterEditField` → campo travado (`narrator`→`narratorId`, `editor`→`editorId`, demais 1:1; `status` nunca travado), conforme [data-model.md](./data-model.md). Implementar até T002 passar. Cobertura 100%. (depende de T002)
- [X] T004 [P] RED: estender `__tests__/unit/components/features/chapters/use-chapter-row.spec.ts` — `enterEditMode("status")` → `mode="edit"` e `activateField="status"`; `enterEditMode()` (lápis) → `mode="edit"` e `activateField=null`; `exitEditMode()` → `mode="view"` e `activateField=null`; flip de `isSelectionMode` para `true` força `view` e zera `activateField`. **N1** — `getEditTriggerProps(field)` retorna `{ onDoubleClick, onMouseDown }`: `onDoubleClick` chama `enterEditMode(field)`; `onMouseDown` previne seleção nativa apenas quando `event.detail > 1`. Garantir que falha.
- [X] T005 GREEN: estender `src/components/features/chapters/hooks/use-chapter-row.ts` — adicionar estado `activateField: ChapterEditField | null` (importando o tipo de `chapter-row-activation.ts`), mudar a assinatura para `enterEditMode(field?: ChapterEditField)`, limpar `activateField` em `exitEditMode` e ao entrar em modo seleção, e expor `getEditTriggerProps(field)` (memoizado) que devolve `{ onDoubleClick, onMouseDown }` — mantendo a lógica de gatilho/supressão no hook (Princípio VII; remediação N1). Implementar até T004 passar. (depende de T004, T003)

**Checkpoint**: Helper puro + hook prontos — a partir daqui as user stories podem ser implementadas.

---

## Phase 3: User Story 1 - Editar status com um duplo-clique (Priority: P1) 🎯 MVP

**Goal**: Duplo-clique no badge de Status coloca a linha em edição e abre o dropdown de status. Materializa o pipeline completo view→hook→edit-mode→`resolveActivation`→controle.

**Independent Test**: Em uma linha em view, dar duplo-clique na célula de Status → `data-mode="edit"` e o dropdown de status aberto, sem cliques extras.

### Tests for User Story 1 ⚠️ (escrever primeiro, garantir que falham)

- [X] T006 [P] [US1] RED: criar `__tests__/unit/components/features/chapters/chapter-row.spec.tsx` — renderizar `ChapterRow` em view, disparar `doubleClick` na célula de Status e asserir `data-mode="edit"` + que o `ChapterStatusSelect` recebe a abertura ativa (assertar via prop/estado observável em jsdom). Garantir que falha.

### Implementation for User Story 1

- [X] T007 [P] [US1] Adicionar prop opcional `defaultOpen?: boolean` a `src/components/features/chapters/chapter-status-select.tsx`, repassada ao `<Select defaultOpen={...}>`.
- [X] T008 [US1] Em `src/components/features/chapters/chapter-row-edit-mode.tsx`: aceitar a prop `activateField: ChapterEditField | null`, chamar `const activation = resolveActivation(activateField, chapter)` e passar `defaultOpen={activation.statusOpen}` ao `<ChapterStatusSelect>`. (depende de T003, T007)
- [X] T009 [US1] Em `src/components/features/chapters/chapter-row.tsx`: aplicar `{...getEditTriggerProps("status")}` na célula de Status (N1 — handlers vêm do hook) e repassar `activateField` ao `<ChapterRowEditMode>`. (depende de T005, T008)
- [X] T010 [US1] E2E: em `__tests__/e2e/books-detail.spec.ts`, adicionar cenário — duplo-clique no badge de status → linha em `data-mode="edit"` + listbox de status visível; escolher um status válido salva pelo fluxo existente. Documentar a contagem de interações (≤ 2) para SC-001. (depende de T009)

**Checkpoint**: US1 funcional e testável de forma independente (MVP).

---

## Phase 4: User Story 2 - Editar qualquer campo entrando direto no controle (Priority: P2)

**Goal**: Estender o duplo-clique às outras 5 células (Título, Narrador, Editor, Prazo, Horas), ativando o controle correto (dropdown/popover abre; input foca sem selecionar texto).

**Independent Test**: Para cada uma das 5 células, duplo-clique → edição + controle correto ativado.

### Tests for User Story 2 ⚠️

- [X] T011 [P] [US2] RED: estender `__tests__/unit/components/features/chapters/chapter-row.spec.tsx` — duplo-clique em Título/Narrador/Editor/Prazo/Horas leva a `data-mode="edit"` e à ativação correta por célula (flag/estado observável). Garantir que falha para as células ainda não ligadas.

### Implementation for User Story 2

- [X] T012 [P] [US2] Adicionar prop opcional `defaultOpen?: boolean` a `src/components/features/chapters/chapter-deadline-picker.tsx`, repassada ao `<Popover defaultOpen={...}>`.
- [X] T013 [US2] Em `src/components/features/chapters/chapter-row-edit-mode.tsx`: aplicar as flags restantes de `activation` — `autoFocus={activation.titleAutoFocus}` no `<Input>` de título; `defaultOpen={activation.narratorOpen}` e `defaultOpen={activation.editorOpen}` nos `<Select>` de narrador/editor; `defaultOpen={activation.deadlineOpen}` no `<ChapterDeadlinePicker>`; `autoFocus={activation.editedSecondsAutoFocus}` no `<SecondsInput>`. (depende de T012, T008)
- [X] T014 [US2] Em `src/components/features/chapters/chapter-row.tsx`: aplicar `{...getEditTriggerProps(<field>)}` nas células de Título, Narrador, Editor, Prazo e Horas (N1 — handlers vêm do hook). (depende de T009, T013)
- [X] T015 [US2] E2E: estender `__tests__/e2e/books-detail.spec.ts` — duplo-clique em cada uma das 5 células abre o dropdown/popover correto ou foca o input correto, conforme [contracts/double-click-row-edit-interaction.md](./contracts/double-click-row-edit-interaction.md). (depende de T013, T014; sequencial após T010 — mesmo arquivo)
- [X] T016 [US2] E2E (remediação **G1** — FR-007): em `__tests__/e2e/books-detail.spec.ts`, após um duplo-clique em uma célula de dado, asserir que não há resíduo de seleção de texto nativa (`window.getSelection()?.toString()` vazio). (depende de T014; sequencial após T015 — mesmo arquivo)

**Checkpoint**: US1 + US2 funcionais — todas as 6 células ativam o controle correto, sem resíduo de seleção.

---

## Phase 5: User Story 3 - Preservar bloqueio, seleção e acessibilidade (Priority: P3)

**Goal**: Garantir não-regressão das regras existentes. **Sem novo código de produção** — o skip de `paid` (alinhado a `PAID_LOCKED_FIELDS`) já vive em `resolveActivation` (T003) e as células não-dado nunca recebem handler (T009/T014). Esta fase é majoritariamente verificação.

**Independent Test**: Exercitar `paid` (campos travados), modo seleção e o caminho do lápis por teclado.

### Tests / Verification for User Story 3 ⚠️

- [ ] T017 [US3] Estender `__tests__/unit/components/features/chapters/chapter-row.spec.tsx` — duplo-clique nas células de alça de arrastar, checkbox de seleção e coluna de Ações NÃO leva a `data-mode="edit"` (confirma que apenas as 6 células de dado recebem `getEditTriggerProps`). (sequencial — mesmo arquivo de T006/T011)
- [ ] T018 [P] [US3] E2E em `__tests__/e2e/books-detail.spec.ts` (remediação **C1**) — capítulo `paid`: duplo-clique em Título, Narrador, Editor, Prazo e Horas entra em edição mas **não** ativa o controle (sem foco/abertura); duplo-clique em **Status** abre o dropdown (reversão). (sequencial após T016 — mesmo arquivo)
- [ ] T019 [US3] E2E em `__tests__/e2e/books-detail.spec.ts` — em modo de seleção em massa, duplo-clique em qualquer célula é no-op; o botão de lápis continua entrando em edição (sem ativação automática) e permanece acessível por Tab + Enter. (sequencial após T018 — mesmo arquivo)

**Checkpoint**: Todos os guarda-corpos verificados; imutabilidade de `paid` (`PAID_LOCKED_FIELDS`) e acessibilidade preservadas.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Conformidade de tamanho de componente (remediação **N1**), revisão e verificação final (Princípio XVI).

- [ ] T020 [US-none] Remediação **N1**: extrair sub-componentes apresentacionais de `src/components/features/chapters/chapter-row.tsx` (hoje 235 LOC, > limite de 200 — Princípio XII) — ex.: mover a coluna de Ações (botões mover/editar/excluir) para um `chapter-row-actions.tsx` — até o arquivo ficar ≤ 200 LOC. Sem mudança de comportamento; manter todos os testes verdes. (depende de T014)
- [ ] T021 Remediação **N1**: extrair sub-componentes apresentacionais de `src/components/features/chapters/chapter-row-edit-mode.tsx` (hoje 257 LOC, > 200) — ex.: extrair as células de Narrador/Editor (`<Select>` inline) para um `chapter-assignee-select-cell.tsx` compartilhado — até o arquivo ficar ≤ 200 LOC. Sem mudança de comportamento; manter testes verdes. (depende de T013)
- [ ] T022 [P] Rodar `/code-review` e `/simplify` sobre o diff da feature (aderência aos Princípios VII e XII; ausência de `useEffect` imperativo de foco; componentes ≤ 200 LOC após T020/T021).
- [ ] T023 Verificação final (nesta ordem): `bun run lint` (zero erros/warnings) → `bun run test:unit` → `bun run test:integration` → `bun run test:e2e` → `bun run build`. Corrigir antes de avançar.
- [ ] T024 Rodar a validação manual de [quickstart.md](./quickstart.md) (passos 1–9) em modo claro e escuro.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — BLOQUEIA todas as user stories.
- **US1 (Phase 3)**: depende da Foundational. É o MVP.
- **US2 (Phase 4)**: depende da Foundational; reusa o pipeline montado em US1 (edit-mode e chapter-row já recebem `activateField`/`getEditTriggerProps`). Toca os mesmos arquivos de US1 → sequencial após US1.
- **US3 (Phase 5)**: depende de US1 + US2 (verifica comportamento end-to-end). Sem novo código de produção.
- **Polish (Phase 6)**: depois de US1–US3. T020/T021 (extração N1) tocam os arquivos finais → só após T013/T014.

### Within Each User Story

- Testes (RED) antes da implementação (GREEN).
- Helper puro e hook (Foundational) antes de qualquer wiring de componente.
- `chapter-row-edit-mode.tsx` antes de `chapter-row.tsx` no fluxo de cada story.

### Parallel Opportunities

- **Foundational**: T002 [P] e T004 [P] (arquivos de teste diferentes) em paralelo; depois T003 e T005.
- **US1**: T006 [P] (teste) e T007 [P] (prop do status select) em paralelo; depois T008 → T009 → T010.
- **US2**: T011 [P] (teste) e T012 [P] (prop do deadline picker) em paralelo; depois T013 → T014 → T015 → T016.
- **US3**: T018 [P] é paralelo a tarefas de outros arquivos, mas sequencial dentro de `books-detail.spec.ts`.
- **Observação**: tarefas que editam o mesmo arquivo NÃO são paralelas — `chapter-row.spec.tsx` (T006/T011/T017), `chapter-row-edit-mode.tsx` (T008/T013/T021), `chapter-row.tsx` (T009/T014/T020) e `books-detail.spec.ts` (T010/T015/T016/T018/T019) são sequenciais entre si.

---

## Parallel Example: Foundational

```bash
# RED em paralelo (arquivos de teste distintos):
Task: "T002 teste do helper puro em __tests__/unit/components/features/chapters/chapter-row-activation.spec.ts"
Task: "T004 teste do hook em __tests__/unit/components/features/chapters/use-chapter-row.spec.ts"
```

## Parallel Example: User Story 1

```bash
# RED + prop isolada em paralelo:
Task: "T006 teste de componente em __tests__/unit/components/features/chapters/chapter-row.spec.tsx"
Task: "T007 prop defaultOpen em src/components/features/chapters/chapter-status-select.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup.
2. Phase 2: Foundational (helper puro + hook) — CRÍTICO.
3. Phase 3: US1 — duplo-clique no Status abre o dropdown.
4. **PARAR e VALIDAR**: testar US1 isoladamente (unit + E2E de status).

### Incremental Delivery

1. Foundational pronto.
2. US1 → testar → demo (MVP: edição de status acelerada).
3. US2 → testar → demo (todos os 6 campos + sem resíduo de seleção).
4. US3 → verificar guarda-corpos (`paid` via `PAID_LOCKED_FIELDS`, seleção, teclado).
5. Polish → extração N1 (≤ 200 LOC) + verificação final + quickstart.

---

## Notes

- [P] = arquivos diferentes, sem dependências pendentes.
- TDD: confirmar que cada teste falha (RED) antes de implementar (GREEN).
- **C1**: o skip em `paid` deriva de `PAID_LOCKED_FIELDS` (só Status ativa) — não do `disabled` parcial do edit-mode.
- **N1**: handlers de gatilho vêm do hook (`getEditTriggerProps`); T020/T021 trazem os dois componentes para ≤ 200 LOC.
- **G1**: T016 verifica ausência de resíduo de seleção de texto (FR-007).
- US3 não adiciona código de produção — o skip de `paid` é foundational (`resolveActivation`) e as células não-dado nunca recebem handler.
- **Sem dependência nova, sem mudança de schema/API/domínio/cálculo de ganho** (FR-011).
- Commits apenas sob solicitação explícita do usuário (sem auto-commit).
- Verificação completa (lint/build/suítes) só na fase final (T023), não a cada task (Princípio XVI).
