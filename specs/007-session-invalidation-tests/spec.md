# Feature Specification: Testes de Invalidacao de Sessao

**Feature Branch**: `007-session-invalidation-tests`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: User description: "quero adicionar testes para o comportamento de invalidar a sessao. essa parte do codigo foi feito nas pressas e implementado apenas para contornar um problema de nao conseguir acessar a pagina e prosseguir com os testes de outras funcionalidades."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Teste unitario do route handler clear-session (Priority: P1)

Como desenvolvedor, preciso de testes unitarios para o endpoint `/api/auth/clear-session` que foi implementado as pressas, garantindo que ele deleta corretamente o cookie de sessao e redireciona para `/login`.

**Why this priority**: Este endpoint e o ponto central da invalidacao de sessao. Sem testes, qualquer refatoracao futura pode quebrar o fluxo de logout/sessao invalida sem deteccao.

**Independent Test**: Pode ser testado isoladamente mockando `cookies()` e `redirect()` do Next.js e verificando que o cookie correto e deletado e o redirect acontece.

**Acceptance Scenarios**:

1. **Given** um request GET para `/api/auth/clear-session`, **When** o handler e executado, **Then** o cookie `better-auth.session_token` deve ser deletado do cookieStore.
2. **Given** um request GET para `/api/auth/clear-session`, **When** o handler e executado, **Then** deve redirecionar para `/login`.
3. **Given** um request GET para `/api/auth/clear-session` quando nao ha cookie de sessao, **When** o handler e executado, **Then** ainda deve chamar delete no cookie e redirecionar para `/login` (operacao idempotente).

---

### User Story 2 - Testes unitarios adicionais para o proxy/middleware (Priority: P2)

Como desenvolvedor, preciso de testes unitarios adicionais para o proxy cobrindo cenarios de edge case como rotas aninhadas protegidas, sub-rotas de auth, e rotas de API nao-auth.

**Why this priority**: O proxy ja tem testes basicos, mas faltam cenarios de borda que podem causar falhas silenciosas em producao.

**Independent Test**: Pode ser testado isoladamente com mocks de `getSessionCookie`, verificando respostas para diferentes combinacoes de rota e estado de autenticacao.

**Acceptance Scenarios**:

1. **Given** usuario nao autenticado acessando rota protegida aninhada (ex: `/dashboard/settings`), **When** o proxy processa, **Then** deve redirecionar para `/login`.
2. **Given** usuario nao autenticado acessando `/api/auth/clear-session`, **When** o proxy processa, **Then** deve permitir acesso (rota publica sob `/api/auth/`).
3. **Given** usuario autenticado acessando qualquer rota protegida aninhada, **When** o proxy processa, **Then** deve permitir acesso sem redirecionamento.
4. **Given** usuario nao autenticado acessando `/api/v1/books`, **When** o proxy processa, **Then** deve redirecionar para `/login` (rota de API protegida, nao sob `/api/auth/`).

---

### User Story 3 - Teste E2E do fluxo de logout e sessao invalida (Priority: P3)

Como desenvolvedor, preciso de testes E2E que validem o fluxo completo de logout pelo browser — clicar no botao, sessao ser invalidada no servidor, e usuario ser redirecionado para login.

**Why this priority**: Garante que o fluxo ponta-a-ponta funciona como esperado do ponto de vista do usuario real.

**Independent Test**: Pode ser testado com Playwright fazendo login, executando logout, e verificando que o usuario e redirecionado e nao consegue acessar rotas protegidas apos logout.

**Acceptance Scenarios**:

1. **Given** usuario autenticado na aplicacao, **When** clica no botao de logout na sidebar, **Then** deve ser redirecionado para `/login`.
2. **Given** usuario que acabou de fazer logout, **When** tenta acessar `/dashboard` diretamente, **Then** deve ser redirecionado para `/login`.
3. **Given** usuario que acabou de fazer logout, **When** acessa a pagina de login, **Then** o formulario de login deve estar visivel e funcional.

---

### Edge Cases

- O que acontece quando `clear-session` e chamado sem cookie existente? (deve ser idempotente — nao deve lancar erro)
- O que acontece quando o proxy recebe a rota exata `/api/auth` (sem sub-rota)? (deve ser publica)
- O que acontece quando usuario nao autenticado tenta acessar rotas de API protegidas como `/api/v1/*`? (deve redirecionar para `/login`)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sistema DEVE ter testes unitarios para o route handler `GET /api/auth/clear-session` cobrindo delecao de cookie e redirect.
- **FR-002**: Sistema DEVE ter testes unitarios para o proxy cobrindo rotas aninhadas protegidas e sub-rotas de `/api/auth/`.
- **FR-003**: Sistema DEVE ter testes unitarios para o proxy cobrindo rotas de API protegidas (ex: `/api/v1/*`) vs rotas de auth publicas.
- **FR-004**: Sistema DEVE ter testes E2E cobrindo o fluxo completo de logout via browser.
- **FR-005**: Sistema DEVE ter testes E2E cobrindo tentativa de acesso a rota protegida apos logout.
- **FR-006**: Todos os testes devem seguir a classificacao definida na constituicao: unit tests com mocks, E2E com Playwright.
- **FR-007**: Nenhum teste deve depender de estado compartilhado com outros testes (isolamento total).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos cenarios de aceitacao listados acima tem testes correspondentes que passam.
- **SC-002**: Os novos testes passam em `bun run test:unit` e `bun run test:e2e` sem falhas.
- **SC-003**: Nenhum teste existente quebra apos as adicoes.
- **SC-004**: O endpoint `clear-session` tem cobertura de teste para todos os seus caminhos de execucao (happy path e edge case sem cookie).
- **SC-005**: O proxy tem cobertura de teste para pelo menos 8 combinacoes de rota/autenticacao (5 existentes + 4 novos).

## Assumptions

- A infraestrutura de teste existente (Vitest para unit, Playwright para E2E) sera reutilizada sem modificacoes.
- O test helper `createTestSession` e factories existentes serao suficientes para os novos testes de integracao, se necessarios.
- O endpoint `clear-session` nao sera refatorado nesta feature — apenas testado como esta.
- Os testes E2E rodam contra a aplicacao com o usuario seed `admin/admin123` ja existente.
- O comportamento do `redirect()` do Next.js em testes unitarios lanca um erro interno (`NEXT_REDIRECT`) que pode ser capturado e validado.
- O `cookies()` do Next.js pode ser mockado para testar o comportamento de delecao do cookie.