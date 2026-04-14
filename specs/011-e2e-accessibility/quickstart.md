# Quickstart: Verificacao de Acessibilidade nos Testes E2E

## Setup

```bash
# Instalar dependencia
bun add -D @axe-core/playwright

# Rodar testes E2E (inclui acessibilidade)
bun run test:e2e
```

## Uso da utility em novos testes

```typescript
import { test } from '@playwright/test';
import { checkAccessibility } from './helpers/accessibility';

// Pagina autenticada — itera automaticamente 10 combinacoes (2 temas × 5 cores)
test('minha pagina e acessivel', async ({ page }) => {
  await page.goto('/minha-pagina');
  await checkAccessibility(page, 'minha-pagina');
});

// Pagina publica — itera automaticamente 2 temas (light/dark)
test('pagina publica e acessivel', async ({ page }) => {
  await page.goto('/pagina-publica');
  await checkAccessibility(page, 'pagina-publica', { authenticated: false });
});
```

## Desabilitar regra especifica

```typescript
await checkAccessibility(page, 'minha-pagina', {
  disableRules: ['color-contrast'], // Justificativa: componente X de terceiro
});
```

## Verificacao manual de acessibilidade

```bash
# Rodar apenas o test file de acessibilidade
bunx playwright test accessibility.spec.ts

# Ver report HTML
bunx playwright show-report
```