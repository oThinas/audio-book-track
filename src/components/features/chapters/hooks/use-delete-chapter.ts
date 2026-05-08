"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api/api-fetch";

export interface UseDeleteChapterArgs {
  readonly chapterId: string;
  readonly onDeleted: (chapterId: string, bookDeleted: boolean) => void;
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
