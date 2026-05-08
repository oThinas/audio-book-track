"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api/api-fetch";
import type { Editor } from "@/lib/domain/editor";

export interface UseDeleteEditorArgs {
  readonly editor: Editor | null;
  readonly onConfirmed: (id: string) => void;
  readonly onOpenChange: (open: boolean) => void;
}

export interface UseDeleteEditorReturn {
  readonly isDeleting: boolean;
  readonly handleConfirm: () => Promise<void>;
}

export function useDeleteEditor({
  editor,
  onConfirmed,
  onOpenChange,
}: UseDeleteEditorArgs): UseDeleteEditorReturn {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirm() {
    if (!editor) return;

    setIsDeleting(true);
    try {
      const result = await apiFetch<null>(`/api/v1/editors/${editor.id}`, {
        method: "DELETE",
      });

      if (result.ok) {
        onConfirmed(editor.id);
        onOpenChange(false);
        return;
      }

      if (result.kind === "api-error" && result.code === "EDITOR_NOT_FOUND") {
        onConfirmed(editor.id);
      }

      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  }

  return { isDeleting, handleConfirm };
}
