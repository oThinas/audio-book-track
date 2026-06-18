"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { ROW_ENTER_CLASS, ROW_EXIT_CLASS, type RowState } from "@/hooks/row-animation";
import { useScrollIntoViewOnEnter } from "@/hooks/use-scroll-into-view-on-enter";
import type { Editor } from "@/lib/domain/editor";
import type { EditorListItem } from "@/lib/repositories/editor-repository";
import { cn } from "@/lib/utils";

import { EditorRowEditMode } from "./editor-row-edit-mode";
import { useEditorRow } from "./hooks/use-editor-row";

interface EditorRowProps {
  readonly editor: EditorListItem;
  readonly rowState?: RowState;
  readonly onRowAnimationEnd?: () => void;
  readonly onUpdated?: (editor: Editor) => void;
  readonly onRequestDelete?: (editor: Editor) => void;
}

export function EditorRow({
  editor,
  rowState = "idle",
  onRowAnimationEnd,
  onUpdated,
  onRequestDelete,
}: EditorRowProps) {
  const {
    isEditing,
    handleStartEdit,
    handleCancelEdit,
    handleEditCompleted,
    handleRequestDelete,
    canDelete,
  } = useEditorRow({ editor, onUpdated, onRequestDelete });
  const setRowRef = useScrollIntoViewOnEnter(rowState === "entering");

  if (isEditing) {
    return (
      <EditorRowEditMode
        editor={editor}
        onCancel={handleCancelEdit}
        onUpdated={handleEditCompleted}
      />
    );
  }

  return (
    <TableRow
      ref={setRowRef}
      data-testid="editor-row"
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
      <TableCell data-testid="editor-name" className="text-foreground">
        {editor.name}
      </TableCell>
      <TableCell
        data-testid="editor-email"
        className="text-muted-foreground truncate"
        title={editor.email}
      >
        {editor.email}
      </TableCell>
      <TableCell data-testid="editor-chapters-count" className="text-foreground">
        {editor.chaptersCount}
      </TableCell>
      <TableCell className="w-24">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${editor.name}`}
            onClick={handleStartEdit}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Excluir ${editor.name}`}
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
