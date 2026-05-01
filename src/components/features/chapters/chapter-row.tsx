"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";

import { StatusBadge } from "@/components/features/books/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ChapterStatus } from "@/lib/domain/chapter";
import { formatSecondsAsHHMMSS } from "@/lib/utils";

import { ChapterDeleteDialog } from "./chapter-delete-dialog";
import { ChapterRowEditMode } from "./chapter-row-edit-mode";
import { useChapterRow } from "./hooks/use-chapter-row";
import { useDeleteChapter } from "./hooks/use-delete-chapter";

export interface ChapterRowEntity {
  readonly id: string;
  readonly number: number;
  readonly status: ChapterStatus;
  readonly narrator: { readonly id: string; readonly name: string } | null;
  readonly editor: { readonly id: string; readonly name: string } | null;
  readonly editedSeconds: number;
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
  readonly onSaved: (updated: ChapterRowEntity, bookStatus: ChapterStatus) => void;
  readonly onDeleted: (chapterId: string, bookDeleted: boolean) => void;
  readonly onToggleSelected: (chapterId: string, selected: boolean) => void;
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
  onSaved,
  onDeleted,
  onToggleSelected,
}: ChapterRowProps) {
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
      <TableRow data-testid={`chapter-row-${chapter.id}`} data-mode="view">
        {isSelectionMode && (
          <TableCell>
            <Checkbox
              checked={isSelected}
              disabled={isPaid}
              onCheckedChange={(value) => onToggleSelected(chapter.id, value === true)}
              aria-label={`Selecionar capítulo ${chapter.number}`}
              data-testid={`chapter-select-${chapter.id}`}
            />
          </TableCell>
        )}
        <TableCell className="font-medium">{chapter.number}</TableCell>
        <TableCell>
          <StatusBadge status={chapter.status} />
        </TableCell>
        <TableCell className="truncate text-muted-foreground">
          {chapter.narrator ? chapter.narrator.name : "—"}
        </TableCell>
        <TableCell className="truncate text-muted-foreground">
          {chapter.editor ? chapter.editor.name : "—"}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatSecondsAsHHMMSS(chapter.editedSeconds)}
        </TableCell>
        {!isSelectionMode && (
          <TableCell className="text-right">
            <div className="inline-flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Editar capítulo ${chapter.number}`}
                data-testid={`chapter-edit-${chapter.id}`}
                onClick={enterEditMode}
              >
                <Pencil aria-hidden="true" className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Excluir capítulo ${chapter.number}`}
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
        chapterNumber={chapter.number}
        isLastNonPaid={isLastNonPaid}
        onCancel={cancelDelete}
        onConfirm={handleDelete}
      />
    </>
  );
}
