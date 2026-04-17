"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Narrator } from "@/lib/domain/narrator";

import { NarratorsTable } from "./narrators-table";

interface NarratorsClientProps {
  readonly initialNarrators: readonly Narrator[];
}

export function NarratorsClient({ initialNarrators }: NarratorsClientProps) {
  const [narrators] = useState<readonly Narrator[]>(initialNarrators);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Button type="button" disabled aria-label="Novo narrador">
          <Plus aria-hidden="true" />
          Novo Narrador
        </Button>
      </div>
      <NarratorsTable narrators={narrators} />
    </div>
  );
}
