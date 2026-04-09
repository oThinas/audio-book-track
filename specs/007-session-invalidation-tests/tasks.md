# Tasks: Testes de Invalidacao de Sessao

**Input**: Design documents from `/specs/007-session-invalidation-tests/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Organization**: Tasks are grouped by user story. Each story is independently implementable and verifiable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 - Unit tests do route handler clear-session (Priority: P1)

**Goal**: Garantir que o endpoint `/api/auth/clear-session` deleta o cookie de sessao e redireciona para `/login`, incluindo o caso de operacao idempotente (sem cookie existente).

**Independent Test**: `bun run test:unit` — os 3 novos testes em `clear-session.test.ts` passam.

### Implementation for User Story 1

- [x] T001 [US1] Create unit test file for clear-session route handler in `__tests__/unit/api/auth/clear-session.test.ts`
  - Mock `next/headers` → `cookies()` retorna mock cookieStore com `delete` spy
  - Mock `next/navigation` → `redirect()` lanca `NEXT_REDIRECT` (replicar comportamento real do Next.js)
  - Import `GET` de `@/app/api/auth/clear-session/route`
  - Test: `should delete better-auth.session_token cookie` — verifica `mockCookieStore.delete('better-auth.session_token')`
  - Test: `should redirect to /login` — verifica `redirect` chamado com `/login` via `rejects.toThrow('NEXT_REDIRECT')`
  - Test: `should be idempotent when no cookie exists` — `delete` nao lanca erro, `redirect` acontece normalmente

**Checkpoint**: `bun run test:unit` passa com os 3 novos testes. `bun run lint` sem erros.

**Quality Gate**: Run `bun run lint` and `bun run test:unit` — phase CANNOT advance with errors or warnings.

---

## Phase 2: User Story 2 - Unit tests adicionais para proxy edge cases (Priority: P2)

**Goal**: Expandir a cobertura do proxy para rotas aninhadas protegidas, sub-rotas de auth, e rotas de API nao-auth.

**Independent Test**: `bun run test:unit` — os 4 novos testes no proxy passam sem quebrar os 5 existentes.

### Implementation for User Story 2

- [x] T002 [US2] Add edge case tests to existing proxy test file in `__tests__/unit/proxy/proxy.test.ts`
  - Reutilizar `createRequest` e mocks de `getSessionCookie` ja configurados
  - Test: `should redirect unauthenticated user from nested protected route (/dashboard/settings)` → status 307, location `/login`
  - Test: `should allow unauthenticated access to /api/auth/clear-session` → status 200 (sub-rota publica)
  - Test: `should allow authenticated access to nested protected routes` → status 200, sem redirect
  - Test: `should redirect unauthenticated user from protected API route (/api/v1/books)` → status 307, location `/login`
  - Test: `should allow unauthenticated access to exact /api/auth route` → status 200 (rota publica exata, sem sub-rota)

**Checkpoint**: `bun run test:unit` passa com todos os testes (5 existentes + 5 novos = 10 total no proxy). `bun run lint` sem erros.

**Quality Gate**: Run `bun run lint` and `bun run test:unit` — phase CANNOT advance with errors or warnings.

---

## Phase 3: User Story 3 - E2E tests do fluxo de logout (Priority: P3)

**Goal**: Validar o fluxo completo de logout via browser — login, clicar "Sair", verificar redirect e bloqueio de acesso.

**Independent Test**: `bun run test:e2e` — os 3 novos testes em `logout.spec.ts` passam.

### Implementation for User Story 3

- [x] T003 [US3] Create E2E test file for logout flow in `__tests__/e2e/auth/logout.spec.ts`
  - Helper `login(page)`: navega para `/login`, preenche `admin`/`admin123`, clica submit, aguarda sair de `/login`
  - Helper `logout(page)`: localiza o botao de logout via `page.getByTestId('sidebar').getByRole('button').filter({ hasText: /Sair/ })` OU `page.getByTestId('sidebar').locator('button', { has: page.locator('.lucide-log-out') })` (resiliente a sidebar collapsed onde texto nao aparece, mas icone sim). Aguarda redirect para `/login`
  - Test: `should redirect to /login after clicking logout` — login → logout → verifica URL contem `/login`
  - Test: `should not allow access to /dashboard after logout` — apos logout, `page.goto('/dashboard')` → verifica redirect para `/login`
  - Test: `should show functional login form after logout` — apos logout, verifica `#username`, `#password`, `#login-submit` visiveis

**Checkpoint**: `bun run test:e2e` passa com todos os testes (existentes + 3 novos).

**Quality Gate**: Run `bun run test:e2e` — phase CANNOT advance with failures.

---

## Phase 4: Verificacao Final e Polish

**Purpose**: Validacao cruzada de todos os testes e integridade do build.

- [x] T004 Run full unit test suite: `bun run test:unit` — todos passam
- [x] T005 Run full E2E test suite: `bun run test:e2e` — todos passam
- [x] T006 Run lint: `bun run lint` — sem erros ou warnings
- [x] T007 Run build: `bun run build` — build passa (integridade do projeto)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: Sem dependencias — pode iniciar imediatamente
- **Phase 2 (US2)**: Sem dependencias — pode iniciar imediatamente
- **Phase 3 (US3)**: Sem dependencias — pode iniciar imediatamente
- **Phase 4 (Verificacao)**: Depende de todas as fases anteriores

### User Story Dependencies

- **US1 (P1)**: Independente — arquivo novo, sem conflito
- **US2 (P2)**: Independente — modifica arquivo existente, sem conflito com US1/US3
- **US3 (P3)**: Independente — arquivo novo, sem conflito

### Parallel Opportunities

- **T001, T002, T003 podem rodar em paralelo** — cada um opera em arquivo diferente, sem dependencias cruzadas
- T004-T007 sao sequenciais (verificacao final)

---

## Parallel Example

```bash
# Launch all 3 user stories in parallel (different files):
Task T001: "Create clear-session.test.ts in __tests__/unit/api/auth/"
Task T002: "Add edge cases to proxy.test.ts in __tests__/unit/proxy/"
Task T003: "Create logout.spec.ts in __tests__/e2e/auth/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001: Unit tests para clear-session
2. **STOP and VALIDATE**: `bun run test:unit` + `bun run lint`
3. O endpoint mais critico ja tem cobertura

### Incremental Delivery

1. T001 → US1 testavel → checkpoint
2. T002 → US2 testavel → checkpoint
3. T003 → US3 testavel → checkpoint
4. T004-T007 → verificacao final → PR ready

---

## Notes

- Nenhum codigo de producao e alterado nesta feature
- Todos os testes seguem a classificacao da constituicao: unit com mocks, E2E com Playwright
- O mock de `redirect()` DEVE lancar `NEXT_REDIRECT` para replicar o comportamento real
- O seletor E2E do botao de logout deve ser resiliente a sidebar collapsed (usar icone como fallback se texto nao visivel)
- O usuario seed `admin/admin123` deve existir no banco para E2E