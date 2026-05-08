"use client";

import { useState } from "react";
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
      });

      if (result.ok) {
        onConfirmed(narrator.id);
        onOpenChange(false);
        return;
      }

      if (result.kind === "api-error" && result.code === "NARRATOR_NOT_FOUND") {
        onConfirmed(narrator.id);
      }

      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  }

  return { isDeleting, handleConfirm };
}
