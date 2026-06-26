# Contratos de Acessibilidade (verificáveis) — D1

Contratos de UI/acessibilidade que substituem contratos de API (não há endpoint nesta feature).
Cada contrato é objetivamente verificável por Lighthouse e/ou axe e/ou asserção de DOM.

## C1 — Contraste (US1)

- **Dado** qualquer texto/ícone informativo em `/dashboard`, `/books`, `/books/:id`,
- **Em** tema claro **e** escuro,
- **Então** a razão de contraste com o fundo é **≥ 4.5:1** (texto normal) ou **≥ 3:1** (texto
  grande/UI).
- **Verificação**: Lighthouse `color-contrast` = pass; axe `color-contrast` sem violação
  `serious` nas 10 combinações.

## C2 — Combobox de estúdio (US2)

- **Dado** o gatilho `role="combobox"` nos diálogos de criar/editar livro,
- **Então** ele declara `aria-haspopup="listbox"` e, **quando aberto**, `aria-controls`
  apontando para o `id` do `PopoverContent`; **quando fechado**, `aria-controls` ausente.
- **E** nenhuma nova violação axe surge (`aria-valid-attr-value`, `aria-required-attr`).
- **E** o React Doctor **não** reporta "Role missing required ARIA props".
- **Verificação**: asserção de DOM (atributos no estado aberto/fechado) + `react-doctor
  --verbose` + axe.

## C3 — Tabela de capítulos (US3)

- **Dado** a tabela em `/books/:id`,
- **Então** todo `<th>` do cabeçalho tem `scope="col"`; a coluna de arraste tem header com
  texto `sr-only` (não `aria-hidden`); toda `<td>` de dados está associada a um header.
- **Verificação**: Lighthouse `td-has-header` = pass; asserção dirigida (axe `runOnly:
  ['td-has-header']` no contêiner da tabela, ou assert de estrutura) = sem violação.

## C4 — Nome acessível ↔ texto visível (US4)

- **Dado** controles com texto visível em `/dashboard` e `/books/:id` (period-filter,
  book-pdf-popover, linha de grupo),
- **Então** o nome acessível **contém** o texto visível (alcançado removendo o `aria-label`
  sobrescrito).
- **Verificação**: Lighthouse `label-content-name-mismatch` = pass; axe sem violação `serious`.

## C5 — Não-regressão (todas)

- **Dado** a baseline 2026-06,
- **Então** Performance, Boas Práticas e SEO **não** regridem nas páginas auditadas; e as
  suítes axe existentes (`/settings`, narrators/editors/studios/dashboard) seguem verdes.
- **Verificação**: comparação de scores Lighthouse + `bun run test:e2e` das suítes a11y.

## C6 — Comportamento preservado (todas)

- **Dado** os controles ajustados (combobox, tabela, botões),
- **Então** abrir/selecionar/fechar/reordenar/acionar funcionam como antes.
- **Verificação**: suítes unit/integration/e2e funcionais verdes (com seletores atualizados
  onde o nome acessível mudou).
