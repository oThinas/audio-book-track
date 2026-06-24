# Implementation Plan: Animações de transição entre páginas (View Transitions)

**Branch**: `038-page-view-transitions` | **Date**: 2026-06-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/038-page-view-transitions/spec.md`

## Summary

Adicionar animações de transição ao navegar entre rotas autenticadas do App Router, sem piscar a sidebar, com direção derivada da relação entre rotas (eixo vertical pela ordem do menu entre seções de topo; eixo horizontal para profundidade lista↔detalhe), handoff suave skeleton→conteúdo, `/settings` como modal compartilhável por URL, morph de reordenação de capítulos, e degradação graciosa sob `prefers-reduced-motion` e em navegadores sem suporte.

**Abordagem técnica** (detalhada em [research.md](./research.md), confirmada via Context7): habilitar `experimental.viewTransition` no Next.js 16.2 e envolver o slot de conteúdo (`{children}` de `layout-client.tsx`) no `<ViewTransition>` experimental do React 19.2. A direção é selecionada por **transition types** (`transitionTypes` no `<Link>` → `React.addTransitionType`), resolvidos por um helper puro a partir do par (origem, destino). O modal de `/settings` usa Parallel Route `@modal` + Intercepting Route `(.)settings`. Keyframes e tokens em `globals.css` (apenas `transform`/`opacity`). Feature puramente de apresentação: **sem mudança de dados, DB, API ou serviço; zero novas dependências** (`Dialog` shadcn a confirmar).

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Bun 1.2 (runtime/PM/test runner)

**Primary Dependencies**: Next.js 16.2.1 (App Router, `experimental.viewTransition`), React 19.2.4 (`ViewTransition`, `addTransitionType` — experimentais), Tailwind CSS 4.2 (variante `motion-reduce:`), shadcn/ui (`Dialog`), `@dnd-kit/*` (já presente, reorder), `tw-animate-css` (já presente). **React Compiler ligado** (`reactCompiler: true`).

**Storage**: N/A — feature de apresentação, nenhuma persistência.

**Testing**: Vitest (unit — helper de direção, 100%), Playwright (E2E — navegação, reduced-motion, modal, reorder, regressão visual por screenshot nos breakpoints). Integration: N/A (sem DB).

**Target Platform**: Web (navegadores modernos). Chromium 111+ / Safari 18+ animam; Firefox e demais → troca instantânea (degradação graciosa).

**Project Type**: Web application (Next.js App Router) — frontend único.

**Performance Goals**: Cada transição ≤ 400 ms (NFR-001/SC-003); animar somente propriedades compositor-friendly (`transform`/`opacity`); zero CLS perceptível; zero nova dependência de bundle.

**Constraints**: Duplamente experimental (flag Next.js + `<ViewTransition>` React) + React Compiler ligado → validar coexistência via build de produção (SC-008). Degradação graciosa e reduced-motion obrigatórias. Sidebar não pode piscar.

**Scale/Scope**: 6 seções de topo + páginas de detalhe; ~6 `loading.tsx`; 1 modal; 1 lista reordenável. Mudanças concentradas em layout, sidebar, globals.css, 1 helper novo, 1 hook existente, e a árvore de rota `@modal`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|-----------|-----------|--------|
| I. Capítulo como unidade | Não toca domínio/cálculo; reorder mantém persistência existente. | ✅ |
| II. Precisão financeira | Sem cálculo financeiro. | ✅ N/A |
| III. Ciclo de vida do capítulo | Sem transições de status. | ✅ N/A |
| IV. Simplicidade (YAGNI) | View Transitions é o **único** caminho para crossfade/morph em navegação SPA (CSS-only não dispara). Flag é config de framework com requisito concreto (a spec), não feature flag de app — não viola XII. Wrap mínimo no slot de conteúdo. | ✅ |
| V. TDD | Helper de direção: unit 100%. Fluxos: E2E (navegação, reduced-motion, modal, reorder, screenshots). Sem lógica de DB → sem integration. | ✅ |
| VI. Clean Architecture (backend) | Sem backend tocado. | ✅ N/A |
| VII. Frontend (composição/atomicidade) | Helper puro em `src/lib/navigation/`; estado do modal vem da rota (não `useState` de domínio); `<ViewTransition>` no já-client `layout-client.tsx`; reorder na lógica do hook existente. Modal usa `<Dialog>` de `components/ui/` (não HTML cru). Páginas autenticadas seguem `PageContainer`. Dark mode preservado (tokens). | ✅ |
| VIII. Performance | Só `transform`/`opacity`; ≤400ms; zero dependência nova; degradação graciosa. | ✅ |
| IX. Design tokens | Durações/curvas/offsets como CSS custom properties em `globals.css`; sem hardcode espalhado. | ✅ |
| X. API REST | Nenhuma rota de API nova. | ✅ N/A |
| XI. PostgreSQL/DB | Sem schema/migration/query. | ✅ N/A |
| XII. Anti-padrões | Sem `fetch`/`useEffect` de side-effect novo em componente client além do listener de popstate (spike D3, encapsulado em hook); sem toast de sucesso; sem cores hardcoded; sem `_components/`. | ✅ |
| XV. Ferramentas/Skills | Context7 consultado (Next.js/React version-specific). `design.pen` a consultar para o modal antes de construir a tela. | ⚠️ consultar `design.pen` na Fase 1 de implementação |

**Resultado**: PASS. Nenhuma violação que exija Complexity Tracking. O uso de APIs experimentais é inerente ao requisito (não há alternativa não-experimental para transição SPA) e está mitigado por degradação graciosa + smoke test.

## Project Structure

### Documentation (this feature)

```text
specs/038-page-view-transitions/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões D1–D8 (Context7)
├── data-model.md        # Phase 1 — sem entidades de domínio (estado client/rota)
├── quickstart.md        # Phase 1 — como habilitar e validar
├── contracts/
│   └── ui-contracts.md   # Phase 1 — vocabulário de transition types, classes CSS, contrato da rota modal
├── checklists/
│   └── requirements.md   # spec quality checklist (de /speckit-specify)
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── globals.css                                   # + keyframes view-transition, tokens, bloco reduced-motion (D7/D8)
│   └── (authenticated)/
│       ├── layout.tsx                                # + aceitar prop `modal` (parallel route)
│       ├── layout-client.tsx                         # envolver {children} em <ViewTransition> (D1)
│       ├── settings/page.tsx                         # mantém página standalone (deep-link/refresh)
│       └── @modal/                                   # NOVO — parallel route slot
│           ├── default.tsx                           # retorna null
│           └── (.)settings/page.tsx                  # intercepta /settings em <Dialog> (D4)
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx                               # transitionTypes dinâmico nos <Link> (D2)
│   │   └── mobile-sidebar.tsx                        # idem
│   ├── features/
│   │   ├── settings/
│   │   │   └── settings-content.tsx                  # NOVO — conteúdo extraído (reuso página + modal, D4)
│   │   └── chapters/
│   │       ├── chapters-table.tsx                    # envolver corpo da lista em <ViewTransition> (D6)
│   │       └── hooks/use-chapters-reorder.ts         # reorder otimista dentro de startTransition (D6)
│   └── ui/dialog.tsx                                 # confirmar/adicionar via shadcn (D4)
├── lib/
│   └── navigation/
│       └── nav-transition.ts                         # NOVO — helper puro resolveNavTransition (D2)
└── hooks/ (existentes: row-animation.ts, use-row-presence.ts) # referência de padrão reduced-motion

next.config.ts                                        # + experimental: { viewTransition: true }

__tests__/
├── unit/navigation/nav-transition.spec.ts            # NOVO — helper 100%
└── e2e/                                              # NOVO(s) — transições, reduced-motion, modal, reorder, screenshots
```

**Structure Decision**: Web application Next.js App Router (estrutura `src/` existente). Mudanças concentradas na camada de apresentação: layout autenticado, sidebars, `globals.css`, um helper puro de navegação, a árvore de rota `@modal`, e o hook de reorder existente. Nenhuma camada de backend/domínio/persistência é tocada.

## Complexity Tracking

> Sem violações de constituição a justificar. As APIs experimentais não constituem violação (Princípio IV): são o único mecanismo possível para transição animada em navegação SPA, com requisito concreto na spec e mitigação por degradação graciosa + smoke test de build. Os 2 spikes (D3 back/forward, D6 @dnd-kit × morph) têm fallback que não regride função.
