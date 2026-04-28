"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Editor } from "@/lib/domain/editor";

interface DeleteEditorDialogProps {
  readonly editor: Editor | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirmed: (id: string) => void;
}

export function DeleteEditorDialog({
  editor,
  open,
  onOpenChange,
  onConfirmed,
}: DeleteEditorDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirm() {
    if (!editor) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/editors/${editor.id}`, {
        method: "DELETE",
      });

      if (response.status === 204) {
        onConfirmed(editor.id);
        onOpenChange(false);
        return;
      }

      if (response.status === 404) {
        onConfirmed(editor.id);
        onOpenChange(false);
        return;
      }

      if (response.status === 409) {
        const body = (await response.json()) as {
          error: {
            code: string;
            message: string;
            details?: { books?: ReadonlyArray<{ id: string; title: string }> };
          };
        };
        if (body.error.code === "EDITOR_LINKED_TO_ACTIVE_CHAPTERS") {
          const titles = body.error.details?.books?.map((b) => b.title) ?? [];
          const titlesPreview = titles.slice(0, 3).join(", ");
          const remainder = titles.length > 3 ? ` e mais ${titles.length - 3}` : "";
          toast.error(
            `Não é possível excluir: capítulos em ${titles.length} livro(s) ativo(s).`,
            titles.length > 0 ? { description: `${titlesPreview}${remainder}` } : undefined,
          );
          onOpenChange(false);
          return;
        }
      }

      toast.error("Não foi possível excluir o editor. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {editor?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. O editor será removido permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="bg-transparent border-t-0">
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-destructive text-white hover:bg-destructive/90 focus-visible:border-destructive focus-visible:ring-destructive/30"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
