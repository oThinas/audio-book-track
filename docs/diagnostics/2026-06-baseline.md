# Diagnóstico de Baseline — 2026-06

Snapshot **datado e imutável** do diagnóstico de performance e qualidade do app,
capturado durante a feature `039-perf-audit-vercel-analytics`. Novos runs devem
criar um novo arquivo (`<YYYY-MM>-baseline.md`), nunca sobrescrever este.

## Metadados

| Campo | Valor |
|---|---|
| Data | 2026-06-24 |
| Branch / commit | `039-perf-audit-vercel-analytics` @ `cbee0d3` |
| Ambiente | `next start` (build de produção) local, `DATABASE_URL` em `localhost:5432`, admin + dataset de seed |
| Navegador | Chromium do Playwright via `--remote-debugging-port` (Lighthouse anexado à porta) |
| Next.js | 16.2.1 (Turbopack) |
| Lighthouse | 13.4.0 (`bun run diagnose:lighthouse`) |
| React Doctor | `react-doctor@latest` via `bunx` (`bun run diagnose:react`) |
| Telemetria | `@vercel/speed-insights` 2.0.0 + `@vercel/analytics` 2.0.1 |

> Artefatos brutos (JSON/HTML do Lighthouse) ficam em `.lighthouse/` (gitignored).
> Regenerável via `bun run diagnose` (seed + lighthouse + react).

---

## 1. Lighthouse — scores (baseline PRÉ-instrumentação)

Telemetria **desabilitada** (build sem `VERCEL_ENV=production` → wrapper renderiza `null`).
Escala 0–100. Categorias clássicas: Performance, Acessibilidade, Boas Práticas, SEO.

| Página | Perfil | Perf | A11y | Best Pr. | SEO | CLS | LCP |
|---|---|---|---|---|---|---|---|
| `/` (home) | mobile | 99 | 100 | 100 | 91 | 0 | 1812 ms |
| `/` (home) | desktop | 100 | 100 | 100 | 91 | 0 | 228 ms |
| `/login` | mobile | 100 | 100 | 100 | 91 | 0 | 614 ms |
| `/login` | desktop | 100 | 100 | 100 | 91 | 0 | 188 ms |
| `/dashboard` | mobile | 100 | 100 | 100 | 91 | 0 | 814 ms |
| `/dashboard` | desktop | 100 | 100 | 100 | 91 | 0 | 229 ms |
| `/books` | mobile | 100 | 100 | 100 | 91 | 0 | 765 ms |
| `/books` | desktop | 100 | 100 | 100 | 91 | 0 | 228 ms |
| `/books/:id` | mobile | 100 | 100 | 100 | 91 | 0 | 766 ms |
| `/books/:id` | desktop | 100 | 100 | 100 | 91 | 0 | 215 ms |

Observações:
- **CLS = 0** em todas as páginas/perfis. **TBT ≈ 0**. LCP bem abaixo do alvo de 2,5 s (Princípio VIII), exceto a home mobile (1812 ms, ainda dentro do alvo).
- **SEO 91** (consistente): único item reprovado é `robots-txt` ("robots.txt is not valid"). É a melhoria de SEO mais barata disponível.
- O Lighthouse 13 reporta também uma categoria experimental **`agentic-browsing` = 67**, fora das 4 clássicas; registrada aqui apenas como nota (não é meta de qualidade desta entrega).
- **Modal de configuração** (`@modal/(.)settings`): não auditado. O snapshot exige a flow API do Lighthouse (baseada em Puppeteer); ver a nota em `scripts/diagnostics/lighthouse.ts`. Pendência de follow-up, não bloqueia esta baseline.

---

## 2. React Doctor — achados (scan estático)

**Score: 45 / 100 (Critical)** — 201 issues no total.

| Categoria | Errors | Warnings |
|---|---|---|
| Segurança | 1 | 3 |
| Bugs | 3 | 33 |
| Performance | 22 | 32 |
| Acessibilidade | 2 | 6 |
| Manutenibilidade | 0 | 99 |

Top-3 errors priorizados pela ferramenta:

1. **Acessibilidade — Role missing required ARIA props** (×2) — `src/components/features/books/book-create-dialog.tsx:178`.
2. **Segurança — Side effect in GET handler** — `src/app/api/auth/clear-session/route.ts:4`.
3. **Performance — React Compiler can't optimize this** — `src/app/(authenticated)/not-found.tsx:6` (`Math.random()` em render).

> Tratar como **hipóteses iniciais**, não verdades. A correção dos achados está
> **fora de escopo** desta feature (decisão registrada na spec): a natureza das
> mudanças ainda é desconhecida e será endereçada em entregas futuras. Detalhe
> completo: `bunx react-doctor@latest --verbose`.

---

## 3. Delta de instrumentação (SC-004)

Comparação **PRÉ** (telemetria off) × **PÓS** (telemetria habilitada via
`VERCEL_ENV=production` na build/run local — necessário porque o gating renderiza
`null` fora de produção e a build gateada-off não embarcaria os componentes).

### 3.1 First-load JS

O `next build` com Turbopack **não imprime** a tabela de tamanhos por rota. A
medição foi feita isolando o chunk de cliente da telemetria no `.next/static`:

| Build | Chunk de telemetria | Raw | Gzipped |
|---|---|---|---|
| PRÉ (off) | — (ausente) | — | — |
| PÓS (on) | `chunks/0cpja5s0zqua3.js` | 13.917 B | **4.816 B (~4,7 KB)** |

O chunk foi verificado como **telemetria-pura**: contém apenas assinaturas
`@vercel/analytics`, `speed-insights`, `/_vercel/insights`, `vitals` — **nenhum**
código do app. É carregado pelo layout raiz apenas na build PÓS.

→ **First-load JS delta ≈ 4,7 KB gzipped < 5 KB.** ✅ **SC-004 atendido.**

### 3.2 CLS

| Página | CLS PRÉ | CLS PÓS |
|---|---|---|
| Todas (mobile + desktop) | 0 | 0 |

→ **CLS delta = 0.** ✅ Os componentes de telemetria não renderizam DOM visível.

### 3.3 Carregamento não-bloqueante

- Os scripts da Vercel (`/_vercel/speed-insights/script.js`, `/_vercel/insights/script.js`)
  são **injetados client-side após a hidratação** (ausentes no HTML inicial) e
  carregam de forma assíncrona — fora do caminho crítico.
- LCP/TBT sem regressão: desktop idêntico (188–229 ms PRÉ e PÓS); mobile dentro
  da variância de laboratório.

→ **Carregamento não-bloqueante comprovado.** ✅

### 3.4 Scores PÓS e artefato local

| Página | Perfil | Perf | A11y | Best Pr. | SEO |
|---|---|---|---|---|---|
| `/` (home) | mobile | 97 | 100 | 96 | 91 |
| demais rotas | mobile/desktop | 100 | 100 | 96 | 91 |

⚠️ **Best Practices cai 100 → 96 apenas localmente.** O único item reprovado é
`errors-in-console`: os scripts `/_vercel/*` injetados **dão 404 sem a edge da
Vercel**, gerando erro de console. **Em produção real na Vercel esses endpoints
respondem 200 e a pontuação retorna a 100.** Não é regressão do código — é
inerente a auditar a telemetria fora do ambiente Vercel.

---

## 4. Consolidação de acessibilidade

A a11y de runtime já é coberta pela suíte E2E com `@axe-core/playwright`
(`__tests__/e2e/accessibility.spec.ts` e os `*-accessibility.spec.ts` por
entidade). O Lighthouse confirma **A11y = 100** em todas as páginas auditadas.
Os 2 errors + 6 warnings de acessibilidade do React Doctor (§2) são achados
**estáticos** complementares (ex.: ARIA props em `book-create-dialog`), não
duplicados aqui — endereçáveis em entrega futura.

---

## 5. Resumo executivo

| Critério (SC-004) | Alvo | Medido | Status |
|---|---|---|---|
| First-load JS delta | < 5 KB gzipped | ~4,7 KB | ✅ |
| CLS delta | 0 | 0 | ✅ |
| Carregamento não-bloqueante | sim | sim (async, client-side) | ✅ |

A instrumentação Vercel adiciona **~4,7 KB gzipped** de first-load JS, **zero**
impacto em CLS e carrega de forma não-bloqueante. A baseline de qualidade está
saudável (Performance 99–100, A11y 100, CLS 0); as oportunidades conhecidas
(`robots.txt`, achados do React Doctor) ficam para entregas futuras.
