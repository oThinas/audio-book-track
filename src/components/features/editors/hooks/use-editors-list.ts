"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { Editor } from "@/lib/domain/editor";
import type { EditorListItem } from "@/lib/repositories/editor-repository";

const NEW_ROW_NAME_INPUT_ID = "editor-new-name";

export interface UseEditorsListReturn {
  readonly editors: readonly EditorListItem[];
  readonly sortedEditors: readonly EditorListItem[];
  readonly isCreating: boolean;
  readonly editorToDelete: Editor | null;
  readonly isDeleteDialogOpen: boolean;
  readonly handleNewClick: () => void;
  readonly handleCreated: (editor: Editor) => void;
  readonly handleCancelled: () => void;
  readonly handleUpdated: (editor: Editor) => void;
  readonly handleRequestDelete: (editor: Editor) => void;
  readonly handleDeleteDialogChange: (open: boolean) => void;
  readonly handleDeleted: (id: string) => void;
}

export function useEditorsList(initial: readonly EditorListItem[]): UseEditorsListReturn {
  const router = useRouter();
  const [editors, setEditors] = useState<readonly EditorListItem[]>(initial);
  const [isCreating, setIsCreating] = useState(false);
  const [editorToDelete, setEditorToDelete] = useState<Editor | null>(null);

  const sortedEditors = useMemo(
    () =>
      [...editors].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [editors],
  );

  const handleNewClick = useCallback(() => {
    setIsCreating((current) => {
      if (current) {
        document.getElementById(NEW_ROW_NAME_INPUT_ID)?.focus();
        return current;
      }
      return true;
    });
  }, []);

  const handleCreated = useCallback(
    (editor: Editor) => {
      setEditors((current) => [...current, { ...editor, chaptersCount: 0 }]);
      setIsCreating(false);
      router.refresh();
    },
    [router],
  );

  const handleCancelled = useCallback(() => {
    setIsCreating(false);
  }, []);

  const handleUpdated = useCallback(
    (updated: Editor) => {
      setEditors((current) =>
        current.map((e) =>
          e.id === updated.id ? { ...updated, chaptersCount: e.chaptersCount } : e,
        ),
      );
      router.refresh();
    },
    [router],
  );

  const handleRequestDelete = useCallback((editor: Editor) => {
    setEditorToDelete(editor);
  }, []);

  const handleDeleteDialogChange = useCallback((open: boolean) => {
    if (!open) {
      setEditorToDelete(null);
    }
  }, []);

  const handleDeleted = useCallback(
    (id: string) => {
      setEditors((current) => current.filter((e) => e.id !== id));
      router.refresh();
    },
    [router],
  );

  return {
    editors,
    sortedEditors,
    isCreating,
    editorToDelete,
    isDeleteDialogOpen: editorToDelete !== null,
    handleNewClick,
    handleCreated,
    handleCancelled,
    handleUpdated,
    handleRequestDelete,
    handleDeleteDialogChange,
    handleDeleted,
  };
}
