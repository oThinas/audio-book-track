"use client";

import { useMemo, useState } from "react";

import { PageDescription, PageHeader, PageTitle } from "@/components/layout/page-container";
import type { Editor } from "@/lib/domain/editor";

import { EditorsTable } from "./editors-table";

interface EditorsClientProps {
  readonly initialEditors: readonly Editor[];
}

export function EditorsClient({ initialEditors }: EditorsClientProps) {
  const [editors] = useState<readonly Editor[]>(initialEditors);

  const sortedEditors = useMemo(
    () =>
      [...editors].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [editors],
  );

  return (
    <div className="flex flex-col">
      <PageHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <PageTitle>Editores</PageTitle>
          <PageDescription>Gerencie os editores disponíveis para revisão.</PageDescription>
        </div>
      </PageHeader>
      <EditorsTable editors={sortedEditors} />
    </div>
  );
}
