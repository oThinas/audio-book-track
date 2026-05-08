"use client";

import { useState } from "react";
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
      });

      if (result.ok) {
        onConfirmed(studio.id);
        onOpenChange(false);
        return;
      }

      if (result.kind === "api-error" && result.code === "STUDIO_NOT_FOUND") {
        onConfirmed(studio.id);
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
