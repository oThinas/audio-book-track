"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api/api-fetch";

export interface UseDeleteChapterArgs {
  readonly chapterId: string;
  readonly onDeleted: (chapterId: string, bookDeleted: boolean) => void;
  /**
   * Re-syncs the lifted `chaptersVersion` token from the DELETE response header
   * so the next chapter mutation does not raise a spurious version conflict —
   * without depending on the background refresh (which can hang under
   * loading.tsx). Absent when the book itself was deleted.
   */
  readonly onVersionChange?: (newVersion: number) => void;
}

export interface UseDeleteChapterReturn {
  readonly deleteOpen: boolean;
  readonly deleting: boolean;
  readonly openDelete: () => void;
  readonly cancelDelete: () => void;
  readonly handleDelete: () => Promise<void>;
}

export function useDeleteChapter({
  chapterId,
  onDeleted,
  onVersionChange,
}: UseDeleteChapterArgs): UseDeleteChapterReturn {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const result = await apiFetch<null>(`/api/v1/chapters/${chapterId}`, { method: "DELETE" });
      if (!result.ok) return;
      const bookDeleted = result.headers.get("X-Book-Deleted") === "true";
      setDeleteOpen(false);
      onDeleted(chapterId, bookDeleted);
      const version = result.headers.get("X-Chapters-Version");
      if (version !== null) onVersionChange?.(Number(version));
    } finally {
      setDeleting(false);
    }
  }

  return {
    deleteOpen,
    deleting,
    handleDelete,
    openDelete: () => setDeleteOpen(true),
    cancelDelete: () => setDeleteOpen(false),
  };
}
