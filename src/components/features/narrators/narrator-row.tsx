"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { ROW_ENTER_CLASS, ROW_EXIT_CLASS, type RowState } from "@/hooks/row-animation";
import { useScrollIntoViewOnEnter } from "@/hooks/use-scroll-into-view-on-enter";
import type { Narrator } from "@/lib/domain/narrator";
import type { NarratorListItem } from "@/lib/repositories/narrator-repository";
import { cn } from "@/lib/utils";

import { useNarratorRow } from "./hooks/use-narrator-row";
import { NarratorRowEditMode } from "./narrator-row-edit-mode";

interface NarratorRowProps {
  readonly narrator: NarratorListItem;
  readonly rowState?: RowState;
  readonly onRowAnimationEnd?: () => void;
  readonly onUpdated?: (narrator: Narrator) => void;
  readonly onRequestDelete?: (narrator: Narrator) => void;
}

export function NarratorRow({
  narrator,
  rowState = "idle",
  onRowAnimationEnd,
  onUpdated,
  onRequestDelete,
}: NarratorRowProps) {
  const {
    isEditing,
    handleStartEdit,
    handleCancelEdit,
    handleEditCompleted,
    handleRequestDelete,
    canDelete,
  } = useNarratorRow({ narrator, onUpdated, onRequestDelete });
  const setRowRef = useScrollIntoViewOnEnter(rowState === "entering");

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
    <TableRow
      ref={setRowRef}
      data-testid="narrator-row"
      data-row-state={rowState}
      className={cn(
        rowState === "entering" && ROW_ENTER_CLASS,
        rowState === "exiting" && ROW_EXIT_CLASS,
      )}
      onAnimationEnd={(event) => {
        // Only the row's own enter/exit animation should clear its state, not a
        // bubbled animation from a descendant.
        if (event.target === event.currentTarget) onRowAnimationEnd?.();
      }}
    >
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
