"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

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

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/v1/chapters/${chapterId}`, { method: "DELETE" });
      if (response.status !== 204) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(body?.error?.message ?? "Erro ao excluir capítulo.");
        return;
      }
      const bookDeleted = response.headers.get("X-Book-Deleted") === "true";
      setDeleteOpen(false);
      onDeleted(chapterId, bookDeleted);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro de rede ao excluir capítulo.");
    } finally {
      setDeleting(false);
    }
  }, [chapterId, onDeleted]);

  const openDelete = useCallback(() => setDeleteOpen(true), []);
  const cancelDelete = useCallback(() => setDeleteOpen(false), []);

  return {
    deleteOpen,
    deleting,
    handleDelete,
    openDelete,
    cancelDelete,
  };
}
