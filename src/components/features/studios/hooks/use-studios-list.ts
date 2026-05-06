"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Studio } from "@/lib/domain/studio";
import type { StudioListItem } from "@/lib/repositories/studio-repository";

const NEW_ROW_NAME_INPUT_ID = "studio-new-name";

export interface UseStudiosListReturn {
  readonly studios: readonly StudioListItem[];
  readonly sortedStudios: readonly StudioListItem[];
  readonly isCreating: boolean;
  readonly studioToDelete: Studio | null;
  readonly isDeleteDialogOpen: boolean;
  readonly handleNewClick: () => void;
  readonly handleCreated: (studio: Studio) => void;
  readonly handleCancelled: () => void;
  readonly handleUpdated: (studio: Studio) => void;
  readonly handleRequestDelete: (studio: Studio) => void;
  readonly handleDeleteDialogChange: (open: boolean) => void;
  readonly handleDeleted: (id: string) => void;
}

export function useStudiosList(initial: readonly StudioListItem[]): UseStudiosListReturn {
  const router = useRouter();
  const [studios, setStudios] = useState<readonly StudioListItem[]>(initial);
  const [isCreating, setIsCreating] = useState(false);
  const [studioToDelete, setStudioToDelete] = useState<Studio | null>(null);

  const sortedStudios = useMemo(
    () =>
      [...studios].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [studios],
  );

  function handleNewClick() {
    if (isCreating) {
      document.getElementById(NEW_ROW_NAME_INPUT_ID)?.focus();
      return;
    }
    setIsCreating(true);
  }

  function handleCreated(studio: Studio) {
    setStudios((current) => [...current, { ...studio, booksCount: 0 }]);
    setIsCreating(false);
    router.refresh();
  }

  function handleCancelled() {
    setIsCreating(false);
  }

  function handleUpdated(updated: Studio) {
    setStudios((current) =>
      current.map((s) => (s.id === updated.id ? { ...updated, booksCount: s.booksCount } : s)),
    );
    router.refresh();
  }

  function handleRequestDelete(studio: Studio) {
    setStudioToDelete(studio);
  }

  function handleDeleteDialogChange(open: boolean) {
    if (!open) {
      setStudioToDelete(null);
    }
  }

  function handleDeleted(id: string) {
    setStudios((current) => current.filter((s) => s.id !== id));
    router.refresh();
  }

  return {
    studios,
    sortedStudios,
    isCreating,
    studioToDelete,
    isDeleteDialogOpen: studioToDelete !== null,
    handleNewClick,
    handleCreated,
    handleCancelled,
    handleUpdated,
    handleRequestDelete,
    handleDeleteDialogChange,
    handleDeleted,
  };
}
