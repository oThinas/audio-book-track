# Implementation Plan: Double-Click Row Edit

**Branch**: `033-double-click-row-edit` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/033-double-click-row-edit/spec.md`

## Summary

Adicionar um acelerador de edição na tabela de capítulos da página de detalhe do livro: dar **duplo-clique** em qualquer das 6 células de dado (Título, Status, Narrador, Editor, Prazo, Horas) coloca a linha em modo edição **e** ativa automaticamente o controle daquela célula — dropdowns e o seletor de prazo abrem; inputs recebem foco. O botão de lápis permanece como caminho descobrível e acessível por teclado.

Abordagem técnica: estender o hook co-localizado `useChapterRow` para carregar um `activateField` opcional; um helper **puro** (`resolveActivation`) mapeia `(activateField, chapter)` → flags declarativas de ativação (`defaultOpen` para os `Select`/`Popover` do `@base-ui/react`, `autoFocus` para os inputs), pulando a ativação quando o controle-alvo está bloqueado em `paid`. Os componentes permanecem apenas de renderização (Princípio VII). **Nenhuma dependência nova, nenhuma mudança de schema, API, domínio ou cálculo de ganho** (FR-011).

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Bun 1.2 (runtime + package manager + test runner)

**Primary Dependencies**: Next.js 16.2.1 (App Router), React 19.2.4, `@base-ui/react` 1.3.0 (primitivos `Select` e `Popover` — ambos os `Root` aceitam `defaultOpen` via `useControlled`), react-hook-form 7.72.1, shadcn/ui, Tailwind CSS 4.2, lucide-react. **Nenhuma dependência nova** (FR-011).

**Storage**: N/A — feature puramente de apresentação/interação; nenhuma mudança de schema, repository ou service.

**Testing**: Vitest (unit, `@vitest-environment jsdom` + `@testing-library/react` `renderHook`/`render`), Playwright (E2E em `next start` por worker). Conforme classificação de testes do Princípio V.

**Target Platform**: Web (navegadores desktop como alvo primário). O recurso é acionado por duplo-clique de mouse; não há suporte a double-tap em touch (FR-009).

**Project Type**: Web application (Next.js App Router, single project).

**Performance Goals**: Impacto nulo no LCP e no bundle do cliente (sem novas deps, Princípio VIII). O handler de duplo-clique é O(1); a montagem do modo edição já existe — apenas ganha props declarativas de ativação. Nenhum render ou requisição extra.

**Constraints**: Apresentação apenas (FR-011). A imutabilidade financeira de `paid` DEVE ser preservada — campos bloqueados (Título, Prazo) nunca são ativados (FR-005, Princípio II). Acessibilidade por teclado preservada via lápis (FR-004). Dark mode inalterado (reusa controles existentes).

**Scale/Scope**: Afeta a tabela de capítulos em `/books/[id]`. ~6 células de dado por linha. Modifica 1 hook, adiciona 1 helper puro, ajusta 2 componentes de feature e 2 controles (status select, deadline picker) para aceitar `defaultOpen`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Justificativa |
|---|---|---|
| I. Capítulo como unidade | ✅ N/A | Sem mudança de domínio; operações continuam no nível do capítulo. |
| II. Precisão financeira | ✅ PASS | `paid` mantém os `PAID_LOCKED_FIELDS` bloqueados; a ativação é pulada para todos eles — só Status ativa (FR-005, remediação C1). Sem mudança em ganho. |
| III. Ciclo de vida do capítulo | ✅ PASS | Transições de status inalteradas — `ChapterStatusSelect` continua usando `reachableTargets`. Duplo-clique apenas abre o dropdown. |
| IV. Simplicidade (YAGNI) | ✅ PASS | `defaultOpen` one-shot (uncontrolled) em vez de máquina de open/close controlada. Sem suporte a touch (não pedido). |
| V. TDD | ✅ PASS | Helper puro `resolveActivation` com cobertura 100%; hook com `renderHook`; E2E para foco/abertura reais. RED→GREEN→REFACTOR. |
| VI. Clean Architecture (backend) | ✅ N/A | Nenhuma mudança de backend. |
| VII. Frontend: composição/hooks | ✅ PASS | `activateField` (estado de interação) vive no hook; mapeamento de ativação é helper puro; componentes só renderizam JSX + chamam hook. Reusa `components/ui/`. |
| VIII. Performance | ✅ PASS | Sem deps novas; sem peso de bundle; handler O(1). |
| IX. Design tokens | ✅ PASS | Nenhum valor visual hardcoded; reusa controles existentes e seus tokens. |
| X. API REST | ✅ N/A | Sem rota nova. |
| XI. PostgreSQL | ✅ N/A | Sem mudança de banco. |
| XII. Anti-padrões | ✅ PASS | Sem `useEffect` para derivar; sem `fetch`/`router.refresh()` em componente; `useState` de estado de interação fica no hook; sem HTML cru; sem `toast.success`. |
| XIII. Métricas/KPIs | ✅ N/A | Não aplicável. |
| XIV. PDF viewer | ✅ N/A | Não aplicável. |
| XV. Skills/ferramentas | ✅ PASS | Context7 consultado (`@base-ui/react` `defaultOpen`/`open`). `/tdd`, `/frontend-patterns`, `/frontend-design` aplicados. **design.pen: consulta N/A** — não há nova superfície visual; a feature reusa a tabela e os controles já existentes (adaptação justificada, Princípio VII). |
| XVI. Qualidade/verificação | ✅ PASS | Fase final única: `lint` + `test:unit` + `test:integration` + `test:e2e` + `build` antes do PR. |

**Resultado**: Todos os gates passam. Nenhuma violação a justificar → Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/033-double-click-row-edit/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Phase 0 — decisões técnicas (mecanismo de ativação)
├── data-model.md        # Phase 1 — estado de interação + mapeamento de ativação (sem DB)
├── quickstart.md        # Phase 1 — como exercitar e verificar a feature
├── contracts/
│   └── double-click-row-edit-interaction.md  # Contrato de interação UI (célula → ativação)
├── checklists/
│   └── requirements.md  # Criado em /speckit-specify
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

Arquivos afetados (todos sob `src/components/features/chapters/`, salvo testes):

```text
src/components/features/chapters/
├── chapter-row-activation.ts            # NOVO — helper PURO: resolveActivation(field, chapter) → flags
├── hooks/
│   └── use-chapter-row.ts               # MOD — adiciona activateField + enterEditMode(field?)
├── chapter-row.tsx                      # MOD — onDoubleClick + supressor de seleção nas 6 células de dado; repassa activateField
├── chapter-row-edit-mode.tsx            # MOD — recebe activateField; aplica flags de ativação aos controles
├── chapter-status-select.tsx            # MOD — aceita `defaultOpen` → repassa ao <Select>
└── chapter-deadline-picker.tsx          # MOD — aceita `defaultOpen` → repassa ao <Popover>

__tests__/unit/components/features/chapters/
├── chapter-row-activation.spec.ts       # NOVO — 100% do helper puro (6 campos + skip em paid)
├── use-chapter-row.spec.ts              # MOD — activateField em enterEditMode(field)/exit/selection-mode
└── chapter-row.spec.tsx                 # NOVO/MOD — duplo-clique por célula → modo edição + ativação

__tests__/e2e/
└── books-detail.spec.ts                 # MOD — duplo-clique real: abre dropdown/popover, foca input, skip em paid, no-op em seleção
```

**Structure Decision**: Single project Next.js. A feature vive inteiramente na camada de apresentação da feature `chapters`. Lógica de interação (`activateField`) e o mapeamento puro (`resolveActivation`) seguem o Princípio VII (hook co-localizado + helper puro testável); os componentes permanecem declarativos. Os controles `Select`/`Popover` recebem apenas a prop declarativa `defaultOpen`; nenhum `useEffect` imperativo de foco é introduzido nos componentes.

## Complexity Tracking

> Sem violações constitucionais — nenhuma complexidade a justificar.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
