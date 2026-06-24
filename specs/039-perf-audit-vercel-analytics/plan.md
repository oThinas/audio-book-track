# Implementation Plan: Performance Audit & Vercel Telemetry

**Branch**: `039-perf-audit-vercel-analytics` | **Date**: 2026-06-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/039-perf-audit-vercel-analytics/spec.md`

## Summary

Instrumentar o app com **Vercel Speed Insights** (Web Vitals de campo) e **Vercel Analytics** (page views), montados uma única vez no layout raiz e **renderizados condicionalmente** apenas em produção real (`VERCEL_ENV === "production"` e `E2E_TEST_MODE !== "1"`), garantindo peso zero no cliente fora de produção. Em paralelo, estabelecer um **baseline de diagnóstico duplo** (antes/depois da instrumentação) com **Lighthouse** (user-flow via Playwright, mobile+desktop) e **React Doctor** (scanner estático via `bunx`), consolidado num snapshot datado imutável em `docs/diagnostics/`. Sem banco, sem API, sem domínio: a métrica vive nos painéis da Vercel; o Sentry permanece só-erros.

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Bun 1.2 (runtime + package manager + test runner)

**Primary Dependencies**: Next.js 16.2.1 (App Router, `reactCompiler: true`), React 19.2.4. **Novas**: `@vercel/speed-insights`, `@vercel/analytics` (prod, cliente); `lighthouse`, `chrome-launcher` (dev, diagnóstico). React Doctor via `bunx` (sem instalar).

**Storage**: N/A — nenhuma tabela, migração, repository ou service. Métricas agregadas nos painéis da Vercel.

**Testing**: Vitest (unit) + Playwright (E2E). Unit: helper puro `isTelemetryEnabled()` (100%). E2E: ausência de scripts/insights da Vercel no run de teste (gating real, SC-003). Diagnóstico não entra na suíte.

**Target Platform**: Web (Next.js na Vercel). Telemetria ativa só em deploy de produção.

**Project Type**: Web application (Next.js App Router, projeto único `src/`).

**Performance Goals**: Instrumentação adiciona **CLS delta = 0**, **first-load JS delta < 5 kb gzipped**, carregamento não-bloqueante (SC-004). Mantém o LCP < 1s do Princípio VIII.

**Constraints**: Telemetria desligada em dev/test/E2E/preview (FR-003/FR-008). Cookieless, sem PII, respeita DNT, sem banner de consentimento (FR-007). Suíte de qualidade verde (FR-016).

**Scale/Scope**: 1 layout raiz tocado, 1 helper puro, 1 wrapper Server Component, 1 entrada de env, 2 scripts de diagnóstico, 1 relatório em `/docs`. ~6 páginas auditadas × mobile/desktop.

## Constitution Check

*GATE: avaliado contra `.specify/memory/constitution.md` v2.18.0.*

| Princípio | Aderência |
|---|---|
| **I. Capítulo como unidade** | N/A — feature não toca domínio/capítulo. ✅ |
| **II. Precisão financeira** | N/A — sem cálculo financeiro. ✅ |
| **III. Ciclo de vida do capítulo** | N/A. ✅ |
| **IV. Simplicidade (YAGNI)** | Render condicional (peso zero) é a solução mais simples; sem persistência/abstração especulativa. ✅ |
| **V. TDD** | Helper puro `isTelemetryEnabled()` testado antes (100%); E2E de gating escrito antes da montagem. ✅ |
| **VI. Clean Architecture backend** | N/A backend; ainda assim a lógica (gating) vive em `lib/` puro, JSX fino. ✅ |
| **VII. Frontend (composição/atomicidade)** | Wrapper permanece **Server Component** (sem `use client`); sem estado de domínio inline; sem HTML cru; telemetria é infra (não vai para `features/`). ✅ |
| **VIII. Performance primeiro** | Dep cliente justificada (research D8): sem alternativa server-side para RUM; ~1–2 kb cada, async, peso zero quando off. ✅ |
| **IX. Design tokens** | N/A — componentes invisíveis, sem estilo. ✅ |
| **X. API REST** | N/A — nenhuma rota nova. ✅ |
| **XI. PostgreSQL** | N/A — sem schema/migração. ✅ |
| **XII. Anti-padrões** | Sem `use client` desnecessário, sem fetch/useEffect, sem console.log em produção (diagnóstico é script operacional via stdout), sem segredo hardcoded. ✅ |
| **XV. Skills/Context7** | Context7 consultado para os pacotes Vercel (docs oficiais). ✅ |
| **XVI. Verificação final** | lint + unit + e2e + build antes do PR. ✅ |

**Resultado**: PASS — nenhuma violação. Complexity Tracking não necessário.

## Project Structure

### Documentation (this feature)

```text
specs/039-perf-audit-vercel-analytics/
├── plan.md              # Este arquivo
├── spec.md              # Especificação (com 9 decisões do grilling)
├── research.md          # Fase 0 — decisões técnicas (Context7)
├── data-model.md        # Fase 1 — entidades de telemetria/relatório (não-DB)
├── quickstart.md        # Fase 1 — como rodar diagnóstico e verificar telemetria
├── contracts/           # Fase 1 — contratos de UI e do script de diagnóstico
│   ├── telemetry-contract.md
│   └── diagnostics-contract.md
└── checklists/
    └── requirements.md  # Checklist de qualidade da spec (verde)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── layout.tsx                          # MOD: monta <VercelTelemetry /> no <body>
├── components/
│   └── layout/
│       └── vercel-telemetry.tsx            # NOVO: Server Component, render condicional
└── lib/
    ├── env/
    │   └── schema.ts                       # MOD: + VERCEL_ENV opcional
    └── telemetry/
        └── is-telemetry-enabled.ts         # NOVO: helper puro (gating)

__tests__/
├── unit/
│   └── telemetry/
│       └── is-telemetry-enabled.spec.ts    # NOVO: tabela-verdade do gating
└── e2e/
    └── telemetry-gating.spec.ts            # NOVO: nenhum script Vercel no run E2E

scripts/
└── diagnostics/
    ├── lighthouse.ts                       # NOVO: user-flow (nav + snapshot do modal)
    └── react-doctor.ts                     # NOVO: wrapper de bunx react-doctor

docs/
└── diagnostics/
    └── 2026-06-baseline.md                 # NOVO: snapshot datado imutável (curado)

.gitignore                                  # MOD: + .lighthouse/ (artefatos brutos)
package.json                                # MOD: deps + scripts diagnose:*
```

**Structure Decision**: App single-project Next.js. A lógica de gating fica em `src/lib/telemetry/` (puro, testável), o wrapper em `src/components/layout/` (infra transversal, não feature). Scripts de diagnóstico em `scripts/diagnostics/` seguindo o padrão de `scripts/db/`. Relatório curado em `docs/` (regra: docs operacionais em `/docs`).

## Complexity Tracking

> Sem violações constitucionais. Seção não aplicável.
