"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PageDescription, PageHeader, PageTitle } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import type { Editor } from "@/lib/domain/editor";
import type { EditorListItem } from "@/lib/repositories/editor-repository";

import { DeleteEditorDialog } from "./delete-editor-dialog";
import { EditorNewRow } from "./editor-new-row";
import { EditorsTable } from "./editors-table";

interface EditorsClientProps {
  readonly initialEditors: readonly EditorListItem[];
}

const NEW_ROW_NAME_INPUT_ID = "editor-new-name";

export function EditorsClient({ initialEditors }: EditorsClientProps) {
  const router = useRouter();
  const [editors, setEditors] = useState<readonly EditorListItem[]>(initialEditors);
  const [isCreating, setIsCreating] = useState(false);
  const [editorToDelete, setEditorToDelete] = useState<Editor | null>(null);

  const sortedEditors = useMemo(
    () =>
      [...editors].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [editors],
  );

  function handleNewClick() {
    if (isCreating) {
      document.getElementById(NEW_ROW_NAME_INPUT_ID)?.focus();
      return;
    }
    setIsCreating(true);
  }

  function handleCreated(editor: Editor) {
    setEditors((current) => [...current, { ...editor, chaptersCount: 0 }]);
    setIsCreating(false);
    router.refresh();
  }

  function handleCancelled() {
    setIsCreating(false);
  }

  function handleUpdated(updated: Editor) {
    setEditors((current) =>
      current.map((e) =>
        e.id === updated.id ? { ...updated, chaptersCount: e.chaptersCount } : e,
      ),
    );
    router.refresh();
  }

  function handleRequestDelete(editor: Editor) {
    setEditorToDelete(editor);
  }

  function handleDeleteDialogChange(open: boolean) {
    if (!open) {
      setEditorToDelete(null);
    }
  }

  function handleDeleted(id: string) {
    setEditors((current) => current.filter((e) => e.id !== id));
    router.refresh();
  }

  return (
    <div className="flex flex-col">
      <PageHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <PageTitle>Editores</PageTitle>
          <PageDescription>Gerencie os editores disponíveis para revisão.</PageDescription>
        </div>
        <Button type="button" aria-label="Novo editor" className="p-5" onClick={handleNewClick}>
          <Plus aria-hidden="true" />
          Novo Editor
        </Button>
      </PageHeader>
      <EditorsTable
        editors={sortedEditors}
        topRow={
          isCreating ? (
            <EditorNewRow onCreated={handleCreated} onCancelled={handleCancelled} />
          ) : null
        }
        onEditorUpdated={handleUpdated}
        onRequestDelete={handleRequestDelete}
      />
      <DeleteEditorDialog
        editor={editorToDelete}
        open={editorToDelete !== null}
        onOpenChange={handleDeleteDialogChange}
        onConfirmed={handleDeleted}
      />
    </div>
  );
}
