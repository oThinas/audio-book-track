# Contract: Chapter Status Transition Rules

**Scope**: Domain (`isValidTransition`) → Service (`ChapterService.update`) → `PATCH /api/v1/chapters/:id`. **No request/response shape change** — only the set of accepted transitions and two error messages change.

## Domain — `isValidTransition(from, to, ctx)`

`ctx = { narratorId, editorId, editedSeconds, confirmReversion? }`

Returns `{ valid: true }` or `{ valid: false, reason }` where `reason ∈ { INVALID_STATUS_TRANSITION, NARRATOR_REQUIRED, EDITOR_REQUIRED, EDITED_SECONDS_REQUIRED, REVERSION_CONFIRMATION_REQUIRED }`.

Behavior = the matrix in [data-model.md](../data-model.md). Pseudocode:

```text
if (from === to) return VALID
if (from === "paid") {
  if (to !== "completed") return INVALID_STATUS_TRANSITION
  if (ctx.confirmReversion !== true) return REVERSION_CONFIRMATION_REQUIRED
  return VALID
}
if (to === "paid") {
  if (from !== "completed") return INVALID_STATUS_TRANSITION
  return requireFields(ctx)            // narrator → editor → editedSeconds>0
}
if (to === "completed") return requireFields(ctx)
return VALID                            // both non-paid, free movement
```

## Service — `ChapterService.update(id, input)`

Guard order:

1. If `current.status === "paid"` → `assertPaidLocked(input)` (any of `PAID_LOCKED_FIELDS` present → `409 CHAPTER_PAID_LOCKED`).
2. If `input.status` changed → `assertTransition(current, input)` → `isValidTransition(...)`; on rejection throw the mapped typed error.
3. `assertReferences(input)` (narrator/editor existence) — unchanged.
4. Persist + recompute `book.status` + bump `chapters_version` + audit `CHAPTER_STATUS_TRANSITION` — all in one transaction (unchanged).

`assertReversion` is **removed** (absorbed by the `from === "paid"` branch of `isValidTransition`).

## HTTP — `PATCH /api/v1/chapters/:id`

Request body (Zod `updateChapterSchema`, **unchanged**): partial of `{ title, status, narratorId, editorId, editedSeconds, deadline, confirmReversion }`.

| Scenario | Status | Error code |
|---|---|---|
| Free non-paid transition (e.g. `pending → reviewing`) | `200` | — |
| `* → completed` / `completed → paid` missing narrator | `422` | `CHAPTER_NARRATOR_REQUIRED` |
| …missing editor | `422` | `CHAPTER_EDITOR_REQUIRED` |
| …`editedSeconds = 0` | `422` | `CHAPTER_EDITED_SECONDS_REQUIRED` |
| `* → paid` where `from ≠ completed` | `422` | `CHAPTER_INVALID_TRANSITION` |
| `paid → completed` without `confirmReversion` | `422` | `CHAPTER_REVERSION_CONFIRMATION_REQUIRED` |
| `paid → completed` with `confirmReversion: true` | `200` | — |
| `paid → {anything but completed}` | `422` | `CHAPTER_INVALID_TRANSITION` |
| Mutating a financial field while `paid` | `409` | `CHAPTER_PAID_LOCKED` |

PT-BR message changes: `CHAPTER_NARRATOR_REQUIRED` and `CHAPTER_EDITOR_REQUIRED` reworded to reference "concluir ou pagar" (research R6). All other catalog entries unchanged.
