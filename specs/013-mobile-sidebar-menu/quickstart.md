# Quickstart: Mobile Sidebar Menu

**Branch**: `013-mobile-sidebar-menu`

## Pré-requisitos

```bash
bun install
bun run dev
```

## Componentes a criar

### 1. Extrair navigation constants
```
src/lib/constants/navigation.ts
```
Mover `NAV_ITEMS` e `BOTTOM_ITEMS` de `sidebar.tsx` para este arquivo.

### 2. HamburgerIcon
```
src/components/layout/hamburger-icon.tsx
```
Ícone animado com 3 `<span>` que transiciona entre ≡ e ✕ via CSS transforms.

### 3. MobileHeader
```
src/components/layout/mobile-header.tsx
```
Header fixo no topo com botão "Menu" (ghost, sem background/bordas).

### 4. MobileSidebar
```
src/components/layout/mobile-sidebar.tsx
```
Painel fullscreen abaixo do header com navegação. Slide-in da esquerda. Focus trap.

### 5. useMobileMenu hook
```
src/lib/hooks/use-mobile-menu.ts
```
Estado `isOpen`, toggle, close-on-navigate, Escape handler.

### 6. Modificar layout-client
```
src/app/(authenticated)/layout-client.tsx
```
Adicionar MobileHeader + MobileSidebar, esconder Sidebar no mobile via CSS.

## Testes

```bash
# Unit tests
bun run test:unit

# E2E tests (requer app rodando)
bun run test:e2e
```

## Verificação

```bash
bun run lint
bun run test:unit
bun run build
```
