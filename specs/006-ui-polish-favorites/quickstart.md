# Quickstart: UI Polish, Sidebar Colapsável e Preferências do Usuário

**Branch**: `006-ui-polish-favorites`

## Prerequisites

- Bun installed (`bun --version` ≥ 1.0)
- PostgreSQL running (local or Neon)
- `.env` with `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`

## Setup

```bash
# Install dependencies
bun install

# Run migrations (after schema changes)
bun run db:push

# Start dev server
bun run dev
```

## Key Files to Understand

| File | Purpose |
|------|---------|
| `src/lib/db/schema.ts` | DB schema — add `user_preference` table here |
| `src/app/globals.css` | Design tokens — add primary color palettes + font size vars |
| `src/components/layout/sidebar.tsx` | Sidebar — add collapse/expand behavior |
| `src/app/(auth)/login/page.tsx` | Login page — restyle to two-panel layout |
| `src/app/(authenticated)/layout.tsx` | Auth layout — wire sidebar state + preferences |
| `src/app/page.tsx` | Root page — replace with redirect logic |
| `src/lib/auth/server.ts` | Auth config — reference for session handling |

## Implementation Order

1. **Schema + Migration**: Add `user_preference` table to Drizzle schema
2. **Domain + Repository + Service**: Create preference types, repo, service
3. **API Route**: `PATCH` + `GET` `/api/v1/user-preferences`
4. **CSS Tokens**: Add primary color palettes + font size variables to `globals.css`
5. **Root Layout**: Wire `next-themes` provider + font size + primary color attributes
6. **Login Page**: Restyle to two-panel layout per design
7. **Sidebar**: Add collapse/expand toggle with animation + cookie state
8. **Settings Page**: New route with preference selector components
9. **Root Redirect**: Replace `page.tsx` with redirect to favorite page
10. **Post-Login Redirect**: Update `LoginForm` to redirect to favorite page

## Design Reference

Open `design.pen` in Pencil editor to view:
- Frame "01 - Login": Login page layout
- Frame "05 - Configurações": Settings page layout
- Frame "[Componente] Sidebar — Estado Colapsado": Collapsed sidebar (64px)
- Frame "[Sistema] Biblioteca de Componentes": All design tokens, typography, buttons, badges, inputs, nav items

## Testing Strategy

| Type | What to test | Location |
|------|-------------|----------|
| Unit | Preference defaults, validation, type guards | `__tests__/unit/` |
| Unit | Service logic (update, upsert, defaults) | `__tests__/unit/` |
| Integration | Repository CRUD with real DB | `__tests__/integration/` |
| E2E | Login page visual, sidebar toggle, settings preferences | `__tests__/e2e/` |

## Common Commands

```bash
# Run all tests
bun run test

# Run unit tests only
bun run test:unit

# Run integration tests only
bun run test:integration

# Run E2E tests
bun run test:e2e

# Generate migration
bunx drizzle-kit generate

# Push schema to DB
bunx drizzle-kit push

# Lint & format
bun run check
```