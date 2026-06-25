# Implementation Plan: Hardening, SEO & tooling (D6 + D7 + D8)

**Branch**: `040-seo-hardening-diagnostics` | **Date**: 2026-06-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/040-seo-hardening-diagnostics/spec.md`

## Summary

Três correções pequenas e independentes da baseline 2026-06, verificadas por `bun run diagnose`:

- **D6 (Segurança):** eliminar o efeito colateral em GET. O route handler GET
  `src/app/api/auth/clear-session/route.ts` (apaga cookie + redireciona) é **deletado**. A
  limpeza da sessão órfã migra para o **middleware** (`src/proxy.ts`): o layout autenticado
  passa a redirecionar para `/login?reauth=1` e o proxy apaga os cookies de sessão do
  better-auth (prefix-aware) na resposta, deixando `/login` renderizar. O logout interativo
  (better-auth `signOut`) permanece inalterado.
- **D7 (SEO):** criar `src/app/robots.ts` (`MetadataRoute.Robots`) **permissivo**
  (`userAgent: '*'`, `allow: '/'`). `Disallow: /` reprovaria o audit `is-crawlable` e não
  levaria o SEO a 100 — a auth já protege o conteúdo.
- **D8 (Ferramental):** habilitar o snapshot do modal de configuração no
  `scripts/diagnostics/lighthouse.ts` adicionando `puppeteer-core` (devDependency),
  conectando-o ao mesmo CDP port, abrindo o modal via sidebar e chamando
  `startFlow(page).snapshot()`.

Abordagem técnica derivada do `research.md` (Context7: Next.js `robots`/`proxy`, better-auth
cookies, Lighthouse user-flow API).

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Bun 1.2 (runtime + package manager + test runner)

**Primary Dependencies**: Next.js 16.2.1 (App Router; `proxy.ts` middleware; `robots.ts`
metadata route), React 19.2.4, better-auth ^1.5.6. Diagnóstico: `lighthouse`, `@playwright/test`
e **`puppeteer-core` (NOVO — devDependency)** para a flow API do Lighthouse.

**Storage**: N/A — nenhuma mudança de schema, repository, service ou banco.

**Testing**: Vitest (`test:unit`, `test:integration`), Playwright (`test:e2e`); verificação
de aceitação via `bun run diagnose` (seed + lighthouse + react-doctor).

**Target Platform**: Web (Next.js App Router em Vercel/Node), perfis Lighthouse mobile + desktop.

**Project Type**: web (Next.js single project).

**Performance Goals**: Lighthouse SEO = 100 nas páginas auditadas; **sem regressão** dos
demais scores (Perf/A11y/Best Practices); `puppeteer-core` fica **fora do bundle de produção**
(devDependency).

**Constraints**: nenhuma mudança de banco/domínio; limpeza de cookie **prefix-aware**
(`__Secure-` em produção) para quebrar o loop órfão também em HTTPS; D8 é **cobertura-apenas**
(achados do modal não corrigidos nesta sessão).

**Scale/Scope**: 3 correções pequenas (D6/D7/D8); ~4 arquivos de produção/script + testes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação |
|---|---|
| I. Capítulo como unidade | N/A — feature não toca domínio de capítulo/livro. ✅ |
| II. Precisão financeira | N/A — nenhum cálculo de ganho. ✅ |
| III. Ciclo de vida do capítulo | N/A. ✅ |
| IV. Simplicidade (YAGNI) | ✅ Menor mudança viável: deletar 1 rota, 1 arquivo `robots.ts`, ajustar proxy + 1 script. Sem abstrações novas. |
| V. TDD + classificação de testes | ✅ Testes primeiro: unit p/ `robots.ts` (saída `MetadataRoute.Robots`) e p/ `proxy.ts` (clear de cookie em `?reauth=1`, bounce preservado); E2E de logout atualizado; `clear-session.spec.ts` removido com a rota. Script de diagnóstico verificado por execução. |
| VI. Clean Architecture | ✅ `clear-session` não tinha lógica de negócio; mover limpeza para o middleware (borda HTTP) não cria lógica em service/controller. Sem novos services/repos. |
| VII. Frontend (composição/atomicidade) | ✅ Sem novos componentes client; layout só muda o destino do `redirect()` (server component). Nenhum `useEffect`/`useState` novo. |
| VIII. Performance | ✅ `robots.ts` é metadata route (zero JS de cliente). `puppeteer-core` é **devDependency** — não entra no bundle. |
| IX. Design tokens | N/A — sem UI nova. ✅ |
| X. REST API | ✅ Remoção de endpoint; nenhum endpoint novo. Sem `200 {success:false}`. |
| XI. PostgreSQL/DB | N/A — sem migrations. ✅ |
| XII. Anti-padrões | ✅ Remove um anti-padrão (side effect em GET). Não introduz nenhum proibido. |
| XV. Skills/Context7 | ✅ Context7 consultado (Next.js robots/proxy, better-auth cookies, Lighthouse flow) — ver `research.md`. |

**Resultado**: PASS. Nenhuma violação. `puppeteer-core` é devDependency (sem impacto de
bundle), justificada pela FR-009 — sem entrada em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/040-seo-hardening-diagnostics/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 (decisões via Context7)
├── data-model.md        # Phase 1 (N/A — sem entidades de domínio)
├── quickstart.md        # Phase 1 (como verificar os 3 SCs)
├── contracts/           # Phase 1 (robots output, proxy reauth, snapshot do modal)
│   ├── robots.md
│   ├── proxy-reauth.md
│   └── diagnostics-modal-snapshot.md
└── checklists/
    └── requirements.md  # do /speckit-specify
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── robots.ts                              # D7 — NOVO (MetadataRoute.Robots permissivo)
│   ├── api/auth/clear-session/route.ts        # D6 — DELETADO
│   └── (authenticated)/layout.tsx             # D6 — redirect → "/login?reauth=1"
├── proxy.ts                                   # D6 — limpa cookies de sessão em ?reauth=1
scripts/
└── diagnostics/lighthouse.ts                  # D8 — snapshot do modal via puppeteer-core

__tests__/
├── unit/
│   ├── app/robots.spec.ts                     # D7 — NOVO (unit)
│   ├── proxy/proxy.spec.ts                    # D6 — reescrito (reauth clear + bounce)
│   └── api/auth/clear-session.spec.ts         # D6 — DELETADO (rota não existe mais)
└── e2e/
    ├── auth/logout.spec.ts                    # D6 — helper → /login?reauth=1
    └── settings-preferences.spec.ts           # D6 — logout helper → /login?reauth=1

package.json                                   # D8 — + puppeteer-core (devDependencies)
```

**Structure Decision**: projeto único Next.js (App Router). As mudanças tocam a borda HTTP
(`proxy.ts`, metadata route, layout server component) e um script de diagnóstico — nenhuma
camada de domínio/serviço/repositório é afetada.

## Complexity Tracking

> Nenhuma violação de constituição a justificar. `puppeteer-core` é devDependency de
> ferramental (não entra no bundle de produção), exigida pela flow API do Lighthouse
> (FR-009); não há alternativa Playwright para o modo snapshot.
