# Tasks: Hardening, SEO & tooling (D6 + D7 + D8)

**Input**: Design documents from `/specs/040-seo-hardening-diagnostics/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUÍDOS — a constituição (Princípio V) exige TDD; testes são escritos e falham
(RED) antes da implementação.

**Organization**: Tarefas agrupadas por user story. As três stories são **independentes** —
ordem das fases segue a prioridade (US1=D6, US2=D7, US3=D8), mas a execução recomendada é
**quick-wins-first** (ver Implementation Strategy).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: US1 (D6), US2 (D7), US3 (D8)

## Path Conventions

Projeto único Next.js: produção em `src/`, scripts em `scripts/`, testes em `__tests__/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialização compartilhada.

- Nenhuma tarefa de setup compartilhado. As três correções são autocontidas; a única
  dependência nova (`puppeteer-core`) é específica do D8 e vive na fase da US3.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pré-requisitos bloqueantes para todas as stories.

- Nenhuma. As três user stories são totalmente independentes e podem começar imediatamente.

**Checkpoint**: Sem fundação a aguardar — qualquer story pode iniciar.

---

## Phase 3: User Story 1 - Remover efeito colateral do fluxo de limpeza de sessão (Priority: P1) 🎯 MVP

**Goal**: Eliminar o side effect em GET. Deletar o route handler GET `clear-session`; a
limpeza da sessão órfã passa para o middleware (`src/proxy.ts`) via `/login?reauth=1`,
prefix-aware. Logout interativo (`signOut`) inalterado.

**Independent Test**: `react-doctor --verbose` sem "Side effect in GET handler"; E2E de logout
verde; visitar `/login?reauth=1` com cookie remove os cookies de sessão e permanece em
`/login`; rota protegida pós-logout redireciona a `/login`.

### Tests for User Story 1 (TDD — escrever PRIMEIRO, devem FALHAR) ⚠️

- [ ] T001 [P] [US1] Reescrever os testes do middleware em `__tests__/unit/proxy/proxy.spec.ts`: (a) `/login?reauth=1` com cookie → status 200, **sem** redirect, e `Set-Cookie` removendo `better-auth.session_token`/`session_data` (+ variantes `__Secure-`); (b) `/login?reauth=1` **sem** cookie → 200 renderiza `/login`; (c) `/login` com cookie **sem** `reauth` → 307 para `/dashboard` (bounce preservado); **remover** o teste "allow unauthenticated access to /api/auth/clear-session" (linha ~80). (RED)
- [ ] T002 [P] [US1] Atualizar o helper de logout E2E em `__tests__/e2e/auth/logout.spec.ts` de `page.goto("/api/auth/clear-session")` para `page.goto("/login?reauth=1")`.
- [ ] T003 [P] [US1] Atualizar o logout E2E em `__tests__/e2e/settings-preferences.spec.ts` (linha ~67) de `/api/auth/clear-session` para `/login?reauth=1`.

### Implementation for User Story 1

- [ ] T004 [US1] Implementar a limpeza da sessão órfã em `src/proxy.ts`: adicionar, **antes** da regra "cookie + `/login` → `/dashboard`", um ramo que detecta `pathname === "/login"` + `request.nextUrl.searchParams.has("reauth")`, monta `NextResponse.next()`, apaga todos os cookies de sessão do better-auth via `response.cookies.delete({ name, path: "/" })` para `better-auth.session_token`, `better-auth.session_data` e as variantes `__Secure-`, e retorna. (depende de T001)
- [ ] T005 [P] [US1] Trocar `redirect("/api/auth/clear-session")` por `redirect("/login?reauth=1")` em `src/app/(authenticated)/layout.tsx` (linha ~21).
- [ ] T006 [P] [US1] Deletar o route handler GET `src/app/api/auth/clear-session/route.ts` e seu teste unit `__tests__/unit/api/auth/clear-session.spec.ts`.
- [ ] T007 [US1] Verificar: `bun run test:unit` (proxy) verde; `bun run diagnose:react` (`react-doctor --verbose`) com **zero** "Side effect in GET handler"; `bun run test:e2e` (logout) verde. (depende de T002–T006)

**Checkpoint**: US1 funcional e testável isoladamente (SC-002, SC-003).

---

## Phase 4: User Story 2 - Política de robots válida para SEO (Priority: P2)

**Goal**: Publicar `src/app/robots.ts` permissivo (`userAgent: '*'`, `allow: '/'`) → audit
`robots-txt` aprova sem reprovar `is-crawlable` → SEO = 100.

**Independent Test**: `curl /robots.txt` retorna `User-Agent: *` / `Allow: /` sem sessão;
Lighthouse SEO = 100 com `robots-txt` e `is-crawlable` aprovados.

### Tests for User Story 2 (TDD — escrever PRIMEIRO, devem FALHAR) ⚠️

- [ ] T008 [P] [US2] Novo teste unit `__tests__/unit/app/robots.spec.ts`: o default export `robots()` retorna `{ rules: { userAgent: "*", allow: "/" } }` — sem `disallow` bloqueante e sem `sitemap`. (RED)
- [ ] T009 [P] [US2] Novo teste E2E `__tests__/e2e/robots.spec.ts` (**sem** login): `GET /robots.txt` → status 200 e corpo contém `Allow: /` — confirma acessibilidade pública (FR-007) e conteúdo (FR-006). (RED)

### Implementation for User Story 2

- [ ] T010 [US2] Criar `src/app/robots.ts` exportando `default function robots(): MetadataRoute.Robots` com `{ rules: { userAgent: "*", allow: "/" } }`. (depende de T008, T009)
- [ ] T011 [US2] Verificar: `bun run test:unit` (robots) verde; `bun run test:e2e` (robots público) verde; `bun run diagnose:lighthouse` → `seo=100` nas páginas auditadas, com `robots-txt` e `is-crawlable` aprovados nos `.lighthouse/*.json`. (SC-001)

**Checkpoint**: US2 funcional e testável isoladamente (SC-001).

---

## Phase 5: User Story 3 - Diagnóstico cobre o modal de configuração (Priority: P3)

**Goal**: Habilitar o snapshot do modal interceptado no `scripts/diagnostics/lighthouse.ts`
via `puppeteer-core` + flow API; remover o warning de skip; degradar graciosamente.

**Independent Test**: `bun run diagnose:lighthouse` gera `.lighthouse/settings-modal.{html,json}`
e **não** imprime "Skipped settings-modal snapshot".

### Story Setup for User Story 3

- [ ] T012 [US3] Adicionar `puppeteer-core` às `devDependencies` (`bun add -d puppeteer-core`) e confirmar que **não** entra em `dependencies` (fora do bundle de produção).

### Implementation for User Story 3

- [ ] T013 [US3] Estender `scripts/diagnostics/lighthouse.ts` (substituindo o bloco de skip nas linhas ~159-169): conectar `puppeteer-core` via `connect({ browserURL: http://localhost:${debugPort} })`; **definir viewport desktop** `page.setViewport({ width: 1280, height: 800 })` (≥1024px) **antes** do clique — a sidebar com `[data-testid="sidebar"]` é desktop-only (`hidden md:flex`); `page.setCookie(...)` com os cookies do admin já extraídos; `goto(${baseURL}/dashboard)`; clicar em `[data-testid="sidebar"] a[href="/settings"]` (rótulo "Configurações") para abrir o modal interceptado; `const flow = await startFlow(page); await flow.snapshot();`; escrever `.lighthouse/settings-modal.html` (`flow.generateReport()`) e `settings-modal.json` (`flow.createFlowResult()`); remover o `console.warn` de skip; envolver em `try/catch` que loga e **continua** se o link/modal não abrir. (depende de T012)
- [ ] T014 [US3] Verificar: `bun run diagnose:lighthouse` gera `.lighthouse/settings-modal.{html,json}` e não emite o warning de skip. (SC-004)

**Checkpoint**: US3 funcional e testável isoladamente (SC-004).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificação cruzada e qualidade final.

- [ ] T015 Rodar `bun run diagnose` completo (seed + lighthouse + react-doctor) e confirmar os SCs sem **regressão** dos demais scores: SEO=100, react-doctor sem o erro de GET, snapshot do modal presente (SC-005).
- [ ] T016 Fase final de qualidade (antes do PR): `bun run lint` (zero erros/warnings), `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`, `bun run build`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** e **Foundational (Phase 2)**: vazias — nada a aguardar.
- **User Stories (Phase 3–5)**: independentes entre si; podem rodar em paralelo ou em qualquer ordem.
- **Polish (Phase 6)**: depende das três stories concluídas.

### User Story Dependencies

- **US1 (D6)**, **US2 (D7)**, **US3 (D8)**: nenhuma dependência entre si. Tocam arquivos
  disjuntos (`proxy.ts`/layout/route handler vs `robots.ts` vs `lighthouse.ts`).

### Within Each User Story

- Testes (RED) antes da implementação (TDD).
- US1: T001 antes de T004; T007 (verificação) por último.
- US2: T008 e T009 antes de T010; T011 (verificação) por último.
- US3: T012 antes de T013; T014 (verificação) por último.

### Parallel Opportunities

- As três stories podem ser feitas em paralelo por pessoas diferentes.
- Dentro da US1, T001/T002/T003 são `[P]` (arquivos diferentes); T005/T006 são `[P]` entre si.
- Dentro da US2, T008/T009 são `[P]` (unit vs E2E).
- T008/T009 (US2) e T012 (US3) podem rodar em paralelo com a US1.

---

## Parallel Example: User Story 1

```bash
# Testes da US1 em paralelo (RED):
Task: "Reescrever __tests__/unit/proxy/proxy.spec.ts (casos reauth)"
Task: "Atualizar __tests__/e2e/auth/logout.spec.ts → /login?reauth=1"
Task: "Atualizar __tests__/e2e/settings-preferences.spec.ts → /login?reauth=1"

# Implementação de arquivos disjuntos em paralelo:
Task: "Trocar redirect em src/app/(authenticated)/layout.tsx"
Task: "Deletar route + teste de clear-session"
```

---

## Implementation Strategy

### Ordem recomendada: quick-wins-first (US2 → US3 → US1)

Embora a US1 (D6) seja P1 por **severidade**, ela é a mais arriscada (auth/middleware + bug
de cookie em prod). Como as três stories são independentes, a **execução** recomendada é:

1. **US2 (D7)** — `robots.ts` + 2 testes (unit + E2E). Ganho de SEO=100, risco nulo.
2. **US3 (D8)** — devDependency + script de diagnóstico. Sem impacto no produto.
3. **US1 (D6)** — mais pesada/arriscada por último (middleware + E2E + remoção de rota).

Cada story é entregável e verificável isoladamente (parar em qualquer checkpoint).

### MVP

Se for entregar incrementalmente, a US2 (D7) é o menor incremento de maior valor visível
(SEO=100). A US1 (D6) é o item de maior severidade e fecha o objetivo de hardening da sessão.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência.
- TDD: confirmar que os testes falham antes de implementar.
- D8 não tem teste unit (script de I/O puro); verificação é por execução (`diagnose:lighthouse`).
- Sem mudança de banco/domínio; nenhum cálculo de ganho tocado.
- Commits convencionais a cada task ou grupo lógico (somente quando o usuário pedir).
