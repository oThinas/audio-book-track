# Implementation Plan: List Row Enter/Exit Animations (Fase A)

**Branch**: `037-list-row-animations` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/037-list-row-animations/spec.md`

## Summary

Adicionar animação de entrada (ao criar) e saída (ao remover) às linhas das quatro listagens em tabela: capítulos (detalhe do livro), narradores, editores e estúdios. As quatro listas já mantêm estado otimista em hooks co-localizados e fazem `router.refresh()` em segundo plano. A abordagem reutiliza a `tw-animate-css` (já instalada) via classes `animate-in`/`animate-out` aplicadas por **prop** às linhas, com a lógica de presença (quais linhas estão entrando / saindo) centralizada num hook reutilizável novo `useRowPresence`. Sem dependência nova, sem mudança de API ou banco. `prefers-reduced-motion` desativa a animação via variante `motion-reduce:animate-none`; só propriedades compositor-friendly (opacidade/transform) são animadas.

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Bun 1.2 (runtime, package manager, test runner)

**Primary Dependencies**: Next.js 16.2.1 (App Router), React 19.2.4 (React Compiler ligado), Tailwind CSS 4.2, `tw-animate-css` 1.4.0 (já instalada), shadcn/ui. **Nenhuma dependência nova** (FR-009/Assumptions).

**Storage**: N/A — feature puramente de apresentação; sem schema, repository ou service.

**Testing**: Vitest (unit, jsdom + Testing Library para o hook e linhas) e Playwright (E2E). TDD obrigatório (Princípio V).

**Target Platform**: Web (navegadores modernos, mobile-first); degrada graciosamente onde `tw-animate-css` não aplica.

**Project Type**: Web application (Next.js App Router, frontend single-project).

**Performance Goals**: Transições suaves (60 fps), apenas `transform`/`opacity` (sem reflow); cada transição ≤ 300 ms (SC-004).

**Constraints**: Respeitar `prefers-reduced-motion` (FR-003); funcionar em tema claro e escuro (FR-004); não animar a carga inicial da lista (FR-005); reordenação permanece neutra (FR-006); rollback limpo em falha (FR-007); sem dependência nova.

**Scale/Scope**: 4 listagens, ~6 componentes de tabela/linha tocados, 1 hook reutilizável novo, ~3 hooks de lista existentes ajustados para o caminho de saída.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Gate | Status |
|-----------|------|--------|
| I. Capítulo como unidade | Sem lógica de atribuição/ganho/status | ✅ N/A — só apresentação |
| II. Precisão financeira | Sem cálculo monetário | ✅ N/A |
| III. Ciclo de vida do capítulo | Sem transição de status | ✅ N/A |
| IV. Simplicidade (YAGNI) | Abstração só se houver repetição real | ✅ Hook reutilizável justificado: narradores/editores/estúdios são estruturalmente idênticos + capítulos. Sem dep nova. |
| V. TDD | Testes antes da implementação, ≥80% | ✅ Unit (hook + linhas) e E2E (fluxos + reduced-motion) escritos primeiro |
| VI. Arquitetura limpa backend | Sem backend | ✅ N/A — nenhuma mudança em controller/service/repo |
| VII. Frontend (composição/hooks) | Estado de domínio em hook; componente só renderiza | ✅ **Estado de presença (entering/exiting) vive em hook**; linhas recebem className por prop e permanecem presentacionais |
| VIII. Performance | Sem peso de bundle; compositor-friendly | ✅ Sem dep nova; `transform`/`opacity` apenas |
| IX. Design tokens | Sem valores visuais hardcoded | ✅ Duração via token Tailwind (`duration-200`); sem cor/spacing hardcoded |
| X. API REST | — | ✅ N/A — sem mudança de endpoint |
| XI. PostgreSQL/DB | — | ✅ N/A |
| XII. Anti-padrões | `any`, fetch/useEffect em componente, toast.success, etc. | ✅ Sem violações: efeitos de animação no hook, sem toast de sucesso, sem `any` |
| XV. Ferramentas/Skills | Context7 + design.pen | ✅ Context7 consultado (Next.js, React ViewTransition, tw-animate-css); design.pen **não se aplica** (animações não previstas no arquivo, confirmado pelo usuário) |
| XVI. Qualidade/verificação | lint+testes+build na fase final | ✅ Planejado antes do PR |

**Resultado**: Sem violações. Tabela de Complexity Tracking vazia.

## Project Structure

### Documentation (this feature)

```text
specs/037-list-row-animations/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões técnicas
├── data-model.md        # Phase 1 — estado de presença (sem entidade de DB)
├── quickstart.md        # Phase 1 — como validar manualmente
├── contracts/           # Phase 1 — contratos de UI/hook
│   ├── row-animation-behavior.md
│   └── use-row-presence.md
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── hooks/
│   └── use-row-presence.ts                 # NOVO — hook reutilizável de presença (entering/exiting) cross-feature
├── components/features/
│   ├── chapters/
│   │   ├── chapters-table.tsx              # renderiza linhas live + exiting; passa isEntering/isExiting
│   │   ├── chapter-row.tsx                 # aplica animate-in/out por prop + onAnimationEnd
│   │   └── hooks/                          # (useBookDetail em books/hooks) integra useRowPresence ao create/delete/bulk-delete
│   ├── narrators/
│   │   ├── narrators-table.tsx             # data = live + exiting; passa flags por linha
│   │   ├── narrator-row.tsx                # aplica classes por prop
│   │   └── hooks/use-narrators-list.ts     # delete vira reter-e-adiar via useRowPresence
│   ├── editors/{editors-table.tsx, editor-row.tsx, hooks/use-editors-list.ts}
│   └── studios/{studios-table.tsx, studio-row.tsx, hooks/use-studios-list.ts}
└── app/globals.css                         # (somente se necessário) salvaguarda global de reduced-motion

__tests__/
├── unit/hooks/use-row-presence.spec.tsx              # detecção de entrada, retenção+drop de saída, reduced-motion
├── unit/components/features/<feature>/<entity>-row.spec.tsx   # linha aplica classe correta por estado
└── e2e/list-row-animations.spec.ts                   # criar/remover nas 4 listas + reduced-motion instantâneo
```

**Structure Decision**: Web app single-project (Next.js App Router). Introduz-se um diretório novo `src/hooks/` para o hook de presença reutilizável — coerente com a regra de organização de frontend do projeto (hooks transversais não pertencem a uma feature específica) e evita duplicar a lógica idêntica de entrada/saída nas 3 listas de entidade + capítulos (Princípio IV / DRY). Os hooks **específicos de feature** continuam em `src/components/features/<feature>/hooks/` (Princípio VII); apenas o primitivo genérico de presença vai para `src/hooks/`.

## Implementation Phasing

Mapeia as prioridades da spec (US1/US2/US3) em incrementos independentes e testáveis:

- **Fase A.1 — Entrada (US1, P1)** — complexidade BAIXA. `useRowPresence` detecta ids que aparecem após o mount inicial e os marca como `entering`; a linha aplica `animate-in` e limpa a marca no `onAnimationEnd`. Não exige adiar nada. Cobre as 4 listas.
- **Fase A.2 — Saída das 3 listas de entidade (US2, P2)** — complexidade MÉDIA. `useRowPresence` retém a linha removida (reter-e-adiar): a chamada de API dispara imediatamente (otimista), mas a remoção do array de render só ocorre no `onAnimationEnd` do `animate-out`. As tabelas TanStack passam a renderizar `live + exiting`.
- **Fase A.3 — Saída de capítulos, incl. bulk-delete (US2, P2)** — complexidade ALTA (dnd-kit + agrupamento + TanStack na mesma tabela). Mesma mecânica de reter-e-adiar aplicada a `useBookDetail`/`chapters-table`, tratando remoção individual e em massa.
- **Fase A.4 — Reduced-motion + tema (US3, P3)** — transversal. Garantir `motion-reduce:animate-none` em todas as linhas animadas e ausência de animação na carga inicial e na reordenação; verificação visual em tema claro/escuro.

## Complexity Tracking

> Sem violações de constituição. Nenhuma justificativa de complexidade necessária.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| — | — | — |
