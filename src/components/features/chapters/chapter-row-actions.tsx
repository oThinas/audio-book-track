"use client";

import { ArrowDown, ArrowUp, Loader2, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";

import { ChapterDeleteDialog } from "./chapter-delete-dialog";
import { useDeleteChapter } from "./hooks/use-delete-chapter";

interface ChapterRowActionsProps {
  readonly chapterId: string;
  readonly chapterTitle: string;
  readonly isPaid: boolean;
  readonly isLastNonPaid: boolean;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly canReorder: boolean;
  readonly onEdit: () => void;
  readonly onMoveBy: (chapterId: string, delta: number) => void;
  readonly onDeleted: (chapterId: string, bookDeleted: boolean) => void;
  readonly onChaptersVersionChange?: (newVersion: number) => void;
}

/** Trailing actions cell of a chapter row: reorder (mobile), edit, delete. */
export function ChapterRowActions({
  chapterId,
  chapterTitle,
  isPaid,
  isLastNonPaid,
  isFirst,
  isLast,
  canReorder,
  onEdit,
  onMoveBy,
  onDeleted,
  onChaptersVersionChange,
}: ChapterRowActionsProps) {
  const { deleteOpen, deleting, openDelete, cancelDelete, handleDelete } = useDeleteChapter({
    chapterId,
    onDeleted,
    onVersionChange: onChaptersVersionChange,
  });

  return (
    <TableCell className="text-right">
      <div className="inline-flex items-center gap-1">
        {canReorder && (
          <span className="inline-flex items-center gap-1 md:hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Mover ${chapterTitle} para cima`}
              data-testid={`chapter-move-up-${chapterId}`}
              onClick={() => onMoveBy(chapterId, -1)}
              disabled={isFirst}
            >
              <ArrowUp aria-hidden="true" className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Mover ${chapterTitle} para baixo`}
              data-testid={`chapter-move-down-${chapterId}`}
              onClick={() => onMoveBy(chapterId, 1)}
              disabled={isLast}
            >
              <ArrowDown aria-hidden="true" className="size-4" />
            </Button>
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Editar ${chapterTitle}`}
          data-testid={`chapter-edit-${chapterId}`}
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Excluir ${chapterTitle}`}
          data-testid={`chapter-delete-${chapterId}`}
          onClick={openDelete}
          disabled={isPaid || deleting}
          className="text-destructive hover:text-destructive"
        >
          {deleting ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Trash2 aria-hidden="true" className="size-4" />
          )}
        </Button>
      </div>
      <ChapterDeleteDialog
        open={deleteOpen}
        chapterTitle={chapterTitle}
        isLastNonPaid={isLastNonPaid}
        onCancel={cancelDelete}
        onConfirm={handleDelete}
      />
    </TableCell>
  );
}
