"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { Editor } from "@/lib/domain/editor";
import type { EditorListItem } from "@/lib/repositories/editor-repository";

import { EditorRowEditMode } from "./editor-row-edit-mode";
import { useEditorRow } from "./hooks/use-editor-row";

interface EditorRowProps {
  readonly editor: EditorListItem;
  readonly onUpdated?: (editor: Editor) => void;
  readonly onRequestDelete?: (editor: Editor) => void;
}

export function EditorRow({ editor, onUpdated, onRequestDelete }: EditorRowProps) {
  const {
    isEditing,
    handleStartEdit,
    handleCancelEdit,
    handleEditCompleted,
    handleRequestDelete,
    canDelete,
  } = useEditorRow({ editor, onUpdated, onRequestDelete });

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
    <TableRow data-testid="editor-row">
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
