# Implementation Plan: Testes de Invalidacao de Sessao

**Branch**: `007-session-invalidation-tests` | **Date**: 2026-04-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-session-invalidation-tests/spec.md`

## Summary

Adicionar testes para o comportamento de invalidacao de sessao que foi implementado as pressas. Inclui testes unitarios para o route handler `/api/auth/clear-session`, testes unitarios adicionais para o proxy (edge cases de rotas), e testes E2E para o fluxo completo de logout via browser. Nenhum codigo de producao sera alterado.

## Technical Context

**Language/Version**: TypeScript 5.9 (Bun runtime)
**Primary Dependencies**: Next.js 16.2, better-auth 1.5, Vitest, Playwright
**Storage**: PostgreSQL (Neon) via Drizzle ORM (apenas leitura nos testes existentes)
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: Web (Next.js App Router)
**Project Type**: Web application
**Performance Goals**: Unit tests < 50ms cada
**Constraints**: Nenhuma alteracao em codigo de producao
**Scale/Scope**: 3 novos arquivos de teste, 1 arquivo modificado

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Status | Nota |
|---|---|---|
| I. Capitulo como Unidade | N/A | Feature de testes, sem logica de dominio |
| II. Precisao Financeira | N/A | Sem calculos financeiros |
| III. Ciclo de Vida | N/A | Sem transicoes de status |
| IV. YAGNI | PASS | Apenas testes necessarios, sem abstraccoes extras |
| V. TDD | PASS | Testes escritos seguindo classificacao (unit com mocks, E2E com Playwright) |
| VI. Arquitetura Limpa | N/A | Sem codigo de producao |
| VII. Frontend | N/A | Sem componentes novos |
| VIII. Performance | PASS | Unit tests < 50ms |
| IX. Design Tokens | N/A | Sem UI |
| X. API REST | N/A | Sem endpoints novos |
| XI. Banco de Dados | N/A | Sem migrations |
| XII. Anti-Padroes | PASS | Sem anti-padroes (mocks isolados, sem any, sem console.log) |
| XV. Skills Obrigatorias | PASS | Usando /speckit.specify, /speckit.plan, /tdd |
| XVI. Qualidade de Codigo | PASS | bun run lint + bun run test:unit + bun run test:e2e |

**Gate Result**: PASS — nenhuma violacao.

## Project Structure

### Documentation (this feature)

```text
specs/007-session-invalidation-tests/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
__tests__/
├── unit/
│   ├── api/
│   │   └── auth/
│   │       └── clear-session.test.ts   # NOVO: testes do route handler
│   └── proxy/
│       └── proxy.test.ts               # MODIFICADO: novos cenarios
├── e2e/
│   └── auth/
│       └── logout.spec.ts              # NOVO: teste E2E de logout
└── helpers/
    └── factories.ts                    # Existente, sem alteracoes
```

**Structure Decision**: Segue a estrutura existente de testes. Unit tests em `__tests__/unit/` espelhando a hierarquia de `src/`. E2E em `__tests__/e2e/auth/`.

## Implementation Phases

### Phase 1: Unit tests — clear-session route handler (P1)

**Arquivo**: `__tests__/unit/api/auth/clear-session.test.ts`

**Approach**:
- Mock `next/headers` → `cookies()` retorna mock com `delete` spy
- Mock `next/navigation` → `redirect()` lanca `NEXT_REDIRECT` (replica comportamento real)
- Importar `GET` de `@/app/api/auth/clear-session/route`

**Testes**:
1. `should delete better-auth.session_token cookie` — verifica `mockCookieStore.delete` chamado com nome correto
2. `should redirect to /login` — verifica `redirect` chamado com `/login`
3. `should be idempotent when no cookie exists` — mesmo sem cookie, `delete` e chamado e `redirect` acontece (sem erro)

**Validacao**: `bun run test:unit` passa, lint passa.

### Phase 2: Unit tests — proxy edge cases (P2)

**Arquivo**: `__tests__/unit/proxy/proxy.test.ts` (modificar existente)

**Approach**: Adicionar novos `it()` ao `describe` existente, reutilizando `createRequest` e mocks ja configurados.

**Novos testes**:
1. `should redirect unauthenticated user from nested protected route (/dashboard/settings)` → redireciona para `/login`
2. `should allow unauthenticated access to /api/auth/clear-session` → status 200 (sub-rota de `/api/auth/`)
3. `should allow authenticated access to nested protected routes` → status 200
4. `should redirect unauthenticated user from protected API route (/api/v1/books)` → redireciona para `/login`

**Validacao**: `bun run test:unit` passa, lint passa, testes existentes nao quebram.

### Phase 3: E2E tests — logout flow (P3)

**Arquivo**: `__tests__/e2e/auth/logout.spec.ts`

**Approach**: Usar Playwright com login via UI, depois clicar no botao "Sair" e verificar comportamento.

**Testes**:
1. `should redirect to /login after clicking logout` — login → clica "Sair" no sidebar → verifica URL e `/login`
2. `should not allow access to /dashboard after logout` — apos logout, navega para `/dashboard` → verifica redirect para `/login`
3. `should show functional login form after logout` — apos logout, verifica que formulario de login esta visivel

**Seletor do botao de logout**: `page.getByTestId('sidebar').getByRole('button', { name: 'Sair' })`

**Validacao**: `bun run test:e2e` passa.

### Phase 4: Verificacao final

1. `bun run lint` — sem erros ou warnings
2. `bun run test:unit` — todos os testes passam (existentes + novos)
3. `bun run test:e2e` — todos os testes passam (existentes + novos)
4. `bun run build` — build passa (sem codigo de producao alterado, mas verifica integridade)

## Complexity Tracking

Nenhuma violacao de constituicao — tabela nao necessaria.

## Risk Assessment

| Risco | Probabilidade | Impacto | Mitigacao |
|---|---|---|---|
| Mock de `redirect` nao replica comportamento real | Baixa | Medio | Pesquisa confirmou que `redirect` lanca `NEXT_REDIRECT`; mock fiel |
| E2E flaky por timing do logout | Media | Baixo | Usar `waitForURL` com timeout adequado |
| Botao "Sair" sem data-testid | Baixa | Baixo | Seletor via `getByRole('button', { name: 'Sair' })` dentro do sidebar |