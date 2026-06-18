"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useCallback } from "react";

import { StatusBadge } from "@/components/features/books/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { ROW_ENTER_CLASS, type RowState } from "@/hooks/row-animation";
import { useScrollIntoViewOnEnter } from "@/hooks/use-scroll-into-view-on-enter";
import type { ChapterStatus } from "@/lib/domain/chapter";
import type { FocusWeekContext } from "@/lib/domain/chapter-deadline";
import { cn, formatSecondsAsHHMMSS } from "@/lib/utils";

import { ChapterDeadlineCell } from "./chapter-deadline-cell";
import { ChapterRowActions } from "./chapter-row-actions";
import { ChapterRowEditMode } from "./chapter-row-edit-mode";
import type { ChapterRowEntity, ChapterRowOption } from "./chapter-row-types";
import { useChapterRow } from "./hooks/use-chapter-row";

export type { ChapterRowEntity, ChapterRowOption } from "./chapter-row-types";

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
  readonly rowState?: RowState;
  readonly onRowAnimationEnd?: () => void;
  readonly onSaved: (updated: ChapterRowEntity, bookStatus: ChapterStatus) => void;
  readonly onDeleted: (chapterId: string, bookDeleted: boolean) => void;
  readonly onChaptersVersionChange?: (newVersion: number) => void;
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
  rowState = "idle",
  onRowAnimationEnd,
  onSaved,
  onDeleted,
  onChaptersVersionChange,
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
  const { mode, activateField, enterEditMode, exitEditMode, getEditTriggerProps } = useChapterRow({
    isSelectionMode,
  });
  const setScrollRef = useScrollIntoViewOnEnter(rowState === "entering");
  const setRowRef = useCallback(
    (node: HTMLTableRowElement | null) => {
      setNodeRef(node);
      setScrollRef(node);
    },
    [setNodeRef, setScrollRef],
  );

  if (mode === "edit") {
    return (
      <ChapterRowEditMode
        chapter={chapter}
        narrators={narrators}
        editors={editors}
        narratorNameById={narratorNameById}
        editorNameById={editorNameById}
        canReorder={canReorder}
        activateField={activateField}
        onCancel={exitEditMode}
        onSaved={(updated, bookStatus) => {
          exitEditMode();
          onSaved(updated, bookStatus);
        }}
        onChaptersVersionChange={onChaptersVersionChange}
      />
    );
  }

  const isPaid = chapter.status === "paid";

  return (
    <TableRow
      ref={setRowRef}
      style={dragStyle}
      data-testid={`chapter-row-${chapter.id}`}
      data-mode="view"
      data-row-state={rowState}
      className={cn(rowState === "entering" && ROW_ENTER_CLASS)}
      onAnimationEnd={(event) => {
        // Only the row's own enter/exit animation should clear its state, not a
        // bubbled animation from a descendant.
        if (event.target === event.currentTarget) onRowAnimationEnd?.();
      }}
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
      <TableCell
        className="max-w-[56ch] truncate font-medium"
        title={chapter.title}
        data-testid={`chapter-cell-title-${chapter.id}`}
        {...getEditTriggerProps("title")}
      >
        {chapter.title}
      </TableCell>
      <TableCell
        data-testid={`chapter-cell-status-${chapter.id}`}
        {...getEditTriggerProps("status")}
      >
        <StatusBadge status={chapter.status} />
      </TableCell>
      <TableCell
        className="truncate text-muted-foreground"
        data-testid={`chapter-cell-narrator-${chapter.id}`}
        {...getEditTriggerProps("narrator")}
      >
        {chapter.narrator ? chapter.narrator.name : "—"}
      </TableCell>
      <TableCell
        className="truncate text-muted-foreground"
        data-testid={`chapter-cell-editor-${chapter.id}`}
        {...getEditTriggerProps("editor")}
      >
        {chapter.editor ? chapter.editor.name : "—"}
      </TableCell>
      <TableCell
        data-testid={`chapter-cell-deadline-${chapter.id}`}
        {...getEditTriggerProps("deadline")}
      >
        <ChapterDeadlineCell
          deadline={chapter.deadline}
          status={chapter.status}
          focusContext={focusContext}
        />
      </TableCell>
      <TableCell
        className="text-right tabular-nums"
        data-testid={`chapter-cell-editedSeconds-${chapter.id}`}
        {...getEditTriggerProps("editedSeconds")}
      >
        {formatSecondsAsHHMMSS(chapter.editedSeconds)}
      </TableCell>
      {!isSelectionMode && (
        <ChapterRowActions
          chapterId={chapter.id}
          chapterTitle={chapter.title}
          isPaid={isPaid}
          isLastNonPaid={isLastNonPaid}
          isFirst={isFirst}
          isLast={isLast}
          canReorder={canReorder}
          onEdit={() => enterEditMode()}
          onMoveBy={onMoveBy}
          onDeleted={onDeleted}
          onChaptersVersionChange={onChaptersVersionChange}
        />
      )}
    </TableRow>
  );
}
