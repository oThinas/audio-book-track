"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Loader2, Pencil, Trash2 } from "lucide-react";

import { StatusBadge } from "@/components/features/books/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ChapterStatus } from "@/lib/domain/chapter";
import type { FocusWeekContext } from "@/lib/domain/chapter-deadline";
import { formatSecondsAsHHMMSS } from "@/lib/utils";

import { ChapterDeadlineCell } from "./chapter-deadline-cell";
import { ChapterDeleteDialog } from "./chapter-delete-dialog";
import { ChapterRowEditMode } from "./chapter-row-edit-mode";
import { useChapterRow } from "./hooks/use-chapter-row";
import { useDeleteChapter } from "./hooks/use-delete-chapter";

export interface ChapterRowEntity {
  readonly id: string;
  readonly title: string;
  readonly position: number;
  readonly status: ChapterStatus;
  readonly narrator: { readonly id: string; readonly name: string } | null;
  readonly editor: { readonly id: string; readonly name: string } | null;
  readonly editedSeconds: number;
  readonly deadline: string | null;
}

export interface ChapterRowOption {
  readonly id: string;
  readonly name: string;
}

interface ChapterRowProps {
  readonly chapter: ChapterRowEntity;
  readonly narrators: ReadonlyArray<ChapterRowOption>;
  readonly editors: ReadonlyArray<ChapterRowOption>;
  readonly narratorNameById: ReadonlyMap<string, string>;
  readonly editorNameById: ReadonlyMap<string, string>;
  readonly isLastNonPaid: boolean;
  readonly isSelectionMode: boolean;
  readonly isSelected: boolean;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly canReorder: boolean;
  readonly focusContext: FocusWeekContext;
  readonly onSaved: (updated: ChapterRowEntity, bookStatus: ChapterStatus) => void;
  readonly onDeleted: (chapterId: string, bookDeleted: boolean) => void;
  readonly onToggleSelected: (chapterId: string, selected: boolean) => void;
  readonly onMoveBy: (chapterId: string, delta: number) => void;
}

export function ChapterRow({
  chapter,
  narrators,
  editors,
  narratorNameById,
  editorNameById,
  isLastNonPaid,
  isSelectionMode,
  isSelected,
  isFirst,
  isLast,
  canReorder,
  focusContext,
  onSaved,
  onDeleted,
  onToggleSelected,
  onMoveBy,
}: ChapterRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter.id,
  });
  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  } as React.CSSProperties;
  const { mode, enterEditMode, exitEditMode } = useChapterRow({ isSelectionMode });
  const { deleteOpen, deleting, openDelete, cancelDelete, handleDelete } = useDeleteChapter({
    chapterId: chapter.id,
    onDeleted,
  });

  if (mode === "edit") {
    return (
      <ChapterRowEditMode
        chapter={chapter}
        narrators={narrators}
        editors={editors}
        narratorNameById={narratorNameById}
        editorNameById={editorNameById}
        canReorder={canReorder}
        onCancel={exitEditMode}
        onSaved={(updated, bookStatus) => {
          exitEditMode();
          onSaved(updated, bookStatus);
        }}
      />
    );
  }

  const isPaid = chapter.status === "paid";

  return (
    <>
      <TableRow
        ref={setNodeRef}
        style={dragStyle}
        data-testid={`chapter-row-${chapter.id}`}
        data-mode="view"
      >
        {isSelectionMode && (
          <TableCell>
            <Checkbox
              checked={isSelected}
              disabled={isPaid}
              onCheckedChange={(value) => onToggleSelected(chapter.id, value === true)}
              aria-label={`Selecionar ${chapter.title}`}
              data-testid={`chapter-select-${chapter.id}`}
            />
          </TableCell>
        )}
        {!isSelectionMode && canReorder && (
          <TableCell className="w-8 p-0">
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label={`Reordenar ${chapter.title}`}
              data-testid={`chapter-drag-${chapter.id}`}
              className="flex h-9 w-8 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            >
              <GripVertical aria-hidden="true" className="size-4" />
            </button>
          </TableCell>
        )}
        <TableCell className="max-w-[56ch] truncate font-medium" title={chapter.title}>
          {chapter.title}
        </TableCell>
        <TableCell>
          <StatusBadge status={chapter.status} />
        </TableCell>
        <TableCell className="truncate text-muted-foreground">
          {chapter.narrator ? chapter.narrator.name : "—"}
        </TableCell>
        <TableCell className="truncate text-muted-foreground">
          {chapter.editor ? chapter.editor.name : "—"}
        </TableCell>
        <TableCell>
          <ChapterDeadlineCell
            deadline={chapter.deadline}
            status={chapter.status}
            focusContext={focusContext}
          />
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatSecondsAsHHMMSS(chapter.editedSeconds)}
        </TableCell>
        {!isSelectionMode && (
          <TableCell className="text-right">
            <div className="inline-flex items-center gap-1">
              {canReorder && (
                <span className="inline-flex items-center gap-1 md:hidden">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Mover ${chapter.title} para cima`}
                    data-testid={`chapter-move-up-${chapter.id}`}
                    onClick={() => onMoveBy(chapter.id, -1)}
                    disabled={isFirst}
                  >
                    <ArrowUp aria-hidden="true" className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Mover ${chapter.title} para baixo`}
                    data-testid={`chapter-move-down-${chapter.id}`}
                    onClick={() => onMoveBy(chapter.id, 1)}
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
                aria-label={`Editar ${chapter.title}`}
                data-testid={`chapter-edit-${chapter.id}`}
                onClick={enterEditMode}
              >
                <Pencil aria-hidden="true" className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Excluir ${chapter.title}`}
                data-testid={`chapter-delete-${chapter.id}`}
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
          </TableCell>
        )}
      </TableRow>
      <ChapterDeleteDialog
        open={deleteOpen}
        chapterTitle={chapter.title}
        isLastNonPaid={isLastNonPaid}
        onCancel={cancelDelete}
        onConfirm={handleDelete}
      />
    </>
  );
}
