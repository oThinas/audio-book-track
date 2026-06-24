---
description: "Task list for Performance Audit & Vercel Telemetry"
---

# Tasks: Performance Audit & Vercel Telemetry

**Input**: Design documents from `/specs/039-perf-audit-vercel-analytics/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUÍDOS — TDD é obrigatório (Constituição, Princípio V) e o plano define testes unit + E2E.

**Organization**: Tarefas agrupadas por user story (P1 → P2 → P3). US1 e US2 compartilham a infra de gating (Fase 2 Foundational).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências pendentes)
- **[Story]**: US1, US2, US3 (mapeia para as user stories da spec.md)
- Caminhos de arquivo exatos incluídos em cada descrição

## Path Conventions

Projeto único Next.js: `src/`, `__tests__/`, `scripts/`, `docs/` na raiz do repositório.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Instalar dependências e preparar comandos.

- [ ] T001 Instalar dependências de runtime: `bun add @vercel/speed-insights @vercel/analytics` (atualiza `package.json` + lockfile)
- [ ] T002 Instalar dependências de diagnóstico (dev): `bun add -d lighthouse chrome-launcher` (atualiza `package.json` + lockfile)
- [ ] T003 [P] Adicionar `.lighthouse/` ao `.gitignore` (artefatos brutos não versionados)
- [ ] T004 Adicionar scripts `diagnose`, `diagnose:lighthouse`, `diagnose:react` ao `package.json` (ver contracts/diagnostics-contract.md §C5)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infra de gating compartilhada por US1 e US2. Helper puro + wrapper Server Component + montagem.

**⚠️ CRITICAL**: US1 e US2 não podem montar componentes da Vercel antes desta fase.

- [ ] T005 [P] Adicionar `VERCEL_ENV: z.enum(["production", "preview", "development"]).optional()` ao `src/lib/env/schema.ts` (não participa do `superRefine`)
- [ ] T006 [P] [TDD] Escrever teste unitário (RED) da tabela-verdade de `isTelemetryEnabled` em `__tests__/unit/telemetry/is-telemetry-enabled.spec.ts` (ver data-model.md §1: prod+¬E2E→true; preview/dev/undefined→false; `E2E_TEST_MODE=1`→false)
- [ ] T007 Implementar helper puro `isTelemetryEnabled(env)` em `src/lib/telemetry/is-telemetry-enabled.ts` para passar T006 (sem I/O, sem leitura de `process.env`, sem mutação — contracts/telemetry-contract.md §C1)
- [ ] T008 Criar wrapper Server Component `VercelTelemetry` em `src/components/layout/vercel-telemetry.tsx` (lê `process.env.VERCEL_ENV`/`E2E_TEST_MODE`, chama o helper, retorna `null` quando desabilitado; sem `use client` — §C2)
- [ ] T009 Montar `<VercelTelemetry />` no `<body>` de `src/app/layout.tsx`, após `{children}` e `<Toaster />` (montagem única, cobre rotas públicas e autenticadas — §C3)

**Checkpoint**: Gating pronto e testado (unit). Wrapper monta `null` em qualquer ambiente até US1/US2 adicionarem componentes.

---

## Phase 3: User Story 1 - Telemetria de Web Vitals (Priority: P1) 🎯 MVP

**Goal**: Coletar Core Web Vitals reais (LCP, INP, CLS, FCP, TTFB) de usuários em produção, atribuídos por rota.

**Independent Test**: Em produção, navegar e ver Web Vitals por rota no painel de Speed Insights; em ambiente de teste, nenhum beacon de Speed Insights é disparado.

- [ ] T010 [US1] Renderizar `<SpeedInsights />` (de `@vercel/speed-insights/next`) dentro de `VercelTelemetry` no ramo habilitado, em `src/components/layout/vercel-telemetry.tsx`
- [ ] T011 [US1] [TDD] Teste E2E em `__tests__/e2e/telemetry-gating.spec.ts`: reusando `login()`, asserir que no run E2E (sem `VERCEL_ENV=production`) **não** há requisição a `/_vercel/speed-insights` nem `<script>` de Speed Insights no DOM (prova SC-003 para US1)

**Checkpoint**: US1 funcional e independentemente verificável. **MVP entregável.**

---

## Phase 4: User Story 2 - Analytics de uso (Priority: P2)

**Goal**: Registrar page views (incluindo navegação client-side) atribuídos por rota, cookieless e sem PII.

**Independent Test**: Em produção, navegar (incl. transições soft) e ver page views por rota no painel de Analytics; em teste, nenhum evento de Analytics é disparado.

- [ ] T012 [US2] Renderizar `<Analytics />` (de `@vercel/analytics/next`) dentro de `VercelTelemetry` no ramo habilitado, em `src/components/layout/vercel-telemetry.tsx` (depende de T010 — mesmo arquivo)
- [ ] T013 [US2] [TDD] Estender `__tests__/e2e/telemetry-gating.spec.ts`: asserir que no run E2E **não** há requisição a `/_vercel/insights` (Analytics) nem `<script>` de Analytics no DOM (prova SC-003 para US2)

**Checkpoint**: US1 e US2 funcionais e independentes. Telemetria completa, gateada por ambiente.

---

## Phase 5: User Story 3 - Diagnóstico de baseline (Priority: P3)

**Goal**: Relatório de baseline (Lighthouse + React Doctor) com baseline duplo, consolidado em `docs/diagnostics/`.

**Independent Test**: Rodar `bun run diagnose` produz scores Lighthouse (6 páginas × mobile/desktop × 4 categorias) e achados do React Doctor (6 categorias); relatório curado existe e é regenerável.

- [ ] T014 [P] [US3] Criar `scripts/diagnostics/react-doctor.ts` que executa `bunx react-doctor@latest` na raiz e encaminha a saída (standalone; sem instalar dep — contracts/diagnostics-contract.md §C2). Logging segue a convenção dos scripts existentes em `scripts/db/*` (não introduzir `console.log` em `src/`)
- [ ] T015 [P] [US3] Criar `scripts/diagnostics/lighthouse.ts`: dirige Chromium do Playwright **standalone** (`chromium.launch()`, fora do test runner) reaproveitando o fluxo de login de `__tests__/e2e/helpers/auth.ts` (extrair/adaptar para uma forma utilizável fora do `@playwright/test`, se necessário), roda Lighthouse user-flow — **navigation** para `/`, `/login`, `/dashboard`, `/books`, `/books/:id` e **snapshot/timespan** para o modal de configuração (abrir via navegação soft da intercepting route `@modal/(.)settings`, não URL direta); perfis mobile+desktop; saída em `.lighthouse/` (§C1)
- [ ] T016 [US3] Criar seed de diagnóstico `scripts/diagnostics/seed.ts` que insere **≥1 livro com capítulos** (reusando `createTestBook` de `__tests__/helpers/factories.ts`) numa base local determinística, para o Lighthouse poder auditar `/books`, `/books/:id` e o modal. Pré-requisito de T017/T018
- [ ] T017 [US3] Capturar **baseline PRÉ-instrumentação**: rodar `bun run build && bun run start` + seed (T016) + `bun run diagnose` contra o app **sem** a telemetria montada (antes da Fase 3 ou em checkout limpo) e registrar scores + tamanho de first-load JS (FR-013, foto limpa)
- [ ] T018 [US3] Capturar **baseline PÓS-instrumentação com a telemetria HABILITADA** (`VERCEL_ENV=production` na build/run local, já que o gating renderiza `null` localmente): repetir o run de T017 com US1+US2 montados e a telemetria ativa, registrando scores + first-load JS — esta é a captura que efetivamente expõe o peso da telemetria
- [ ] T019 [US3] Computar e documentar o **delta SC-004** a partir de PRÉ (T017) vs PÓS-habilitado (T018): first-load JS delta `< 5 kb gzipped` (via saída de `next build`), contribuição ao CLS `= 0`, e **evidência de carregamento não-bloqueante** (scripts `async`/fora do caminho crítico no relatório do Lighthouse)
- [ ] T020 [US3] Escrever relatório curado `docs/diagnostics/2026-06-baseline.md` (snapshot datado imutável): scores Lighthouse, achados do React Doctor com severidade+recomendação, seção de delta SC-004, e nota consolidando a11y com os testes `@axe-core/playwright` existentes (data-model.md §4, FR-014, SC-005, SC-007)

**Checkpoint**: Todas as user stories funcionais. Relatório de baseline versionado.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação final e documentação transversal.

- [ ] T021 [P] Atualizar `docs/observability.md`: (a) divisão de métricas — Web Vitals (Speed Insights) + page views (Analytics) centralizados na Vercel, Sentry só-erros com `tracesSampleRate=0` (FR-009); (b) **postura de privacidade** — o que é coletado, cookieless/sem PII, DNT respeitado, sem banner de consentimento (FR-018)
- [ ] T022 [P] Rodar validação do `quickstart.md` (montagem, gating, baseline duplo)
- [ ] T023 Gate de qualidade final: `bun run lint` (zero erros/warnings), `bun run test:unit`, `bun run test:e2e`, `bun run build` (SC-006, FR-016)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — pode começar já.
- **Foundational (Phase 2)**: depende do Setup (deps instaladas, env). **BLOQUEIA US1 e US2.**
- **US1 (Phase 3)**: depende da Fase 2. É o MVP.
- **US2 (Phase 4)**: depende da Fase 2; T012 depende de T010 (mesmo arquivo `vercel-telemetry.tsx`).
- **US3 (Phase 5)**: scripts (T014/T015) e seed (T016) independentes de US1/US2. ⚠️ **T017 (PRÉ-baseline) deve ser capturado antes de US1/US2 montarem a telemetria** (ou de um checkout limpo) para honrar o baseline duplo (FR-013). **T018 (PÓS) exige a telemetria HABILITADA** (`VERCEL_ENV=production` local) — sem isso o gating renderiza `null` e o delta de SC-004 sai trivialmente 0.
- **Polish (Phase 6)**: depende de todas as stories desejadas.

### Within Each User Story

- TDD: T006 (unit, RED) antes de T007 (impl). T011/T013 (E2E) guardam o gating de cada story.
- Helper (T007) antes do wrapper (T008) antes da montagem (T009).
- US3: scripts (T014/T015) + seed (T016) antes das capturas (T017→T018) antes do delta (T019) e do relatório (T020).

### Parallel Opportunities

- **Setup**: T003 [P] em paralelo com a sequência de instalação (T001→T002→T004 são sequenciais, mesmo `package.json`).
- **Foundational**: T005 [P] e T006 [P] em paralelo (arquivos diferentes); T007→T008→T009 sequenciais.
- **US3**: T014 [P], T015 [P] e o seed T016 em paralelo (arquivos diferentes); capturas T017→T018→T019→T020 sequenciais.
- **Polish**: T021 [P] e T022 [P] em paralelo; T023 por último.
- US1 e US2 tocam o mesmo arquivo (`vercel-telemetry.tsx` + `telemetry-gating.spec.ts`) → **não** paralelizáveis entre si; sequenciar US1 antes de US2.

---

## Parallel Example: Phase 2 (Foundational)

```bash
# T005 e T006 tocam arquivos diferentes — podem ir juntas:
Task: "Adicionar VERCEL_ENV ao src/lib/env/schema.ts"
Task: "Escrever teste unitário (RED) em __tests__/unit/telemetry/is-telemetry-enabled.spec.ts"
# Depois, sequencial: T007 (impl helper) → T008 (wrapper) → T009 (mount)
```

## Parallel Example: Phase 5 (US3 scripts)

```bash
# T014, T015 e T016 são arquivos independentes:
Task: "Criar scripts/diagnostics/react-doctor.ts"
Task: "Criar scripts/diagnostics/lighthouse.ts"
Task: "Criar scripts/diagnostics/seed.ts (createTestBook factory)"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Fase 1 (Setup) → Fase 2 (Foundational, gating testado) → Fase 3 (US1: Speed Insights).
2. **PARAR e VALIDAR**: gating E2E verde; em produção, Web Vitals aparecem no painel.
3. Deploy/demo (MVP).

### Incremental Delivery

1. Setup + Foundational → base de gating pronta.
2. US1 (Speed Insights) → testar → deploy (MVP).
3. US2 (Analytics) → testar → deploy.
4. US3 (diagnóstico) → relatório de baseline.
5. ⚠️ Capturar a PRÉ-baseline (T017) **antes** de US1/US2; capturar a PÓS (T018) **com a telemetria habilitada** (`VERCEL_ENV=production` local) para o delta SC-004 medir o peso real.

---

## Notes

- [P] = arquivos diferentes, sem dependências pendentes.
- TDD: T006 deve FALHAR antes de T007. Verificar RED.
- US1 e US2 compartilham `vercel-telemetry.tsx` — sequenciais por design.
- Sem DB/API/domínio: nenhuma migração, repository, service ou rota. Sentry intocado.
- Commits só sob pedido explícito do usuário (sem auto-commit).
- Gate final (T023) usa scripts do `package.json`, nunca comandos diretos.
