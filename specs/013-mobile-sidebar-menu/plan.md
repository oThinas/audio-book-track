# Implementation Plan: Mobile Sidebar Menu

**Branch**: `013-mobile-sidebar-menu` | **Date**: 2026-04-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-mobile-sidebar-menu/spec.md`

## Summary

No mobile (< 768px), a sidebar lateral é escondida e substituída por um header fixo com botão "Menu" ghost e ícone animado hambúrguer ↔ X. Ao abrir, um painel fullscreen desliza da esquerda com todos os itens de navegação, com focus trap e suporte a `prefers-reduced-motion`. Desktop permanece inalterado.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (Bun runtime)
**Primary Dependencies**: Next.js 16.2.1 (App Router), React 19.2.4, Tailwind CSS v4, lucide-react 1.7.0, shadcn/ui 4.1.2
**Storage**: N/A (sem mudanças de banco de dados)
**Testing**: Vitest (unit), Playwright 1.59.1 (E2E)
**Target Platform**: Web (mobile + desktop browsers)
**Project Type**: Web application (Next.js)
**Performance Goals**: LCP < 1s, animações a 60fps em propriedades compositor-friendly
**Constraints**: CSS-only animations (sem biblioteca extra), mobile-first (Tailwind), dark mode obrigatório
**Scale/Scope**: ~7 arquivos novos/modificados, ~350 linhas de código novo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Capítulo como Unidade | N/A | Feature puramente UI, sem lógica de domínio |
| II. Precisão Financeira | N/A | Sem cálculos financeiros |
| III. Ciclo de Vida | N/A | Sem mudança de status |
| IV. YAGNI | PASS | Sem dependências extras, CSS-only, sem abstrações especulativas |
| V. TDD | PASS | Testes escritos antes da implementação |
| VI. Arquitetura Limpa | N/A | Sem mudanças no backend |
| VII. Frontend Composição | PASS | Mobile-first, shadcn Button, dark mode, design tokens, componentes atômicos |
| VIII. Performance | PASS | Animações compositor-friendly (transform, opacity), sem bundle adicional |
| IX. Design Tokens | PASS | Usa tokens `sidebar-*` e `background`/`foreground` existentes |
| X. API REST | N/A | Sem novos endpoints |
| XI. PostgreSQL | N/A | Sem mudanças de banco |
| XII. Anti-Padrões | PASS | Sem HTML cru, sem hardcoded values, sem console.log |

**Resultado**: Todos os gates passam. Nenhuma violação.

## Project Structure

### Documentation (this feature)

```text
specs/013-mobile-sidebar-menu/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── (authenticated)/
│       └── layout-client.tsx          # MODIFIED: responsive layout with mobile components
├── components/
│   └── layout/
│       ├── sidebar.tsx                # MODIFIED: import shared NAV_ITEMS, add hidden md:flex
│       ├── mobile-header.tsx          # NEW: fixed header with Menu button (mobile only)
│       ├── mobile-sidebar.tsx         # NEW: fullscreen overlay panel with navigation
│       └── hamburger-icon.tsx         # NEW: animated hamburger ↔ X icon
└── lib/
    ├── constants/
    │   └── navigation.ts             # NEW: shared NAV_ITEMS + BOTTOM_ITEMS
    └── hooks/
        └── use-mobile-menu.ts        # NEW: mobile menu state + Escape + focus trap

__tests__/
├── unit/
│   └── hooks/
│       └── use-mobile-menu.test.ts   # NEW: unit tests for mobile menu hook
└── e2e/
    ├── sidebar-toggle.spec.ts        # EXISTING: verify no regression on desktop
    └── mobile-sidebar.spec.ts        # NEW: E2E tests for mobile sidebar
```

**Structure Decision**: Componentes de layout mobile vivem em `components/layout/` junto com `sidebar.tsx` existente. Hook novo em `lib/hooks/`. Constants extraídas em `lib/constants/`. Segue a estrutura existente sem criar novas camadas.

## Design Decisions

### D1: CSS Visibility vs Conditional Rendering

**Escolha**: CSS visibility via Tailwind (`hidden md:flex` / `md:hidden`).

**Razão**: Ambos os layouts (mobile e desktop) estão sempre no DOM. O React não precisa montar/desmontar componentes ao redimensionar a janela. A transição de breakpoint acontece instantaneamente via CSS media query, sem JavaScript. Isso garante FR-011 (transição automática sem recarregar) e evita flicker.

### D2: Hamburger Icon — CSS Spans vs SVG

**Escolha**: 3 `<span>` elements com CSS transitions.

**Razão**: Permite morphing suave entre as formas (hambúrguer → X) usando `transform: rotate()` e `opacity`. SVGs do Lucide fariam um swap abrupto, não uma transição. As 3 spans são estilizadas com `bg-current` para herdar a cor do texto e funcionar em light/dark mode automaticamente.

### D3: Focus Trap — Manual vs Library

**Escolha**: Implementação manual no `useMobileMenu` hook.

**Razão**: O focus trap para este caso é simples (~20 linhas). Adicionar `focus-trap-react` ou acoplar a Radix Dialog viola YAGNI. O hook captura `keydown` events e cicla o foco entre os elementos focáveis do container.

### D4: Navigation Constants — Extração

**Escolha**: Mover `NAV_ITEMS` e `BOTTOM_ITEMS` para `src/lib/constants/navigation.ts`.

**Razão**: FR-005 exige que o mobile exiba os mesmos itens do desktop. Duplicar os arrays violaria DRY. O `Sidebar` e `MobileSidebar` importam do mesmo módulo.

### D5: MobileSidebar com `<div>` ao invés de shadcn Sheet — Exceção justificada à Constituição VII

> **Princípios envolvidos:**
> - *"shadcn/ui como biblioteca de componentes padrão"* — verificar se existe equivalente antes de criar do zero.
> - *"Uso obrigatório de componentes de `components/ui/` (NUNCA HTML cru)"* — usar `<Button>`, `<Input>`, etc.

**Escolha**: O `MobileSidebar` usa `<div>` com CSS `position: fixed` + `transform` ao invés do componente `Sheet` do shadcn/ui.

**Por que o Sheet não se aplica aqui**:

O `Sheet` do shadcn/ui (Radix Dialog) é projetado para painéis laterais parciais com backdrop — ele:
1. Renderiza via **React Portal** em `document.body`, fora da árvore de componentes. Isso faz o painel sobrepor **toda a viewport**, incluindo o header mobile que deve permanecer visível.
2. Inclui um **backdrop/overlay** que escurece o conteúdo por trás. No nosso caso, o painel ocupa 100% da viewport abaixo do header — não há conteúdo visível para escurecer.
3. Tem **largura fixa** (padrão ~75% da tela). O requisito é 100% da viewport.

Customizar o Sheet para remover o portal, esconder o backdrop, forçar largura total e posicionar abaixo do header exigiria override de múltiplos estilos internos do Radix — trabalhando **contra** o componente ao invés de com ele.

**O que esta decisão NÃO viola**:

- O `MobileSidebar` é um **componente de layout** (`components/layout/`), não um primitivo de UI (`components/ui/`). A regra de "NUNCA HTML cru" aplica-se a primitivos interativos (`<button>`, `<input>`, `<select>`) que têm equivalente em `components/ui/`. Um `<div>` de posicionamento não é um primitivo interativo.
- O botão "Menu" dentro do `MobileHeader` **usa** `<Button>` do shadcn/ui (variant `ghost`).
- Os links de navegação dentro do `MobileSidebar` seguem o mesmo padrão do `Sidebar` desktop existente (que também usa `<Link>` + `<Button>` do shadcn).

**Precedente**: O `Sidebar` desktop existente (`sidebar.tsx`) já usa `<aside>` + `<div>` para layout, com apenas `<Button>` do shadcn para elementos interativos. O `MobileSidebar` segue o mesmo padrão.

### D6: Panel Slide Animation

**Escolha**: `transform: translateX(-100%)` para fechado, `translateX(0)` para aberto, com `transition-transform duration-300 ease-in-out`.

**Razão**: `transform` é compositor-friendly (60fps). O painel está sempre no DOM, posicionado fora da viewport à esquerda. `prefers-reduced-motion` desativa a transition via `motion-reduce:transition-none`.

## Component Architecture

```
AuthenticatedLayoutClient (owner do estado)
├── MobileHeader (md:hidden)
│   └── HamburgerIcon (animated ≡ ↔ ✕)
├── MobileSidebar (md:hidden, slide-in overlay)
│   ├── NAV_ITEMS links
│   └── BOTTOM_ITEMS links + Logout
├── Sidebar (hidden md:flex — desktop only)
│   ├── NAV_ITEMS links
│   └── BOTTOM_ITEMS links + Logout
└── Main content (flex-1)
```

**Estado**:
- `useSidebar(initialCollapsed)` — desktop collapse (já existe)
- `useMobileMenu()` — mobile open/close (novo)

Ambos os hooks vivem no `AuthenticatedLayoutClient`, que passa props para os componentes filhos.

## Complexity Tracking

Nenhuma violação de constituição — tabela não aplicável.
