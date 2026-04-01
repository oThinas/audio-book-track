# Feature Specification: Test Review & E2E Login

**Feature Branch**: `004-test-review-e2e`
**Created**: 2026-04-01
**Status**: Draft
**Input**: User description: "Revisar testes existentes conforme regras de classificacao definidas na constituicao e adicionar teste E2E do fluxo de login com Playwright"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Revisao de Testes Existentes (Priority: P1)

Como desenvolvedor, quero que todos os testes existentes estejam classificados
corretamente (unit/integration/e2e) conforme as regras definidas na constituicao
do projeto, para que a pirâmide de testes seja confiável e cada suite execute
no ambiente adequado.

**Why this priority**: Testes mal classificados prejudicam a confiabilidade da
suite inteira. Um teste unit que depende de DB real falha em CI sem banco; um
teste E2E que usa mocks não valida o fluxo real. Corrigir isso é pré-requisito
para qualquer novo teste.

**Independent Test**: Executar `bun run test:unit`, `bun run test:integration`
e `bun run test:e2e` separadamente e verificar que cada teste está na suite
correta conforme os critérios da constituição.

**Acceptance Scenarios**:

1. **Given** as regras de classificação definidas no Princípio V da constituição,
   **When** todos os testes são auditados, **Then** cada teste está na pasta
   correta (`__tests__/unit/`, `__tests__/integration/`, `__tests__/e2e/`)
   conforme seus critérios (mocks -> unit, DB real -> integration, browser -> e2e).

2. **Given** um teste que usa `vi.mock()` para isolar dependências,
   **When** esse teste está em `__tests__/integration/` ou `__tests__/e2e/`,
   **Then** ele DEVE ser movido para `__tests__/unit/`.

3. **Given** um teste que apenas lê configurações em memória (sem DB, sem HTTP),
   **When** esse teste está em `__tests__/integration/`,
   **Then** ele DEVE ser movido para `__tests__/unit/`.

4. **Given** todos os testes reclassificados,
   **When** `bun run test:unit` e `bun run test:integration` são executados,
   **Then** todos passam sem erros.

---

### User Story 2 - Teste E2E do Fluxo de Login (Priority: P2)

Como desenvolvedor, quero um teste E2E real com Playwright que valide o fluxo
completo de login no browser (formulário -> autenticação -> redirect ao dashboard),
para garantir que o fluxo crítico do usuário funciona de ponta a ponta.

**Why this priority**: O fluxo de login está completo (formulário, autenticação,
redirect, proteção de rotas). Um teste E2E real com browser valida a integração
entre frontend, backend e banco de dados — algo que testes unit e integration
não cobrem.

**Independent Test**: Executar `bun run test:e2e` com Playwright e verificar que
o teste abre o browser, preenche o formulário de login, submete e verifica
redirect ao dashboard.

**Acceptance Scenarios**:

1. **Given** Playwright configurado no projeto,
   **When** `bun run test:e2e` é executado,
   **Then** os testes E2E rodam com browser real (chromium headless).

2. **Given** um usuário válido no banco (seed),
   **When** o teste preenche username e password no formulário de login e submete,
   **Then** o usuário é redirecionado para `/dashboard`.

3. **Given** credenciais inválidas,
   **When** o teste preenche username e password incorretos e submete,
   **Then** uma mensagem de erro é exibida e o usuário permanece em `/login`.

4. **Given** um usuário não autenticado,
   **When** tenta acessar `/dashboard` diretamente,
   **Then** é redirecionado para `/login`.

---

### Edge Cases

- Login com campos vazios: formulário não submete (validação client-side).
- Rate limiting: após 3 tentativas falhas em 60s, usuário é bloqueado temporariamente.
- Sessão expirada: usuário com sessão expirada é redirecionado ao login.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Todos os testes existentes DEVEM estar classificados conforme as regras
  do Princípio V da constituição (unit: mocks/função pura, integration: DB real,
  e2e: browser real).
- **FR-002**: Playwright DEVE ser configurado como framework de testes E2E do projeto.
- **FR-003**: O teste E2E DEVE validar login com sucesso (credenciais válidas -> redirect
  ao dashboard).
- **FR-004**: O teste E2E DEVE validar login com falha (credenciais inválidas -> mensagem
  de erro).
- **FR-005**: O teste E2E DEVE validar proteção de rota (acesso direto a `/dashboard`
  sem sessão -> redirect ao `/login`).
- **FR-006**: O teste E2E DEVE rodar sem mocks — app real, banco real, auth real.
- **FR-007**: Suites de teste (`test:unit`, `test:integration`, `test:e2e`) DEVEM
  continuar executáveis independentemente.
- **FR-008**: O rate limiting DEVE ser validado via teste de integração — após 3
  tentativas de login em 60s, a 4a tentativa DEVE ser bloqueada pelo servidor.

### Key Entities

- **Test Suite**: Agrupamento de testes por categoria (unit, integration, e2e)
  com critérios de classificação definidos na constituição.
- **Login Flow**: Fluxo completo: formulário -> autenticação -> redirect -> dashboard.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos testes existentes estão na categoria correta conforme as
  regras da constituição.
- **SC-002**: `test:unit` executa apenas testes que não dependem de banco de dados ou
  browser.
- **SC-003**: `test:integration` executa apenas testes que interagem com
  banco de dados real.
- **SC-004**: `test:e2e` executa testes com browser real e todos passam.
- **SC-005**: O fluxo de login completo (formulário -> auth -> dashboard) é validado
  de ponta a ponta em menos de 10 segundos.
- **SC-006**: Todas as 3 suites de teste passam independentemente sem erros.

## Assumptions

- Playwright será instalado como devDependency e configurado para chromium headless.
- O teste E2E usará o usuário seed (`admin` / `admin123`) já existente no banco.
- O teste E2E requer o servidor Next.js rodando (via `webServer` config do Playwright).
- A configuração do Vitest para E2E será substituída pelo Playwright (Vitest fica
  para unit e integration).
- A reclassificação de testes já foi parcialmente feita na sessão anterior (3 testes
  movidos de integration/e2e para unit). Esta feature valida e finaliza o trabalho.