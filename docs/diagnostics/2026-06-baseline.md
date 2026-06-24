# Diagnóstico de Baseline — 2026-06

Snapshot **datado e imutável** do diagnóstico de performance e qualidade do app,
capturado durante a feature `039-perf-audit-vercel-analytics`. Novos runs devem
criar um novo arquivo (`<YYYY-MM>-baseline.md`), nunca sobrescrever este.

## Metadados

| Campo | Valor |
|---|---|
| Data | 2026-06-24 |
| Branch / commit | `039-perf-audit-vercel-analytics` @ `ce782ea` |
| Ambiente | `next start` (build de produção) local, `DATABASE_URL` em `localhost:5432`, admin + dataset de seed |
| Navegador | Chromium do Playwright via `--remote-debugging-port` (Lighthouse anexado à porta) |
| Auditorias autenticadas | sessão admin encaminhada ao Lighthouse via header `Cookie` (a aba do Lighthouse vive fora do contexto do Playwright). `/` foi excluído por ser apenas portão de redirect (→ `/login` ou página favorita) |
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
| `/login` | mobile | 100 | 100 | 100 | 91 | 0 | 1516 ms |
| `/login` | desktop | 100 | 100 | 100 | 91 | 0 | 187 ms |
| `/dashboard` | mobile | **80** | 96 | 100 | 91 | **0,276** | **3015 ms** |
| `/dashboard` | desktop | 100 | 96 | 100 | 91 | 0,054 | 336 ms |
| `/books` | mobile | 100 | 96 | 100 | 91 | 0 | 1512 ms |
| `/books` | desktop | 100 | 96 | 100 | 91 | 0 | 226 ms |
| `/books/:id` | mobile | 94 | 96 | 100 | 91 | 0 | **3018 ms** |
| `/books/:id` | desktop | 100 | 96 | 100 | 91 | 0 | 334 ms |

Achados (oportunidades — correção fora de escopo desta entrega):
- **Dashboard mobile é o ponto fraco**: Performance 80, **LCP 3015 ms (> 2,5 s)** e **CLS 0,276 (> 0,1)**. Provável causa: widgets/charts do dashboard (recharts) carregando de forma assíncrona e empurrando o layout. Vale investigar reserva de espaço (skeleton com altura fixa) e priorização do LCP.
- **`/books/:id` mobile**: LCP 3018 ms (> 2,5 s).
- **A11y = 96** em todas as páginas **autenticadas** (login fica 100). Há lacunas reais de acessibilidade — corroboradas pelos achados do React Doctor (§2).
- **SEO 91** (consistente): único item reprovado é `robots-txt` ("robots.txt is not valid"). É a melhoria de SEO mais barata disponível.
- Desktop está saudável em tudo (Perf 100, CLS ~0, LCP < 350 ms).
- O Lighthouse 13 reporta também a categoria experimental **`agentic-browsing`** (48–67), fora das 4 clássicas; registrada apenas como nota.
- **Modal de configuração** (`@modal/(.)settings`): não auditado — o snapshot exige a flow API do Lighthouse (baseada em Puppeteer). Ver a nota em `scripts/diagnostics/lighthouse.ts`. Pendência de follow-up.

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

### 3.2 CLS — delta por página (PRÉ × PÓS)

| Página | Perfil | CLS PRÉ | CLS PÓS | Delta |
|---|---|---|---|---|
| `/login` | mobile/desktop | 0 | 0 | 0 |
| `/books` | mobile/desktop | 0 | 0 | 0 |
| `/books/:id` | mobile/desktop | 0 | 0 | 0 |
| `/dashboard` | desktop | 0,053752 | 0,053752 | **0** |
| `/dashboard` | mobile | 0,275818 | 0,275818 | **0** |

→ **CLS delta = 0 em todas as páginas** — valores **byte-idênticos** PRÉ/PÓS,
**inclusive no dashboard**, que já tem layout shift próprio (pré-existente, §1).
A telemetria não renderiza DOM visível, logo não adiciona shift algum. ✅

### 3.3 Carregamento não-bloqueante

- Os scripts da Vercel (`/_vercel/speed-insights/script.js`, `/_vercel/insights/script.js`)
  são **injetados client-side após a hidratação** (ausentes no HTML inicial) e
  carregam de forma assíncrona — fora do caminho crítico.
- Performance/LCP sem regressão: dashboard mobile **80 / 3015 ms (PRÉ)** vs
  **80 / 3017 ms (PÓS)**; `/books` mobile idêntico (100 / ~1512 ms). Variações
  restantes dentro do ruído de laboratório.

→ **Carregamento não-bloqueante comprovado.** ✅

### 3.4 Scores PÓS e artefato local

Telemetria habilitada — scores **idênticos** ao PRÉ, exceto Boas Práticas:

| Categoria | PRÉ | PÓS |
|---|---|---|
| Performance / A11y / SEO | (igual à tabela §1) | inalterados |
| **Best Practices** | 100 | **96** (todas as páginas) |

⚠️ **Best Practices cai 100 → 96 apenas localmente.** O único item reprovado é
`errors-in-console`: os scripts `/_vercel/*` injetados **dão 404 sem a edge da
Vercel**, gerando erro de console. **Em produção real na Vercel esses endpoints
respondem 200 e a pontuação retorna a 100.** Não é regressão do código — é
inerente a auditar a telemetria fora do ambiente Vercel.

---

## 4. Consolidação de acessibilidade

A a11y de runtime já é coberta pela suíte E2E com `@axe-core/playwright`
(`__tests__/e2e/accessibility.spec.ts` e os `*-accessibility.spec.ts` por
entidade). O Lighthouse mede **A11y = 96** nas páginas autenticadas (100 no
login) — há lacunas reais. Os 2 errors + 6 warnings de acessibilidade do React
Doctor (§2) são achados **estáticos** complementares (ex.: ARIA props em
`book-create-dialog`). Endereçáveis em entrega futura.

---

## 5. Resumo executivo

### SC-004 — impacto da telemetria

| Critério | Alvo | Medido | Status |
|---|---|---|---|
| First-load JS delta | < 5 KB gzipped | ~4,7 KB | ✅ |
| CLS delta | 0 | 0 (idêntico PRÉ/PÓS, todas as páginas) | ✅ |
| Carregamento não-bloqueante | sim | sim (async, client-side; sem regressão de perf) | ✅ |

A instrumentação Vercel adiciona **~4,7 KB gzipped** de first-load JS, **zero**
impacto em CLS e carrega de forma não-bloqueante.

### Saúde da baseline (independente da telemetria)

- **Desktop**: saudável em tudo (Perf 100, CLS ~0, LCP < 350 ms).
- **Mobile**: atenção no **dashboard** (Perf 80, LCP ~3 s, CLS 0,276) e no LCP de
  `/books/:id` (~3 s).
- **A11y 96** nas páginas autenticadas; **SEO 91** (`robots.txt`).
- **React Doctor 45/100** (201 issues).

As correções dessas oportunidades ficam para entregas futuras (fora de escopo
desta feature, por decisão da spec).

---

## 6. Backlog de correções (para entregas futuras)

Cada item abaixo é escopável como um deliverável independente (`/speckit-specify`).
Severidade: 🔴 alta · 🟡 média · 🟢 baixa. `file:line` extraídos dos artefatos
brutos desta baseline (Lighthouse + React Doctor `--verbose`); reproduzível via
`bun run diagnose` + `bunx react-doctor@latest --verbose`.

### D1 — 🔴 Acessibilidade → A11y 100 nas páginas autenticadas

Lighthouse A11y = 96 em `/dashboard`, `/books`, `/books/:id`. Auditorias que reprovam:

| Auditoria Lighthouse | Páginas | Direção |
|---|---|---|
| `color-contrast` | dashboard, books, books-detail (mobile+desktop) | Ajustar tokens de contraste (texto/fundo) que não atingem 4.5:1 |
| `label-content-name-mismatch` | dashboard, books-detail | Nome acessível deve conter o texto visível do controle |
| `td-has-header` | books-detail | Associar `<td>` a headers na tabela de capítulos |

React Doctor (a11y errors) complementa:
- **Role missing required ARIA props** — `src/components/features/books/book-create-dialog.tsx:178`, `src/components/features/books/book-edit-dialog.tsx:158`.

Verificação: `bun run diagnose:lighthouse` → A11y = 100; `@axe-core/playwright` verde.

### D2 — 🔴 Performance & CLS do dashboard mobile

Pior CWV da baseline: `/dashboard` mobile com **Perf 80, LCP ~3015 ms (> 2,5 s), CLS 0,276 (> 0,1)**.

- **CLS**: 1 layout shift no contêiner de conteúdo principal (`main.flex-1 > div.flex`) — provavelmente widgets/charts (recharts) carregando assíncronos sem reserva de espaço. Direção: skeleton com **altura fixa** para os cards/charts do dashboard.
- **JS não usado**: `unused-javascript` estima **~61 KiB** de economia no dashboard mobile. Direção: code-split/lazy dos charts; revisar imports do recharts.
- **LCP ~3 s**: dominado pelo custo de JS acima (os insights de LCP-element passaram). Melhora junto com o split de JS.

Verificação: dashboard mobile com CLS < 0,1, LCP < 2,5 s, Perf ≥ 90.

### D3 — 🟡 LCP mobile de `/books/:id`

`/books/:id` mobile LCP **~3018 ms (> 2,5 s)** (desktop saudável, 334 ms). Investigar custo de render/JS da página de detalhe no perfil mobile. Verificação: LCP < 2,5 s.

### D4 — 🟡 Desbloquear o React Compiler (22 performance errors)

O React Compiler não consegue auto-memoizar 22 pontos → otimização perdida. Dois grupos:

- **"can't optimize this"** — ex.: `src/components/ui/chart.tsx:188,287`, `src/components/ui/field.tsx:195`, `src/app/(authenticated)/not-found.tsx:6`, `src/components/features/*/hooks/use-*.ts` e várias tabelas (`*-table.tsx`).
- **"doesn't support this syntax" ×8** — `use-book-detail.ts:256`, `use-studio-inline-creator.ts:52`, `use-delete-{chapter,editor,narrator,studio}.ts`, `calendar.tsx:29-30`, `chapter-row-actions.tsx:26`, `page-loading.tsx:31,56`.

Direção: ajustar os padrões que o compiler rejeita (refs/closures/sintaxe). Verificação: `bunx react-doctor@latest --verbose` sem perf errors dessa família.

### D5 — 🟡 Bugs: estado sincronizado a prop dentro de effect (×3)

`src/components/features/books/book-create-dialog.tsx:100`, `src/components/features/chapters/hooks/use-chapter-row.ts:41-42`, `src/components/layout/mobile-sidebar.tsx:68`. Anti-padrão que a própria constituição proíbe (derivar com `useMemo`, não `useEffect`). Direção: derivar/`key` em vez de sincronizar via effect.

### D6 — 🟡 Segurança: side effect em GET handler

`src/app/api/auth/clear-session/route.ts:4` — GET deve ser idempotente/sem efeito colateral. Direção: mover a limpeza de sessão para POST/DELETE. (Warnings correlatos: `src/lib/db/migrate.ts:105`, `drizzle-dashboard-repository.ts:208`.)

### D7 — 🟢 SEO: robots.txt válido

`robots-txt` reprovado em todas as páginas (SEO 91). Direção: adicionar `app/robots.ts` (ou `robots.txt`) válido. Verificação: SEO = 100.

### D8 — 🟢 Cobertura Lighthouse do modal de configuração

O snapshot do `@modal/(.)settings` não roda (exige a flow API do Lighthouse / Puppeteer). Direção: adicionar `puppeteer-core` conectando à mesma `--remote-debugging-port` e usar `flow.snapshot()` (ver nota em `scripts/diagnostics/lighthouse.ts`).

> Warnings não itemizados (≈173): Manutenibilidade 99, Performance 32, Bugs 33,
> Acessibilidade 6, Segurança 3. Lista completa: `bunx react-doctor@latest --verbose`.
