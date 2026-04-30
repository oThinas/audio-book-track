"use client";

import { Plus } from "lucide-react";

import { PageDescription, PageHeader, PageTitle } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import type { StudioListItem } from "@/lib/repositories/studio-repository";

import { DeleteStudioDialog } from "./delete-studio-dialog";
import { useStudiosList } from "./hooks/use-studios-list";
import { StudioNewRow } from "./studio-new-row";
import { StudiosTable } from "./studios-table";

interface StudiosClientProps {
  readonly initialStudios: readonly StudioListItem[];
}

export function StudiosClient({ initialStudios }: StudiosClientProps) {
  const {
    sortedStudios,
    isCreating,
    studioToDelete,
    isDeleteDialogOpen,
    handleNewClick,
    handleCreated,
    handleCancelled,
    handleUpdated,
    handleRequestDelete,
    handleDeleteDialogChange,
    handleDeleted,
  } = useStudiosList(initialStudios);

  return (
    <div className="flex flex-col">
      <PageHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <PageTitle>Estúdios</PageTitle>
          <PageDescription>Gerencie os estúdios parceiros.</PageDescription>
        </div>
        <Button type="button" aria-label="Novo estúdio" className="p-5" onClick={handleNewClick}>
          <Plus aria-hidden="true" />
          Novo Estúdio
        </Button>
      </PageHeader>
      <StudiosTable
        studios={sortedStudios}
        topRow={
          isCreating ? (
            <StudioNewRow onCreated={handleCreated} onCancelled={handleCancelled} />
          ) : null
        }
        onStudioUpdated={handleUpdated}
        onRequestDelete={handleRequestDelete}
      />
      <DeleteStudioDialog
        studio={studioToDelete}
        open={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        onConfirmed={handleDeleted}
      />
    </div>
  );
}
