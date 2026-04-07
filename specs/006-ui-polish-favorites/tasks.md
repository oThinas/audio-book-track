# Tasks: UI Polish, Sidebar Colapsável e Preferências do Usuário

**Input**: Design documents from `/specs/006-ui-polish-favorites/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-preferences.md

**Tests**: Required — constitution mandates TDD (Princípio V). Tests written FIRST (RED), then implementation (GREEN).

**Organization**: Tasks grouped by user story. Each story is independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1–US5)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Design tokens, DB schema, and shared types that multiple stories depend on.

- [x] T001 Add primary color palettes (blue, orange, green, red, amber) as CSS variable sets in `src/app/globals.css` with light + dark variants, activated via `[data-primary-color]` attribute
- [x] T002 Add font size CSS variables (`--font-size-base`) for small (14px), medium (16px), large (18px) in `src/app/globals.css`
- [x] T003 Add `user_preference` table to Drizzle schema in `src/lib/db/schema.ts` with columns: id, user_id (FK unique), theme, font_size, primary_color, favorite_page, created_at, updated_at — with index on user_id
- [x] T004 Generate and apply Drizzle migration for `user_preference` table via `bunx drizzle-kit generate` and `bunx drizzle-kit push`
- [x] T005 [P] Install shadcn/ui Select and RadioGroup components via `bunx --bun shadcn@latest add select radio-group` — creates `src/components/ui/select.tsx` and `src/components/ui/radio-group.tsx`
- [x] T006 [P] Create domain types, defaults, and Zod validation schemas in `src/lib/domain/user-preference.ts` (Theme, FontSize, PrimaryColor, FavoritePage enums + defaults + partial update schema)
- [x] T008 [P] Create navigable pages constant map (slug → URL) in `src/lib/domain/navigable-pages.ts`

**Checkpoint**: Schema migrated, CSS tokens ready, domain types defined.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Repository, service, and API route for user preferences — required by US4 and US5.

**⚠️ CRITICAL**: US4 and US5 cannot begin until this phase is complete.

### Tests (RED)

- [x] T008 [P] Write unit tests for `UserPreferenceService` (getOrDefault, update with upsert, validation) in `__tests__/unit/user-preference-service.test.ts` — mock repository
- [x] T009 [P] Write unit tests for domain types and Zod schemas (valid/invalid values, defaults, partial update) in `__tests__/unit/user-preference-domain.test.ts`
- [x] T010 Write integration tests for `UserPreferenceRepository` (create, read, update, upsert, cascade delete) in `__tests__/integration/user-preference-repo.test.ts`

### Implementation (GREEN)

- [x] T011 Implement `DrizzleUserPreferenceRepository` in `src/lib/repositories/user-preference-repository.ts` (findByUserId, upsert — select only needed columns, no SELECT *)
- [x] T012 Implement `UserPreferenceService` in `src/lib/services/user-preference-service.ts` (getOrDefault, updatePreference — constructor injection of repository)
- [x] T013 Create `GET /api/v1/user-preferences` route in `src/app/api/v1/user-preferences/route.ts` — auth check, delegate to service, return preferences or defaults
- [x] T014 Create `PATCH /api/v1/user-preferences` route in `src/app/api/v1/user-preferences/route.ts` — auth check, Zod validation (partial, at least 1 field), delegate to service, return 200/401/422

**Checkpoint**: Foundation ready — preferences API functional. Run `T008–T010` tests to verify GREEN.

---

## Phase 3: User Story 1 — Estilização da Página de Login (Priority: P1) 🎯 MVP

**Goal**: Reestruturar a página de login conforme o design (dois painéis em desktop, formulário centralizado em mobile).

**Independent Test**: Abrir `/login` no browser em 3 breakpoints e comparar com frame "01 - Login" do `design.pen`.

### Tests (RED)

- [x] T015 [US1] Write E2E test for login page visual structure (two-panel desktop, single-panel mobile, design token compliance) in `__tests__/e2e/login-styling.spec.ts`

### Implementation (GREEN)

- [x] T016 [US1] Restyle login page in `src/app/(auth)/login/page.tsx` — two-panel flex layout: left panel (sidebar-bg, branding with headphones icon, title "AudioBook Track", subtitle), right panel (bg-page, centered card with form). Mobile first: `hidden md:flex` on left panel
- [x] T017 [US1] Update `src/components/features/auth/login-form.tsx` — after successful login, fetch user's favorite page from `/api/v1/user-preferences` and redirect to it (or `/dashboard` as default) instead of hardcoded `/dashboard`

**Checkpoint**: Login page matches design. Post-login redirects to favorite page. E2E test GREEN.

---

## Phase 4: User Story 2 — Sidebar Expansível e Colapsável (Priority: P2)

**Goal**: Adicionar toggle para expandir/collapsar a sidebar com animação suave e persistência via cookie.

**Independent Test**: Clicar no botão de toggle, verificar animação e persistência entre navegações.

### Tests (RED)

- [ ] T018 [P] [US2] Write unit test for `useSidebar` hook (toggle, read from cookie, default state) in `__tests__/unit/use-sidebar.test.ts`
- [ ] T019 [P] [US2] Write E2E test for sidebar toggle (expand/collapse, animation, persistence across navigation, mobile drawer behavior) in `__tests__/e2e/sidebar-toggle.spec.ts`

### Implementation (GREEN)

- [ ] T020 [US2] Create `useSidebar` hook in `src/lib/hooks/use-sidebar.ts` — manage collapsed state via cookie (`sidebar-collapsed`), provide toggle function, read initial state from cookie
- [ ] T021 [US2] Create `SidebarToggle` button component in `src/components/layout/sidebar-toggle.tsx` — icon button (ChevronLeft/ChevronRight from lucide) that calls toggle
- [ ] T022 [US2] Refactor `src/components/layout/sidebar.tsx` — accept `collapsed` prop, animate width transition (w-64 ↔ w-16, duration-300), show/hide labels with opacity transition, center icons when collapsed. Mobile: overlay/drawer behavior with backdrop
- [ ] T023 [US2] Update `src/app/(authenticated)/layout.tsx` — read `sidebar-collapsed` cookie server-side via `cookies()`, pass to Sidebar, wire SidebarToggle

**Checkpoint**: Sidebar toggles smoothly. State persists across pages. Mobile shows drawer. E2E test GREEN.

---

## Phase 5: User Story 3 — Estilização da Página de Configurações (Priority: P2)

**Goal**: Criar página de configurações estilizada conforme o design com cards para formulários de preferências.

**Independent Test**: Acessar `/settings` e comparar com frame "05 - Configurações" do `design.pen`.

### Tests (RED)

- [ ] T024 [US3] Write E2E test for settings page layout (title, cards structure, responsive stacking on mobile) in `__tests__/e2e/settings-page.spec.ts`

### Implementation (GREEN)

- [ ] T025 [US3] Create settings page in `src/app/(authenticated)/settings/page.tsx` — Server Component that fetches user preferences, renders title "Configurações" and card sections (Aparência, Navegação) per design
- [ ] T026 [US3] Add "Configurações" nav item to sidebar in `src/components/layout/sidebar.tsx` — Settings icon from lucide, route to `/settings`, highlight active state

**Checkpoint**: Settings page matches design. Navigation works from sidebar. E2E test GREEN.

---

## Phase 6: User Story 4 — Preferências de Personalização (Priority: P3)

**Goal**: Implementar seletores de tema, fonte e cor primária com auto-save e aplicação imediata.

**Independent Test**: Alterar cada preferência e verificar aplicação imediata + persistência cross-device.

### Tests (RED)

- [ ] T027 [US4] Write E2E tests for all preference selectors (theme: light/dark/system with CSS class check + OS preference toggle; font size: small/medium/large with html font-size check; primary color: each color with CSS variable check; all with auto-save persistence) in `__tests__/e2e/settings-preferences.spec.ts`

### Implementation (GREEN)

- [ ] T028 [US4] Create shared `useAutoSavePreference` hook in `src/lib/hooks/use-auto-save-preference.ts` — `use client`, accepts preference key + value, debounces PATCH to `/api/v1/user-preferences` (300ms), returns save status for inline feedback (toast/checkmark)
- [ ] T029 [US4] Wire `next-themes` ThemeProvider in `src/app/layout.tsx` — wrap children with `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`, add `suppressHydrationWarning` to `<html>`
- [ ] T030 [P] [US4] Create `ThemeSelector` component in `src/components/features/settings/theme-selector.tsx` — `use client`, shadcn RadioGroup (Claro/Escuro/Sistema), calls `setTheme()` from next-themes + `useAutoSavePreference`
- [ ] T031 [P] [US4] Create `FontSizeSelector` component in `src/components/features/settings/font-size-selector.tsx` — `use client`, shadcn RadioGroup (Pequena/Média/Grande), sets `--font-size-base` on `<html>` + `useAutoSavePreference`
- [ ] T032 [P] [US4] Create `PrimaryColorSelector` component in `src/components/features/settings/primary-color-selector.tsx` — `use client`, color swatches (5 options), sets `data-primary-color` on `<html>` + `useAutoSavePreference`
- [ ] T033 [US4] Update `src/app/layout.tsx` — read user preferences server-side (if authenticated), set initial `data-primary-color` and `style={{ fontSize }}` on `<html>` to prevent flash
- [ ] T034 [US4] Integrate selectors into settings page `src/app/(authenticated)/settings/page.tsx` — pass current preferences as initial values to each selector component in the Aparência card

**Checkpoint**: Theme/font/color changes apply immediately. Auto-save works. Preferences persist across login sessions. E2E tests GREEN.

---

## Phase 7: User Story 5 — Redirecionamento e Página Favorita (Priority: P3)

**Goal**: Redirecionar `/` para página favorita. Permitir seleção de favorita nas configurações.

**Independent Test**: Alterar página favorita nas configurações, acessar `/`, verificar redirect correto.

### Tests (RED)

- [ ] T035 [US5] Write E2E test for favorite page selector (select option, verify auto-save) appended to `__tests__/e2e/settings-preferences.spec.ts`
- [ ] T036 [P] [US5] Write E2E test for root redirect (authenticated → favorite page, unauthenticated → /login, fallback to /dashboard) in `__tests__/e2e/redirect.spec.ts`

### Implementation (GREEN)

- [ ] T037 [P] [US5] Create `FavoritePageSelector` component in `src/components/features/settings/favorite-page-selector.tsx` — `use client`, shadcn Select dropdown with navigable pages, `useAutoSavePreference`
- [ ] T038 [US5] Integrate `FavoritePageSelector` into settings page `src/app/(authenticated)/settings/page.tsx` — in the Navegação card, pass current favoritePage as initial value
- [ ] T039 [US5] Replace `src/app/page.tsx` with server-side redirect — check auth session, if authenticated fetch favorite page and `redirect()`, if not `redirect('/login')`. Fallback to `/dashboard` if favorite route invalid

**Checkpoint**: Root redirect works. Favorite page selectable and persisted. E2E tests GREEN.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, accessibility, and cleanup.

- [ ] T040 [P] Verify all pages pass visual comparison at 3 breakpoints (mobile < 640px, tablet 640–1024px, desktop > 1024px)
- [ ] T041 [P] Verify no hardcoded color/spacing values remain in modified files (grep for hex colors, px values outside design tokens)
- [ ] T042 [P] Verify all `use client` directives have justification comments
- [ ] T043 Run full test suite (`bun run test`) and verify all tests pass
- [ ] T044 Run quickstart.md validation — follow setup steps on clean checkout
- [ ] T045 Self-review checklist per constitution (Princípios I–XIV)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on T003, T005 from Phase 1
- **Phase 3 (US1 - Login)**: Depends on Phase 1 (CSS tokens). Can start after T001–T002. Also needs Phase 2 for post-login redirect (T017)
- **Phase 4 (US2 - Sidebar)**: No dependencies on Phase 2 — can start after Phase 1
- **Phase 5 (US3 - Settings)**: No dependencies on Phase 2 — can start after Phase 1
- **Phase 6 (US4 - Preferences)**: Depends on Phase 2 (API) + Phase 5 (settings page structure)
- **Phase 7 (US5 - Redirect)**: Depends on Phase 2 (API) + Phase 6 (preference selectors exist)
- **Phase 8 (Polish)**: Depends on all desired phases being complete

### User Story Dependencies

```
Phase 1 (Setup)
  ├── Phase 2 (Foundational) ──┬── Phase 6 (US4: Preferences) ── Phase 7 (US5: Redirect)
  ├── Phase 3 (US1: Login) ────┘
  ├── Phase 4 (US2: Sidebar) [independent]
  └── Phase 5 (US3: Settings) ── Phase 6 (US4: Preferences)
```

- **US1 (Login)** + **US2 (Sidebar)** + **US3 (Settings)**: Can start in parallel after Phase 1
- **US4 (Preferences)**: Needs Phase 2 + US3 (settings page exists)
- **US5 (Redirect)**: Needs US4 (preferences functional)

### Parallel Opportunities Per Phase

| Phase | Parallel Tasks |
|-------|---------------|
| Phase 1 | T001+T002 (CSS), T003+T004 (DB), T005+T006 (domain) |
| Phase 2 | T008+T009+T010 (tests), T011 can parallel with T012 if interface defined first |
| Phase 3 | T016+T017 after T015 |
| Phase 4 | T018+T019 (tests), T020+T021 (hook + toggle button) |
| Phase 5 | T025+T026 after T024 |
| Phase 6 | T027 (single test file), T030+T031+T032 (selectors) |
| Phase 7 | T036+T037 (different files), T037 in parallel once tests written |
| Phase 8 | T040+T041+T042 all parallel |

---

## Parallel Example: Phase 6 (User Story 4)

```bash
# T027: Single E2E test file covering all preference selectors (theme, font, color)

# Launch all selector components together (GREEN phase — different files):
Task: "Create ThemeSelector in src/components/features/settings/theme-selector.tsx"
Task: "Create FontSizeSelector in src/components/features/settings/font-size-selector.tsx"
Task: "Create PrimaryColorSelector in src/components/features/settings/primary-color-selector.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (CSS tokens + DB schema + domain types)
2. Complete Phase 2: Foundational (repository + service + API)
3. Complete Phase 3: User Story 1 (Login page restyled + post-login redirect)
4. **STOP and VALIDATE**: Login page matches design, redirects correctly
5. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation ready
2. Add US1 (Login) → Test independently → Deploy/Demo (MVP!)
3. Add US2 (Sidebar) + US3 (Settings) → Test independently → Deploy/Demo
4. Add US4 (Preferences) → Test independently → Deploy/Demo
5. Add US5 (Redirect) → Test independently → Deploy/Demo
6. Phase 8 (Polish) → Final validation

### Parallel Team Strategy

With multiple developers after Phase 1 + Phase 2:

- Developer A: US1 (Login) → US4 (Preferences)
- Developer B: US2 (Sidebar) → US5 (Redirect)
- Developer C: US3 (Settings) → Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- TDD is mandatory (constitution Princípio V): write tests FIRST, verify FAIL, then implement
- Commit after each task or logical group
- All CSS colors in OKLch (match existing `globals.css` convention)
- Auto-save uses debounced PATCH (300ms) per research.md decision R5
- Sidebar state via cookie (not localStorage) per research.md decision R4