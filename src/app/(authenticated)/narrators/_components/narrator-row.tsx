"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { Narrator } from "@/lib/domain/narrator";

interface NarratorRowProps {
  readonly narrator: Narrator;
}

export function NarratorRow({ narrator }: NarratorRowProps) {
  return (
    <TableRow data-testid="narrator-row">
      <TableCell data-testid="narrator-name" className="font-medium text-foreground">
        {narrator.name}
      </TableCell>
      <TableCell data-testid="narrator-email" className="text-muted-foreground">
        {narrator.email}
      </TableCell>
      <TableCell className="w-24">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${narrator.name}`}
            disabled
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Excluir ${narrator.name}`}
            disabled
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
