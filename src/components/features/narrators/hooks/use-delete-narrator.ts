"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Narrator } from "@/lib/domain/narrator";

interface NarratorLinkedDetails {
  readonly books?: ReadonlyArray<{ readonly id: string; readonly title: string }>;
}

interface NarratorErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: NarratorLinkedDetails;
  };
}

export interface UseDeleteNarratorArgs {
  readonly narrator: Narrator | null;
  readonly onConfirmed: (id: string) => void;
  readonly onOpenChange: (open: boolean) => void;
}

export interface UseDeleteNarratorReturn {
  readonly isDeleting: boolean;
  readonly handleConfirm: () => Promise<void>;
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
      const response = await fetch(`/api/v1/narrators/${narrator.id}`, {
        method: "DELETE",
      });

      if (response.status === 204 || response.status === 404) {
        onConfirmed(narrator.id);
        onOpenChange(false);
        return;
      }

      if (response.status === 409) {
        const body = (await response.json()) as NarratorErrorBody;
        if (body.error.code === "NARRATOR_LINKED_TO_ACTIVE_CHAPTERS") {
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

      toast.error("Não foi possível excluir o narrador. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  }

  return { isDeleting, handleConfirm };
}
