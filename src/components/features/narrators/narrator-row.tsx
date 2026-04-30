"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { Narrator } from "@/lib/domain/narrator";
import type { NarratorListItem } from "@/lib/repositories/narrator-repository";

import { useNarratorRow } from "./hooks/use-narrator-row";
import { NarratorRowEditMode } from "./narrator-row-edit-mode";

interface NarratorRowProps {
  readonly narrator: NarratorListItem;
  readonly onUpdated?: (narrator: Narrator) => void;
  readonly onRequestDelete?: (narrator: Narrator) => void;
}

export function NarratorRow({ narrator, onUpdated, onRequestDelete }: NarratorRowProps) {
  const {
    isEditing,
    handleStartEdit,
    handleCancelEdit,
    handleEditCompleted,
    handleRequestDelete,
    canDelete,
  } = useNarratorRow({ narrator, onUpdated, onRequestDelete });

  if (isEditing) {
    return (
      <NarratorRowEditMode
        narrator={narrator}
        onCancel={handleCancelEdit}
        onUpdated={handleEditCompleted}
      />
    );
  }

  return (
    <TableRow data-testid="narrator-row">
      <TableCell data-testid="narrator-name" className="text-foreground">
        {narrator.name}
      </TableCell>
      <TableCell data-testid="narrator-chapters-count" className="text-foreground">
        {narrator.chaptersCount}
      </TableCell>
      <TableCell className="w-24">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${narrator.name}`}
            onClick={handleStartEdit}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Excluir ${narrator.name}`}
            disabled={!canDelete}
            onClick={handleRequestDelete}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
