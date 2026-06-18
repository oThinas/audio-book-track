"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { ROW_ENTER_CLASS, ROW_EXIT_CLASS, type RowState } from "@/hooks/row-animation";
import { useScrollIntoViewOnEnter } from "@/hooks/use-scroll-into-view-on-enter";
import type { Studio } from "@/lib/domain/studio";
import type { StudioListItem } from "@/lib/repositories/studio-repository";
import { cn, formatCentsBRL } from "@/lib/utils";

import { useStudioRow } from "./hooks/use-studio-row";
import { StudioRowEditMode } from "./studio-row-edit-mode";

interface StudioRowProps {
  readonly studio: StudioListItem;
  readonly rowState?: RowState;
  readonly onRowAnimationEnd?: () => void;
  readonly onUpdated?: (studio: Studio) => void;
  readonly onRequestDelete?: (studio: Studio) => void;
}

export function StudioRow({
  studio,
  rowState = "idle",
  onRowAnimationEnd,
  onUpdated,
  onRequestDelete,
}: StudioRowProps) {
  const {
    isEditing,
    handleStartEdit,
    handleCancelEdit,
    handleEditCompleted,
    handleRequestDelete,
    canDelete,
  } = useStudioRow({ studio, onUpdated, onRequestDelete });
  const setRowRef = useScrollIntoViewOnEnter(rowState === "entering");

  if (isEditing) {
    return (
      <StudioRowEditMode
        studio={studio}
        onCancel={handleCancelEdit}
        onUpdated={handleEditCompleted}
      />
    );
  }

  return (
    <TableRow
      ref={setRowRef}
      data-testid="studio-row"
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
      <TableCell data-testid="studio-name" className="text-foreground">
        {studio.name}
      </TableCell>
      <TableCell data-testid="studio-hourly-rate" className="text-foreground">
        {formatCentsBRL(studio.defaultHourlyRateCents)}
      </TableCell>
      <TableCell data-testid="studio-books-count" className="text-foreground">
        {studio.booksCount}
      </TableCell>
      <TableCell className="w-24">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${studio.name}`}
            onClick={handleStartEdit}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Excluir ${studio.name}`}
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
