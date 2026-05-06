"use client";

import { useCallback, useState } from "react";
import type { Narrator } from "@/lib/domain/narrator";
import type { NarratorListItem } from "@/lib/repositories/narrator-repository";

export interface UseNarratorRowArgs {
  readonly narrator: NarratorListItem;
  readonly onUpdated?: (narrator: Narrator) => void;
  readonly onRequestDelete?: (narrator: Narrator) => void;
}

export interface UseNarratorRowReturn {
  readonly isEditing: boolean;
  readonly handleStartEdit: () => void;
  readonly handleCancelEdit: () => void;
  readonly handleEditCompleted: (updated: Narrator) => void;
  readonly handleRequestDelete: () => void;
  readonly canDelete: boolean;
}

export function useNarratorRow({
  narrator,
  onUpdated,
  onRequestDelete,
}: UseNarratorRowArgs): UseNarratorRowReturn {
  const [isEditing, setIsEditing] = useState(false);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleEditCompleted = useCallback(
    (updated: Narrator) => {
      onUpdated?.(updated);
      setIsEditing(false);
    },
    [onUpdated],
  );

  const handleRequestDelete = useCallback(() => {
    onRequestDelete?.(narrator);
  }, [onRequestDelete, narrator]);

  return {
    isEditing,
    handleStartEdit,
    handleCancelEdit,
    handleEditCompleted,
    handleRequestDelete,
    canDelete: onRequestDelete !== undefined,
  };
}
