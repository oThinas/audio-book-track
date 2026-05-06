"use client";

import { useCallback, useState } from "react";
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

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleEditCompleted = useCallback(
    (updated: Studio) => {
      onUpdated?.(updated);
      setIsEditing(false);
    },
    [onUpdated],
  );

  const handleRequestDelete = useCallback(() => {
    onRequestDelete?.(studio);
  }, [onRequestDelete, studio]);

  return {
    isEditing,
    handleStartEdit,
    handleCancelEdit,
    handleEditCompleted,
    handleRequestDelete,
    canDelete: onRequestDelete !== undefined,
  };
}
