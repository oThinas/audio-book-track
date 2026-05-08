"use client";

import { useState } from "react";
import { toast } from "sonner";
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

interface BlockingDetails {
  readonly books?: ReadonlyArray<{ readonly id: string; readonly title: string }>;
}

function isBlockingDetails(value: unknown): value is BlockingDetails {
  if (typeof value !== "object" || value === null) return false;
  const books = (value as { books?: unknown }).books;
  return books === undefined || Array.isArray(books);
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
        suppressToastFor: ["EDITOR_LINKED_TO_ACTIVE_CHAPTERS"],
      });

      if (result.ok) {
        onConfirmed(editor.id);
        onOpenChange(false);
        return;
      }

      if (result.kind === "api-error") {
        if (result.code === "EDITOR_NOT_FOUND") {
          onConfirmed(editor.id);
        } else if (
          result.code === "EDITOR_LINKED_TO_ACTIVE_CHAPTERS" &&
          isBlockingDetails(result.details)
        ) {
          const titles = result.details.books?.map((b) => b.title) ?? [];
          const titlesPreview = titles.slice(0, 3).join(", ");
          const remainder = titles.length > 3 ? ` e mais ${titles.length - 3}` : "";
          toast.warning(
            `Não é possível excluir: capítulos em ${titles.length} livro(s) ativo(s).`,
            titles.length > 0 ? { description: `${titlesPreview}${remainder}` } : undefined,
          );
        }
      }

      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  }

  return { isDeleting, handleConfirm };
}
