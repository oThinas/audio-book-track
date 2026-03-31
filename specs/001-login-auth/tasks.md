# Tasks: Login e Autenticação

**Input**: Design documents from `/specs/001-login-auth/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-api.md

**Tests**: TDD é obrigatório (Constituição Princípio V). Testes são escritos ANTES da implementação.

**Organization**: Tasks são agrupadas por user story para permitir implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências)
- **[Story]**: User story associada (US1, US2, US3, US4, US5)
- Caminhos de arquivo exatos em cada descrição

---

## Phase 1: Setup (Project Scaffolding)

**Purpose**: Inicializar o projeto Next.js com todas as dependências e ferramentas configuradas.

- [x] T001 Initialize Next.js project with Bun and TypeScript in project root (`bunx create-next-app@latest . --typescript --tailwind --eslint=false --app --src-dir=true --import-alias="@/*"`)
- [x] T002 Install core dependencies: better-auth, drizzle-orm, drizzle-kit, pg, @neondatabase/serverless, zod, react-hook-form, @hookform/resolvers, lucide-react
- [x] T003 Install dev dependencies: vitest, @vitejs/plugin-react, supertest, @faker-js/faker, @types/pg, @types/supertest
- [x] T004 [P] Remove ESLint config and install Biome; create `biome.json` with formatter and linter rules
- [x] T005 [P] Create `.env.example` with DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, NODE_ENV
- [x] T006 [P] Create `drizzle.config.ts` with PostgreSQL connection and schema path pointing to `lib/db/schema.ts`
- [x] T007 [P] Configure Vitest in `vitest.config.ts` with path aliases matching `tsconfig.json`
- [x] T008 Initialize shadcn/ui (`bunx shadcn@latest init`) and add components: button, input, card, label, sonner
- [x] T009 [P] Update `package.json` scripts: `db:migrate`, `db:seed`, `db:studio`, `test`, `test:e2e`, `lint`, `lint:fix`

**Checkpoint**: Projeto inicializado, dependências instaladas, ferramentas configuradas. `bun run dev` funciona com página padrão do Next.js.

---

## Phase 2: Foundational (Database + Auth Infrastructure)

**Purpose**: Infraestrutura de banco de dados e autenticação que DEVE estar completa antes de qualquer user story.

**⚠️ CRITICAL**: Nenhum trabalho de user story pode começar até esta fase estar completa.

- [x] T010 Create Drizzle database instance with pg pool connection in `lib/db/index.ts`
- [x] T011 Create auth database schema (user, session, account, verification tables) in `lib/db/schema.ts` following data-model.md — include username field from better-auth username plugin, timestamptz for dates, indices on FKs
- [x] T012 Create better-auth server configuration in `lib/auth/server.ts`: drizzleAdapter with provider "pg", username plugin (minLength: 3, maxLength: 30), emailAndPassword enabled with disableSignUp: true, session expiresIn: 604800 and updateAge: 86400, rate limiting (window: 60, max: 3), cookie config (httpOnly, secure, sameSite: "lax")
- [x] T013 Create better-auth client in `lib/auth/client.ts` using `createAuthClient` with username plugin for browser usage
- [x] T014 [P] Create Zod validation schemas in `lib/schemas/auth.ts`: loginSchema with username (regex `/^[a-zA-Z0-9_]{3,30}$/`) and password (min 6 chars)
- [x] T015 Create catch-all auth route handler in `app/api/auth/[...all]/route.ts` that delegates to better-auth `auth.handler`
- [x] T016 Create database migration script in `lib/db/migrate.ts` using drizzle-kit migrate
- [x] T017 Create seed script in `lib/db/seed.ts` that inserts a test user (username: "admin", password: "admin123", name: "Administrador", email: "admin@audiobook.local") — seed usa instância separada do better-auth com disableSignUp: false para bypass
- [x] T018 Run initial migration to create auth tables (`bun run db:migrate`)
- [x] T019 Create root layout in `app/layout.tsx` with fonts (next/font), Tailwind globals, Toaster provider (sonner)

**Checkpoint**: Banco de dados com schema criado, auth configurado, seed executável. Rotas de API do better-auth respondem.

---

## Phase 3: User Story 1 — Fazer login com username e senha (P1) 🎯 MVP

**Goal**: Usuário com credenciais no banco consegue fazer login e ser redirecionado ao dashboard.

**Independent Test**: Inserir usuário via seed, acessar `/login`, preencher username e senha, verificar redirecionamento ao `/dashboard`.

### Tests for User Story 1

> **TDD: Escrever estes testes PRIMEIRO, verificar que FALHAM antes da implementação**

- [x] T020 [P] [US1] Write unit tests for loginSchema validation (valid username, invalid chars, too short, too long, empty password, short password) in `__tests__/unit/schemas/auth.test.ts`
- [x] T021 [P] [US1] Write integration tests for sign-in flow (correct credentials → 200 + session cookie, wrong password → 401 generic error, nonexistent username → 401 generic error, empty fields → validation error, verify password in DB is hashed and not plaintext — FR-010) in `__tests__/integration/auth/auth.test.ts`

### Implementation for User Story 1

- [x] T022 [P] [US1] Create login form component in `components/features/auth/login-form.tsx` — `use client` with react-hook-form + zod resolver, username and password fields using shadcn Input/Label/Button, onError shows toast via sonner, onSuccess redirects to `/dashboard`
- [x] T023 [US1] Create login page in `app/(auth)/login/page.tsx` — Server Component rendering LoginForm inside shadcn Card, centered layout, app title
- [x] T024 [US1] Create dashboard placeholder page in `app/(authenticated)/dashboard/page.tsx` — Server Component with welcome message and placeholder areas for future KPIs/gráficos (FR-013)
- [x] T025 [US1] Run seed (`bun run db:seed`) and verify login flow end-to-end: login → session cookie set → redirect to dashboard
- [x] T026 [US1] Verify all US1 tests pass: `bun run test __tests__/unit/schemas/` and `bun run test __tests__/integration/auth/`

**Checkpoint**: Login funcional com username e senha. Usuário autenticado vê o dashboard. Testes passando.

---

## Phase 4: User Story 2 — Proteção de rotas autenticadas (P1)

**Goal**: Visitantes não autenticados são redirecionados ao login. Usuários autenticados na página de login são redirecionados ao dashboard.

**Independent Test**: Acessar `/dashboard` sem sessão → redirecionado a `/login`. Acessar `/login` com sessão → redirecionado a `/dashboard`.

### Tests for User Story 2

> **TDD: Escrever estes testes PRIMEIRO, verificar que FALHAM antes da implementação**

- [x] T027 [P] [US2] Write e2e tests for route protection (unauthenticated → redirect to /login, authenticated → access dashboard, authenticated → /login redirects to /dashboard) in `__tests__/e2e/auth/login.test.ts`

### Implementation for User Story 2

- [x] T028 [US2] Create Next.js middleware in `middleware.ts` using `getSessionCookie` from `better-auth/cookies`: redirect unauthenticated users to `/login` for all routes except `/login` and `/api/auth/*`; redirect authenticated users from `/login` to `/dashboard` (FR-005, FR-011)
- [x] T029 [US2] Verify all US2 tests pass: `bun run test __tests__/e2e/auth/`

**Checkpoint**: Todas as rotas protegidas. Redirecionamentos funcionando corretamente.

---

## Phase 5: User Story 3 — Persistência de sessão por 7 dias (P1)

**Goal**: Sessão persiste por 7 dias mesmo após fechar o navegador. Após 7 dias, sessão expira.

**Independent Test**: Fazer login, verificar cookie com maxAge de 604800 segundos. Verificar que `expiresAt` na sessão é 7 dias após criação.

### Tests for User Story 3

> **TDD: Escrever estes testes PRIMEIRO, verificar que FALHAM antes da implementação**

- [x] T030 [US3] Write integration test for session persistence (login → verify session expiresAt is 7 days from now, verify cookie maxAge = 604800, verify session stored in database with correct expiration) in `__tests__/integration/auth/session.test.ts`

### Implementation for User Story 3

- [x] T031 [US3] Verify better-auth session config in `lib/auth/server.ts` has `expiresIn: 604800`, `updateAge: 86400`, and `cookieCache: { enabled: true, maxAge: 300 }` — adjust if tests fail
- [x] T032 [US3] Verify all US3 tests pass: `bun run test __tests__/integration/auth/session.test.ts`

**Checkpoint**: Sessões persistem por 7 dias. Cookie configurado corretamente.

---

## Phase 6: User Story 4 — Fazer logout (P2)

**Goal**: Usuário autenticado pode encerrar sessão via botão de logout na sidebar.

**Independent Test**: Fazer login, clicar logout, verificar redirecionamento ao login e que rota protegida exige novo login.

### Tests for User Story 4

> **TDD: Escrever estes testes PRIMEIRO, verificar que FALHAM antes da implementação**

- [ ] T033 [P] [US4] Write integration test for logout (authenticated user → sign-out → session invalidated → redirect to login, verify cookie cleared) in `__tests__/integration/auth/logout.test.ts`

### Implementation for User Story 4

- [ ] T034 [US4] Create sidebar component in `components/layout/sidebar.tsx` — Server Component com nav link para Dashboard (Lucide Home icon) e nome do usuário. Extrair botão de logout em componente `use client` separado (`components/features/auth/logout-button.tsx`) que chama `authClient.signOut()` e redireciona para `/login` (FR-012). Justificar `use client` no componente conforme Princípio XII.
- [ ] T035 [US4] Create authenticated layout in `app/(authenticated)/layout.tsx` — Server Component that renders sidebar + main content area via `children` prop
- [ ] T036 [US4] Verify all US4 tests pass: `bun run test __tests__/integration/auth/logout.test.ts`

**Checkpoint**: Sidebar funcional com Dashboard link, nome do usuário e logout. Logout encerra sessão corretamente.

---

## Phase 7: User Story 5 — Ambiente de desenvolvimento com Docker (P2)

**Goal**: Desenvolvedor sobe todo o ambiente com um único comando.

**Independent Test**: Executar `docker compose up`, verificar que PostgreSQL está rodando, aplicação responde em `localhost:3000` e página de login é exibida.

### Implementation for User Story 5

- [ ] T037 [P] [US5] Create `docker-compose.yml` with services: `db` (PostgreSQL 16, volume persistente, port 5432, env vars) and `app` (build from Dockerfile, port 3000, depends_on db, env vars from .env)
- [ ] T038 [P] [US5] Create `Dockerfile` with multi-stage build: base (bun), deps (install), build (next build), runner (production image with minimal footprint)
- [ ] T039 [US5] Create startup script or docker-compose command that runs migrations and seed on first boot
- [ ] T040 [US5] Verify full environment: `docker compose up -d`, wait for healthy, access `http://localhost:3000`, verify login page displays

**Checkpoint**: Ambiente de desenvolvimento completo com um comando. PostgreSQL + App funcionando.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verificação final, cobertura de testes e edge cases.

- [ ] T041 [P] Write unit test for rate limiting: verify 429 response after 3 failed attempts in 1 minute in `__tests__/integration/auth/rate-limit.test.ts` (FR-009)
- [ ] T042 [P] Write integration test for sign-up blocked: verify POST to `/api/auth/sign-up/email` and `/api/auth/sign-up/username` return error in `__tests__/integration/auth/signup-blocked.test.ts` (FR-002)
- [ ] T043 Verify error messages are generic (no username existence leak, no SQL details) across all auth error responses (FR-008, SC-005)
- [ ] T044 Run full test suite and verify coverage >= 80% overall with 100% on `lib/validations/auth.ts`: `bun run test --coverage`
- [ ] T045 Run Biome lint and fix any issues: `bun run lint:fix`
- [ ] T046 Validate quickstart.md: follow all steps on a clean environment and verify the complete flow works
- [ ] T047 Final self-review checklist per constitution (Princípios I–XII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — começa imediatamente
- **Foundational (Phase 2)**: Depende de Phase 1 — BLOQUEIA todas as user stories
- **US1 Login (Phase 3)**: Depende de Phase 2
- **US2 Route Protection (Phase 4)**: Depende de Phase 3 (precisa do login funcional para testar redirecionamentos)
- **US3 Session Persistence (Phase 5)**: Depende de Phase 3 (precisa do login funcional para verificar sessão)
- **US4 Logout + Sidebar (Phase 6)**: Depende de Phase 3 (precisa do login funcional e dashboard existente)
- **US5 Docker (Phase 7)**: Pode iniciar após Phase 2, mas idealmente após Phase 6 para validação completa
- **Polish (Phase 8)**: Depende de todas as user stories

### User Story Dependencies

- **US1 (P1)**: Começa após Phase 2 — sem dependência de outras stories
- **US2 (P1)**: Depende de US1 (middleware precisa de login funcional para testar)
- **US3 (P1)**: Depende de US1 (sessão criada pelo login)
- **US4 (P2)**: Depende de US1 (sidebar exibida no dashboard)
- **US5 (P2)**: Independente das outras stories (infra), mas validação completa após US4

### Within Each User Story

- Testes escritos PRIMEIRO e FALHAM antes da implementação (TDD)
- Schema/Models antes de Services
- Services antes de UI
- Implementação core antes de integração
- Story completa antes de avançar para próxima prioridade

### Parallel Opportunities

- T004, T005, T006, T007, T009 podem rodar em paralelo (Phase 1)
- T014 pode rodar em paralelo com T010-T013 (Phase 2)
- T020 e T021 podem rodar em paralelo (Phase 3 — testes)
- T027 pode rodar em paralelo com testes de US3 e US4 (se já houver login funcional)
- T037 e T038 podem rodar em paralelo (Phase 7 — Docker)
- T041 e T042 podem rodar em paralelo (Phase 8 — testes edge case)

---

## Parallel Example: User Story 1

```bash
# Testes em paralelo (TDD — escrever primeiro, devem FALHAR):
Task T020: "Unit tests for loginSchema in __tests__/unit/validations/auth.test.ts"
Task T021: "Integration tests for sign-in flow in __tests__/integration/auth/auth.test.ts"

# Após testes falhando, implementar componentes em paralelo:
Task T022: "Login form component in components/features/auth/login-form.tsx"
Task T024: "Dashboard placeholder in app/(authenticated)/dashboard/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — bloqueia tudo)
3. Complete Phase 3: User Story 1 (Login)
4. **STOP and VALIDATE**: Testar login end-to-end independentemente
5. Deploy/demo se necessário

### Incremental Delivery

1. Setup + Foundational → Infraestrutura pronta
2. US1 Login → Testar independentemente → MVP funcional!
3. US2 Route Protection → Testar independentemente → Segurança básica
4. US3 Session Persistence → Testar independentemente → UX completa
5. US4 Logout + Sidebar → Testar independentemente → Navegação completa
6. US5 Docker → Validar ambiente → DX completa
7. Polish → Cobertura, edge cases, lint → Release-ready

### Notas

- Cada story adiciona valor sem quebrar as anteriores
- Commit após cada task ou grupo lógico
- Parar em qualquer checkpoint para validar story independentemente

---

## Notes

- [P] tasks = arquivos diferentes, sem dependências
- [Story] label mapeia task para user story específica
- TDD obrigatório: testes falham ANTES da implementação
- Cobertura >= 80% geral, 100% em validações de auth
- Evitar: tasks vagas, conflitos de arquivo, dependências cross-story que quebrem independência