# Implementation Plan: Pagina 404 Personalizada

**Branch**: `014-custom-404-page` | **Date**: 2026-04-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/014-custom-404-page/spec.md`

## Summary

Criar uma pagina 404 personalizada com mensagens humoristicas tematicas de audiobooks/narracao. A pagina exibe uma frase aleatoria de um conjunto de 5+ opcoes a cada visita, um botao para voltar a pagina inicial, e funciona em ambos os temas (claro/escuro) e em todos os viewports.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (Bun runtime)
**Primary Dependencies**: Next.js 16.2.1 (App Router), React 19.2.4, Tailwind CSS v4, shadcn/ui 4.1.2, lucide-react 1.7.0
**Storage**: N/A (sem banco de dados)
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Web (browser desktop e mobile)
**Project Type**: Web application (Next.js)
**Performance Goals**: Pagina estatica server-rendered — carregamento imediato
**Constraints**: Sem bundle adicional no cliente (`use client` nao necessario)
**Scale/Scope**: 1 pagina, ~1 componente, 0 endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Status | Notas |
|-----------|--------|-------|
| I. Capitulo como Unidade | N/A | Nenhuma operacao de dominio |
| II. Precisao Financeira | N/A | Nenhum calculo financeiro |
| III. Ciclo de Vida | N/A | Nenhuma transicao de status |
| IV. Simplicidade (YAGNI) | PASS | Uma unica pagina estatica, sem abstrações |
| V. TDD | APPLICABLE | Testes unitarios para selecao aleatoria + E2E para renderizacao |
| VI. Arquitetura Limpa | N/A | Sem backend/service/repository |
| VII. Frontend Composicao | APPLICABLE | Usar shadcn/ui Button, design tokens, dark mode, mobile first |
| VIII. Performance | PASS | Server Component puro, zero JS no cliente |
| IX. Design Tokens | APPLICABLE | Todas as cores e espacamentos via tokens |
| X. API REST | N/A | Nenhum endpoint |
| XI. PostgreSQL | N/A | Sem banco |
| XII. Anti-Padroes | APPLICABLE | Sem HTML cru, sem cores hardcoded, sem `use client` desnecessario |
| XIII. Metricas/KPIs | N/A | Sem dashboard |
| XIV. PDF Viewer | N/A | Sem PDF |
| XV. Ferramentas | APPLICABLE | Context7, design.pen consultados |
| XVI. Qualidade | APPLICABLE | lint, test, build devem passar |

**Gate Result**: PASS — nenhuma violacao.

## Project Structure

### Documentation (this feature)

```text
specs/014-custom-404-page/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── not-found.tsx          # [NEW] Pagina 404 personalizada (Server Component)
└── lib/
    └── constants/
        └── not-found-messages.ts  # [NEW] Array de mensagens humoristicas
```

```text
__tests__/
├── unit/
│   └── constants/
│       └── not-found-messages.test.ts  # [NEW] Testes do array de mensagens
└── e2e/
    └── not-found.spec.ts               # [NEW] E2E: pagina 404 renderiza corretamente
```

**Structure Decision**: Apenas 2 novos arquivos de producao + 2 de teste. As mensagens sao extraidas para um arquivo constante em `lib/constants/` seguindo o padrao existente (`navigation.ts` ja vive la). A pagina em si e um Server Component puro em `src/app/not-found.tsx`.

## Phase 0: Research (Completed)

Todas as decisoes documentadas em [research.md](research.md). Nenhum NEEDS CLARIFICATION restante.

## Phase 1: Design

### Arquitetura da pagina

```
RootLayout (ThemeProvider, fonts)
  └── NotFound (Server Component)
        ├── Icone ilustrativo (lucide-react)
        ├── Codigo "404" em destaque
        ├── Mensagem humoristica aleatoria
        ├── Subtitulo explicativo fixo
        └── Button (shadcn/ui) → Link para "/"
```

### Layout visual

- **Centralizacao**: `flex min-h-screen items-center justify-center` — conteudo centralizado vertical e horizontalmente.
- **Container**: Max-width limitado (`max-w-md`), padding responsivo.
- **Hierarquia**:
  1. Icone tematico (lucide-react, ex: `BookX` ou `BookOpen`) — grande, cor `muted-foreground`.
  2. "404" — texto extra-large bold (`text-7xl sm:text-8xl font-bold text-foreground`).
  3. Mensagem humoristica — `text-lg text-muted-foreground`, selecionada aleatoriamente.
  4. Subtitulo fixo — "A pagina que voce procura nao foi encontrada." em `text-sm text-muted-foreground`.
  5. Botao "Voltar ao inicio" — `<Button>` default variant com `<Link href="/">`.
- **Dark mode**: Todas as cores via tokens semanticos (`text-foreground`, `text-muted-foreground`, `bg-background`).
- **Mobile first**: Layout funciona em 320px+ sem ajustes; apenas scale de texto via `sm:` breakpoint.

### Mensagens humoristicas (minimo 5)

Frases tematicas de audiobooks/narracao, em portugues brasileiro:

1. "Esse capitulo ainda nao foi escrito..."
2. "Parece que o narrador pulou essa pagina."
3. "Esse trecho foi cortado na edicao final."
4. "O audiobook acabou antes de chegar aqui."
5. "Essa pagina esta em revisao... desde sempre."
6. "O editor esqueceu de incluir esse capitulo."
7. "Fim da gravacao. Essa parte nao existe."

### Contratos

Nenhum contrato externo — a feature e puramente interna (pagina estatica, sem API).

## Complexity Tracking

Nenhuma violacao a justificar. Feature simples e diretamente alinhada com YAGNI (Principio IV).
