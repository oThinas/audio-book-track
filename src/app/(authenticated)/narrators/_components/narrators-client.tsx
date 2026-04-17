"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PageDescription, PageHeader, PageTitle } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import type { Narrator } from "@/lib/domain/narrator";

import { NarratorNewRow } from "./narrator-new-row";
import { NarratorsTable } from "./narrators-table";

interface NarratorsClientProps {
  readonly initialNarrators: readonly Narrator[];
}

const NEW_ROW_NAME_INPUT_ID = "narrator-new-name";

export function NarratorsClient({ initialNarrators }: NarratorsClientProps) {
  const router = useRouter();
  const [narrators, setNarrators] = useState<readonly Narrator[]>(initialNarrators);
  const [isCreating, setIsCreating] = useState(false);

  const sortedNarrators = useMemo(
    () =>
      [...narrators].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [narrators],
  );

  function handleNewClick() {
    if (isCreating) {
      document.getElementById(NEW_ROW_NAME_INPUT_ID)?.focus();
      return;
    }
    setIsCreating(true);
  }

  function handleCreated(narrator: Narrator) {
    setNarrators((current) => [...current, narrator]);
    setIsCreating(false);
    router.refresh();
  }

  function handleCancelled() {
    setIsCreating(false);
  }

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
      />
    </div>
  );
}
