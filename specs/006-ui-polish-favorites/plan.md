# Implementation Plan: UI Polish, Sidebar Colapsável e Preferências do Usuário

**Branch**: `006-ui-polish-favorites` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-ui-polish-favorites/spec.md`

## Summary

Estilizar as páginas de login e configurações conforme o design (`design.pen`), adicionar sidebar colapsável com toggle animado, implementar sistema de preferências do usuário (tema, fonte, cor primária, página favorita) persistido no banco de dados com auto-save, e redirecionar `/` e pós-login para a página favorita do usuário.

## Technical Context

**Language/Version**: TypeScript 5.9, Bun runtime
**Primary Dependencies**: Next.js 16.2, React 19.2, better-auth 1.5, @base-ui/react 1.3, next-themes 0.4, Tailwind CSS 4.2, Drizzle ORM 0.45, Zod 4.3, lucide-react 1.7
**Storage**: PostgreSQL (Neon serverless) via Drizzle ORM
**Testing**: Vitest 4.1 (unit/integration), Playwright 1.59 (E2E)
**Target Platform**: Web (desktop + tablet + mobile)
**Project Type**: Web application (Next.js App Router, SSR-first)
**Performance Goals**: Sidebar toggle < 300ms, redirect < 1s, LCP < 1s
**Constraints**: Mobile first, design tokens only (no hardcoded values), auto-save preferences cross-device
**Scale/Scope**: Single-user/small team, ~6 pages, ~50 components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Notes |
|-----------|--------|-------|
| I. Capítulo como Unidade | N/A | Feature não toca em capítulos |
| II. Precisão Financeira | N/A | Feature não toca em dados financeiros |
| III. Ciclo de Vida | N/A | Feature não toca em status de capítulos |
| IV. Simplicidade (YAGNI) | PASS | Preferências são 4 campos simples, sem over-engineering |
| V. TDD | PENDING | Testes serão escritos antes da implementação |
| VI. Arquitetura Limpa | PASS | Service → Repository para preferências; controllers finos |
| VII. Frontend: Mobile First | PASS | Todas as telas serão mobile first com breakpoints progressivos |
| VIII. Performance | PASS | Server Components por padrão; sidebar toggle client-side justificado |
| IX. Design Tokens | PASS | Cores de tema como CSS variables; nenhum hardcode |
| X. API REST | PASS | PATCH `/api/v1/user-preferences` com Zod validation |
| XI. PostgreSQL | PASS | Nova tabela `user_preference` com FK indexada |
| XII. Anti-Padrões | PASS | Sem `any`, sem `SELECT *`, sem console.log |
| XIII. KPIs/Dashboard | N/A | Dashboard não será alterado nesta feature |
| XIV. PDF Viewer | N/A | Não aplicável |

**GATE RESULT**: PASS — nenhuma violação detectada.

## Project Structure

### Documentation (this feature)

```text
specs/006-ui-polish-favorites/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-preferences.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (auth)/login/page.tsx              # MODIFY: two-panel layout per design
│   ├── (authenticated)/
│   │   ├── layout.tsx                     # MODIFY: sidebar collapse state, preferences provider
│   │   ├── dashboard/page.tsx             # NO CHANGE
│   │   └── settings/page.tsx              # NEW: settings page with preferences forms
│   ├── api/v1/user-preferences/route.ts   # NEW: PATCH endpoint for auto-save
│   ├── page.tsx                           # MODIFY: redirect to favorite page
│   ├── layout.tsx                         # MODIFY: ThemeProvider + font size CSS var
│   └── globals.css                        # MODIFY: add primary color palettes + font size tokens
├── components/
│   ├── features/
│   │   └── settings/
│   │       ├── theme-selector.tsx         # NEW: theme radio group
│   │       ├── font-size-selector.tsx     # NEW: font size radio group
│   │       ├── primary-color-selector.tsx # NEW: color swatch picker
│   │       └── favorite-page-selector.tsx # NEW: select dropdown
│   ├── layout/
│   │   ├── sidebar.tsx                    # MODIFY: collapse/expand + toggle button + animation
│   │   └── sidebar-toggle.tsx             # NEW: toggle button component
│   └── ui/                                # shadcn components (add as needed)
├── lib/
│   ├── domain/
│   │   ├── user-preference.ts             # NEW: types + validation + defaults
│   │   └── navigable-pages.ts             # NEW: page slug → URL mapping constant
│   ├── repositories/
│   │   └── user-preference-repository.ts  # NEW: CRUD for user_preference table
│   ├── services/
│   │   └── user-preference-service.ts     # NEW: business logic for preference updates
│   ├── db/
│   │   └── schema.ts                      # MODIFY: add user_preference table
│   └── hooks/
│       └── use-sidebar.ts                 # NEW: sidebar collapse state hook (cookie)
└── __tests__/
    ├── unit/
    │   ├── user-preference-domain.test.ts # NEW: validation, defaults, types
    │   └── user-preference-service.test.ts# NEW: service logic with mocked repo
    ├── integration/
    │   └── user-preference-repo.test.ts   # NEW: DB CRUD operations
    └── e2e/
        ├── login-styling.spec.ts          # NEW: visual comparison of login page
        ├── sidebar-toggle.spec.ts         # NEW: collapse/expand behavior
        ├── settings-page.spec.ts          # NEW: settings page layout + responsive
        ├── settings-preferences.spec.ts   # NEW: preference selection + persistence
        └── redirect.spec.ts              # NEW: root redirect + fallback behavior
```

**Structure Decision**: Follows existing Clean Architecture pattern (domain → repositories → services → API routes). New `settings` route under `(authenticated)`. Preferences stored in PostgreSQL, exposed via API route, consumed by Server Components + client-side providers.

## Complexity Tracking

No violations to justify — all decisions follow constitution patterns.