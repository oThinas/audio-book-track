"use client";

import { Plus } from "lucide-react";

import { PageDescription, PageHeader, PageTitle } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import type { NarratorListItem } from "@/lib/repositories/narrator-repository";

import { DeleteNarratorDialog } from "./delete-narrator-dialog";
import { useNarratorsList } from "./hooks/use-narrators-list";
import { NarratorNewRow } from "./narrator-new-row";
import { NarratorsTable } from "./narrators-table";

interface NarratorsClientProps {
  readonly initialNarrators: readonly NarratorListItem[];
}

export function NarratorsClient({ initialNarrators }: NarratorsClientProps) {
  const {
    sortedNarrators,
    isCreating,
    narratorToDelete,
    isDeleteDialogOpen,
    handleNewClick,
    handleCreated,
    handleCancelled,
    handleUpdated,
    handleRequestDelete,
    handleDeleteDialogChange,
    handleDeleted,
  } = useNarratorsList(initialNarrators);

  return (
    <div className="flex flex-col">
      <PageHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <PageTitle>Narradores</PageTitle>
          <PageDescription>Gerencie os narradores disponíveis para gravações.</PageDescription>
        </div>
        <Button type="button" aria-label="Novo narrador" className="p-5" onClick={handleNewClick}>
          <Plus aria-hidden="true" />
          Novo Narrador
        </Button>
      </PageHeader>
      <NarratorsTable
        narrators={sortedNarrators}
        topRow={
          isCreating ? (
            <NarratorNewRow onCreated={handleCreated} onCancelled={handleCancelled} />
          ) : null
        }
        onNarratorUpdated={handleUpdated}
        onRequestDelete={handleRequestDelete}
      />
      <DeleteNarratorDialog
        narrator={narratorToDelete}
        open={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        onConfirmed={handleDeleted}
      />
    </div>
  );
}
