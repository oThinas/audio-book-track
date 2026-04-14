# Tasks: Test Doubles Refactor

**Input**: Design documents from `/specs/012-test-doubles-refactor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Refatoração de testes existentes — não há novos testes a escrever, mas os testes refatorados devem continuar passando e mantendo cobertura.

**Organization**: Tarefas agrupadas por user story para implementação e verificação independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências)
- **[Story]**: User story associada (US1, US2, US3)
- Caminhos exatos incluídos nas descrições

---

## Phase 1: Setup (Baseline)

**Purpose**: Registrar estado atual dos testes e cobertura antes de qualquer mudança.

- [x] T001 Executar `bun run test:unit` e registrar que todos os testes passam (baseline)
- [x] T002 Executar `bun run lint` e registrar que não há erros ou warnings (baseline)
- [x] T003 Executar `bun run build` e registrar que o build compila (baseline)

**Checkpoint**: Baseline registrado — qualquer regressão a partir daqui é detectável.

**Quality Gate**: `bun run lint`, `bun run test:unit` e `bun run build` devem estar verdes.

---

## Phase 2: User Story 1 - Testes de service com fakes injetáveis (Priority: P1)

**Goal**: Verificar que todos os testes de services já usam fakes in-memory via construtor, sem `vi.mock()` para módulos internos.

**Independent Test**: Executar `bun run test:unit` e confirmar que `user-preference-service.test.ts` passa sem `vi.mock()` para módulos internos.

**Nota**: O codebase já satisfaz esta user story — `user-preference-service.test.ts` usa `InMemoryUserPreferenceRepository` injetado via construtor. As tarefas abaixo são de verificação, não de implementação.

### Implementation for User Story 1

- [x] T004 [US1] Verificar que `__tests__/unit/user-preference-service.test.ts` não usa `vi.mock()` para módulos internos (apenas `InMemoryUserPreferenceRepository` injetado)
- [x] T005 [US1] Verificar que `__tests__/repositories/in-memory-user-preference-repository.ts` implementa a interface `UserPreferenceRepository` de `src/lib/domain/user-preference-repository.ts`
- [x] T006 [US1] Verificar que para cada interface de repository no domínio (`src/lib/domain/`) existe um fake correspondente em `__tests__/repositories/`

**Checkpoint**: US1 validada — padrão de fakes in-memory para services confirmado como existente e funcional.

**Quality Gate**: `bun run test:unit` — todos os testes de services passam.

---

## Phase 3: User Story 2 - Testes de módulos internos com fakes de função (Priority: P2)

**Goal**: Eliminar `vi.mock()` de `health.test.ts` e `instrumentation.test.ts` para módulos internos (`@/lib/db/ping`, `@/lib/db/health-check`) refatorando os módulos de produção para aceitar dependências como parâmetro.

**Independent Test**: Executar `bun run test:unit` e confirmar que `health.test.ts` e `instrumentation.test.ts` passam sem `vi.mock()` para módulos internos do projeto.

### Implementation for User Story 2 — health API route

- [x] T007 [US2] Ler módulo de produção testado por `__tests__/unit/api/health.test.ts` (route handler em `src/app/api/health/route.ts`) e entender como importa `createDatabasePing` e `checkDatabaseConnection`
- [x] T008 [US2] Extrair lógica do route handler de health em função testável que aceita dependências como parâmetro (ex: `createHealthHandler(deps)`) em `src/app/api/health/route.ts`
- [x] T009 [US2] Garantir que o route handler original chama a função extraída com as dependências concretas — comportamento de produção inalterado
- [x] T010 [US2] Refatorar `__tests__/unit/api/health.test.ts`: remover `vi.mock("@/lib/db/ping")` e `vi.mock("@/lib/db/health-check")`, substituir por fakes injetados via `vi.fn()`
- [x] T011 [US2] Executar `bun run test:unit` e `bun run lint` — verificar que health tests passam e lint está limpo

### Implementation for User Story 2 — instrumentation

- [x] T012 [US2] Ler `__tests__/unit/db/instrumentation.test.ts` para identificar o módulo de produção importado (provável `src/lib/db/instrumentation.ts` ou `src/instrumentation.ts`), confirmar path real e entender como importa `createDatabasePing` e `checkDatabaseHealth`
- [x] T013 [US2] Extrair lógica do módulo de instrumentação em função testável que aceita dependências como parâmetro
- [x] T014 [US2] Garantir que o módulo de instrumentação original chama a função extraída com as dependências concretas — comportamento de produção inalterado
- [x] T015 [US2] Refatorar `__tests__/unit/db/instrumentation.test.ts`: remover `vi.mock("@/lib/db/ping")` e `vi.mock("@/lib/db/health-check")`, substituir por fakes injetados via `vi.fn()`
- [x] T016 [US2] Executar `bun run test:unit` e `bun run lint` — verificar que instrumentation tests passam e lint está limpo

**Checkpoint**: US2 completa — ambos os arquivos de teste refatorados sem `vi.mock()` para módulos internos.

**Quality Gate**: `bun run lint`, `bun run test:unit` e `bun run build` — todos devem passar sem erros ou warnings.

---

## Phase 4: User Story 3 - Allowlist e convenção documentada (Priority: P3)

**Goal**: Confirmar que todo `vi.mock()` restante referencia apenas módulos da allowlist e documentar a convenção de test doubles no CLAUDE.md.

**Independent Test**: Executar grep para verificar que nenhum `vi.mock()` restante referencia módulo interno fora da allowlist; ler convenção documentada e confirmar que é clara.

### Implementation for User Story 3

- [x] T017 [US3] Verificar que `__tests__/unit/setup.ts` contém apenas mocks da allowlist (`@/lib/db`, `@/lib/env`)
- [x] T018 [US3] Executar verificação automatizada (grep) em `__tests__/unit/` para confirmar que todo `vi.mock()` restante referencia apenas módulos da allowlist: `next/headers`, `next/navigation`, `@axe-core/playwright`, `better-auth/cookies`, `@/lib/env`, `@/lib/db`
- [x] T019 [US3] Adicionar seção de convenção de test doubles no `CLAUDE.md`, na área de classificação de testes, documentando: (a) quando usar fakes manuais, (b) quando `vi.mock()` é aceitável (allowlist), (c) `vi.fn()` é livre para fakes tipados, (d) referência aos modelos existentes no codebase, (e) atualizar árvore de decisão rápida para incluir fakes injetados como critério de unit test: "O teste usa vi.mock(), fakes injetados ou testa função pura? → Unit"
- [x] T020 [US3] Executar `bun run lint` — verificar que CLAUDE.md não introduz erros

**Checkpoint**: US3 completa — allowlist verificada e convenção documentada.

**Quality Gate**: `bun run lint` — sem erros ou warnings.

---

## Phase 5: Polish & Verificação Final

**Purpose**: Garantir integridade completa do codebase após todas as mudanças.

- [x] T021 Executar `bun run test:unit` — todos os testes unitários passam
- [x] T022 Executar `bun run test:integration` — testes de integração não foram afetados
- [x] T023 Executar `bun run build` — build de produção compila sem erros
- [x] T024 Confirmar com grep que nenhum `vi.mock()` em `__tests__/unit/` referencia módulo interno fora da allowlist
- [x] T025 Comparar cobertura de testes com baseline (T001) — cobertura >= nível pré-refatoração

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — início imediato
- **US1 (Phase 2)**: Depende de Setup — apenas verificação, sem código
- **US2 (Phase 3)**: Depende de Setup — trabalho principal de refatoração
- **US3 (Phase 4)**: Depende de US2 (para que grep reflita estado final)
- **Polish (Phase 5)**: Depende de US2 e US3

### User Story Dependencies

- **US1 (P1)**: Independente — já satisfeita, apenas verificação
- **US2 (P2)**: Independente de US1 — pode iniciar após baseline
- **US3 (P3)**: Depende de US2 — a verificação de allowlist precisa que as refatorações estejam completas

### Within User Story 2

- T007 → T008 → T009 → T010 → T011 (health API: ler → extrair → preservar default → refatorar teste → verificar)
- T012 → T013 → T014 → T015 → T016 (instrumentation: ler → extrair → preservar default → refatorar teste → verificar)
- Os dois grupos (health + instrumentation) podem rodar em paralelo entre si

### Parallel Opportunities

- T001, T002, T003 podem rodar em paralelo (Phase 1)
- T004, T005, T006 podem rodar em paralelo (Phase 2)
- Health (T007-T011) e Instrumentation (T012-T016) podem rodar em paralelo (Phase 3)
- T017, T018 podem rodar em paralelo; T019 depende de T018 confirmar allowlist (Phase 4)
- T021, T022, T023 podem rodar em paralelo (Phase 5)

---

## Parallel Example: User Story 2

```bash
# Dois grupos podem rodar em paralelo:

# Grupo A: Health API route
Task: "Ler módulo de produção testado por health.test.ts"
Task: "Extrair lógica do route handler em função testável"
Task: "Refatorar health.test.ts para usar fakes injetados"

# Grupo B: Instrumentation module
Task: "Ler módulo de produção testado por instrumentation.test.ts"
Task: "Extrair lógica do módulo de instrumentação"
Task: "Refatorar instrumentation.test.ts para usar fakes injetados"
```

---

## Implementation Strategy

### MVP First (User Story 2 — Health API)

1. Completar Phase 1: Baseline
2. Completar Phase 2: Verificar US1 (sem código)
3. Completar Phase 3, Grupo A: Refatorar health API (T007-T011)
4. **STOP and VALIDATE**: `bun run test:unit` passa, health.test.ts sem `vi.mock()` de internos
5. Continuar com Grupo B: Refatorar instrumentation (T012-T016)

### Incremental Delivery

1. Baseline → US1 verificada → Foundation ready
2. Health API refatorada → Test independently → Partial MVP
3. Instrumentation refatorada → Test independently → US2 complete
4. Convenção documentada → US3 complete
5. Verificação final → Feature complete

---

## Notes

- Esta refatoração tem escopo pequeno: 2 arquivos de teste + 2 módulos de produção + 1 documentação
- US1 já está satisfeita — o padrão existe no codebase desde features anteriores
- O modelo a seguir para fakes de função é `__tests__/unit/db/health-check.test.ts`
- O modelo a seguir para fakes de repository é `__tests__/unit/user-preference-service.test.ts`
- `vi.fn()` é permitido para criar fakes tipados — não precisa de classes hand-written para funções simples
- Commitar após cada checkpoint de fase