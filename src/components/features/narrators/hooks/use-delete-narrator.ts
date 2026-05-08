"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/api-fetch";
import type { Narrator } from "@/lib/domain/narrator";

export interface UseDeleteNarratorArgs {
  readonly narrator: Narrator | null;
  readonly onConfirmed: (id: string) => void;
  readonly onOpenChange: (open: boolean) => void;
}

export interface UseDeleteNarratorReturn {
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

export function useDeleteNarrator({
  narrator,
  onConfirmed,
  onOpenChange,
}: UseDeleteNarratorArgs): UseDeleteNarratorReturn {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirm() {
    if (!narrator) return;

    setIsDeleting(true);
    try {
      const result = await apiFetch<null>(`/api/v1/narrators/${narrator.id}`, {
        method: "DELETE",
        suppressToastFor: ["NARRATOR_LINKED_TO_ACTIVE_CHAPTERS"],
      });

      if (result.ok) {
        onConfirmed(narrator.id);
        onOpenChange(false);
        return;
      }

      if (result.kind === "api-error") {
        if (result.code === "NARRATOR_NOT_FOUND") {
          onConfirmed(narrator.id);
        } else if (
          result.code === "NARRATOR_LINKED_TO_ACTIVE_CHAPTERS" &&
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
