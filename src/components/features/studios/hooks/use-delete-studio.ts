"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ApiErrorBody } from "@/lib/api/error-response";
import type { Studio } from "@/lib/domain/studio";

export interface UseDeleteStudioArgs {
  readonly studio: Studio | null;
  readonly onConfirmed: (id: string) => void;
  readonly onOpenChange: (open: boolean) => void;
}

export interface UseDeleteStudioReturn {
  readonly isDeleting: boolean;
  readonly error: string | null;
  readonly handleConfirm: () => Promise<void>;
  readonly handleCancel: () => void;
}

export function useDeleteStudio({
  studio,
  onConfirmed,
  onOpenChange,
}: UseDeleteStudioArgs): UseDeleteStudioReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Reset error during render when the targeted studio changes — React-recommended
  // pattern over useEffect for resetting state derived from props
  // (https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes).
  const studioId = studio?.id ?? null;
  const [trackedStudioId, setTrackedStudioId] = useState<string | null>(studioId);
  if (studioId !== trackedStudioId) {
    setTrackedStudioId(studioId);
    setError(null);
  }

  async function handleConfirm() {
    if (!studio) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/studios/${studio.id}`, {
        method: "DELETE",
      });

      if (response.status === 204 || response.status === 404) {
        onConfirmed(studio.id);
        onOpenChange(false);
        return;
      }

      if (response.status === 409) {
        const body = (await response.json()) as ApiErrorBody & {
          error: { details?: { books?: ReadonlyArray<{ id: string; title: string }> } };
        };
        if (body.error.code === "STUDIO_HAS_ACTIVE_BOOKS") {
          const titles = body.error.details?.books?.map((b) => b.title) ?? [];
          const titlesPreview = titles.slice(0, 3).join(", ");
          const remainder = titles.length > 3 ? ` e mais ${titles.length - 3}` : "";
          toast.error(
            `Não é possível excluir: ${titles.length} livro(s) com capítulos ativos.`,
            titles.length > 0 ? { description: `${titlesPreview}${remainder}` } : undefined,
          );
          onOpenChange(false);
          return;
        }
      }

      toast.error("Não foi possível excluir o estúdio. Tente novamente.");
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCancel() {
    onOpenChange(false);
  }

  return {
    isDeleting,
    error,
    handleConfirm,
    handleCancel,
  };
}
