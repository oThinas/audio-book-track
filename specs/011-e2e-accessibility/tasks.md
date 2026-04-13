# Tasks: Verificacao de Acessibilidade nos Testes E2E

**Input**: Design documents from `/specs/011-e2e-accessibility/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: TDD obrigatorio (Principio V da constituicao). Unit tests para a utility function sao escritos antes da implementacao. O test file E2E e o proprio deliverable.

**Organization**: Tasks agrupadas por user story para permitir implementacao e teste independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependencias)
- **[Story]**: User story correspondente (US1, US2, US3)
- Caminhos exatos incluidos em cada task

---

## Phase 1: Setup

**Purpose**: Instalar dependencia e preparar infraestrutura basica

- [x] T001 Instalar `@axe-core/playwright` como devDependency via `bun add -D @axe-core/playwright`
- [x] T002 Criar diretorio `__tests__/e2e/helpers/` para utilities reutilizaveis

**Checkpoint**: Dependencia instalada e diretorio helper criado.

**Quality Gate**: `bun run lint` e `bun run build` passando.

---

## Phase 2: Foundational (TDD da Utility Function)

**Purpose**: Criar a utility function `checkAccessibility` seguindo TDD. Esta funcao e prerequisito para todos os user stories.

**CRITICAL**: Nenhum user story pode comecar antes desta fase estar completa.

### Tests (RED)

- [ ] T003 [P] Criar unit test para separacao de violacoes por impacto (blocking vs warnings) em `__tests__/unit/accessibility-helper.test.ts`
- [ ] T004 [P] Criar unit test para formatacao de output legivel de violacoes em `__tests__/unit/accessibility-helper.test.ts`

### Implementation (GREEN)

- [ ] T005 Implementar funcao `checkAccessibility` em `__tests__/e2e/helpers/accessibility.ts` — AxeBuilder com tags WCAG 2.1 AA, iteracao interna sobre combinacoes tema/cor (10 para autenticadas, 2 para publicas), separacao de impacto, formatacao de output, screenshot em caso de violacao. Funcoes auxiliares `setTheme` e `setPrimaryColor` sao internas (nao exportadas).

### Verify (IMPROVE)

- [ ] T006 Rodar `bun run test:unit` — testes de T003/T004 devem passar

**Checkpoint**: Utility function completa, testada e pronta para uso.

**Quality Gate**: `bun run lint`, `bun run test:unit` e `bun run build` passando.

---

## Phase 3: User Story 1 — Deteccao automatica de violacoes (Priority: P1) MVP

**Goal**: Criar test file dedicado que verifica acessibilidade em todas as paginas × combinacoes de tema/cor.

**Independent Test**: Rodar `bun run test:e2e` e verificar que o test file de acessibilidade executa 22 checks (2 login + 10 dashboard + 10 settings), reportando violacoes com detalhes.

### Implementation for User Story 1

- [ ] T007 [US1] Criar `__tests__/e2e/accessibility.spec.ts` com `test.describe` para pagina de login — chama `checkAccessibility(page, 'login', { authenticated: false })` que itera internamente sobre 2 temas
- [ ] T008 [US1] Adicionar `test.describe` para pagina de dashboard em `__tests__/e2e/accessibility.spec.ts` — chama `checkAccessibility(page, 'dashboard')` que itera internamente sobre 10 combinacoes, com login automatico no `beforeEach`
- [ ] T009 [US1] Adicionar `test.describe` para pagina de settings em `__tests__/e2e/accessibility.spec.ts` — chama `checkAccessibility(page, 'settings')` que itera internamente sobre 10 combinacoes, com login automatico no `beforeEach`
- [ ] T010 [US1] Rodar `bun run test:e2e` e capturar relatorio inicial de violacoes existentes (anotar em comentario no PR)
- [ ] T011 [US1] Corrigir violacoes de acessibilidade critical/serious encontradas na pagina de login (HTML, ARIA, contraste)
- [ ] T012 [US1] Corrigir violacoes de acessibilidade critical/serious encontradas na pagina de dashboard (HTML, ARIA, contraste)
- [ ] T013 [US1] Corrigir violacoes de acessibilidade critical/serious encontradas na pagina de settings (HTML, ARIA, contraste)
- [ ] T014 [US1] Para violacoes que nao podem ser corrigidas (componentes de terceiros), desabilitar regra especifica com comentario justificando em `__tests__/e2e/accessibility.spec.ts`

**Checkpoint**: Test file dedicado roda 22 checks em todas as combinacoes. Zero violacoes critical/serious (corrigidas ou justificadas).

**Quality Gate**: `bun run lint`, `bun run test:unit`, `bun run test:e2e` e `bun run build` passando.

---

## Phase 4: User Story 2 — Bloqueio no CI para violacoes criticas (Priority: P2)

**Goal**: Garantir que violacoes critical/serious falham o teste (bloqueando merge de PR), enquanto moderate/minor sao reportadas como warnings sem causar falha.

**Independent Test**: Introduzir violacao critical intencional e verificar que o teste falha. Introduzir violacao moderate e verificar que o teste passa com warning.

### Implementation for User Story 2

- [ ] T015 [US2] Verificar que o comportamento de bloqueio funciona corretamente — violacoes critical/serious causam falha do teste via assertion em `__tests__/e2e/helpers/accessibility.ts`
- [ ] T016 [US2] Verificar que violacoes moderate/minor sao logadas como warnings no console sem causar falha — revisar output em `__tests__/e2e/helpers/accessibility.ts`
- [ ] T017 [US2] Verificar que screenshots sao capturados corretamente em caso de violacao com nome descritivo `a11y-{pagina}-{tema}-{cor}-violation.png`

**Checkpoint**: Comportamento de bloqueio verificado — critical/serious falham, moderate/minor nao.

---

## Phase 5: User Story 3 — Utility reutilizavel (Priority: P3)

**Goal**: Garantir que a utility `checkAccessibility` tem API limpa e pode ser integrada em novos testes E2E com no maximo 2 linhas de codigo.

**Independent Test**: Criar teste E2E minimo que importa e chama `checkAccessibility` em uma pagina — deve funcionar sem configuracao adicional.

### Implementation for User Story 3

- [ ] T018 [US3] Verificar que `checkAccessibility` e exportada corretamente e pode ser importada de `__tests__/e2e/helpers/accessibility.ts` com import simples
- [ ] T019 [US3] Verificar que `disableRules` funciona via parametro optional em `__tests__/e2e/helpers/accessibility.ts`
- [ ] T020 [US3] Verificar que a utility roda automaticamente todas as 10 combinacoes tema/cor quando chamada em teste de pagina autenticada — validar em `__tests__/e2e/accessibility.spec.ts`

**Checkpoint**: Utility reutilizavel com API limpa. Integracao em 2 linhas confirmada.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificacao final de qualidade e limpeza

- [ ] T021 Rodar `bun run lint` — zero erros e warnings
- [ ] T022 Rodar `bun run test:unit` — todos os testes passando
- [ ] T023 Rodar `bun run test:e2e` — todos os 22 checks de acessibilidade passando em todas as combinacoes
- [ ] T024 Rodar `bun run build` — build de producao sem erros
- [ ] T025 Validar quickstart.md executando os comandos documentados em `specs/011-e2e-accessibility/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependencias — pode comecar imediatamente
- **Foundational (Phase 2)**: Depende de Phase 1 — BLOQUEIA todos os user stories
- **US1 (Phase 3)**: Depende de Phase 2 — principal deliverable
- **US2 (Phase 4)**: Depende de Phase 2 — pode rodar em paralelo com US1 (verificacao do comportamento da utility)
- **US3 (Phase 5)**: Depende de Phase 2 — pode rodar em paralelo com US1 (verificacao da API)
- **Polish (Phase 6)**: Depende de todos os user stories completos

### User Story Dependencies

- **US1 (P1)**: Depende de Foundational (Phase 2). Inclui correcao de violacoes existentes.
- **US2 (P2)**: Depende de Foundational (Phase 2). Pode comecar em paralelo com US1.
- **US3 (P3)**: Depende de Foundational (Phase 2). Pode comecar em paralelo com US1.

### Within Each User Story

- Implementacao sequencial dentro de cada US (tasks dependem das anteriores)
- Verificacao apos cada task que produz artefato de codigo

### Parallel Opportunities

- T003 e T004 podem rodar em paralelo (unit tests independentes)
- US2 e US3 podem comecar assim que Foundational terminar, em paralelo com US1
- T021-T024 sao independentes e podem rodar em paralelo

---

## Parallel Example: Foundational Phase

```bash
# Lancar unit tests em paralelo:
Task T003: "Unit test para separacao de violacoes por impacto"
Task T004: "Unit test para formatacao de output"
```

## Parallel Example: Post-Foundational

```bash
# Apos Phase 2, lancar US2 e US3 em paralelo com US1:
US1: T007-T014 (test file + correcao de violacoes)
US2: T015-T017 (verificacao de bloqueio CI)
US3: T018-T020 (verificacao da API da utility)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (instalar dependencia)
2. Completar Phase 2: Foundational (utility + TDD)
3. Completar Phase 3: US1 (test file + correcao de violacoes)
4. **STOP e VALIDAR**: Rodar `bun run test:e2e` — 22 checks devem passar
5. MVP pronto para merge

### Incremental Delivery

1. Setup + Foundational → Utility pronta
2. US1 → Test file funcionando, violacoes corrigidas → MVP
3. US2 → Comportamento de bloqueio verificado → CI enforcement confirmado
4. US3 → API limpa verificada → Reuso facilitado
5. Polish → Qualidade final garantida

---

## Notes

- [P] tasks = arquivos diferentes, sem dependencias
- [Story] label mapeia task para user story especifica
- Tasks T011-T013 (correcao de violacoes) terao escopo definido apos T010 (scan inicial)
- Cada task que produz codigo deve ser seguida de `bun run lint`
- Commits convencionais apos cada task ou grupo logico