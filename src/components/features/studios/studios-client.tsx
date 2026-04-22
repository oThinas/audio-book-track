"use client";

import { useMemo, useState } from "react";

import { PageDescription, PageHeader, PageTitle } from "@/components/layout/page-container";
import type { Studio } from "@/lib/domain/studio";

import { StudiosTable } from "./studios-table";

interface StudiosClientProps {
  readonly initialStudios: readonly Studio[];
}

export function StudiosClient({ initialStudios }: StudiosClientProps) {
  const [studios] = useState<readonly Studio[]>(initialStudios);

  const sortedStudios = useMemo(
    () =>
      [...studios].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [studios],
  );

  return (
    <div className="flex flex-col">
      <PageHeader>
        <PageTitle>Estúdios</PageTitle>
        <PageDescription>Gerencie os estúdios parceiros.</PageDescription>
      </PageHeader>
      <StudiosTable studios={sortedStudios} />
    </div>
  );
}
