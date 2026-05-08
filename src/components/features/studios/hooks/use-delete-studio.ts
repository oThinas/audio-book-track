"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/api-fetch";
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

interface BlockingDetails {
  readonly books?: ReadonlyArray<{ readonly id: string; readonly title: string }>;
}

function isBlockingDetails(value: unknown): value is BlockingDetails {
  if (typeof value !== "object" || value === null) return false;
  const books = (value as { books?: unknown }).books;
  return books === undefined || Array.isArray(books);
}

export function useDeleteStudio({
  studio,
  onConfirmed,
  onOpenChange,
}: UseDeleteStudioArgs): UseDeleteStudioReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const result = await apiFetch<null>(`/api/v1/studios/${studio.id}`, {
        method: "DELETE",
        // Suppress wrapper's generic toast — hook fires a richer one with the
        // blocking books list in the description.
        suppressToastFor: ["STUDIO_HAS_ACTIVE_BOOKS"],
      });

      if (result.ok) {
        onConfirmed(studio.id);
        onOpenChange(false);
        return;
      }

      if (result.kind === "api-error") {
        if (result.code === "STUDIO_NOT_FOUND") {
          onConfirmed(studio.id);
        } else if (result.code === "STUDIO_HAS_ACTIVE_BOOKS" && isBlockingDetails(result.details)) {
          const titles = result.details.books?.map((b) => b.title) ?? [];
          const titlesPreview = titles.slice(0, 3).join(", ");
          const remainder = titles.length > 3 ? ` e mais ${titles.length - 3}` : "";
          toast.warning(
            `Não é possível excluir: ${titles.length} livro(s) com capítulos ativos.`,
            titles.length > 0 ? { description: `${titlesPreview}${remainder}` } : undefined,
          );
        }
      }

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
