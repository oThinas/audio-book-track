"use client";

import { useState } from "react";
import type { Studio } from "@/lib/domain/studio";
import type { StudioListItem } from "@/lib/repositories/studio-repository";

export interface UseStudioRowArgs {
  readonly studio: StudioListItem;
  readonly onUpdated?: (studio: Studio) => void;
  readonly onRequestDelete?: (studio: Studio) => void;
}

export interface UseStudioRowReturn {
  readonly isEditing: boolean;
  readonly handleStartEdit: () => void;
  readonly handleCancelEdit: () => void;
  readonly handleEditCompleted: (updated: Studio) => void;
  readonly handleRequestDelete: () => void;
  readonly canDelete: boolean;
}

export function useStudioRow({
  studio,
  onUpdated,
  onRequestDelete,
}: UseStudioRowArgs): UseStudioRowReturn {
  const [isEditing, setIsEditing] = useState(false);

  function handleStartEdit() {
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
  }

  function handleEditCompleted(updated: Studio) {
    onUpdated?.(updated);
    setIsEditing(false);
  }

  function handleRequestDelete() {
    onRequestDelete?.(studio);
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
