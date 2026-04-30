"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Editor } from "@/lib/domain/editor";

interface EditorLinkedDetails {
  readonly books?: ReadonlyArray<{ readonly id: string; readonly title: string }>;
}

interface EditorErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: EditorLinkedDetails;
  };
}

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
      const response = await fetch(`/api/v1/editors/${editor.id}`, {
        method: "DELETE",
      });

      if (response.status === 204 || response.status === 404) {
        onConfirmed(editor.id);
        onOpenChange(false);
        return;
      }

      if (response.status === 409) {
        const body = (await response.json()) as EditorErrorBody;
        if (body.error.code === "EDITOR_LINKED_TO_ACTIVE_CHAPTERS") {
          const titles = body.error.details?.books?.map((b) => b.title) ?? [];
          const titlesPreview = titles.slice(0, 3).join(", ");
          const remainder = titles.length > 3 ? ` e mais ${titles.length - 3}` : "";
          toast.error(
            `Não é possível excluir: capítulos em ${titles.length} livro(s) ativo(s).`,
            titles.length > 0 ? { description: `${titlesPreview}${remainder}` } : undefined,
          );
          onOpenChange(false);
          return;
        }
      }

      toast.error("Não foi possível excluir o editor. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  }

  return { isDeleting, handleConfirm };
}
