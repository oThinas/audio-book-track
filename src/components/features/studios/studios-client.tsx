"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PageDescription, PageHeader, PageTitle } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import type { Studio } from "@/lib/domain/studio";
import type { StudioListItem } from "@/lib/repositories/studio-repository";

import { DeleteStudioDialog } from "./delete-studio-dialog";
import { StudioNewRow } from "./studio-new-row";
import { StudiosTable } from "./studios-table";

interface StudiosClientProps {
  readonly initialStudios: readonly StudioListItem[];
}

const NEW_ROW_NAME_INPUT_ID = "studio-new-name";

export function StudiosClient({ initialStudios }: StudiosClientProps) {
  const router = useRouter();
  const [studios, setStudios] = useState<readonly StudioListItem[]>(initialStudios);
  const [isCreating, setIsCreating] = useState(false);
  const [studioToDelete, setStudioToDelete] = useState<Studio | null>(null);

  const sortedStudios = useMemo(
    () =>
      [...studios].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [studios],
  );

  function handleNewClick() {
    if (isCreating) {
      document.getElementById(NEW_ROW_NAME_INPUT_ID)?.focus();
      return;
    }
    setIsCreating(true);
  }

  function handleCreated(studio: Studio) {
    // Studio recém-criado começa sem livros — booksCount é incrementado em revalidações.
    setStudios((current) => [...current, { ...studio, booksCount: 0 }]);
    setIsCreating(false);
    router.refresh();
  }

  function handleCancelled() {
    setIsCreating(false);
  }

  function handleUpdated(updated: Studio) {
    // Preserva o booksCount existente — update não altera a contagem.
    setStudios((current) =>
      current.map((s) => (s.id === updated.id ? { ...updated, booksCount: s.booksCount } : s)),
    );
    router.refresh();
  }

  function handleRequestDelete(studio: Studio) {
    setStudioToDelete(studio);
  }

  function handleDeleteDialogChange(open: boolean) {
    if (!open) {
      setStudioToDelete(null);
    }
  }

  function handleDeleted(id: string) {
    setStudios((current) => current.filter((s) => s.id !== id));
    router.refresh();
  }

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
        open={studioToDelete !== null}
        onOpenChange={handleDeleteDialogChange}
        onConfirmed={handleDeleted}
      />
    </div>
  );
}
