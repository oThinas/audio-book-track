import type { ChapterStatus } from "./chapter";

export interface TransitionContext {
  readonly narratorId: string | null;
  readonly editorId: string | null;
  readonly editedSeconds: number;
  readonly confirmReversion?: boolean;
}

export type TransitionRejection =
  | "INVALID_STATUS_TRANSITION"
  | "NARRATOR_REQUIRED"
  | "EDITOR_REQUIRED"
  | "EDITED_SECONDS_REQUIRED"
  | "REVERSION_CONFIRMATION_REQUIRED";

export type TransitionResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: TransitionRejection };

const VALID: TransitionResult = { valid: true } as const;

function reject(reason: TransitionRejection): TransitionResult {
  return { valid: false, reason };
}

/**
 * Narrator + editor + editedSeconds (> 0) are required only at the entry edges
 * of `completed` and `paid`. The check order is deterministic
 * (narrator → editor → editedSeconds): the first missing field is reported.
 */
function requireCompletionFields(ctx: TransitionContext): TransitionResult {
  if (ctx.narratorId === null) return reject("NARRATOR_REQUIRED");
  if (ctx.editorId === null) return reject("EDITOR_REQUIRED");
  if (ctx.editedSeconds <= 0) return reject("EDITED_SECONDS_REQUIRED");
  return VALID;
}

/**
 * Free movement between the NON-PAID statuses (pending/editing/reviewing/retake),
 * in any order and with no required field. `paid` is the only guarded status:
 * it can only be entered from `completed` (with the completion fields) and left
 * only towards `completed` (with reversion confirmation). Completing requires the
 * same fields from any non-paid status. See Constitution Principle III.
 */
export function isValidTransition(
  from: ChapterStatus,
  to: ChapterStatus,
  ctx: TransitionContext,
): TransitionResult {
  if (from === to) {
    return VALID;
  }

  if (from === "paid") {
    if (to !== "completed") return reject("INVALID_STATUS_TRANSITION");
    // Reversion does not re-check fields: the chapter already had them to be paid.
    if (ctx.confirmReversion !== true) return reject("REVERSION_CONFIRMATION_REQUIRED");
    return VALID;
  }

  if (to === "paid") {
    if (from !== "completed") return reject("INVALID_STATUS_TRANSITION");
    return requireCompletionFields(ctx);
  }

  if (to === "completed") {
    return requireCompletionFields(ctx);
  }

  // Free movement: both statuses are non-paid (paid handled above) and `to` is
  // neither completed nor paid. These annotations are a compile-time
  // exhaustiveness guard — adding a new ChapterStatus breaks the assignment,
  // forcing the new status to be classified here instead of silently falling
  // through to VALID (which would bypass the completion/paid field guards).
  const _exhaustiveFrom: Exclude<ChapterStatus, "paid"> = from;
  const _exhaustiveTo: Exclude<ChapterStatus, "completed" | "paid"> = to;
  void _exhaustiveFrom;
  void _exhaustiveTo;
  return VALID;
}
