---
description: "Task list — Acessibilidade A11y 100 nas páginas autenticadas (D1)"
---

# Tasks: Acessibilidade → A11y 100 nas páginas autenticadas (D1)

**Input**: Design documents from `/specs/041-authenticated-a11y/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/a11y-contracts.md, quickstart.md

**Tests**: TDD é **obrigatório** (constituição). Cada user story tem teste(s) escritos/ancorados
ANTES do fix (RED → GREEN). O RED é ancorado no **discovery-run** (T003).

**Organization**: tarefas agrupadas por user story; cada uma independentemente testável via sua
auditoria específica (Lighthouse) + asserção dirigida.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: US1–US4 (mapeia para as user stories da spec)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: pré-requisitos de código/infra para a verificação a11y.

- [X] T001 [P] Confirmar que `TableHead` em `src/components/ui/table.tsx` repassa `scope` e demais props ao `<th>` (ajustar o spread/forwardRef se não repassar) — pré-requisito do US3. **OK**: `TableHead` já faz `{...props}` no `<th>` (table.tsx:56-67); `scope` passa direto.
- [X] T002 [P] Garantir factory de livro + capítulos em `__tests__/helpers/factories.ts` (`createTestBook`/`createTestChapter`) para semear `/books/:id` na nova spec axe; adicionar se faltar (sem tocar `seed-test.ts`). **OK**: `createTestBook`/`createTestChapter` já existem; a spec axe (T004) usa o seeding E2E via `helpers/seed.ts` (`seedBook`/`seedChapter`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: ancorar o RED do TDD em evidência real e criar a rede axe compartilhada.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [X] T003 Discovery-run: subir DB local, `bun run build && E2E_TEST_MODE=1 bun run start`, `bun run diagnose:seed`, `bun run diagnose:lighthouse`, `bun run diagnose:react`. **FEITO** — registrado em research.md §R6. Baseline **A11y=96** (3 páginas, mobile+desktop). **Achado-chave**: contraste é mais amplo que a hipótese — 5 tokens (`--muted-foreground`→0.50, `--reviewing`/`--retake`→0.50, `--completed`→0.47, `--destructive`→0.46) + componente `paid` (`bg-primary text-primary-foreground`). `--editing` já passa. Combobox ARIA confirmado ×2 pelo react-doctor.
- [X] T004 Criar scaffold `__tests__/e2e/books-accessibility.spec.ts` cobrindo `/books` **e** `/books/:id`, semeando livro+capítulos via `helpers/seed.ts` no `beforeEach` e chamando `checkAccessibility(page, label)` (10 combinações tema×cor). **FEITO**. Rede de regressão compartilhada por US1/US3/US4 (GREEN confirmado na Phase 7).

**Checkpoint**: alvos exatos conhecidos + rede axe de `/books` no lugar (RED).

---

## Phase 3: User Story 1 - Contraste de cor adequado (Priority: P1) 🎯 MVP

**Goal**: `color-contrast` passa nas 3 páginas, nos 2 temas, via token global.

**Independent Test**: `color-contrast` (Lighthouse) passa em dashboard/books/books-detail; axe
sem violação `serious` de contraste nas 10 combinações.

- [X] T005 [US1] Confirmar RED de `color-contrast`: discovery-run (T003) mediu A11y=96 com violações de contraste enumeradas (badges de status + destructive) — evidência em research.md §R6.
- [X] T006 [US1] Ajustar tokens do **tema claro** (`:root`) em `src/app/globals.css` (não alterar `.dark`): `--muted-foreground` 0.556→0.50, `--reviewing`/`--retake` →0.50, `--completed` →0.47, `--destructive` →0.46 (`--editing` mantido). **Escopo ampliado** vs. hipótese (5 tokens) conforme §R6. Verificado por calculador oklch→WCAG (4.96–5.51:1).
- [X] T006b [US1] `src/components/features/books/status-badge.tsx`: `paid` de `bg-primary/15 text-primary` → `bg-primary text-primary-foreground` (token não corrige; `text-primary` reprova nas 5 paletas).
- [ ] T007 [US1] GREEN: código aplicado; verificação completa (Lighthouse `color-contrast` verde + axe nas 10 combinações + demais suítes `*-accessibility` sem regressão) consolidada na **Phase 7** (T021/T022).

**Checkpoint**: contraste resolvido; MVP entregável.

---

## Phase 4: User Story 2 - Combobox com ARIA completo (Priority: P2)

**Goal**: gatilho `role="combobox"` com `aria-haspopup`/`aria-controls`; zero "Role missing
required ARIA props"; sem nova violação axe.

**Independent Test**: `react-doctor --verbose` sem o achado; asserção de DOM confirma atributos
no aberto/fechado; axe sem `aria-valid-attr-value`.

- [ ] T008 [P] [US2] (RED) Asserção de DOM dos atributos ARIA do combobox (estado aberto e fechado) para os diálogos de criar/editar livro — em `__tests__/e2e/` (alvo `book-studio-trigger` / `book-edit-studio-trigger`). Deve falhar hoje (faltam `aria-haspopup`/`aria-controls`).
- [ ] T009 [US2] `src/components/features/books/book-create-dialog.tsx`: `id="book-studio-listbox"` no `PopoverContent`; no `Button` gatilho add `aria-haspopup="listbox"` e `aria-controls={studioPickerOpen ? "book-studio-listbox" : undefined}`.
- [ ] T010 [US2] `src/components/features/books/book-edit-dialog.tsx`: idem com `id="book-edit-studio-listbox"`, atento ao ninho `TooltipTrigger → PopoverTrigger → Button` (sem IDs duplicados nem `aria-*` conflitante).
- [ ] T011 [US2] GREEN: `bun run diagnose:react` → zero "Role missing required ARIA props"; rodar a asserção de T008 (verde) e confirmar axe sem `aria-valid-attr-value` novo; comportamento abrir/selecionar/fechar inalterado.

**Checkpoint**: combobox acessível nos dois diálogos.

---

## Phase 5: User Story 3 - Tabela com células associadas a cabeçalhos (Priority: P3)

**Goal**: `td-has-header` passa em `/books/:id`.

**Independent Test**: `td-has-header` (Lighthouse) passa; asserção dirigida (axe `runOnly:
['td-has-header']` na tabela) sem violação.

- [ ] T012 [US3] (RED) Asserção dirigida `td-has-header` na tabela de capítulos (axe `include` no contêiner da tabela em `/books/:id`), adicionada a `books-accessibility.spec.ts` ou helper. Deve falhar hoje.
- [ ] T013 [US3] `src/components/features/chapters/chapters-table.tsx`: `scope="col"` em todos os `<TableHead>` do cabeçalho; trocar `<TableHead aria-hidden="true" />` da coluna de arraste por header com `<span className="sr-only">Reordenar</span>`.
- [ ] T014 [US3] `src/components/features/chapters/chapter-group-row.tsx`: garantir que as células do resumo ficam associadas aos headers de coluna (alinhamento posicional + `scope`), **mantendo** `role="button"` na linha de grupo.
- [ ] T015 [US3] GREEN: asserção de T012 verde; `td-has-header` do Lighthouse passa no discovery re-run de `/books/:id`.

**Checkpoint**: tabela semanticamente correta.

---

## Phase 6: User Story 4 - Nome acessível contém o texto visível (Priority: P4)

**Goal**: `label-content-name-mismatch` passa em `/dashboard` e `/books/:id`.

**Independent Test**: `label-content-name-mismatch` (Lighthouse) passa; axe sem violação
`serious` nos controles afetados.

- [ ] T016 [P] [US4] (RED) Asserção/axe `label-content-name-mismatch` cobrindo period-filter, book-pdf-popover e linha de grupo. Deve falhar hoje.
- [ ] T017 [P] [US4] `src/components/features/dashboard/period-filter.tsx`: remover `aria-label="Selecionar período customizado"` do `PopoverTrigger` (nome passa a ser `{customLabel}`).
- [ ] T018 [P] [US4] `src/components/features/books/book-pdf-popover.tsx`: remover `aria-label` do `Button` (nome passa a ser "Ver PDF").
- [ ] T019 [US4] `src/components/features/chapters/chapter-group-row.tsx`: remover `aria-label="Expandir/Recolher grupo"` (estado via `aria-expanded`, já presente; `sr-only` interno opcional para o verbo).
- [ ] T020 [US4] Atualizar seletores `getByRole(..., { name })` afetados em e2e/unit (ex.: "Editar URL do PDF", "Selecionar período customizado", "Expandir grupo") e rodar `bun run test:e2e` dos fluxos tocados (livros/dashboard/capítulos). GREEN da asserção de T016.

**Checkpoint**: todos os 4 achados do D1 resolvidos.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: fechar a verificação e o gate de aceitação.

- [ ] T021 `books-accessibility.spec.ts` 100% verde (10 combinações) e demais `*-accessibility.spec.ts` verdes.
- [ ] T022 **Gate de aceitação (Lighthouse)**: re-rodar `bun run diagnose:lighthouse` → **A11y = 100** em `/dashboard`, `/books`, `/books/:id` (mobile **e** desktop); confirmar **sem regressão** de Performance/Boas Práticas/SEO vs. baseline 2026-06.
- [ ] T023 Verificação final (antes do PR): `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`, `bun run build`, `bun run diagnose:react`.
- [ ] T024 [P] (opcional) Revisão a11y dedicada com o agente `ecc:a11y-architect` sobre os componentes tocados.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup; **BLOQUEIA** todas as user stories (T003 crava alvos e valor de token; T004 cria a rede axe).
- **User Stories (Phase 3–6)**: dependem da Phase 2. São independentes entre si e podem ser feitas em qualquer ordem (sugestão: P1 → P2 → P3 → P4).
- **Polish (Phase 7)**: depende de todas as US desejadas.

### User Story Dependencies

- **US1 (P1)**: token global; independente. (MVP)
- **US2 (P2)**: ARIA nos diálogos; independente (arquivos próprios).
- **US3 (P3)**: tabela; independente (depende de T001 — passthrough de `scope`).
- **US4 (P4)**: labels; independente. Fecha a parte de `label` da `books-accessibility.spec.ts`.

> **Nota de acoplamento honesta**: `books-accessibility.spec.ts` (T004, `checkAccessibility`)
> só fica **totalmente** verde após US1 **e** US4 (ambos produzem violações `serious`). O RED/GREEN
> **isolado** de cada story vem das **asserções dirigidas** (T005/T012/T016) e da auditoria
> específica do Lighthouse, preservando a testabilidade independente.

### Coordenação com a Sessão 4 (D4/D5)

`book-create-dialog.tsx`, `book-edit-dialog.tsx` e `chapter-group-row.tsx` também serão tocados
pela Sessão 4. Executar as sessões **sequencialmente** (nunca em branches paralelas) para evitar
rebase. Esta sessão mexe **só** em ARIA/markup/tokens.

### Parallel Opportunities

- Setup: T001, T002 em paralelo.
- US2: T009 e T010 são arquivos diferentes ([P] entre si após T008).
- US4: T017 e T018 em paralelo (arquivos diferentes); T019 depois (mesmo arquivo do US3 T014 → cuidado de sequência).
- Asserções RED (T008, T016) em paralelo dentro de suas stories.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) → Phase 2 (Foundational, inclui discovery-run).
2. Phase 3 (US1 contraste) → **STOP & VALIDATE**: `color-contrast` verde nos 2 temas.
3. Demo do ganho de contraste (maior alcance do D1).

### Incremental Delivery

US1 → US2 → US3 → US4, cada uma testada isoladamente (asserção dirigida + auditoria Lighthouse),
fechando com a Phase 7 (gate de aceitação Lighthouse A11y = 100 + verificação final).

---

## Notes

- TDD: o RED de cada story é ancorado no discovery-run (T003) + asserções dirigidas; confirmar
  falha antes do fix.
- Durante o desenvolvimento, rodar **apenas** os testes da mudança atual (não a suíte inteira);
  a verificação completa é a Phase 7.
- Não há mudança de banco/domínio; nenhuma factory toca `seed-test.ts`.
- Sem `toast.success`; sem HTML cru novo; dark mode preservado (tema escuro inalterado).
- Commit apenas sob pedido explícito do usuário (não auto-commitar por checkpoint).
