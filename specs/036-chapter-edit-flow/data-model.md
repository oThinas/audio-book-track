# Phase 1 Data Model: Chapter Edit Flow

**No persistence changes.** No new tables, columns, indexes, or migrations. The only domain artifact that changes is the **chapter status transition machine** (`src/lib/domain/chapter-state-machine.ts`), a pure function. This document specifies its new behavior exhaustively (it is the 100%-coverage unit under Principle V).

## Entity (unchanged shape)

**Chapter** — fields relevant to this feature:

| Field | Type | Notes |
|---|---|---|
| `status` | enum `pending \| editing \| reviewing \| retake \| completed \| paid` | The state under change. |
| `narratorId` | `string \| null` | Required to enter `completed`/`paid`. |
| `editorId` | `string \| null` | Required to enter `completed`/`paid`. |
| `editedSeconds` | `integer ≥ 0` | Must be `> 0` to enter `completed`/`paid`. Locked once `paid`. |
| `completedAt` / `paidAt` | `timestamptz \| null` | Set on first entry into `completed`/`paid`; not cleared on reversion (unchanged). |

`PAID_LOCKED_FIELDS = [title, narratorId, editorId, editedSeconds, deadline]` — immutable while `paid` (unchanged).

## Transition matrix (NEW)

`✓` = allowed · `✗` = rejected `INVALID_STATUS_TRANSITION` · `F` = allowed **iff** narrator+editor+editedSeconds>0 (else field error) · `C` = allowed **iff** `confirmReversion === true` (else `REVERSION_CONFIRMATION_REQUIRED`)

| from \ to | pending | editing | reviewing | retake | completed | paid |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **pending** | – | ✓ | ✓ | ✓ | F | ✗ |
| **editing** | ✓ | – | ✓ | ✓ | F | ✗ |
| **reviewing** | ✓ | ✓ | – | ✓ | F | ✗ |
| **retake** | ✓ | ✓ | ✓ | – | F | ✗ |
| **completed** | ✓ | ✓ | ✓ | ✓ | – | F |
| **paid** | ✗ | ✗ | ✗ | ✗ | C | – |

Notes:
- `from === to` → always VALID (no-op; the service still patches other fields).
- `paid → completed` (`C`) does **not** re-check narrator/editor/seconds (the chapter already had them to become paid); it only requires `confirmReversion`.
- `* → paid` is `F` **and** restricted to `from === completed` (cells other than `completed → paid` are `✗`).
- Field-check order for `F`: narrator → editor → editedSeconds (first missing wins).

## Rejection reasons (existing enum, unchanged)

`INVALID_STATUS_TRANSITION` · `NARRATOR_REQUIRED` · `EDITOR_REQUIRED` · `EDITED_SECONDS_REQUIRED` · `REVERSION_CONFIRMATION_REQUIRED` → mapped to existing typed `DomainError`s and PT-BR catalog codes (`CHAPTER_*`). Only the **message text** of `CHAPTER_NARRATOR_REQUIRED` / `CHAPTER_EDITOR_REQUIRED` changes (see research R6).

## UI mirror (`reachableTargets`, topology only)

| current status | selectable targets |
|---|---|
| `paid` | `paid`, `completed` |
| `completed` | `pending`, `editing`, `reviewing`, `retake`, `completed`, `paid` |
| any other non-paid | `pending`, `editing`, `reviewing`, `retake`, `completed` (paid **disabled**) |

The mirror is intentionally coarser than the machine (it ignores field presence — FR-014). It must never offer a target the machine rejects on topology, and never forbid one it allows (FR-017).
