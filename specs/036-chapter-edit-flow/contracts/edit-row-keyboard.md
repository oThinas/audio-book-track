# Contract: Edit-Row Keyboard Interaction

**Scope**: Client only — `chapter-row-edit-mode.tsx` (wiring) + `use-chapter-row-edit.ts` (logic) + `chapter-row-edit-actions.tsx` (marker). No network/contract change.

## Hook API addition

`useChapterRowEdit(...)` returns, in addition to its current shape:

```ts
handleRowKeyDown: (event: React.KeyboardEvent<HTMLTableRowElement>) => void
```

Wired in the component as `<TableRow data-mode="edit" onKeyDown={handleRowKeyDown}>`.

## Behavior

| Key | Condition | Outcome |
|---|---|---|
| `Enter` | nothing open, focus on title/seconds/closed trigger | `preventDefault()` + `form.handleSubmit(onSubmit)()` → validates, then saves (or shows field error) |
| `Enter` | a Select/Popover/calendar is **open** | handler **returns early** → Base UI selects highlighted option/date & closes; edit not saved |
| `Enter` | focus inside the actions cell (`[data-row-actions]`) | handler returns early → native: Save submits, Cancel cancels |
| `Enter` | `form.formState.isSubmitting` | handler returns early → no double submit |
| `Escape` | nothing open | `preventDefault()` + `onCancel()` → row exits edit mode, no changes persisted |
| `Escape` | a popup is **open** | handler returns early → Base UI closes the popup; edit stays open (second Escape then cancels) |

## "Is a popup open?" detection (the critical guard)

Because React synthetic events bubble through the React tree (not the DOM), keydowns from a portaled, open Base UI popup **do** reach the row handler. The guard:

```ts
const el = event.target as HTMLElement;
const popupOpen =
  el.closest('[aria-expanded="true"]') !== null ||                       // open Select/Popover trigger
  el.closest('[data-slot="select-content"], [data-slot="popover-content"]') !== null; // focus inside open popup
if (popupOpen) return;
if (el.closest('[data-row-actions]')) return;                            // native button behavior
```

The `data-row-actions` marker is added to the `<TableCell>` wrapper in `chapter-row-edit-actions.tsx`.

## Acceptance (maps to spec US2)

- Enter from title → saves (regression of existing behavior).
- Enter from closed status/narrator/editor trigger → saves.
- Enter while status dropdown open → selects highlighted option, closes; second Enter saves.
- Enter while calendar open → picks highlighted date, closes; edit not saved.
- Escape with nothing open → cancels.
- Escape with dropdown open → closes dropdown only; second Escape cancels.
- Enter on Cancel button → cancels (native). Enter on Save button → saves (native submit).
- Enter with invalid title → validation blocks save, error shown.
