"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { PageDescription, PageHeader, PageTitle } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import type { Narrator } from "@/lib/domain/narrator";

import { NarratorsTable } from "./narrators-table";

interface NarratorsClientProps {
  readonly initialNarrators: readonly Narrator[];
}

export function NarratorsClient({ initialNarrators }: NarratorsClientProps) {
  const [narrators] = useState<readonly Narrator[]>(initialNarrators);

  return (
    <div className="flex flex-col">
      <PageHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <PageTitle>Narradores</PageTitle>
          <PageDescription>Gerencie os narradores disponíveis para gravações.</PageDescription>
        </div>
        <Button type="button" disabled aria-label="Novo narrador" className="p-5">
          <Plus aria-hidden="true" />
          Novo Narrador
        </Button>
      </PageHeader>
      <NarratorsTable narrators={narrators} />
    </div>
  );
}
