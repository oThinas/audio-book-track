# Tasks: Mobile Sidebar Menu

**Input**: Design documents from `/specs/013-mobile-sidebar-menu/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: TDD obrigatório (constituição Princípio V). Unit tests para hooks, E2E tests para comportamento visual.

**Organization**: Tasks agrupadas por user story. US1+US2 são ambos P1 mas US2 depende de US1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extrair constantes de navegação compartilhadas entre Sidebar desktop e MobileSidebar

- [x] T001 Create shared navigation constants in src/lib/constants/navigation.ts (extract NAV_ITEMS and BOTTOM_ITEMS from sidebar.tsx, export NavigationItem type)
- [x] T002 Update src/components/layout/sidebar.tsx to import NAV_ITEMS, BOTTOM_ITEMS from src/lib/constants/navigation.ts (remove inline declarations)

**Quality Gate**: `bun run lint` e `bun run build` — sem erros ou warnings.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Hook de estado e testes unitários — DEVEM estar completos antes de qualquer user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Write unit tests for useMobileMenu hook in __tests__/unit/hooks/use-mobile-menu.test.ts (RED — test isOpen state, toggle, close, Escape key handler; tests MUST fail before implementation)
- [x] T004 Implement useMobileMenu hook in src/lib/hooks/use-mobile-menu.ts (GREEN — isOpen state, toggle callback, close callback, Escape keydown handler; tests from T003 MUST pass)

**Checkpoint**: Hook testado e funcional. User stories podem começar.

**Quality Gate**: `bun run lint`, `bun run test:unit`, e `bun run build` — sem erros ou warnings.

---

## Phase 3: User Story 1 — Navegar pelo app no celular (Priority: P1) 🎯 MVP

**Goal**: No mobile (< 768px), a sidebar lateral é escondida e substituída por um header fixo com botão "Menu" no canto superior esquerdo. Desktop permanece inalterado.

**Independent Test**: Acessar qualquer página autenticada em viewport mobile (< 768px) e verificar que a sidebar não aparece e o botão "Menu" está visível no canto superior esquerdo. Em viewport desktop (≥ 768px), sidebar funciona normalmente.

### Implementation for User Story 1

- [ ] T005 [P] [US1] Create MobileHeader component in src/components/layout/mobile-header.tsx (fixed header with ghost Button "Menu" using Lucide Menu/X icons as placeholder, md:hidden visibility, sidebar color tokens for background)
- [ ] T006 [P] [US1] Add responsive hiding to Sidebar in src/components/layout/sidebar.tsx (add `hidden md:flex` to the aside element, preserving all existing desktop behavior)
- [ ] T007 [US1] Update AuthenticatedLayoutClient in src/app/(authenticated)/layout-client.tsx (add MobileHeader above content area, add useMobileMenu hook, restructure layout for responsive: flex-col wrapper with MobileHeader visible only on mobile, Sidebar visible only on desktop)

**Checkpoint**: Em viewport mobile, sidebar está escondida e header com botão "Menu" é visível. Em desktop, tudo funciona como antes.

**Quality Gate**: `bun run lint`, `bun run test:unit`, e `bun run build` — sem erros ou warnings.

---

## Phase 4: User Story 2 + User Story 4 — Abrir e fechar menu de navegação (Priority: P1 + P2)

**Goal**: Ao tocar no botão "Menu", um painel de navegação desliza da esquerda ocupando toda a viewport abaixo do header. O painel pode ser fechado pelo botão, tecla Escape, ou ao navegar para uma página. Focus trap ativo quando aberto, foco retorna ao botão ao fechar.

**Independent Test**: Em viewport mobile, tocar em "Menu", verificar que o painel abre com todos os itens de navegação. Tocar em um item, verificar que navega e fecha o menu. Pressionar Escape, verificar que fecha.

**Note**: US4 (fechar menu) é inseparável de US2 (abrir menu) na implementação — ambos usam o mesmo componente e hook.

### Implementation for User Story 2 + User Story 4

- [ ] T008 [US2] Create MobileSidebar component in src/components/layout/mobile-sidebar.tsx (fullscreen overlay below header, slide-in from left via CSS transform, imports NAV_ITEMS and BOTTOM_ITEMS from navigation.ts, renders all nav items + settings + logout, focus trap on open, md:hidden visibility; add inline comment referencing plan.md D5 justifying div usage over shadcn Sheet per constitution Principle VII)
- [ ] T009 [US2] Integrate MobileSidebar into AuthenticatedLayoutClient in src/app/(authenticated)/layout-client.tsx (pass isOpen and onClose from useMobileMenu, wire onNavigate to close menu)
- [ ] T010 [US4] Add close-on-navigate effect in src/app/(authenticated)/layout-client.tsx (useEffect watching pathname from usePathname — when pathname changes while menu is open, call close; ensures menu auto-closes after navigation)
- [ ] T011 [US4] Add focus return logic in src/components/layout/mobile-sidebar.tsx (when panel closes, return focus to the Menu button ref in MobileHeader)

**Checkpoint**: Menu mobile abre com slide-in, exibe todos os itens, fecha via botão/Escape/navegação. Focus trap funciona. Desktop inalterado.

**Quality Gate**: `bun run lint`, `bun run test:unit`, e `bun run build` — sem erros ou warnings.

---

## Phase 5: User Story 3 — Animação do ícone hambúrguer para X (Priority: P2)

**Goal**: O ícone do botão "Menu" transiciona suavemente de hambúrguer (≡) para X (✕) ao abrir/fechar o menu, com duração de 200–400ms. Respeita `prefers-reduced-motion`.

**Independent Test**: Em viewport mobile, abrir e fechar o menu e observar a transição animada do ícone. Com `prefers-reduced-motion` ativado, a transição é instantânea.

### Implementation for User Story 3

- [ ] T012 [US3] Create HamburgerIcon component in src/components/layout/hamburger-icon.tsx (3 spans with CSS transitions: top bar rotates +45deg, middle bar fades out via opacity, bottom bar rotates -45deg; duration 300ms ease-in-out; uses bg-current for theme compatibility; accepts isOpen prop)
- [ ] T013 [US3] Replace Lucide Menu/X placeholder in MobileHeader in src/components/layout/mobile-header.tsx (swap Lucide icons for HamburgerIcon component, pass isOpen prop)
- [ ] T014 [US3] Add prefers-reduced-motion support to HamburgerIcon in src/components/layout/hamburger-icon.tsx (add motion-reduce:transition-none Tailwind class to all animated spans)

**Checkpoint**: Ícone anima suavemente entre ≡ e ✕. Com reduced-motion, transição é instantânea.

**Quality Gate**: `bun run lint`, `bun run test:unit`, e `bun run build` — sem erros ou warnings.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: E2E tests, verificação de regressão, dark mode, e validação final

- [ ] T015 [P] Write E2E tests for mobile sidebar in __tests__/e2e/mobile-sidebar.spec.ts (viewport 375x667: verify sidebar hidden, header visible, menu opens/closes, navigation works, Escape closes, icon animation present, all nav items rendered)
- [ ] T016 [P] Verify existing E2E sidebar-toggle.spec.ts passes at desktop viewport (1280x720) — no regression in desktop sidebar behavior
- [ ] T017 Visual review: verify dark mode and all 5 primary color palettes (blue, orange, green, red, amber) render correctly for MobileHeader and MobileSidebar
- [ ] T018 Run full verification suite: `bun run lint`, `bun run test:unit`, `bun run test:e2e`, `bun run build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (navigation constants must exist for tests)
- **US1 (Phase 3)**: Depends on Phase 2 (useMobileMenu hook must exist)
- **US2+US4 (Phase 4)**: Depends on Phase 3 (MobileHeader and responsive layout must exist)
- **US3 (Phase 5)**: Depends on Phase 3 (MobileHeader must exist to replace placeholder icon)
- **Polish (Phase 6)**: Depends on Phases 3–5 completion

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational — no dependency on other stories
- **US2+US4 (P1+P2)**: Depends on US1 (header + responsive layout must exist)
- **US3 (P2)**: Depends on US1 (MobileHeader must exist); independent of US2

### Within Each User Story

```
T005 ──┐
       ├── T007 (layout-client depends on MobileHeader + Sidebar changes)
T006 ──┘

T008 ──── T009 ──── T010
                      │
                      T011

T012 ──── T013 ──── T014
```

### Parallel Opportunities

- **Phase 1**: T001 → T002 (sequential — T002 depends on T001)
- **Phase 3**: T005 [P] and T006 [P] can run in parallel (different files), then T007 depends on both
- **Phase 5**: T012 → T013 → T014 (sequential within same files)
- **Phase 6**: T015 [P] and T016 [P] can run in parallel (different test files)

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# Launch in parallel (different files):
Task T005: "Create MobileHeader in src/components/layout/mobile-header.tsx"
Task T006: "Add hidden md:flex to Sidebar in src/components/layout/sidebar.tsx"

# Then sequential (depends on both):
Task T007: "Update layout-client.tsx with responsive layout"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (extract navigation constants)
2. Complete Phase 2: Foundational (useMobileMenu hook + tests)
3. Complete Phase 3: User Story 1 (responsive layout)
4. **STOP and VALIDATE**: Test — mobile shows header, desktop shows sidebar
5. This is a functional MVP: users can see the responsive layout

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. US1 → Responsive layout works → **MVP!**
3. US2+US4 → Navigation panel opens/closes → **Fully navigable on mobile**
4. US3 → Animated icon → **Polished experience**
5. Polish → E2E tests + visual review → **Production ready**

---

## Notes

- TDD obrigatório: T003 (unit tests) DEVE ser escrito e falhar ANTES de T004 (implementação)
- Constitution D5 justification: MobileSidebar usa div ao invés de shadcn Sheet — ver plan.md D5
- Navigation constants são compartilhados para evitar duplicação (DRY)
- Focus trap é manual (~20 linhas) por YAGNI — sem biblioteca extra
- Animações usam apenas propriedades compositor-friendly (transform, opacity)
- prefers-reduced-motion deve desativar todas as animações (ícone + slide)
