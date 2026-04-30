"use client";

import { Plus } from "lucide-react";

import { PageDescription, PageHeader, PageTitle } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import type { EditorListItem } from "@/lib/repositories/editor-repository";

import { DeleteEditorDialog } from "./delete-editor-dialog";
import { EditorNewRow } from "./editor-new-row";
import { EditorsTable } from "./editors-table";
import { useEditorsList } from "./hooks/use-editors-list";

interface EditorsClientProps {
  readonly initialEditors: readonly EditorListItem[];
}

export function EditorsClient({ initialEditors }: EditorsClientProps) {
  const {
    sortedEditors,
    isCreating,
    editorToDelete,
    isDeleteDialogOpen,
    handleNewClick,
    handleCreated,
    handleCancelled,
    handleUpdated,
    handleRequestDelete,
    handleDeleteDialogChange,
    handleDeleted,
  } = useEditorsList(initialEditors);

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
        open={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        onConfirmed={handleDeleted}
      />
    </div>
  );
}
