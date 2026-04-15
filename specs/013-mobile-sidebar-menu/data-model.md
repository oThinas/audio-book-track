# Data Model: Mobile Sidebar Menu

**Date**: 2026-04-14

## Entities

Esta feature é puramente frontend — não cria novas entidades de banco de dados.

### NavigationItem (tipo compartilhado)

Já existe implicitamente em `sidebar.tsx`. Será formalizado como tipo exportável.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| href | `string` | Rota de destino |
| label | `string` | Texto exibido |
| icon | `LucideIcon` | Ícone do lucide-react |

### MobileMenuState (estado do hook)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| isOpen | `boolean` | Menu está aberto (padrão: `false`) |

**Transições de estado:**

```
fechado → aberto   (toggle via botão "Menu")
aberto  → fechado  (toggle via botão "Menu", Escape, clique em nav item)
```

## Relações

- `MobileHeader` consome `MobileMenuState` via props (isOpen + onToggle)
- `MobileSidebar` consome `MobileMenuState` via props (isOpen + onClose)
- `MobileSidebar` consome `NavigationItem[]` do módulo compartilhado
- `Sidebar` (desktop) consome `NavigationItem[]` do módulo compartilhado
- `AuthenticatedLayoutClient` é o owner do estado e passa props para ambos
