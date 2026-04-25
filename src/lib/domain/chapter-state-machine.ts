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
  | "EDITOR_OR_SECONDS_REQUIRED"
  | "REVERSION_CONFIRMATION_REQUIRED";

export type TransitionResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: TransitionRejection };

const VALID: TransitionResult = { valid: true } as const;

function reject(reason: TransitionRejection): TransitionResult {
  return { valid: false, reason };
}

export function isValidTransition(
  from: ChapterStatus,
  to: ChapterStatus,
  ctx: TransitionContext,
): TransitionResult {
  if (from === to) {
    return VALID;
  }

  switch (from) {
    case "pending":
      if (to !== "editing") return reject("INVALID_STATUS_TRANSITION");
      if (ctx.narratorId === null) return reject("NARRATOR_REQUIRED");
      return VALID;

    case "editing":
      if (to !== "reviewing") return reject("INVALID_STATUS_TRANSITION");
      if (ctx.editorId === null || ctx.editedSeconds <= 0) {
        return reject("EDITOR_OR_SECONDS_REQUIRED");
      }
      return VALID;

    case "reviewing":
      if (to === "retake" || to === "completed") return VALID;
      return reject("INVALID_STATUS_TRANSITION");

    case "retake":
      if (to === "reviewing") return VALID;
      return reject("INVALID_STATUS_TRANSITION");

    case "completed":
      if (to === "paid" || to === "reviewing") return VALID;
      return reject("INVALID_STATUS_TRANSITION");

    case "paid":
      if (to !== "completed") return reject("INVALID_STATUS_TRANSITION");
      if (ctx.confirmReversion !== true) return reject("REVERSION_CONFIRMATION_REQUIRED");
      return VALID;

    default: {
      const exhaustive: never = from;
      throw new Error(`isValidTransition: status inesperado ${String(exhaustive)}`);
    }
  }
}
