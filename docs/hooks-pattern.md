# Padrão de Hooks por Feature (Componentes Apenas de Renderização)

> Entrada rápida para o time. Para detalhes completos, abra os artefatos referenciados.

## Em uma frase

Componentes em `src/components/features/<feature>/` ficam **apenas de renderização** (JSX + chamada de hook). Toda lógica — state machine, mutações, derivações, side-effects, navegação — vive em **hooks customizados co-localizados** em `src/components/features/<feature>/hooks/`.

## Por que

- **Princípio VII** (Constituição) — composição: lógica de estado e data fetching DEVEM residir em custom hooks ou Server Components, nunca inline em JSX.
- **Princípio XII** — anti-padrão de componente > 200 LOC.
- **Princípio V** — TDD: hooks são testáveis com `renderHook` sem montar a árvore de componentes.

## Onde olhar

| Recurso | Para |
|---|---|
| [../specs/021-presentation-only-components/quickstart.md](../specs/021-presentation-only-components/quickstart.md) | Receita passo-a-passo (10 passos: inventário → extração → testes → smoke → cleanup) |
| [../specs/021-presentation-only-components/contracts/](../specs/021-presentation-only-components/contracts/) | Contratos canônicos dos hooks da feature de Estúdios — input, output, side-effects, invariantes |
| [../specs/021-presentation-only-components/data-model.md](../specs/021-presentation-only-components/data-model.md) | Auditoria componente-por-componente + tabela "estado de domínio vs. estado visual local" (critério objetivo) |
| [../specs/021-presentation-only-components/research.md](../specs/021-presentation-only-components/research.md) | Decisões técnicas (convenções de retorno, granularidade, RHF, refetch, naming) |

## Convenções resumidas

- **Co-localização**: hook em `src/components/features/<feature>/hooks/use-<scope>.ts`. Promoção para `src/lib/hooks/` apenas quando usado por ≥ 2 features.
- **Retorno**: objeto nomeado (`{ data, isLoading, callbacks, ... }`), nunca tupla.
- **Naming**: `use-<feature>-<scope>` (ex.: `use-studios-list`, `use-studio-row`, `use-create-studio-form`).
- **RHF**: `useForm()` permanece **no componente**; o hook recebe `form` por argumento e expõe `onSubmit`.
- **Refetch**: `router.refresh()` é o mecanismo padrão pós-mutação.
- **Toasts**: zero `toast.success` (Princípio VII). Sucesso vem da própria UI.
- **Testes**: `renderHook` (`@testing-library/react`); fakes injetados para módulos internos; `vi.mock()` apenas para módulos não-injetáveis (ver allowlist em `__tests__/unit/setup.ts`).
- **Cobertura**: ≥ 80% por hook (linhas + branches). Helpers puros (ex.: `lib/domain/chapter-transitions.ts`): 100%.

## Estado de domínio vs. estado visual local — onde colocar

| Tipo de estado | Onde mora |
|---|---|
| Lista, item selecionado, item em edição, erro de mutação, dados de servidor | **Hook** (estado de domínio) |
| `isOpen` de menu/popover, `isHovered`, `isFocused`, foco automático | **Componente** (estado puramente visual) |

Critério prático: se o estado **influencia o que é renderizado a partir dos dados** ou **dispara mutação**, é estado de domínio → hook. Se afeta **apenas a aparência local sem ler dados de servidor**, é visual → componente.

## Exemplo canônico

[`src/components/features/studios/`](../src/components/features/studios/) — hooks em [`hooks/`](../src/components/features/studios/hooks/), testes em [`__tests__/unit/components/features/studios/`](../__tests__/unit/components/features/studios/). Use como ponto de partida ao migrar uma nova feature.