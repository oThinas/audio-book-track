# Implementation Plan: Dark Mode & Primary Color Theming Refactor

**Branch**: `009-dark-mode-theming` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-dark-mode-theming/spec.md`

## Summary

Refatorar 9 componentes da aplicacao para substituir ~52 classes Tailwind hardcoded por tokens semanticos ja existentes no design system (`globals.css`). Isso garante suporte correto a dark mode e a customizacao de cor primaria, conforme exigido pela constituicao (Principios VII e IX). Nenhum token novo, entidade, rota ou migration e necessario — apenas consumo correto da infraestrutura de theming existente.

## Technical Context

**Language/Version**: TypeScript 5.9 (Bun runtime)
**Primary Dependencies**: Next.js 16.2, React 19.2, Tailwind CSS 4.2, next-themes 0.4, lucide-react 1.7
**Storage**: N/A (sem alteracoes de banco de dados)
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: Web (browser)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: N/A (refatoracao CSS-only, sem impacto em performance)
**Constraints**: Substituicao 1:1 de classes — nenhuma mudanca visual em modo claro
**Scale/Scope**: 9 arquivos, ~52 substituicoes de classes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Status | Nota |
|-----------|--------|------|
| IV. YAGNI | PASS | Nenhuma abstracao nova; substituicao direta de classes |
| VII. Dark mode obrigatorio | PASS (objetivo) | Esta feature implementa exatamente este principio |
| VII. Componentes ui/ | PASS | Sem criacao de componentes novos, apenas refatoracao de existentes |
| VII. PageContainer em paginas autenticadas | PASS | Sem alteracao de estrutura de layout |
| IX. Design tokens para tudo | PASS (objetivo) | Esta feature elimina valores hardcoded |
| XII. Anti-padroes — cores hardcoded | PASS (objetivo) | Esta feature remove cores hardcoded |
| XVI. Qualidade — lint/test/build | PENDENTE | Verificar apos implementacao |

**Gate result**: PASS — nenhuma violacao. Feature alinhada com multiplos principios constitucionais.

## Project Structure

### Documentation (this feature)

```text
specs/009-dark-mode-theming/
├── spec.md              # Especificacao da feature
├── plan.md              # Este arquivo
├── research.md          # Mapeamento de classes hardcoded → tokens
├── data-model.md        # Modelo de dados (sem alteracoes)
├── quickstart.md        # Guia de verificacao rapida
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec
└── tasks.md             # Lista de tarefas (gerado por /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── globals.css                          # Design tokens (inalterado)
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx                     # 7 substituicoes
│   └── (authenticated)/
│       ├── layout-client.tsx                # 1 substituicao
│       └── settings/
│           └── page.tsx                     # 12 substituicoes
├── components/
│   ├── features/
│   │   ├── auth/
│   │   │   └── login-form.tsx               # 2 substituicoes
│   │   └── settings/
│   │       ├── theme-selector.tsx           # 4 substituicoes
│   │       ├── font-size-selector.tsx       # 4 substituicoes
│   │       ├── favorite-page-selector.tsx   # 4 substituicoes
│   │       └── primary-color-selector.tsx   # 0 (swatches mantidos)
│   └── layout/
│       ├── sidebar.tsx                      # 16 substituicoes
│       └── sidebar-toggle.tsx               # 2 substituicoes
```

**Structure Decision**: Nenhuma alteracao na estrutura de diretorios. Todos os arquivos ja existem — apenas o conteudo de classes CSS sera modificado.

## Complexity Tracking

Nenhuma violacao a justificar. Feature de complexidade minima (substituicao 1:1 de classes Tailwind).