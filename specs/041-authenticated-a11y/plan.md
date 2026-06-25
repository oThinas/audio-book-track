# Implementation Plan: Acessibilidade → A11y 100 nas páginas autenticadas (D1)

**Branch**: `041-authenticated-a11y` | **Date**: 2026-06-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/041-authenticated-a11y/spec.md`

## Summary

Elevar o score de A11y do Lighthouse de **96 → 100** em `/dashboard`, `/books` e `/books/:id`
corrigindo quatro classes de achado (contraste, ARIA de combobox, associação célula↔cabeçalho,
nome acessível ↔ texto visível), **sem** tocar banco/schema/domínio. Abordagem decidida no
grill (ver §"Decisões resolvidas" da spec):

- **Contraste:** ajustar o token **global** `--muted-foreground` apenas no **tema claro**.
- **Combobox:** `aria-haspopup="listbox"` + `aria-controls` vinculado **só quando aberto**,
  in-place nos dois diálogos.
- **Tabela:** `scope="col"` em todos os `<th>` + header `sr-only` na coluna de arraste,
  mantendo `role="button"` da linha de grupo.
- **Label:** remover `aria-label` sobrescrito, deixando o texto visível ser o nome.

Verificação em duas camadas: **Lighthouse = gate de aceitação** (manual local) e **axe
ampliado + asserções dirigidas = driver de TDD/CI**, com **discovery-run** como primeira task.

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Bun 1.2 (runtime + package manager + test runner)

**Primary Dependencies**: Next.js 16.2.1 (App Router), React 19.2.4, shadcn/ui (Popover,
Command/cmdk, Table, Button, Tooltip), Tailwind CSS 4.2 (`sr-only`, tokens OKLCH),
`@tanstack/react-table` (agrupamento), `@axe-core/playwright` + `axe-core` (verificação a11y),
`react-doctor` (scan estático), Lighthouse 13 (`scripts/diagnostics/*`). **Nenhuma dependência
nova.**

**Storage**: N/A — sem mudança de schema, repositório, service ou modelo de domínio.

**Testing**: Playwright (E2E + axe), Vitest (unit). TDD: RED ancorado no discovery-run.

**Target Platform**: navegadores (Chromium/Firefox/WebKit via Playwright); mobile + desktop.

**Project Type**: web app (Next.js App Router) — feature puramente de apresentação/a11y.

**Performance Goals**: A11y Lighthouse = 100 nas três páginas (mobile+desktop); **zero**
regressão em Performance/Boas Práticas/SEO vs. baseline 2026-06.

**Constraints**: WCAG 2.1 AA (contraste ≥ 4.5:1 normal / ≥ 3:1 grande/UI); funcionar nos
**dois temas** (claro/escuro) e nas 5 cores primárias (helper axe itera 10 combinações);
preservar comportamento dos controles; não introduzir nova violação axe.

**Scale/Scope**: 3 páginas auditadas; ~7 arquivos de componente/estilo + 1 spec E2E nova.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| I. Capítulo como unidade central | Sem lógica de domínio; só UI/a11y | ✅ N/A |
| II. Cálculos financeiros determinísticos | Não tocado | ✅ N/A |
| III. Transições de status | Não tocado | ✅ N/A |
| IV. Complexidade justificada | Mudanças mínimas e cirúrgicas; sem nova abstração/dep | ✅ |
| V. TDD ≥ 80% | RED no discovery-run → asserções dirigidas + nova spec axe antes do fix | ✅ |
| VI. Lógica no Service/Domain | Nenhuma lógica nova; apenas markup/tokens | ✅ N/A |
| VII. Componentes client só renderizam; lógica em hooks | Mudanças são **markup/ARIA/atributos** no JSX (apresentação pura); `aria-controls` usa estado visual já existente (`studioPickerOpen`); **nenhum** novo `useState`/efeito/fetch | ✅ |
| VII. shadcn/ui, sem HTML cru, PageContainer | Usa primitivos existentes; sem HTML cru novo | ✅ |
| VII. Dark mode | Contraste validado nos dois temas (escuro inalterado) | ✅ |
| VIII. Bundle do cliente | Sem nova dependência; impacto ~zero | ✅ |
| IX. Design tokens (sem hardcode) | Contraste via token global `--muted-foreground` | ✅ |
| X. Endpoints REST | Não há endpoint novo | ✅ N/A |
| XI. Banco/SQL | Nenhuma query/coluna | ✅ N/A |
| XII. Anti-padrões proibidos | Nenhum introduzido | ✅ |
| XV. Context7 + design.pen | Context7 consultado (shadcn Combobox ARIA); design.pen não aplicável (sem tela nova) | ✅ |

**Resultado: PASS.** Sem violações → sem Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/041-authenticated-a11y/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões + Context7 + matemática de contraste
├── data-model.md        # Phase 1 — sem entidades; tokens + matriz de achados
├── quickstart.md        # Phase 1 — guia de verificação (Lighthouse + axe)
├── contracts/
│   └── a11y-contracts.md # Phase 1 — contratos verificáveis (ARIA/contraste/tabela/label)
└── checklists/
    └── requirements.md   # (já existente, do /speckit-specify)
```

### Source Code (repository root)

Arquivos tocados (apresentação/estilo/teste — nenhum de domínio/persistência):

```text
src/
├── app/
│   └── globals.css                                   # US1: token --muted-foreground (tema claro)
├── components/
│   ├── features/
│   │   ├── books/
│   │   │   ├── book-create-dialog.tsx                # US2: aria-haspopup + aria-controls
│   │   │   ├── book-edit-dialog.tsx                  # US2: idem (com ninho tooltip+popover)
│   │   │   └── book-pdf-popover.tsx                  # US4: remover aria-label sobrescrito
│   │   ├── chapters/
│   │   │   ├── chapters-table.tsx                    # US3: scope="col" + header sr-only (arraste)
│   │   │   └── chapter-group-row.tsx                 # US3/US4: td/header + remover aria-label
│   │   └── dashboard/
│   │       └── period-filter.tsx                     # US4: remover aria-label sobrescrito
│   └── ui/
│       └── table.tsx                                 # US3: confirmar passthrough de `scope` no TableHead

__tests__/e2e/
├── books-accessibility.spec.ts                       # NOVO: axe /books e /books/:id (10 combos)
├── helpers/accessibility.ts                          # reuso; possível helper de asserção dirigida
└── (specs *-accessibility.spec.ts existentes)        # reverificar verdes pós token global
```

**Structure Decision**: app Next.js single-project existente; a feature adiciona apenas um
arquivo de teste E2E novo e edita componentes/estilos. Componentes de feature permanecem em
`src/components/features/<feature>/` (constituição). Sem novas camadas.

## Complexity Tracking

> Sem violações de Constitution Check — seção não aplicável.
