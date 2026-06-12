import type { ChapterStatus } from "./chapter";
import { isValidTransition, type TransitionRejection } from "./chapter-state-machine";

export interface ChapterTransitionContext {
  readonly narratorId: string | null;
  readonly editorId: string | null;
  readonly editedSeconds: number;
  readonly confirmReversion?: boolean;
}

export type ChapterTransitionResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

const REASON_MESSAGES: Record<TransitionRejection, string> = {
  INVALID_STATUS_TRANSITION: "Transição de status não permitida.",
  NARRATOR_REQUIRED: "Atribua um narrador antes de iniciar a edição.",
  EDITOR_REQUIRED: "Atribua um editor antes de enviar para revisão.",
  EDITED_SECONDS_REQUIRED: "Registre a minutagem (tempo editado) antes de concluir o capítulo.",
  REVERSION_CONFIRMATION_REQUIRED:
    "Confirme a reversão antes de retornar um capítulo pago para concluído.",
};

export function validateChapterTransition(
  from: ChapterStatus,
  to: ChapterStatus,
  ctx: ChapterTransitionContext,
): ChapterTransitionResult {
  const result = isValidTransition(from, to, ctx);
  if (result.valid) return { valid: true };
  return { valid: false, reason: REASON_MESSAGES[result.reason] };
}
