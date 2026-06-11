"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChapterEditField } from "../chapter-row-activation";

export interface UseChapterRowArgs {
  readonly isSelectionMode: boolean;
}

export interface ChapterEditTriggerProps {
  readonly onDoubleClick: () => void;
  readonly onMouseDown: (event: React.MouseEvent) => void;
}

export interface UseChapterRowReturn {
  readonly mode: "view" | "edit";
  /** Which control to auto-activate on entering edit; null when via the pencil. */
  readonly activateField: ChapterEditField | null;
  readonly enterEditMode: (field?: ChapterEditField) => void;
  readonly exitEditMode: () => void;
  /** Double-click handlers for a data cell: enter edit + suppress text selection. */
  readonly getEditTriggerProps: (field: ChapterEditField) => ChapterEditTriggerProps;
}

// A double-click selects the word under the cursor. Suppress that residue on the
// second mouse-down only, leaving single-click selection (e.g. copying a title)
// intact.
function suppressDoubleClickSelection(event: React.MouseEvent): void {
  if (event.detail > 1) event.preventDefault();
}

export function useChapterRow({ isSelectionMode }: UseChapterRowArgs): UseChapterRowReturn {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [activateField, setActivateField] = useState<ChapterEditField | null>(null);

  // Bulk-delete mode and inline edit mode are mutually exclusive: when the
  // parent enters selection mode, drop any in-flight edit so the row renders
  // its checkbox instead of the edit form.
  useEffect(() => {
    if (isSelectionMode) {
      setMode("view");
      setActivateField(null);
    }
  }, [isSelectionMode]);

  const enterEditMode = useCallback(
    (field?: ChapterEditField) => {
      // Editing is disabled while bulk-selecting: a double-click on a data cell
      // (handlers stay attached in selection mode) must not enter edit mode.
      if (isSelectionMode) return;
      setActivateField(field ?? null);
      setMode("edit");
    },
    [isSelectionMode],
  );

  const exitEditMode = useCallback(() => {
    setMode("view");
    setActivateField(null);
  }, []);

  const getEditTriggerProps = useCallback(
    (field: ChapterEditField): ChapterEditTriggerProps => ({
      onDoubleClick: () => enterEditMode(field),
      onMouseDown: suppressDoubleClickSelection,
    }),
    [enterEditMode],
  );

  return { mode, activateField, enterEditMode, exitEditMode, getEditTriggerProps };
}
