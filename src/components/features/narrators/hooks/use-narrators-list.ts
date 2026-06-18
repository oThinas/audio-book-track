"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { RowState } from "@/hooks/row-animation";
import { useRowPresence } from "@/hooks/use-row-presence";
import type { Narrator } from "@/lib/domain/narrator";
import type { NarratorListItem } from "@/lib/repositories/narrator-repository";

const NEW_ROW_NAME_INPUT_ID = "narrator-new-name";

const getNarratorId = (narrator: NarratorListItem): string => narrator.id;

export interface UseNarratorsListReturn {
  readonly narrators: readonly NarratorListItem[];
  readonly sortedNarrators: readonly NarratorListItem[];
  readonly renderItems: readonly NarratorListItem[];
  readonly rowState: (id: string) => RowState;
  readonly onRowAnimationEnd: (id: string) => void;
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

  const { renderItems, rowState, remove, onRowAnimationEnd } = useRowPresence({
    items: sortedNarrators,
    getId: getNarratorId,
  });

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
    // Retain the row through its exit animation, then drop it from the source on
    // animationend. The DELETE already succeeded upstream (dialog), so commit is
    // just the optimistic removal; failures never reach here.
    remove(id, () => {
      setNarrators((current) => current.filter((n) => n.id !== id));
    });
    router.refresh();
  }

  return {
    narrators,
    sortedNarrators,
    renderItems,
    rowState,
    onRowAnimationEnd,
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
