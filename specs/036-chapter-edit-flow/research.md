# Phase 0 Research: Chapter Edit Flow

All unknowns resolved by reading the codebase + Context7 (Base UI v1.3). No `NEEDS CLARIFICATION` remain.

## R1 — Open-aware keyboard interception on the edit row

**Decision**: Single keydown handler attached to the edit-mode `<TableRow>` (via `onKeyDown`), implemented in the hook `use-chapter-row-edit.ts` and exposed as `handleRowKeyDown(event)`. On `Enter` → `event.preventDefault()` + `form.handleSubmit(onSubmit)()`. On `Escape` → `event.preventDefault()` + `onCancel()`. Guards skip the action:

- **Popup open** → let Base UI handle the key. Detected by `target.closest('[aria-expanded="true"]')` (Base UI Select/Popover trigger sets `aria-expanded="true"` while open) **or** `target.closest('[data-slot="select-content"], [data-slot="popover-content"]')` (event originated inside the open popup).
- **Action buttons** → native behavior preserved. Detected by `target.closest('[data-row-actions]')` (a marker added to the actions cell). Enter on Save (`type=submit`) submits natively; Enter on Cancel (`type=button` + `onClick`) cancels natively.
- **In-flight submit** → skip if `form.formState.isSubmitting` (no double submit, FR-007).

**Rationale**: The constitution's mandatory Context7 check on Base UI v1.3 confirmed popups render in a `Portal` and Escape-to-close is built-in for the topmost popup. **Critical finding**: React synthetic events bubble through the React *component* tree, not the DOM tree — so even though the popup DOM is portaled to `document.body`, a keydown inside an open Select/Popover **still reaches the row's React `onKeyDown`**. Therefore the "portal isolates the row" assumption is false and the explicit open-state guard above is **required**, not optional. This is the single highest-risk detail in the feature.

**Alternatives considered**:
- *Rely on portal/DOM isolation* — rejected: React portals re-bubble events through the parent React tree.
- *Track popup open-state in React (controlled Select/Popover)* — rejected: more invasive (the Select/Popover are currently uncontrolled with `defaultOpen` only); the DOM-attribute guard is simpler and matches the existing presentational pattern.
- *`event.defaultPrevented` as the discriminator* — rejected: Base UI calls `preventDefault` both when opening a closed trigger and when acting on an open popup, so it can't distinguish the two states.

## R2 — Why current Enter-to-save only works on the title

**Finding**: The title `<Input>` and `SecondsInput` both carry `form={formId}`, so HTML implicit submission *should* fire for both — but the observed behavior is title-only, and the Base UI Select/Popover triggers swallow Enter entirely. Rather than depend on implicit submission (fragile, control-specific), the new row-level handler calls `form.handleSubmit(onSubmit)()` **programmatically** for every control and `preventDefault()`s the native Enter, giving one deterministic submission path across all controls and eliminating any double-submit risk with the existing `form=` association.

**Decision**: Programmatic submit from the row handler; do not rely on implicit form submission. `SecondsInput`'s own `onKeyDown` only intercepts Backspace, so Enter bubbles to the row handler unimpeded.

## R3 — Domain state machine rewrite (`isValidTransition`)

**Decision**: Replace the sequential graph with:

```text
from === to                      → VALID (no-op)
from === "paid"                  → only to "completed" (+ confirmReversion) ; else INVALID / REVERSION_CONFIRMATION_REQUIRED
to === "paid"                    → only from "completed" ; require narrator+editor+editedSeconds>0 ; else INVALID / *_REQUIRED
to === "completed"               → require narrator+editor+editedSeconds>0 (from any non-paid) ; else *_REQUIRED
otherwise (both non-paid)        → VALID (free movement, no fields)
```

Field-check order: narrator → editor → editedSeconds (first missing field is reported).

**Rationale**: Encodes exactly the grilled decisions — free non-paid movement, guards on `completed`/`paid`, narrow paid edges, financial integrity (`editedSeconds > 0` before `paid`). Pure function → 100% unit coverage (Principle V).

**Alternatives considered**: Keeping the field guard at `reviewing → completed` only (current) — rejected; the grilled decision requires narrator+editor+seconds at both `completed` and `paid` edges (belt-and-suspenders against clearing fields in the same edit).

## R4 — Service guard-flow simplification (`ChapterService.update`)

**Decision**: Restructure to:

```text
if (current.status === "paid") this.assertPaidLocked(input);   // financial fields immutable, always
if (input.status changed)      this.assertTransition(current, input);  // isValidTransition for ALL transitions, incl. from "paid"
```

Remove `assertReversion` — its logic (paid → completed requires confirmation; paid → anything-else invalid) is now fully expressed by `isValidTransition`'s `from === "paid"` branch. `assertTransition` already maps rejection reasons to the existing typed errors (`ChapterNarratorRequiredError`, etc.).

**Rationale**: One validation path, less duplication, same guarantees. `assertPaidLocked` stays separate because it protects field immutability independent of any status change.

**Alternatives considered**: Keep `assertReversion` and special-case paid in the UI/service — rejected (duplicate source of truth; the state machine already covers it).

## R5 — UI `reachableTargets` (topology only)

**Decision**:

```text
current === "paid"        → ["paid", "completed"]
current === "completed"   → [all non-paid] + ["paid"]
otherwise                 → [all non-paid]   // "paid" disabled
```

`reachableTargets` encodes **only** the status graph (which options are selectable). It does **not** check narrator/editor/editedSeconds — per FR-014, `completed`/`paid` stay selectable even with empty fields, and the field requirement is enforced on Save with a field-specific PT-BR message (matches the current submit-time guard pattern).

**Rationale**: Keeps the dropdown free of reactive field-presence wiring; consistent with how field guards already surface today.

## R6 — Error message rewording (PT-BR catalog)

**Decision**: Update the user-facing PT-BR messages whose context changed:

- `CHAPTER_NARRATOR_REQUIRED`: "É preciso atribuir um narrador antes de concluir ou pagar o capítulo."
- `CHAPTER_EDITOR_REQUIRED`: "É preciso atribuir um editor antes de concluir ou pagar o capítulo."
- `CHAPTER_EDITED_SECONDS_REQUIRED`: extend to "É preciso registrar a minutagem (tempo editado, acima de zero) antes de concluir ou pagar o capítulo." (A1 resolved — extended, not optional.)

Files: `src/lib/api/error-codes/chapter.ts` (what the user sees via `apiFetch`) **and** `src/lib/domain/chapter-transitions.ts` `REASON_MESSAGES` (kept consistent; used by the pure transition helper / its 100% test). The internal `DomainError` `super(...)` strings stay static English (FR-018 of the constitution / project rule).

**Rationale**: The old wording ("antes de iniciar a edição / enviar para revisão") is now incorrect — narrator/editor are no longer gates for `editing`/`reviewing`.

## R7 — No schema / migration / dependency

**Decision**: Confirmed. `chapter.status` already accepts all six statuses; the PATCH Zod schema (`updateChapterSchema`) already accepts `status` + `confirmReversion`; the response envelope is unchanged. No Drizzle migration, no new client/server dependency.

**Rationale**: The feature is behavioral (transition graph + keyboard), not structural.
