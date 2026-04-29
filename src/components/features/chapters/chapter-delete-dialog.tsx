"use client";

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

interface ChapterDeleteDialogProps {
  readonly open: boolean;
  readonly chapterNumber: number;
  readonly isLastNonPaid: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ChapterDeleteDialog({
  open,
  chapterNumber,
  isLastNonPaid,
  onConfirm,
  onCancel,
}: ChapterDeleteDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent data-testid="chapter-delete-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir capítulo {chapterNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            {isLastNonPaid
              ? "Este é o último capítulo do livro. Confirmar excluirá o livro junto com o capítulo. Esta ação não pode ser desfeita."
              : "Esta ação não pode ser desfeita."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            data-testid="chapter-delete-confirm"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
