"use client";

import { useCallback, useState } from "react";
import type { Editor } from "@/lib/domain/editor";
import type { EditorListItem } from "@/lib/repositories/editor-repository";

export interface UseEditorRowArgs {
  readonly editor: EditorListItem;
  readonly onUpdated?: (editor: Editor) => void;
  readonly onRequestDelete?: (editor: Editor) => void;
}

export interface UseEditorRowReturn {
  readonly isEditing: boolean;
  readonly handleStartEdit: () => void;
  readonly handleCancelEdit: () => void;
  readonly handleEditCompleted: (updated: Editor) => void;
  readonly handleRequestDelete: () => void;
  readonly canDelete: boolean;
}

export function useEditorRow({
  editor,
  onUpdated,
  onRequestDelete,
}: UseEditorRowArgs): UseEditorRowReturn {
  const [isEditing, setIsEditing] = useState(false);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleEditCompleted = useCallback(
    (updated: Editor) => {
      onUpdated?.(updated);
      setIsEditing(false);
    },
    [onUpdated],
  );

  const handleRequestDelete = useCallback(() => {
    onRequestDelete?.(editor);
  }, [onRequestDelete, editor]);

  return {
    isEditing,
    handleStartEdit,
    handleCancelEdit,
    handleEditCompleted,
    handleRequestDelete,
    canDelete: onRequestDelete !== undefined,
  };
}
