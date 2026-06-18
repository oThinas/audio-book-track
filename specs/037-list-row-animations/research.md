# Research: List Row Enter/Exit Animations (Fase A)

**Feature**: 037-list-row-animations · **Date**: 2026-06-18

Decisões técnicas que resolvem o Technical Context do `plan.md`. Não há marcadores NEEDS CLARIFICATION pendentes.

---

## D1 — Biblioteca de animação: `tw-animate-css` (existente)

- **Decision**: Reutilizar `tw-animate-css` 1.4.0 (já instalada e em uso nos primitivos shadcn) via classes utilitárias `animate-in`/`animate-out`.
- **Rationale**: Zero dependência nova (FR-009, Princípio VIII); mesma família de classes que o resto da UI (`data-open:animate-in fade-in-0 zoom-in-95` em `dialog.tsx`/`popover.tsx`), garantindo consistência; classes animam apenas `opacity`/`transform` (compositor-friendly, Princípio VIII).
- **Alternatives considered**:
  - `framer-motion`/`motion` — descartada: peso de bundle desnecessário para fade/slide simples (Princípio IV/VIII).
  - React `<ViewTransition>` — descartada para a Fase A: experimental (flag Next + API React) e mais indicada para morph de reordenação e transição de página (parkada na Fase B, ver `futuras-features.md`).

## D2 — Classes e duração

- **Decision**: Entrada `animate-in fade-in-0 slide-in-from-top-2 duration-200`; saída `animate-out fade-out-0 slide-out-to-top-2 duration-200`. Todas as linhas animadas recebem também `motion-reduce:animate-none`.
- **Rationale**: Alinhado ao vocabulário já usado no projeto (`fade-in-0`, `slide-in-from-top-2`, `duration-*`). `duration-200` é token Tailwind (Princípio IX, sem hardcode) e mantém a transição ≤ 300 ms (SC-004). Slide curto (`-2` = 0,5rem) evita deslocamento brusco em linha de tabela.
- **Alternatives considered**: `zoom-in-95` (usado em dialogs) — descartado para linhas por parecer "pop" deslocado num contexto tabular; fade+slide curto é mais natural para inserção/remoção de linha.

## D3 — Distinguir linha "entrando" da carga inicial (FR-005)

- **Decision**: O hook captura o conjunto de ids presentes no **primeiro render** (via `ref`). Qualquer id que apareça depois é marcado como `entering` e recebe `animate-in`; a marca é limpa no `onAnimationEnd` da linha. A carga inicial não anima nenhuma linha.
- **Rationale**: Atende FR-005 (sem cascata de animação ao navegar/abrir a lista) e evita reanimar tudo após `router.refresh()`, já que só ids genuinamente novos entram no conjunto `entering`.
- **Alternatives considered**: aplicar `animate-in` incondicionalmente — descartado: animaria todas as linhas na montagem e em cada refresh.

## D4 — Saída antes de desmontar: reter-e-adiar (FR-002, FR-007)

- **Decision**: A remoção continua **otimista no servidor** (a chamada DELETE dispara imediatamente), mas a linha **não** é filtrada do array de render na hora. O hook move a linha para um conjunto `exiting` (mantendo sua posição), a linha aplica `animate-out`, e só no `onAnimationEnd` a linha é efetivamente removida do render. Em caso de falha da API, a linha é retirada de `exiting` e reinserida (rollback limpo, FR-007).
- **Rationale**: É o padrão "animate presence" — a única forma de animar a saída quando o item já saiu do array fonte. Mantém o feedback otimista (a ação dispara já) e a integridade visual.
- **Alternatives considered**: remover do array na hora (comportamento atual) — não há como animar a saída; `setTimeout` fixo em vez de `onAnimationEnd` — descartado: dessincroniza da duração real e quebra sob reduced-motion.

## D5 — Local do estado de presença: hook reutilizável `src/hooks/use-row-presence.ts`

- **Decision**: Centralizar a lógica (conjunto `entering`, lista `exiting`, merge de render, handlers de `onAnimationEnd`) num hook genérico novo em `src/hooks/use-row-presence.ts`, parametrizado por `getId`. Cada lista existente consome o hook; as linhas recebem `isEntering`/`isExiting` por prop.
- **Rationale**: Princípio VII (estado de domínio/UI em hook, componente só renderiza) + Princípio IV/DRY (narradores/editores/estúdios são idênticos; capítulos reusa a mesma mecânica). Não existe hoje diretório de hooks transversais — `src/hooks/` é o local correto (hooks de feature permanecem em `src/components/features/<feature>/hooks/`).
- **Alternatives considered**: duplicar a lógica em cada hook de lista — descartado (DRY); colocar em `components/features/shared/hooks/` — descartado por não haver "feature" shared e o hook ser infra de UI genérica.

## D6 — `prefers-reduced-motion` (FR-003)

- **Decision**: Aplicar `motion-reduce:animate-none` em todas as linhas animadas **e** fazer o hook detectar reduced-motion (`window.matchMedia('(prefers-reduced-motion: reduce)')`): quando ativo, entrada é no-op e a saída remove a linha **imediatamente** (sem reter), pois sem animação nenhum `onAnimationEnd` dispara.
- **Rationale**: `tw-animate-css` **não** desliga animação sob reduced-motion automaticamente. Sem o curto-circuito no hook, uma linha em `exiting` ficaria presa (nenhum `animationend`). A combinação variante CSS + curto-circuito no hook garante troca instantânea e sem linha presa.
- **Alternatives considered**: só a regra CSS global `@media (prefers-reduced-motion)` zerando `animation-duration` — insuficiente sozinha porque a linha em `exiting` nunca receberia `animationend` e não seria desmontada.

## D7 — Renderização de linhas live + exiting nas tabelas

- **Decision**: As tabelas passam a renderizar a lista mesclada `live + exiting` mantendo a posição original das linhas em saída. Nas tabelas TanStack (narradores/editores/estúdios) a `data` do `useReactTable` passa a ser a lista mesclada; em capítulos, a mescla entra no array `chapters` consumido pela tabela.
- **Rationale**: Necessário para D4 (a linha precisa continuar no DOM durante o `animate-out`). A flag por linha (`isExiting`) seleciona a classe.
- **Alternatives considered**: portal/overlay clonando a linha — descartado (frágil em tabela com colunas `table-fixed`).

## D8 — Compatibilidade com React Compiler

- **Decision**: O hook usa `useState`/`useRef`/`useCallback` e um `useEffect` para `matchMedia`; sem padrões que o React Compiler rejeite.
- **Rationale**: React Compiler (`reactCompiler: true`) memoiza automaticamente; refs e handlers estáveis seguem as regras. Validar no build final (`bun run build`).

## D9 — Estratégia de testes (TDD, Princípio V)

- **Decision**:
  - **Unit** (`__tests__/unit/hooks/use-row-presence.spec.tsx`): renderizar o hook com Testing Library; verificar (a) ids iniciais não entram em `entering`; (b) id novo é marcado e limpo após `animationend`; (c) remoção retém a linha em `exiting` e a remove após `animationend`; (d) sob reduced-motion (matchMedia mockado) entrada é no-op e remoção é imediata.
  - **Unit** (linhas): cada `<entity>-row` aplica as classes corretas conforme `isEntering`/`isExiting`.
  - **E2E** (`__tests__/e2e/list-row-animations.spec.ts`): criar e remover item nas 4 listas (linha aparece/desaparece corretamente); com `page.emulateMedia({ reducedMotion: 'reduce' })`, a mudança é instantânea. Assertir presença/ausência de linha e marcadores de estado (`data-row-state`), não pixels (evita flakiness).
- **Rationale**: `useRowPresence` é unidade isolável (matchMedia/animationend mockáveis) → unit; fluxos completos no browser → E2E. Conforme classificação do projeto.

## D10 — Marcador de estado para teste/E2E

- **Decision**: Cada linha animada expõe `data-row-state="entering" | "exiting" | "idle"` além das classes.
- **Rationale**: Permite asserções determinísticas em E2E/unit sem depender de timing de animação; não altera `role`/estrutura (selectores `getByRole` existentes permanecem válidos).
