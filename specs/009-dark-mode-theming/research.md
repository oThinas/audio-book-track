# Research: Dark Mode & Primary Color Theming Refactor

**Branch**: `009-dark-mode-theming` | **Date**: 2026-04-10

## Decisao 1: Estrategia de substituicao de classes

**Decision**: Substituicao direta de classes Tailwind hardcoded por tokens semanticos ja existentes em `globals.css`.

**Rationale**: O projeto ja possui um sistema completo de design tokens com CSS custom properties definidos para `:root` (light), `.dark` (dark) e `[data-primary-color]` (variantes de cor). Nao ha necessidade de criar novos tokens ou alterar a infraestrutura de theming — apenas consumir corretamente os tokens existentes nos componentes.

**Alternatives considered**:
- Criar um layer de abstraction com utility classes customizadas — rejeitado por adicionar complexidade sem beneficio; os tokens Tailwind semanticos ja cumprem esse papel.
- Usar `dark:` prefix do Tailwind em cada classe — rejeitado porque o projeto usa class-based dark mode via `next-themes` com CSS custom properties, tornando o prefix `dark:` desnecessario quando tokens semanticos sao usados.

## Decisao 2: Sidebar como superficie independente

**Decision**: A sidebar usa tokens semanticos proprios (`bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-primary`, etc.) separados dos tokens de pagina (`bg-background`, `text-foreground`).

**Rationale**: O design da sidebar e uma superficie visualmente distinta (escura em ambos os temas, com variantes proprias). Os tokens `--sidebar-*` ja estao definidos em `globals.css` com valores diferentes de `--background`/`--foreground`, permitindo que a sidebar mantenha sua identidade visual enquanto se adapta ao tema.

**Alternatives considered**:
- Usar os mesmos tokens de pagina na sidebar — rejeitado porque quebraria a hierarquia visual entre sidebar e conteudo.

## Decisao 3: Painel de branding da pagina de login

**Decision**: O painel de branding (lado esquerdo da pagina de login) usa `bg-sidebar` para manter consistencia visual com a sidebar autenticada.

**Rationale**: O painel de branding tem a mesma funcao visual que a sidebar — uma superficie escura com destaque de marca. Usar o mesmo token garante que ambos se adaptam de forma coordenada ao tema.

**Alternatives considered**:
- Usar `bg-card` — rejeitado porque nao reflete a intencao visual do painel de branding.
- Manter `bg-slate-800` — rejeitado porque nao se adapta ao tema.

## Decisao 4: Separadores na pagina de settings

**Decision**: Substituir `bg-slate-100` dos separadores por `bg-border`.

**Rationale**: Separadores visuais devem seguir o token de borda para manter consistencia com outros elementos divisorios do design system. `bg-border` adapta-se corretamente a ambos os temas.

**Alternatives considered**:
- `bg-muted` — aceitavel, mas `bg-border` e mais semanticamente correto para divisores.

## Decisao 5: Cores de destaque usam token `primary`

**Decision**: Todos os estados checked/active de seletores e itens de navegacao usam `bg-primary`/`text-primary` (ou variantes sidebar) em vez de `bg-blue-600` hardcoded.

**Rationale**: O token `--primary` e dinamicamente redefinido pelo atributo `[data-primary-color]`, permitindo que a cor mude conforme a preferencia do usuario. Classes hardcoded ignoram essa preferencia.

**Alternatives considered**: Nenhuma — este e o unico caminho correto para suportar a customizacao de cor primaria.

## Mapeamento completo de substituicoes

### Padroes globais

| Classe hardcoded         | Token semantico                      | Contexto               |
|--------------------------|--------------------------------------|------------------------|
| `bg-slate-800`           | `bg-sidebar`                         | Sidebar, branding      |
| `bg-slate-50`            | `bg-background`                      | Fundo de pagina        |
| `bg-white`               | `bg-card`                            | Cards, containers      |
| `bg-slate-100`           | `bg-border`                          | Separadores            |
| `text-slate-800`         | `text-foreground`                    | Texto principal        |
| `text-slate-700`         | `text-foreground`                    | Labels de formulario   |
| `text-slate-500`         | `text-muted-foreground`              | Texto secundario       |
| `text-slate-400`         | `text-muted-foreground`              | Texto terciario        |
| `border-slate-200`       | `border-border`                      | Bordas                 |
| `bg-blue-600`            | `bg-primary` / `bg-sidebar-primary`  | Acento ativo           |
| `text-blue-500`          | `text-primary` / `text-sidebar-primary` | Icone de marca      |
| `text-white` (em acento) | `text-primary-foreground`            | Texto sobre acento     |
| `text-red-400`           | `text-destructive`                   | Botao de logout        |
| `hover:bg-slate-700`     | `hover:bg-sidebar-accent`            | Hover na sidebar       |
| `hover:text-white`       | `hover:text-sidebar-accent-foreground` | Hover texto sidebar  |

### Excecoes aceitas

| Classe          | Arquivo                         | Motivo                              |
|-----------------|---------------------------------|-------------------------------------|
| `bg-blue-600`   | primary-color-selector.tsx      | Amostra fixa de cor (swatch)        |
| `bg-orange-600` | primary-color-selector.tsx      | Amostra fixa de cor (swatch)        |
| `bg-emerald-600`| primary-color-selector.tsx      | Amostra fixa de cor (swatch)        |
| `bg-rose-600`   | primary-color-selector.tsx      | Amostra fixa de cor (swatch)        |
| `bg-amber-600`  | primary-color-selector.tsx      | Amostra fixa de cor (swatch)        |
| `ring-*-600/50` | primary-color-selector.tsx      | Ring das amostras de cor            |
| `text-white`    | primary-color-selector.tsx:51   | Check icon sobre swatch (contraste) |

### Arquivos afetados (10 componentes)

1. `src/app/(auth)/login/page.tsx` — 7 substituicoes
2. `src/components/features/auth/login-form.tsx` — 2 substituicoes
3. `src/components/layout/sidebar.tsx` — 16 substituicoes
4. `src/components/layout/sidebar-toggle.tsx` — 2 substituicoes
5. `src/app/(authenticated)/layout-client.tsx` — 1 substituicao
6. `src/app/(authenticated)/settings/page.tsx` — 12 substituicoes
7. `src/components/features/settings/theme-selector.tsx` — 4 substituicoes
8. `src/components/features/settings/font-size-selector.tsx` — 4 substituicoes
9. `src/components/features/settings/favorite-page-selector.tsx` — 4 substituicoes
10. `src/components/features/settings/primary-color-selector.tsx` — 0 substituicoes (apenas swatches, aceitos)

**Total**: ~52 substituicoes de classes em 9 arquivos (primary-color-selector nao requer mudancas).