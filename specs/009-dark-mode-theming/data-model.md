# Data Model: Dark Mode & Primary Color Theming Refactor

**Branch**: `009-dark-mode-theming` | **Date**: 2026-04-10

## Entidades

Nenhuma entidade nova. Nenhuma alteracao de schema.

### Entidades existentes relevantes

**User Preference** (tabela `user_preference`)
- `theme`: enum `["light", "dark", "system"]` — sem alteracao
- `primaryColor`: enum `["blue", "orange", "green", "red", "amber"]` — sem alteracao
- `fontSize`: enum `["small", "medium", "large"]` — sem alteracao
- `favoritePage`: enum `["dashboard", "books", "studios", "editors", "narrators", "settings"]` — sem alteracao

### Design Tokens (CSS Custom Properties)

Tokens existentes em `src/app/globals.css` consumidos por esta feature:

**Tokens de pagina** (`:root` / `.dark`):
- `--background`, `--foreground`
- `--card`, `--card-foreground`
- `--primary`, `--primary-foreground`
- `--muted`, `--muted-foreground`
- `--border`, `--input`, `--ring`
- `--destructive`

**Tokens de sidebar** (`:root` / `.dark`):
- `--sidebar`, `--sidebar-foreground`
- `--sidebar-primary`, `--sidebar-primary-foreground`
- `--sidebar-accent`, `--sidebar-accent-foreground`
- `--sidebar-border`, `--sidebar-ring`

**Tokens de cor primaria** (`[data-primary-color="blue|orange|green|red|amber"]`):
- Redefine `--primary`, `--primary-foreground`, `--ring`, `--sidebar-primary`
- Valores diferentes para `:root` e `.dark` em cada cor

Nenhum token novo precisa ser criado.

## Migrations

Nenhuma migration necessaria.