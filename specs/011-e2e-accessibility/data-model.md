# Data Model: Verificacao de Acessibilidade nos Testes E2E

Esta feature nao altera o modelo de dados da aplicacao. Nao ha novas entidades, campos, relacionamentos ou migracoes de banco de dados.

## Entidades impactadas

Nenhuma.

## Novos artefatos de teste

| Artefato | Tipo | Descricao |
|----------|------|-----------|
| `__tests__/e2e/helpers/accessibility.ts` | Utility | Funcao `checkAccessibility` reutilizavel |
| `__tests__/e2e/accessibility.spec.ts` | Test file | Test file dedicado de acessibilidade |
| `__tests__/unit/accessibility-helper.test.ts` | Unit test | Testes unitarios da utility |

## Tipos relevantes (somente leitura, do axe-core)

A utility function consome tipos do `@axe-core/playwright`:

- `AxeResults` — resultado completo do `analyze()`
- `Result` — uma violacao individual (id, impact, description, helpUrl, nodes)
- `NodeResult` — um elemento afetado (target, html, failureSummary)

Estes tipos sao importados da biblioteca, nao criados pelo projeto.