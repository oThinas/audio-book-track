# Data Model: Double-Click Row Edit

**Feature**: 033-double-click-row-edit | **Date**: 2026-06-10

> **Sem entidades de persistência.** Esta feature é puramente de apresentação/interação (FR-011): nenhuma tabela, coluna, migration, repository, service ou contrato de API é criado ou alterado. O "modelo" aqui é o **estado de interação no cliente** e o **mapeamento puro** de ativação.

## Estado de interação (no hook `useChapterRow`)

| Campo | Tipo | Descrição |
|---|---|---|
| `mode` | `"view" \| "edit"` | Estado existente — modo de renderização da linha. |
| `activateField` | `ChapterEditField \| null` | **NOVO** — qual controle ativar ao entrar em edição. `null` quando a edição foi iniciada pelo lápis (sem ativação automática). |

**Tipo de campo editável:**

```ts
// chapter-row-activation.ts
export type ChapterEditField =
  | "title"
  | "status"
  | "narrator"
  | "editor"
  | "deadline"
  | "editedSeconds";
```

**Transições do estado de interação:**

| Origem (gatilho) | `mode` | `activateField` |
|---|---|---|
| Duplo-clique na célula `X` | `edit` | `X` |
| Clique no lápis | `edit` | `null` |
| `exitEditMode()` (cancelar/salvar) | `view` | `null` |
| Entrar em modo seleção (`isSelectionMode = true`) | `view` (forçado) | `null` |

Regras:
- `activateField` é efêmero: lido uma vez na montagem do modo edição para derivar as flags declarativas; não persiste após a interação inicial (o usuário fecha/reabre os controles normalmente).
- Em modo seleção, duplo-clique é no-op (FR-006) — o hook já força `view` quando `isSelectionMode` vira `true`.

## Mapeamento puro de ativação (`resolveActivation`)

Função pura, sem React, 100% coberta. Mapeia o campo-alvo + o capítulo (para respeitar bloqueio de `paid`) nas flags declarativas consumidas pelos controles.

```ts
// chapter-row-activation.ts
export interface ChapterRowActivation {
  readonly titleAutoFocus: boolean;        // <Input> Título
  readonly statusOpen: boolean;            // <ChapterStatusSelect defaultOpen>
  readonly narratorOpen: boolean;          // <Select> Narrador defaultOpen
  readonly editorOpen: boolean;            // <Select> Editor defaultOpen
  readonly deadlineOpen: boolean;          // <ChapterDeadlinePicker defaultOpen>
  readonly editedSecondsAutoFocus: boolean;// <SecondsInput> Horas
}

export function resolveActivation(
  field: ChapterEditField | null,
  chapter: Pick<ChapterRowEntity, "status">,
): ChapterRowActivation;
```

**Tabela de verdade** (campo-alvo → flag verdadeira; demais flags `false`):

| `activateField` | Flag ativada | Bloqueio em `paid`? (`PAID_LOCKED_FIELDS`) |
|---|---|---|
| `null` (lápis) | nenhuma | — (tudo `false`) |
| `"title"` | `titleAutoFocus` | **Sim** (`title`) → `false` quando `status === "paid"` |
| `"status"` | `statusOpen` | **Não** — único campo editável em `paid` (reversão) |
| `"narrator"` | `narratorOpen` | **Sim** (`narratorId`) → `false` quando `status === "paid"` |
| `"editor"` | `editorOpen` | **Sim** (`editorId`) → `false` quando `status === "paid"` |
| `"deadline"` | `deadlineOpen` | **Sim** (`deadline`) → `false` quando `status === "paid"` |
| `"editedSeconds"` | `editedSecondsAutoFocus` | **Sim** (`editedSeconds`) → `false` quando `status === "paid"` |

> Em `paid`, a ativação é pulada para todo campo cujo correspondente está em `PAID_LOCKED_FIELDS` (fonte de verdade em `src/lib/domain/chapter.ts`: `narratorId, editorId, editedSeconds, deadline, title`). **Apenas `status`** (não travado) ativa. `resolveActivation` DEVE derivar o bloqueio de `PAID_LOCKED_FIELDS` — não do estado `disabled` (parcial) do `chapter-row-edit-mode.tsx`, que hoje só desabilita Título e Prazo.
>
> **Observação fora de escopo (follow-up):** o edit-mode mantém Narrador/Editor/Horas clicáveis em `paid` (o servidor rejeita a alteração via `PAID_LOCKED_FIELDS`). Alinhar esses `disabled` ao conjunto travado é um conserto pré-existente recomendado, **não** coberto por esta feature — aqui apenas a **ativação automática** respeita o conjunto completo.

## Componentes — props adicionadas

| Componente | Prop nova | Tipo | Efeito |
|---|---|---|---|
| `ChapterStatusSelect` | `defaultOpen` | `boolean?` | Repassada ao `<Select defaultOpen>`. |
| `ChapterDeadlinePicker` | `defaultOpen` | `boolean?` | Repassada ao `<Popover defaultOpen>`. |
| `ChapterRowEditMode` | `activateField` | `ChapterEditField \| null` | Deriva flags via `resolveActivation`. |

Narrador/Editor usam `<Select>` inline no edit-mode → recebem `defaultOpen` diretamente. Título (`Input`) e Horas (`SecondsInput`) recebem `autoFocus` diretamente (ambos repassam atributos ao input nativo).
