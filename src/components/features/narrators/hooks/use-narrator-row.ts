"use client";

import { useState } from "react";
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

  function handleStartEdit() {
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
  }

  function handleEditCompleted(updated: Narrator) {
    onUpdated?.(updated);
    setIsEditing(false);
  }

  function handleRequestDelete() {
    onRequestDelete?.(narrator);
  }

  return {
    isEditing,
    handleStartEdit,
    handleCancelEdit,
    handleEditCompleted,
    handleRequestDelete,
    canDelete: onRequestDelete !== undefined,
  };
}
