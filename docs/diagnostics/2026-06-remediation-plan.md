# Roadmap de Remediação — Baseline 2026-06

Plano de correção do backlog **D1–D8** identificado em
[`2026-06-baseline.md`](./2026-06-baseline.md) (§6). A correção dos achados ficou **fora de
escopo** da feature `039-perf-audit-vercel-analytics` (decisão da spec); este documento
organiza esse backlog em **4 sessões**, onde **cada sessão é uma rodada completa de speckit**
(`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` →
`/speckit-analyze` → verificação final + PR).

Os itens foram agrupados por **afinidade técnica e de verificação**, e a ordem segue
**quick wins primeiro**.

Resultado esperado: A11y 100 e SEO 100 nas páginas auditadas, CWV mobile saudável
(LCP < 2,5 s, CLS < 0,1), React Compiler desbloqueado e correções de segurança/effects —
tudo verificável re-rodando `bun run diagnose`.

> Numeração de feature: próximo número disponível é **040**. Cada sessão consome um número
> sequencial (`NNN-kebab-case`); o script do speckit gera o nome a partir da descrição.
> Nomes abaixo são sugestões.

---

## Visão geral das sessões (ordem de execução: quick wins → críticos → médios)

| Ordem | Sessão | Itens | Severidade | Branch sugerido |
|---|---|---|---|---|
| 1 | **Hardening, SEO & tooling** | D6 + D7 + D8 | 🟡🟢🟢 | `040-seo-hardening-diagnostics` |
| 2 | **Acessibilidade → A11y 100** | D1 | 🔴 | `041-authenticated-a11y` |
| 3 | **Performance mobile / CWV** | D2 + D3 | 🔴🟡 | `042-mobile-cwv-performance` |
| 4 | **Saúde do código React** | D4 + D5 | 🟡🟡 | `043-react-compiler-effects` |

**Coordenação crítica:** Sessão 2 (D1) e Sessão 4 (D4+D5) tocam os **mesmos arquivos**
(`book-create-dialog.tsx`, `book-edit-dialog.tsx`, `mobile-sidebar.tsx`) — D1 mexe em
props ARIA, D4/D5 em effects/closures. São preocupações distintas no mesmo arquivo, mas
para evitar rebase **executar sequencialmente**, nunca em branches paralelas.

---

## Sessão 1 — Hardening, SEO & tooling (D6 + D7 + D8) · 🟡🟢🟢

Três correções pequenas e de baixo risco agrupadas como rodada de "polimentos & ferramental".

### D7 — SEO: robots.txt válido (🟢)
- **Problema:** Lighthouse reprova `robots-txt` em todas as páginas (SEO 91). Não existe
  `app/robots.ts`, `public/robots.txt` nem `app/sitemap.ts`. App é **inteiramente autenticado**.
- **Mudança:** criar **`src/app/robots.ts`** (rota de metadata Next.js, tipo
  `MetadataRoute.Robots`) com `disallow: '/'` — válido para o Lighthouse **e** semanticamente
  correto (app privado não deve ser indexado). Opcional: `robots: { index: false, follow: false }`
  no `metadata` do layout raiz (`src/app/layout.tsx:21`). `src/proxy.ts:40` já exclui `robots.txt`
  do matcher.
- **SC:** Lighthouse SEO = 100.

### D6 — Segurança: side effect em GET handler (🟡)
- **Problema:** `src/app/api/auth/clear-session/route.ts` faz `cookies().delete(...)` +
  `redirect("/login")` num **GET** (deve ser idempotente). React Doctor sinaliza como erro de segurança.
- **Nuance descoberta (resolver no `/speckit-plan`):** o endpoint é invocado por
  `src/app/(authenticated)/layout.tsx:21` via `redirect("/api/auth/clear-session")` — um
  redirect server-side **só emite GET** — e pelos testes E2E (`logout.spec.ts`,
  `settings-preferences.spec.ts`) via `page.goto(...)`. Trocar para POST/DELETE quebra esses
  call sites; é uma mudança de fluxo, não só de método.
- **Direção (avaliar duas opções na spec/plan):**
  - (a) Limpar o cookie da sessão órfã **diretamente no Server Component/layout** e redirecionar
    a `/login` sem passar por endpoint GET com efeito.
  - (b) Converter para Server Action / `POST` com form de logout e ajustar layout + testes E2E.
- **SC:** `react-doctor --verbose` sem "Side effect in GET handler"; fluxo de logout E2E verde.
- **Risco:** toca auth — atenção na verificação E2E.

### D8 — Cobertura Lighthouse do modal de configuração (🟢)
- **Problema:** `scripts/diagnostics/lighthouse.ts:159-169` pula o snapshot do modal
  interceptado `@modal/(.)settings` porque exige a **flow API** do Lighthouse (Puppeteer), e o
  projeto padroniza Playwright sem `puppeteer-core`.
- **Mudança:** adicionar `puppeteer-core` (devDependency), conectar à mesma
  `--remote-debugging-port` (`DIAGNOSE_DEBUG_PORT`, default 9222), abrir o modal via
  `getByTestId("sidebar").getByRole("link", { name: "Configurações" })` e chamar `flow.snapshot()`.
  Modal: `src/app/(authenticated)/@modal/(.)settings/page.tsx` → `SettingsModal`.
- **SC:** `bun run diagnose:lighthouse` gera snapshot do modal sem o warning de skip.

---

## Sessão 2 — Acessibilidade → A11y 100 nas páginas autenticadas (D1) · 🔴

Lighthouse A11y = 96 em `/dashboard`, `/books`, `/books/:id`. Auditorias reprovadas:

- **`role` sem ARIA props exigidas:** `book-create-dialog.tsx:178` e `book-edit-dialog.tsx:158`
  têm `<Button role="combobox">` sem `aria-controls`/`aria-haspopup`. Adicionar as props
  (apontar `aria-controls` ao popover, `aria-haspopup` adequado). No edit-dialog há aninhamento
  `Tooltip → Popover` a revisar. Consultar padrão shadcn Combobox via Context7.
- **`color-contrast`** (dashboard, books, books-detail, mobile+desktop): tokens OKLCH em
  `src/app/globals.css`. Suspeito principal: `--muted-foreground` (L 0.556 claro / 0.708 escuro)
  sobre `bg-background`/`bg-muted` < 4.5:1. Ajustar lightness dos tokens reprovados; **validar nos
  dois temas** (claro e escuro).
- **`td-has-header`** (books-detail): `src/components/features/chapters/chapters-table.tsx` —
  garantir associação semântica célula↔header (`<TableHead scope="col">` / estrutura correta).
- **`label-content-name-mismatch`** (dashboard, books-detail): revisar controles cujo
  `aria-label` não contém o texto visível (provável em botões com ícone). Identificar via run do
  Lighthouse/axe.
- **SC:** Lighthouse A11y = 100 nas três páginas; suites `*-accessibility.spec.ts`
  (`@axe-core/playwright`) verdes.

---

## Sessão 3 — Performance mobile / CWV (D2 + D3) · 🔴🟡

Mesma ferramenta de verificação (Lighthouse mobile) e mesma natureza de mudança (reserva de
espaço + code-split + priorização de LCP).

### D2 — Performance & CLS do dashboard mobile (🔴)
Pior CWV da baseline: **Perf 80, LCP ~3015 ms, CLS 0,276, ~61 KiB unused JS**.
- **CLS:** `/dashboard` é a **única rota sem `loading.tsx`**. Criar
  **`src/app/(authenticated)/dashboard/loading.tsx`** com skeleton de **altura fixa** espelhando
  o layout real (seguir o padrão de `031` e de `src/components/layout/page-loading.tsx`).
- Revisar os fallbacks `<Suspense fallback={<SectionSkeleton .../>}>` em
  `src/components/features/dashboard/dashboard-page-content.tsx`: garantir que `SectionSkeleton`
  tem a **mesma altura** do conteúdo real (cards/charts). `revenue-chart.tsx` já usa `h-[260px]`
  e `revenue-chart-lazy.tsx` já é `dynamic({ ssr:false, loading: SectionSkeleton })`.
- **unused JS (~61 KiB):** revisar imports de recharts/`src/components/ui/chart.tsx`; confirmar
  que todos os charts/widgets pesados do dashboard são carregados dinamicamente (não só o revenue).
- **SC:** dashboard mobile com **CLS < 0,1, LCP < 2,5 s, Perf ≥ 90**.

### D3 — LCP mobile de `/books/:id` (🟡)
- LCP **~3018 ms** mobile (desktop saudável a 334 ms). Investigar custo de render/JS da página
  de detalhe (`src/app/(authenticated)/books/[id]/`) no perfil mobile — provável peso da tabela
  de capítulos + dnd-kit. Já existe `loading.tsx`. Direção: code-split/lazy do que não é
  above-the-fold; priorizar o elemento LCP.
- **SC:** `/books/:id` mobile com LCP < 2,5 s.

---

## Sessão 4 — Saúde do código React: compiler + effects (D4 + D5) · 🟡🟡

D5 é subconjunto de D4 (mesma classe: padrões de hook/effect/render que o compiler rejeita);
verificação comum: `react-doctor --verbose`.

### D4 — Desbloquear o React Compiler (22 perf errors)
- **`Math.random()` em render:** `src/app/(authenticated)/not-found.tsx:6` → mover seleção da
  mensagem para fora do render puro (constante por mount, ex. `useState(() => ...)`).
- **"doesn't support this syntax" ×8:** `use-book-detail.ts:256`, `use-studio-inline-creator.ts:52`,
  `use-delete-{chapter,editor,narrator,studio}.ts`, `calendar.tsx:29-30`,
  `chapter-row-actions.tsx:26`, `page-loading.tsx:31,56` — ajustar closures/sintaxe rejeitada.
- **"can't optimize this":** `chart.tsx:188,287`, `field.tsx:195`, tabelas `*-table.tsx`, hooks `use-*`.
- **`mobile-sidebar.tsx`:** `handleFocusTrap` usa `useCallback([])` mas referencia `panelRef` —
  corrigir o array de dependências.
- **SC:** `react-doctor --verbose` sem perf errors dessa família.

### D5 — Estado sincronizado a prop via effect (×3)
- `book-create-dialog.tsx:100`, `use-chapter-row.ts:41-42`, `mobile-sidebar.tsx:68` — substituir
  sincronização via `useEffect` por **estado derivado** (`useMemo`/`key`), conforme anti-padrão
  proibido pela constituição. Ex.: `use-chapter-row` → derivar `mode` de `isSelectionMode`.
- **SC:** sem bugs de effect-sync no React Doctor; comportamento preservado (unit/integration/e2e verdes).

---

## Workflow por sessão (rodada speckit completa)

Cada sessão segue, em sua própria branch contra `main`:

1. **`/speckit-specify`** → cria `specs/NNN-...` com `spec.md`: uma user story por D-item
   coberto, FRs e **Success Criteria mensuráveis** (= os SCs listados acima).
2. **`/speckit-plan`** → Technical Context + **Constitution Check** + `research.md` consultando
   **Context7** (shadcn Combobox ARIA, Next.js `robots` metadata route, recharts code-split,
   React Compiler/`react-doctor`). Para a Sessão 1, decidir a abordagem de D6 (opção a vs b).
3. **`/speckit-tasks`** → tarefas por user story, TDD-first.
4. **`/speckit-implement`** → TDD (RED → GREEN → REFACTOR), cobertura ≥ 80% (100% se tocar
   cálculo de ganho — não é o caso aqui).
5. **`/speckit-analyze`** → consistência cross-artefato (spec/plan/tasks).
6. **Verificação final** (antes do PR): `bun run lint`, `bun run test:unit`,
   `bun run test:integration`, `bun run test:e2e` (Sessões 1, 2, 3 afetam fluxos E2E), `bun run build`.
   Depois `/finish-task` → PR contra `main`.

---

## Verificação end-to-end (re-baseline)

- **Por sessão:** re-rodar `bun run diagnose` (seed + lighthouse + react) e confirmar o SC
  específico da sessão antes do PR:
  - Sessão 1 → SEO = 100; React Doctor sem o erro de GET; snapshot do modal presente.
  - Sessão 2 → A11y = 100 nas três páginas; axe verde.
  - Sessão 3 → dashboard mobile CLS < 0,1 / LCP < 2,5 s / Perf ≥ 90; books/:id mobile LCP < 2,5 s.
  - Sessão 4 → `react-doctor --verbose` sem perf errors da família + sem effect-sync bugs.
- **Ao fim das 4 sessões:** criar **novo** `docs/diagnostics/<YYYY-MM>-baseline.md` (datado e
  imutável — **nunca sobrescrever** o de 2026-06) comparando os deltas pré/pós backlog.

---

## Fora de escopo

- Os **~173 warnings de manutenibilidade** do React Doctor (Manutenibilidade 99, Performance 32,
  Bugs 33, Acessibilidade 6, Segurança 3) **não itemizados** no backlog §6. Follow-up opcional
  numa sessão futura (`044-...`) se houver apetite, após estas quatro.
- Categoria experimental `agentic-browsing` do Lighthouse 13 (registrada apenas como nota no baseline).
