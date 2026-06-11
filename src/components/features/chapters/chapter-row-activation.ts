import { type ChapterStatus, PAID_LOCKED_FIELDS, type PaidLockedField } from "@/lib/domain/chapter";

/**
 * Which control to auto-activate when a chapter row enters edit mode via a
 * double-click on a data cell. Mirrors the field names of the edit draft.
 */
export type ChapterEditField =
  | "title"
  | "status"
  | "narrator"
  | "editor"
  | "deadline"
  | "editedSeconds";

/**
 * Declarative activation flags consumed by the edit-mode controls: dropdowns /
 * popover open via `defaultOpen`, inputs focus via `autoFocus`.
 */
export interface ChapterRowActivation {
  readonly titleAutoFocus: boolean;
  readonly statusOpen: boolean;
  readonly narratorOpen: boolean;
  readonly editorOpen: boolean;
  readonly deadlineOpen: boolean;
  readonly editedSecondsAutoFocus: boolean;
}

const NONE: ChapterRowActivation = {
  titleAutoFocus: false,
  statusOpen: false,
  narratorOpen: false,
  editorOpen: false,
  deadlineOpen: false,
  editedSecondsAutoFocus: false,
};

// Maps each editable field (except `status`, which is never locked) to its
// persisted counterpart. The paid lock derives from PAID_LOCKED_FIELDS — the
// domain source of truth — not from the edit form's (partial) disabled state.
const PERSISTED_FIELD: Record<Exclude<ChapterEditField, "status">, PaidLockedField> = {
  title: "title",
  narrator: "narratorId",
  editor: "editorId",
  deadline: "deadline",
  editedSeconds: "editedSeconds",
};

function isLockedOnPaid(field: ChapterEditField, status: ChapterStatus): boolean {
  if (status !== "paid" || field === "status") return false;
  return PAID_LOCKED_FIELDS.includes(PERSISTED_FIELD[field]);
}

/**
 * Given the field a double-click targeted and the chapter, returns which single
 * control should auto-activate. Returns all-false when no field is targeted
 * (pencil entry) or when the target is locked on a paid chapter.
 */
export function resolveActivation(
  field: ChapterEditField | null,
  chapter: { readonly status: ChapterStatus },
): ChapterRowActivation {
  if (field === null || isLockedOnPaid(field, chapter.status)) return NONE;
  switch (field) {
    case "title":
      return { ...NONE, titleAutoFocus: true };
    case "status":
      return { ...NONE, statusOpen: true };
    case "narrator":
      return { ...NONE, narratorOpen: true };
    case "editor":
      return { ...NONE, editorOpen: true };
    case "deadline":
      return { ...NONE, deadlineOpen: true };
    case "editedSeconds":
      return { ...NONE, editedSecondsAutoFocus: true };
    default: {
      const exhaustive: never = field;
      throw new Error(`Unknown chapter edit field: ${String(exhaustive)}`);
    }
  }
}
