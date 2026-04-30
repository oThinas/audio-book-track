"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Narrator } from "@/lib/domain/narrator";
import type { NarratorListItem } from "@/lib/repositories/narrator-repository";

const NEW_ROW_NAME_INPUT_ID = "narrator-new-name";

export interface UseNarratorsListReturn {
  readonly narrators: readonly NarratorListItem[];
  readonly sortedNarrators: readonly NarratorListItem[];
  readonly isCreating: boolean;
  readonly narratorToDelete: Narrator | null;
  readonly isDeleteDialogOpen: boolean;
  readonly handleNewClick: () => void;
  readonly handleCreated: (narrator: Narrator) => void;
  readonly handleCancelled: () => void;
  readonly handleUpdated: (narrator: Narrator) => void;
  readonly handleRequestDelete: (narrator: Narrator) => void;
  readonly handleDeleteDialogChange: (open: boolean) => void;
  readonly handleDeleted: (id: string) => void;
}

export function useNarratorsList(initial: readonly NarratorListItem[]): UseNarratorsListReturn {
  const router = useRouter();
  const [narrators, setNarrators] = useState<readonly NarratorListItem[]>(initial);
  const [isCreating, setIsCreating] = useState(false);
  const [narratorToDelete, setNarratorToDelete] = useState<Narrator | null>(null);

  const sortedNarrators = useMemo(
    () =>
      [...narrators].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [narrators],
  );

  function handleNewClick() {
    if (isCreating) {
      document.getElementById(NEW_ROW_NAME_INPUT_ID)?.focus();
      return;
    }
    setIsCreating(true);
  }

  function handleCreated(narrator: Narrator) {
    setNarrators((current) => [...current, { ...narrator, chaptersCount: 0 }]);
    setIsCreating(false);
    router.refresh();
  }

  function handleCancelled() {
    setIsCreating(false);
  }

  function handleUpdated(updated: Narrator) {
    setNarrators((current) =>
      current.map((n) =>
        n.id === updated.id ? { ...updated, chaptersCount: n.chaptersCount } : n,
      ),
    );
    router.refresh();
  }

  function handleRequestDelete(narrator: Narrator) {
    setNarratorToDelete(narrator);
  }

  function handleDeleteDialogChange(open: boolean) {
    if (!open) {
      setNarratorToDelete(null);
    }
  }

  function handleDeleted(id: string) {
    setNarrators((current) => current.filter((n) => n.id !== id));
    router.refresh();
  }

  return {
    narrators,
    sortedNarrators,
    isCreating,
    narratorToDelete,
    isDeleteDialogOpen: narratorToDelete !== null,
    handleNewClick,
    handleCreated,
    handleCancelled,
    handleUpdated,
    handleRequestDelete,
    handleDeleteDialogChange,
    handleDeleted,
  };
}
