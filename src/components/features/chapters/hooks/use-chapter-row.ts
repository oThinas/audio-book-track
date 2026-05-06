"use client";

import { useEffect, useState } from "react";

export interface UseChapterRowArgs {
  readonly isSelectionMode: boolean;
}

export interface UseChapterRowReturn {
  readonly mode: "view" | "edit";
  readonly enterEditMode: () => void;
  readonly exitEditMode: () => void;
}

export function useChapterRow({ isSelectionMode }: UseChapterRowArgs): UseChapterRowReturn {
  const [mode, setMode] = useState<"view" | "edit">("view");

  // Bulk-delete mode and inline edit mode are mutually exclusive: when the
  // parent enters selection mode, drop any in-flight edit so the row renders
  // its checkbox instead of the edit form.
  useEffect(() => {
    if (isSelectionMode) {
      setMode("view");
    }
  }, [isSelectionMode]);

  return {
    mode,
    enterEditMode: () => setMode("edit"),
    exitEditMode: () => setMode("view"),
  };
}
