# Tasks: Database Health Check

**Input**: Design documents from `/specs/010-db-health-check/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: TDD obrigatório por constituição (Princípio V). Testes escritos ANTES da implementação.

**Organization**: Tasks agrupadas por user story. US1 e US2 compartilham a mesma implementação (caminho feliz e caminho de falha do startup) e são tratadas como uma fase única.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências)
- **[Story]**: User story associada (US1, US2, US3)
- Caminhos exatos de arquivo incluídos nas descrições

---

## Phase 1: Setup

**Purpose**: Não há setup adicional necessário. A estrutura do projeto já existe (`lib/db/`, `app/api/`, `__tests__/`). Exportação do pool é pré-existente em `src/lib/db/index.ts`.

**Checkpoint**: Nenhuma ação necessária — avançar para Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Criar a função core de health check que será usada tanto pelo startup (US1/US2) quanto pelo endpoint (US3).

**CRITICAL**: Nenhuma user story pode começar antes desta fase estar completa.

### Tests for Foundational

> **NOTE: Escrever estes testes PRIMEIRO, garantir que FALHAM antes da implementação**

- [x] T001 Criar testes unitários para `checkDatabaseHealth` com `PingFn` mockada (retry, timeout, categorização de erros) em `__tests__/unit/db/health-check.test.ts`
- [x] T002 Criar testes unitários para `checkDatabaseConnection` com `PingFn` mockada (tentativa única, timeout) em `__tests__/unit/db/health-check.test.ts`
- [x] T003 [P] Criar teste de integração para `createDatabasePing` + `checkDatabaseConnection` com banco real em `__tests__/integration/infra/health-check.test.ts`

### Implementation for Foundational

- [x] T004 Definir type `PingFn` e implementar `checkDatabaseHealth(ping: PingFn, options?)` com retry e timeout em `src/lib/db/health-check.ts`
- [x] T005 Implementar `checkDatabaseConnection(ping: PingFn, timeoutMs?)` (tentativa única) em `src/lib/db/health-check.ts`
- [x] T006 Implementar categorização de erros (ECONNREFUSED, timeout, auth, genérico) sem expor connection string em `src/lib/db/health-check.ts`
- [x] T007 Criar `createDatabasePing(db)` que retorna `PingFn` via `db.execute(sql\`SELECT 1\`)` em `src/lib/db/ping.ts`
- [x] T008 Verificar que todos os testes T001-T003 passam

**Checkpoint**: Função de health check funcional e testada. Testes unitários com PingFn mockada e teste de integração com banco real passando.

**Quality Gate**: `bun run lint` e `bun run test:unit` e `bun run test:integration` e `bun run build` — todos devem passar.

---

## Phase 3: User Story 1+2 — Inicialização segura / Falha rápida (Priority: P1)

**Goal**: A aplicação verifica conectividade com o banco ao iniciar. Se acessível, emite log de confirmação. Se inacessível após 3 tentativas, falha com mensagem clara e exit code 1.

**Independent Test**: Iniciar a aplicação com banco rodando (deve logar sucesso) e com banco parado (deve falhar com mensagem clara em ~6s).

### Tests for User Story 1+2

> **NOTE: Escrever estes testes PRIMEIRO, garantir que FALHAM antes da implementação**

- [x] T009 [US1] Criar teste unitário para `register()` — cenário de sucesso (log de confirmação emitido) em `__tests__/unit/db/instrumentation.test.ts`
- [x] T010 [US2] Criar teste unitário para `register()` — cenário de falha (process.exit(1) chamado, mensagem de erro emitida) em `__tests__/unit/db/instrumentation.test.ts`

### Implementation for User Story 1+2

- [x] T011 [US1] Criar `src/instrumentation.ts` com função `register()` que cria `ping` via `createDatabasePing(db)` e chama `checkDatabaseHealth(ping)`
- [x] T012 [US1] Implementar log de confirmação no caminho de sucesso: `[health-check] Database connection verified successfully`
- [x] T013 [US2] Implementar log de erro e `process.exit(1)` no caminho de falha: `[health-check] Database health check failed after N attempts: <mensagem>`
- [x] T014 [US1] Verificar que todos os testes T009-T010 passam

**Checkpoint**: Aplicação verifica banco na inicialização. Sucesso loga confirmação. Falha encerra o processo com exit code 1 e mensagem clara.

**Quality Gate**: `bun run lint` e `bun run test:unit` e `bun run build` — todos devem passar.

---

## Phase 4: User Story 3 — Endpoint de saúde (Priority: P2)

**Goal**: Endpoint HTTP `GET /api/health` verifica conectividade com o banco em tempo real. Retorna `200` quando saudável, `503` quando não saudável. Sem autenticação, sem informações sensíveis.

**Independent Test**: Chamar `GET /api/health` com banco acessível (200) e com banco inacessível (503).

### Tests for User Story 3

> **NOTE: Escrever estes testes PRIMEIRO, garantir que FALHAM antes da implementação**

- [x] T015 [US3] Criar teste unitário para o route handler — cenário saudável (200, JSON correto) em `__tests__/unit/api/health.test.ts`
- [x] T016 [US3] Criar teste unitário para o route handler — cenário não saudável (503, JSON correto) em `__tests__/unit/api/health.test.ts`
- [x] T017 [US3] Criar teste unitário verificando que a resposta não contém informações sensíveis em `__tests__/unit/api/health.test.ts`

### Implementation for User Story 3

- [x] T018 [US3] Criar `src/app/api/health/route.ts` com handler GET que cria `ping` via `createDatabasePing(db)`, chama `checkDatabaseConnection(ping)` e retorna JSON conforme contrato
- [x] T019 [US3] Adicionar header `Cache-Control: no-store` na resposta do endpoint
- [x] T020 [US3] Verificar que todos os testes T015-T017 passam

**Checkpoint**: Endpoint `/api/health` funcional. Retorna 200/503 com JSON minimalista. Sem informações sensíveis.

**Quality Gate**: `bun run lint` e `bun run test:unit` e `bun run test:integration` e `bun run build` — todos devem passar.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validação final e verificações de qualidade.

- [ ] T021 Executar validação completa do quickstart.md (verificar os 3 cenários: startup ok, startup fail, endpoint)
- [ ] T022 Verificar que nenhuma informação sensível é exposta em logs ou respostas de erro (connection string, credenciais)
- [ ] T023 Verificação final: `bun run lint` + `bun run test:unit` + `bun run test:integration` + `bun run build` sem erros ou warnings

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A — nenhuma ação necessária
- **Foundational (Phase 2)**: Sem dependências externas — pode começar imediatamente. BLOQUEIA todas as user stories
- **US1+US2 (Phase 3)**: Depende de Phase 2 (função `checkDatabaseHealth`)
- **US3 (Phase 4)**: Depende de Phase 2 (função `checkDatabaseConnection`). Independente de Phase 3
- **Polish (Phase 5)**: Depende de Phase 3 e Phase 4

### User Story Dependencies

- **US1+US2 (P1)**: Depende apenas da Phase 2. Sem dependências de US3.
- **US3 (P2)**: Depende apenas da Phase 2. Sem dependências de US1/US2. Pode rodar em paralelo com Phase 3.

### Within Each Phase

- Testes DEVEM ser escritos e FALHAR antes da implementação (TDD)
- Implementação após testes
- Verificação de que todos os testes passam ao final da fase

### Parallel Opportunities

- T001/T002 e T003 podem rodar em paralelo (arquivos separados: unit vs integration)
- T001 e T002 compartilham o mesmo arquivo — executar sequencialmente
- T009 e T010 compartilham o mesmo arquivo de teste — executar sequencialmente
- T015, T016, T017 compartilham o mesmo arquivo de teste — executar sequencialmente
- Phase 3 (US1+US2) e Phase 4 (US3) podem rodar em paralelo após Phase 2

---

## Parallel Example: Foundational

```bash
# Testes foundational em paralelo:
Task: "T001 - Testes unitários para checkDatabaseHealth em __tests__/unit/db/health-check.test.ts"
Task: "T003 - Teste de integração para checkDatabaseConnection em __tests__/integration/infra/health-check.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1+2 Only)

1. Complete Phase 2: Foundational (health-check.ts + testes)
2. Complete Phase 3: US1+US2 (instrumentation.ts)
3. **STOP and VALIDATE**: Testar startup com banco ligado e desligado
4. Deploy/demo se pronto

### Incremental Delivery

1. Phase 2 → Função de health check testada
2. Phase 3 → Startup fail-fast funcional (MVP!)
3. Phase 4 → Endpoint de monitoramento (incremento)
4. Phase 5 → Validação final e polish

---

## Notes

- [P] tasks = arquivos diferentes, sem dependências
- [Story] label mapeia task à user story para rastreabilidade
- US1 e US2 são inseparáveis (sucesso e falha do mesmo código) — tratadas como fase única
- TDD obrigatório: testes falham → implementação → testes passam
- Commitar após cada fase ou grupo lógico de tasks
