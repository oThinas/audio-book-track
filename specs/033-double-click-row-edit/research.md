# Research: Double-Click Row Edit

**Feature**: 033-double-click-row-edit | **Date**: 2026-06-10

Todas as ambiguidades de produto foram resolvidas interativamente via `/grill-me` antes da spec (ver [spec.md](./spec.md) → Assumptions e a tabela de decisões). Este documento registra as decisões **técnicas** de implementação. Não restam marcadores `NEEDS CLARIFICATION`.

---

## R1 — Mecanismo de ativação do controle ("disparar um click no campo")

**Decisão**: Ativação **declarativa one-shot** ao montar o modo edição:
- `Select` (Status, Narrador, Editor) → prop `defaultOpen` do `@base-ui/react` `Select.Root`.
- `Popover` (Prazo) → prop `defaultOpen` do `@base-ui/react` `Popover.Root`.
- Inputs (Título via `Input`, Horas via `SecondsInput`) → atributo React `autoFocus` (foca ao montar, **sem** selecionar o texto — conforme decisão de produto).

**Rationale**:
- Context7 (`/mui/base-ui/v1.3.0`) confirma que os componentes base-ui são *uncontrolled por padrão* e usam `useControlled({ controlled: openParam, default: defaultOpen, ... })` internamente — ou seja, `defaultOpen` é prop suportada em `Select.Root` e `Popover.Root` e abre o overlay já na montagem.
- O modo edição é **remontado** a cada entrada (a linha condicionalmente renderiza `<ChapterRowEditMode>`), então `defaultOpen`/`autoFocus` disparam exatamente uma vez ao entrar — que é o comportamento desejado (acelerador view→edição, FR-008). Depois disso o usuário fecha/reabre normalmente.
- Evita uma máquina de estado controlada de open/close por controle (Princípio IV — YAGNI). Não há requisito de re-disparar a abertura enquanto já em edição.

**Alternativas consideradas**:
- *Disparar um `click` sintético* no controle após o re-render (`element.dispatchEvent(new MouseEvent('click'))`): rejeitado — frágil entre re-render/portal/timing, exige `ref` + `useEffect` imperativo no componente (violaria Princípio VII), e o resultado semântico desejado (abrir dropdown / focar input) é alcançado de forma robusta por `defaultOpen`/`autoFocus`.
- *Controlled `open` + `onOpenChange` com estado local*: rejeitado como padrão — mais código sem benefício; `defaultOpen` cobre o caso. (Mantido como fallback documentado caso algum `Root` específico não honre `defaultOpen` no ambiente real — nesse caso, estado de open/close puramente visual é permitido inline no componente pela tabela do Princípio VII.)

---

## R2 — Onde mora a lógica (Princípio VII)

**Decisão**:
- O **estado de interação** `activateField: ChapterEditField | null` mora no hook `useChapterRow`. `enterEditMode(field?)` define `mode = "edit"` e `activateField = field ?? null`. O lápis chama `enterEditMode()` (sem campo → sem ativação, comportamento atual). `exitEditMode()` e a entrada em modo seleção limpam `activateField`.
- O **mapeamento** `(activateField, chapter) → flags de ativação` é um helper **puro** exportado (`resolveActivation`) em `chapter-row-activation.ts`. Sem React, 100% testável.
- `ChapterRowEditMode` chama `resolveActivation(...)` e **espalha** as flags declarativas nos controles. Permanece apenas-renderização.
- `ChapterRow` (view) liga `onDoubleClick={() => enterEditMode(field)}` nas 6 células de dado.

**Rationale**: `activateField` descreve "qual ação de edição está em andamento" → vai para o hook (tabela do Princípio VII). O mapeamento puro elimina necessidade de testar abertura via DOM no nível unitário e dá cobertura 100% sem flakiness (alinhado a `/tdd`).

**Alternativas**: manter o mapeamento inline no JSX do edit-mode — rejeitado; extrair a função pura torna o "skip em paid" trivialmente testável e mantém o componente magro (< 200 LOC, Princípio XII).

---

## R3 — Pular ativação em campos travados de `paid` (alinhado a `PAID_LOCKED_FIELDS`)

**Decisão**: `resolveActivation` deriva o bloqueio da **fonte de verdade** `PAID_LOCKED_FIELDS` (`src/lib/domain/chapter.ts` = `narratorId, editorId, editedSeconds, deadline, title`), **não** do estado `disabled` do edit-mode. Quando `chapter.status === "paid"`, a ativação é pulada para Título, Narrador, Editor, Prazo e Horas; **apenas Status** ativa (Status não está em `PAID_LOCKED_FIELDS` — habilita a reversão `paid` → `completed`).

**Rationale**: A versão anterior espelhava o `disabled` **parcial** do edit-mode (só Título/Prazo), o que faria o duplo-clique em Narrador/Editor/Horas de um capítulo `paid` **auto-abrir** controles cuja alteração o servidor rejeita (`PAID_LOCKED_FIELDS`) — induzindo erro e contrariando o espírito do Princípio II. Derivar de `PAID_LOCKED_FIELDS` torna a regra correta e simples: *em `paid`, só Status ativa* (remediação C1 do `/speckit-analyze`).

**Fora de escopo (follow-up)**: o edit-mode hoje só desabilita visualmente Título e Prazo em `paid`; Narrador/Editor/Horas seguem clicáveis (servidor rejeita). Alinhar esses `disabled` ao conjunto travado é um conserto pré-existente recomendado, mas **não** faz parte desta feature — aqui só a ativação automática respeita o conjunto completo.

---

## R4 — Supressão do resíduo de seleção de texto nativa (FR-007)

**Decisão**: Em cada célula de dado, adicionar um supressor pontual no `onMouseDown`: quando `event.detail > 1` (segundo clique de um duplo-clique), chamar `event.preventDefault()`. Isso impede o highlight de palavra do navegador **apenas no duplo-clique**, preservando seleção/cópia normal em clique simples.

**Rationale**: `user-select: none` global na célula mataria a cópia do título em clique simples. O guard `detail > 1` é cirúrgico. É um handler puro e sem estado (interação visual) — admissível inline no componente; pode ser extraído como função pura de módulo (`suppressDoubleClickSelection`) para legibilidade.

**Alternativas**: `CSS user-select: none` — rejeitado (impede cópia legítima).

---

## R5 — Escopo touch (FR-009)

**Decisão**: Usar o evento React `onDoubleClick` (mouse). Sem tratamento especial de double-tap em touch; no mobile o lápis permanece o caminho.

**Rationale**: Double-tap em touch é frágil (timing, conflito com zoom/scroll) e não foi pedido. `/frontend-design`: manter a interação previsível e o caminho acessível (lápis) intacto.

---

## R6 — Estratégia de testes (Princípio V + `/tdd`)

**Decisão** (RED → GREEN → REFACTOR):
1. **Unit — helper puro** `chapter-row-activation.spec.ts`: para cada um dos 6 campos, `resolveActivation` retorna a flag correta; em `paid`, Título, Narrador, Editor, Prazo e Horas (todos em `PAID_LOCKED_FIELDS`) retornam flag falsa — só Status ativa; campos não-alvo retornam tudo falso; `activateField = null` (entrada via lápis) retorna tudo falso. **Cobertura 100%** (lógica pura).
2. **Unit — hook** `use-chapter-row.spec.ts` (estende existente): `enterEditMode("status")` → `mode="edit"` + `activateField="status"`; `enterEditMode()` → `activateField=null`; `exitEditMode()` zera `activateField`; flip de `isSelectionMode` força view e zera `activateField`.
3. **Unit — componente** `chapter-row.spec.tsx`: duplo-clique em cada célula de dado leva a `data-mode="edit"`; células não-dado (drag/checkbox/ações) não disparam; verifica presença do controle ativado quando viável em jsdom.
4. **E2E** `books-detail.spec.ts` (estende): duplo-clique real abre o dropdown de Status/Narrador/Editor (listbox visível), abre o popover de Prazo, foca os inputs de Título/Horas; em `paid` entra em edição mas só ativa Status (os 5 campos de `PAID_LOCKED_FIELDS` são pulados); duplo-clique não deixa resíduo de seleção de texto; em modo seleção é no-op; o lápis continua entrando em edição.

**Rationale**: Foco/abertura reais são verificados no navegador (E2E), onde `autoFocus`/`defaultOpen` têm semântica fiel; a lógica determinística fica em unit puro. Evita asserções frágeis de foco em jsdom.

---

## R7 — Tipo do identificador de campo

**Decisão**: `type ChapterEditField = "title" | "status" | "narrator" | "editor" | "deadline" | "editedSeconds"` — alinhado aos nomes de campo de `ChapterEditDraftValues` (inglês no código, Princípio II/feedback). Exportado de `chapter-row-activation.ts` e consumido pelo hook e pelos componentes.

**Rationale**: Reusar os mesmos nomes de campo do draft evita um segundo vocabulário e mantém o mapeamento óbvio.
