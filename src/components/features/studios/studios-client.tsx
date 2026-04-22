"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PageDescription, PageHeader, PageTitle } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import type { Studio } from "@/lib/domain/studio";

import { StudioNewRow } from "./studio-new-row";
import { StudiosTable } from "./studios-table";

interface StudiosClientProps {
  readonly initialStudios: readonly Studio[];
}

const NEW_ROW_NAME_INPUT_ID = "studio-new-name";

export function StudiosClient({ initialStudios }: StudiosClientProps) {
  const router = useRouter();
  const [studios, setStudios] = useState<readonly Studio[]>(initialStudios);
  const [isCreating, setIsCreating] = useState(false);

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
    setStudios((current) => [...current, studio]);
    setIsCreating(false);
    router.refresh();
  }

  function handleCancelled() {
    setIsCreating(false);
  }

  function handleUpdated(updated: Studio) {
    setStudios((current) => current.map((s) => (s.id === updated.id ? updated : s)));
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
      />
    </div>
  );
}
