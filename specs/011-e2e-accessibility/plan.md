# Implementation Plan: Verificacao de Acessibilidade nos Testes E2E

**Branch**: `011-e2e-accessibility` | **Date**: 2026-04-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/011-e2e-accessibility/spec.md`

## Summary

Integrar `@axe-core/playwright` na suite de testes E2E para verificar automaticamente acessibilidade (contraste, ARIA, roles) em todas as paginas da aplicacao. A verificacao roda em um test file dedicado (`accessibility.spec.ts`) que itera sobre todas as combinacoes de tema (light/dark) e cor primaria (blue/orange/green/red/amber) — 10 combinacoes para paginas autenticadas, 2 para publicas. Violacoes critical/serious falham o teste; moderate/minor sao warnings. Screenshots sao capturados em caso de violacao.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (Bun runtime)
**Primary Dependencies**: Next.js 16.2.1, Playwright 1.59.1, @axe-core/playwright (nova dependencia)
**Storage**: PostgreSQL (apenas para seeding de testes E2E existente — sem alteracoes)
**Testing**: Playwright E2E (test file dedicado) + Vitest (unit test para utility)
**Target Platform**: Web (Chromium — browser unico ja configurado)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: < 2 segundos por combinacao tema/cor por pagina
**Constraints**: Viewport padrao apenas (1280x720); sem dependencias extras de CI
**Scale**: 4 paginas (login, dashboard, settings, root redirect) × 10 combinacoes = ~40 checks para autenticadas + ~8 checks para publicas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Status | Nota |
|-----------|--------|------|
| I. Capitulo como Unidade | N/A | Feature nao altera dominio |
| II. Precisao Financeira | N/A | Feature nao altera calculos |
| III. Ciclo de Vida | N/A | Feature nao altera status |
| IV. YAGNI | PASS | Escopo minimo: 1 test file + 1 utility. Sem abstraccoes premassivas. |
| V. TDD | PASS | Utility function tera unit tests primeiro (TDD). Test file E2E e o proprio deliverable. |
| VI. Arquitetura Limpa | N/A | Feature nao altera backend |
| VII. Frontend | PASS | Feature verifica conformidade de dark mode e componentes UI. Nao cria componentes. |
| VIII. Performance | PASS | < 2s por combinacao. Nao afeta bundle do cliente. |
| IX. Design Tokens | N/A | Feature nao cria tokens visuais |
| X. API REST | N/A | Feature nao cria endpoints |
| XI. PostgreSQL | N/A | Feature nao altera schema |
| XII. Anti-Padroes | PASS | Nenhum `any`, sem hardcoded values, sem swallow de erros |
| XIII. KPIs | N/A | Feature nao altera dashboard |
| XIV. PDF | N/A | Feature nao altera PDF viewer |
| XV. Skills | PASS | Context7 consultado para @axe-core/playwright. TDD e E2E skills serao usados. |
| XVI. Qualidade | PASS | Lint, testes e build devem passar antes de PR |

**Gate result**: PASS — nenhuma violacao.

## Project Structure

### Documentation (this feature)

```text
specs/011-e2e-accessibility/
├── spec.md
├── plan.md              # Este arquivo
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
__tests__/
├── e2e/
│   ├── accessibility.spec.ts      # NOVO — test file dedicado de acessibilidade
│   ├── helpers/
│   │   └── accessibility.ts       # NOVO — utility reutilizavel (checkAccessibility)
│   ├── auth/
│   │   ├── login.test.ts
│   │   └── logout.spec.ts
│   ├── login-styling.spec.ts
│   ├── redirect.spec.ts
│   ├── settings-page.spec.ts
│   ├── settings-preferences.spec.ts
│   ├── sidebar-toggle.spec.ts
│   └── global-setup.ts
└── unit/
    └── accessibility-helper.test.ts   # NOVO — unit test da utility
```

**Structure Decision**: Apenas 2 novos arquivos de teste + 1 utility helper. O test file dedicado vive em `__tests__/e2e/` seguindo a convencao existente. A utility fica em `__tests__/e2e/helpers/` para ser importavel por qualquer teste E2E. Unit test da utility fica em `__tests__/unit/`.

## Design Decisions

### D1. Abordagem de troca de tema/cor (programatica, sem UI)

Para eficiencia, a troca de tema e cor sera feita programaticamente via `page.evaluate()`, sem navegar pela UI de settings. Mecanismo identificado no codebase:

**Tema (light/dark):**
```typescript
await page.evaluate((theme) => {
  localStorage.setItem("theme", theme);
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}, theme);
```

**Cor primaria:**
```typescript
await page.evaluate((color) => {
  document.documentElement.setAttribute("data-primary-color", color);
  localStorage.setItem("primary-color", color);
}, color);
```

Apos cada troca, um `page.waitForTimeout(100)` curto garante que os CSS custom properties sejam aplicados antes do axe-core analisar o DOM.

### D2. Estrutura do test file dedicado

O `accessibility.spec.ts` tera:
- `test.describe` por pagina (login, dashboard, settings)
- Dentro de cada describe, um unico `test()` por pagina que chama `checkAccessibility`
- A iteracao sobre combinacoes tema × cor e feita **internamente pela utility** — o test file nao faz loop manual
- Exemplo: `test('login - WCAG 2.1 AA', ...)` chama `checkAccessibility(page, 'login', { authenticated: false })` que internamente testa light + dark
- Exemplo: `test('settings - WCAG 2.1 AA', ...)` chama `checkAccessibility(page, 'settings')` que internamente testa 10 combinacoes

### D3. Utility function (`checkAccessibility`)

Funcao reutilizavel que encapsula **toda a logica de verificacao**, incluindo iteracao automatica sobre combinacoes de tema e cor:

1. Receber a pagina e um label descritivo
2. Determinar se a pagina e autenticada (`authenticated: true`) ou publica
3. **Iterar internamente** sobre todas as combinacoes aplicaveis:
   - Paginas autenticadas: 10 combinacoes (2 temas × 5 cores)
   - Paginas publicas: 2 combinacoes (light/dark, cor padrao)
4. Para cada combinacao: trocar tema/cor via `page.evaluate()`, configurar `AxeBuilder` com tags WCAG 2.1 AA, executar `.analyze()`
5. Separar violacoes por impacto (blocking vs warnings)
6. Capturar screenshot se houver violacoes
7. Formatar output legivel
8. Assertar que blocking violations (critical/serious) = 0

Assinatura planejada:
```typescript
interface AccessibilityOptions {
  /** Pagina requer autenticacao — itera 10 combinacoes (tema × cor). Default: true */
  authenticated?: boolean;
  /** Regras axe-core a desabilitar (ex: componente de terceiro) */
  disableRules?: string[];
}

async function checkAccessibility(
  page: Page,
  label: string,
  options?: AccessibilityOptions
): Promise<void>;
```

**Uso pelo consumidor (2 linhas)**:
```typescript
await page.goto('/settings');
await checkAccessibility(page, 'settings');
// Internamente itera light/blue, light/orange, ... dark/amber (10 combos)
```

**Uso para pagina publica**:
```typescript
await page.goto('/login');
await checkAccessibility(page, 'login', { authenticated: false });
// Internamente itera light, dark (2 combos)
```

As funcoes auxiliares `setTheme` e `setPrimaryColor` sao **internas** a utility — nao exportadas.

### D4. Screenshot em caso de violacao

Quando `checkAccessibility` detectar violacoes, capturara um screenshot com nome descritivo:
```
test-results/a11y-{pagina}-{tema}-{cor}-violation.png
```
Isso funciona com o Playwright's built-in artifact collection e sera visivel no CI.

### D5. Mecanismo de desabilitar regras

Dois niveis:
1. **Global**: array de rule IDs no topo do test file (ex: regras desabilitadas por componentes de terceiros)
2. **Por teste**: via parametro `disableRules` na utility function

Cada regra desabilitada DEVE ter comentario justificando.

### D6. Correcao de violacoes existentes

SC-005 exige zero violacoes critical/serious apos implementacao. Estrategia:
1. Primeiro: implementar test file e utility
2. Rodar contra codebase atual para mapear violacoes existentes
3. Corrigir violacoes de acessibilidade encontradas (HTML, ARIA attributes, contraste)
4. Se uma violacao nao puder ser corrigida (componente de terceiro), desabilitar regra com justificativa

## Complexity Tracking

Nenhuma violacao de constituicao a justificar.

## Phase 2 Preview (tasks summary)

1. Instalar `@axe-core/playwright` como devDependency
2. Criar utility function `checkAccessibility` em `__tests__/e2e/helpers/accessibility.ts`
3. Criar unit tests para a utility (formatacao de output, separacao de impacto)
4. Criar `accessibility.spec.ts` com cobertura de todas as paginas × combinacoes
5. Rodar testes e mapear violacoes existentes
6. Corrigir violacoes de acessibilidade no codebase (HTML, ARIA, contraste)
7. Verificar: lint, testes, build