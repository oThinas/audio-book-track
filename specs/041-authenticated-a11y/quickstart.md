# Quickstart — Verificação da A11y 100 (D1)

Guia de execução/validação. Não contém implementação — só como provar que a feature funciona.

## Pré-requisitos

- PostgreSQL local em `localhost:5432` (DB de dev) **e** o DB de teste (`audiobook_track_test`,
  via `TEST_DATABASE_URL`) para E2E.
- Dependências instaladas (`bun install`). **Nenhuma dependência nova** nesta feature.

## Passo 0 — Discovery-run (ancora o RED do TDD)

```bash
bun run build && bun run start    # build de produção + servidor (em terminal separado)
bun run diagnose:seed             # sessão de admin + dataset
bun run diagnose:lighthouse       # scores Lighthouse (A11y atual = 96 nas 3 páginas)
bun run diagnose:react            # react-doctor (achados estáticos, incl. ARIA do combobox)
```

Registrar, por página/tema/cor, os elementos exatos que reprovam `color-contrast`,
`label-content-name-mismatch`, `td-has-header`. Essa lista define os testes falhos.

## Passo 1 — TDD (RED → GREEN) por user story

Rodar **apenas** os testes da mudança atual durante o desenvolvimento (não a suíte inteira):

```bash
# US1 contraste + US3 tabela + US4 label (E2E axe — nova spec)
bun run test:e2e -- books-accessibility

# US2 combobox (asserção de DOM/atributos ARIA — unit/e2e do alvo)
bun run test:e2e -- book-create-dialog book-edit-dialog
```

- **RED**: novos testes/asserções falham contra o estado atual.
- **GREEN**: aplicar as correções (token, ARIA, scope/sr-only, remoção de aria-label).

## Passo 2 — Gate de aceitação (Lighthouse)

```bash
bun run diagnose:lighthouse
```

**Esperado**: A11y = **100** em `/dashboard`, `/books`, `/books/:id` (mobile **e** desktop);
sem regressão de Performance/Boas Práticas/SEO. (A queda local de Best Practices por 404 dos
scripts Vercel não afeta A11y.)

## Passo 3 — Verificação final (antes do PR)

```bash
bun run lint
bun run test:unit
bun run test:integration
bun run test:e2e          # inclui as suítes a11y e funcionais (seletores atualizados)
bun run build
bun run diagnose:react    # zero "Role missing required ARIA props"
```

## Critérios de sucesso (resumo)

- Lighthouse A11y = 100 nas 3 páginas (SC-001).
- `react-doctor` sem "Role missing required ARIA props" (SC-002).
- `books-accessibility.spec.ts` + demais `*-accessibility.spec.ts` verdes (SC-003).
- `color-contrast`/`label-content-name-mismatch`/`td-has-header` passam (SC-004).
- Contraste OK nos dois temas (SC-005); sem regressão (SC-006); comportamento preservado
  (SC-007).
