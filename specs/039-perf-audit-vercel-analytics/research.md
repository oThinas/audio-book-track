# Research: Performance Audit & Vercel Telemetry

**Feature**: 039-perf-audit-vercel-analytics
**Date**: 2026-06-24
**Fontes**: Context7 MCP (`/websites/vercel` — docs oficiais), WebFetch (react.doctor/docs), inspeção do código.

Todos os pontos de NEEDS CLARIFICATION foram resolvidos na spec (via `/grill-me`). Esta pesquisa fixa as **decisões técnicas** de implementação.

---

## D1 — Montagem dos componentes de telemetria (Speed Insights + Analytics)

**Decisão**: Montar `<SpeedInsights />` (de `@vercel/speed-insights/next`) e `<Analytics />` (de `@vercel/analytics/next`) no `src/app/layout.tsx`, dentro do `<body>`, após `{children}`. O layout raiz é Server Component e cobre rotas públicas e autenticadas em uma única montagem (FR-017).

**Rationale**: Documentação oficial (Context7) para Next.js 13.5+ App Router — o projeto está em Next 16.2.1. Os componentes `/next` fazem atribuição de rota automática (App Router) sem opt-out de SSR no layout. Atende FR-001, FR-002, FR-005, FR-006.

```tsx
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
// ... <body>{children}<SpeedInsights /><Analytics /></body>
```

**Alternativas consideradas**: import de `/react` + `usePathname` (necessário apenas em Next < 13.5 — rejeitado, forçaria `use client` no caminho). `next/script` manual (rejeitado — reinventa o pacote oficial).

---

## D2 — Gating de ambiente: render condicional no Server Component

**Decisão**: **Não montar** os componentes fora de produção. Um helper puro decide; o wrapper Server Component só renderiza a telemetria quando habilitada. Critério canônico (FR-003/FR-008):

```
isTelemetryEnabled = (VERCEL_ENV === "production") && (E2E_TEST_MODE !== "1")
```

**Rationale**: O render condicional em Server Component dá **peso zero no cliente quando desligado** (preview, dev, test, E2E não baixam script algum) — superior a sempre montar e filtrar. Garante SC-003 e SC-004 de forma estrutural. `VERCEL_ENV` só existe em deploy da Vercel (ausente no `next dev` e no `next start` local do E2E), e o `E2E_TEST_MODE !== "1"` é o cinto de segurança decidido no grilling.

**Alternativas consideradas**:
- **Prop `mode="production"` + `beforeSend` retornando `null`** (Context7 confirma ambos existem): rejeitado como mecanismo *primário* — o script-cliente ainda carrega em preview/E2E mesmo que não envie, violando "peso zero" e arriscando flakiness. `beforeSend` fica disponível como camada extra de redação se algum dia surgir PII em URL (não é o caso hoje).
- Auto-detecção padrão da Vercel: rejeitada — por padrão **preview deploys coletam**, o que a spec proíbe.

---

## D3 — Localização: helper puro + wrapper Server Component

**Decisão**:
- Helper puro testável: `src/lib/telemetry/is-telemetry-enabled.ts` → `isTelemetryEnabled(env: { vercelEnv?: string; e2eTestMode?: string }): boolean`. **Recebe o ambiente por parâmetro** (não lê `process.env` dentro) — testável sem mock, no padrão dos fakes de função já usados no projeto (health-check).
- Wrapper Server Component: `src/components/layout/vercel-telemetry.tsx` — lê `process.env.VERCEL_ENV`/`process.env.E2E_TEST_MODE`, chama o helper e renderiza condicionalmente os dois componentes da Vercel. **Permanece Server Component** (sem `use client`); os componentes client da Vercel são renderizados como filhos.

**Rationale**: Princípio VI (lógica pura em `lib/`, 100% testável — Princípio V), Princípio VII (componente fino só renderiza; sem estado de domínio; sem `use client` desnecessário — Princípio VIII), Princípio IV (solução mais simples). Telemetria é infra transversal, não feature — mora em `components/layout/` (já abriga wrappers estruturais) em vez de `components/features/`.

---

## D4 — Schema de env: registrar `VERCEL_ENV`

**Decisão**: Adicionar `VERCEL_ENV: z.enum(["production", "preview", "development"]).optional()` ao `src/lib/env/schema.ts`. Opcional — é injetada pela Vercel em deploy e ausente localmente. `E2E_TEST_MODE` continua lido via `process.env` direto (padrão atual do projeto, runtime-only).

**Rationale**: Mantém o schema como fonte única de verdade do ambiente, sem quebrar dev/test (onde `VERCEL_ENV` não existe). Não exige novo segredo nem validação em produção.

---

## D5 — Diagnóstico Lighthouse: API programática + Playwright

**Decisão**: Script operacional `scripts/diagnostics/lighthouse.ts` que:
1. Reaproveita o fluxo de login E2E (`__tests__/e2e/helpers/auth.ts` → `login(page)`, admin/admin123) dirigindo um Chromium do Playwright.
2. Roda o Lighthouse pela **API de user-flow** (`lighthouse`): **navigation mode** para as páginas cheias (autenticação, dashboard, lista, detalhe, home pública) e **snapshot/timespan mode** para o **modal de configuração** (intercepting route — exige navegação soft, não URL direta).
3. Perfis **mobile e desktop**, **tema único**.
4. Escreve artefatos brutos (JSON/HTML) em `.lighthouse/` (gitignored) e alimenta o resumo curado em `docs/diagnostics/`.

Alvo: **`next start` local com build de produção** (deltas reprodutíveis — FR-012/FR-013).

**Rationale**: Só a API de user-flow do `lighthouse` cobre os três modos (navigation/snapshot/timespan) necessários para auditar o modal interceptado. Dirigir via Playwright reaproveita o login já existente (zero novo mecanismo de auth).

**Alternativas consideradas**: `playwright-lighthouse` (rejeitado — foca em navigation audits; fraco para snapshot do modal). Lighthouse manual no DevTools (rejeitado — não reprodutível/versionável). PageSpeed contra produção (rejeitado para o delta — rede/CDN poluem; números de campo vêm do Speed Insights).

---

## D6 — Diagnóstico React Doctor

**Decisão**: `bunx react-doctor@latest` (scanner CLI estático determinístico) via script `scripts/diagnostics/react-doctor.ts` (ou direto no `package.json`). Sem instalar dependência. Categorias coletadas: segurança, performance, estado, efeitos, arquitetura, acessibilidade (FR-011).

**Rationale**: WebFetch confirmou: ferramenta CLI standalone, complementa lint. Projeto usa **Biome** (não ESLint/oxlint) → recurso de leitura de config de lint não se aplica, roda standalone. `bunx` (não `npx`) por regra do projeto. Integração GitHub Action de PR fica **fora de escopo** (spec).

---

## D7 — Baseline duplo e relatório

**Decisão**: Capturar o baseline **antes** de adicionar a instrumentação (foto limpa) e **depois** (provar SC-004). Relatório = **snapshot datado imutável** em `docs/diagnostics/<YYYY-MM>-baseline.md` (só resumo curado: scores Lighthouse mobile+desktop nas 4 categorias, achados do React Doctor nas 6 categorias, cada item com severidade + recomendação, e a comparação de delta de bundle/CLS). Artefatos brutos não versionados (`.gitignore`).

**Rationale**: FR-013/FR-014/SC-007. Snapshot datado preserva histórico ("o app estava assim em jun/2026"); regenerável pelos scripts (FR-015).

---

## D8 — Dependências a adicionar

| Pacote | Tipo | Justificativa (Princípio VIII) |
|---|---|---|
| `@vercel/speed-insights` | prod (cliente) | RUM de Web Vitals — sem alternativa server-side; ~1–2 kb gzipped, carga assíncrona; centraliza métrica na Vercel |
| `@vercel/analytics` | prod (cliente) | Page views — ~1–2 kb gzipped, cookieless; centraliza na Vercel |
| `lighthouse` | dev | Diagnóstico de baseline (user-flow API) |
| `chrome-launcher` | dev | Lançar/atachar Chrome para o Lighthouse (ou reaproveitar o Chromium do Playwright via CDP) |
| React Doctor | — | Via `bunx`, sem instalar |

**Delta de bundle alvo (SC-004)**: contribuição combinada de cliente **< 5 kb gzipped**, CLS delta = 0, carregamento não-bloqueante. `lighthouse`/`chrome-launcher` são **devDependencies** — não entram no bundle do app.

---

## D9 — Sem persistência, sem API, sem domínio

**Decisão**: Nenhuma tabela, migração, repository, service ou rota `/api/v1/**`. A coleta é agregada nos painéis da Vercel. Sentry permanece só-erros (`tracesSampleRate=0` intacto, instrumentation.ts/sentry.*.config.ts não tocados) — FR-009.

**Rationale**: Princípios I/XI não se aplicam (nenhum dado de capítulo/financeiro). Princípio IV (YAGNI) — não criar infra de persistência para dados que vivem fora do app.

---

## D10 — Estratégia de testes

| Camada | O que | Como |
|---|---|---|
| **Unit** | `isTelemetryEnabled()` | Tabela-verdade completa (prod+¬E2E → true; preview → false; development → false; `E2E_TEST_MODE=1` → false; `VERCEL_ENV` ausente → false). Função pura recebendo env por parâmetro → sem mock. Cobertura 100%. |
| **Unit** | schema de env | `VERCEL_ENV` válido/ausente/ inválido não quebra parse em dev/test. |
| **E2E** | gating real (SC-003) | No run E2E (sem `VERCEL_ENV=production`), asserir que **nenhum** script/insight da Vercel é injetado/requisitado (`/_vercel/insights`, `/_vercel/speed-insights`). Reaproveita infra E2E existente. |

O script de diagnóstico (`scripts/diagnostics/*`) é ferramenta operacional — **não** entra na suíte de testes automatizada.

**Rationale**: Princípio V (TDD; pure helper 100%). O E2E prova o gating de forma observável, fechando o maior risco da feature (telemetria vazar para fora de produção).
