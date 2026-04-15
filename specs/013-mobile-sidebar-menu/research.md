# Research: Mobile Sidebar Menu

**Date**: 2026-04-14
**Branch**: `013-mobile-sidebar-menu`

## R1: Animação Hambúrguer → X

**Decision**: CSS transitions puras com 3 `<span>` elements.

**Rationale**: O padrão "hamburger to X" com CSS é amplamente documentado e requer apenas `transform: rotate()` + `opacity` transitions nas 3 barras. Usa apenas propriedades compositor-friendly (`transform`, `opacity`), sem reflow. Duração de 300ms com `ease-in-out` é o sweet spot para percepção fluida.

**Alternatives considered**:
- **Framer Motion**: Biblioteca robusta, mas adiciona ~30kb ao bundle e o projeto não a utiliza em nenhum outro lugar. Viola YAGNI.
- **Lucide React icons com swap**: Trocar entre ícones `Menu` e `X` do Lucide. Sem animação — é um swap abrupto, não uma transição suave como especificado.
- **tw-animate-css** (já instalada): Oferece classes utilitárias de animação, mas não suporta a morphing de 3 barras em X nativamente.

## R2: Slide-in do Painel

**Decision**: CSS `transform: translateX(-100%)` ↔ `translateX(0)` com `transition-transform duration-300`.

**Rationale**: `transform` é compositor-friendly, não causa reflow. O painel sempre está no DOM (posicionado fora da viewport), e a transição move ele para dentro. `prefers-reduced-motion` desativa a transição, fazendo o painel aparecer/desaparecer instantaneamente.

**Alternatives considered**:
- **shadcn Sheet**: Usa Radix Dialog internamente, que renderiza via React Portal em `document.body`. Isso sobrepõe toda a viewport (incluindo o header mobile que deve permanecer visível), inclui backdrop desnecessário (o painel já ocupa 100% da área), e tem largura fixa. Customizar para remover portal, esconder backdrop, forçar largura total e posicionar abaixo do header exigiria override de múltiplos estilos internos do Radix. **Nota de constituição**: esta decisão não viola o Princípio VII ("shadcn/ui padrão" / "NUNCA HTML cru") — o `MobileSidebar` é um componente de layout (como o `Sidebar` desktop existente), não um primitivo interativo. Elementos interativos dentro dele (Button, Link) continuam usando shadcn/ui. Ver [plan.md D5](plan.md) para justificativa completa.
- **CSS `display: none` / `display: block`**: Sem animação de slide. Aparição abrupta.

## R3: Focus Trap

**Decision**: Implementação manual com event listener de `keydown` no container.

**Rationale**: O focus trap para este caso é simples: ao abrir o menu, identificar todos os elementos focáveis dentro do container (header + painel), e ao pressionar Tab no último elemento, voltar para o primeiro (e vice-versa com Shift+Tab). São ~20 linhas de lógica. Ao fechar, restaurar foco ao botão "Menu".

**Alternatives considered**:
- **focus-trap-react**: Biblioteca dedicada, mas adicionar dependência para ~20 linhas de lógica é over-engineering. Viola YAGNI.
- **Radix Dialog**: Faz focus trap automaticamente, mas obriga a usar a estrutura de Dialog (portal, overlay, content) que não se encaixa bem no layout desejado (painel abaixo do header fixo).
- **@base-ui/react Dialog**: Já está no projeto, mas acopla a solução a uma abstração específica quando a necessidade é simples.

## R4: Breakpoint e Estratégia Responsiva

**Decision**: Usar Tailwind `md:` (768px) como breakpoint. Mobile-first: estilizar para mobile por padrão, aplicar `md:` para desktop.

**Rationale**: O projeto já usa Tailwind CSS v4 com approach mobile-first. A constituição exige mobile-first (Princípio VII). O breakpoint `md` (768px) é o padrão da spec e alinha com tablets em modo retrato.

**Alternatives considered**:
- **`lg:` (1024px)**: Muito largo — excluiria tablets que têm espaço suficiente para a sidebar.
- **`sm:` (640px)**: Muito estreito — forçaria sidebar desktop em telas onde ela não cabe bem.
- **Custom breakpoint**: Desnecessário — `md` é o padrão da indústria para sidebar visibility.

## R5: Extração de Navigation Items

**Decision**: Extrair `NAV_ITEMS` e `BOTTOM_ITEMS` para `src/lib/constants/navigation.ts`, compartilhado entre Sidebar desktop e MobileSidebar.

**Rationale**: Ambos os componentes (desktop sidebar e mobile sidebar) devem exibir exatamente os mesmos itens de navegação (FR-005). Duplicar os arrays violaria DRY e criaria risco de dessincronização.

**Alternatives considered**:
- **Manter no sidebar.tsx e importar no MobileSidebar**: Criaria dependência circular ou coupling indesejado entre componentes visuais.
- **Prop drilling dos items**: Over-engineering para dados estáticos que não mudam em runtime.

## R6: Estado do Menu Mobile

**Decision**: Hook `useMobileMenu` com `useState` local no `AuthenticatedLayoutClient`. Não persiste em cookie.

**Rationale**: O menu mobile sempre abre fechado (spec: "O estado de aberto/fechado do menu mobile não precisa ser persistido entre sessões"). Diferente do sidebar collapse que persiste em cookie, o menu mobile é efêmero. O hook gerencia `isOpen`, toggle, close-on-navigate, e o handler de Escape.

**Alternatives considered**:
- **Persistir em cookie como o sidebar collapse**: Desnecessário — ninguém quer que o menu abra automaticamente ao recarregar a página no mobile.
- **Context global**: O estado é local ao layout — não é consumido por componentes filhos distantes. useState no layout-client é suficiente.
