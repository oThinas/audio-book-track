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

interface ChaptersBulkDeleteConfirmProps {
  readonly open: boolean;
  readonly count: number;
  readonly hasPaid: boolean;
  readonly willDeleteBook: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function ChaptersBulkDeleteConfirm({
  open,
  count,
  hasPaid,
  willDeleteBook,
  onCancel,
  onConfirm,
}: ChaptersBulkDeleteConfirmProps) {
  const noun = count === 1 ? "capítulo" : "capítulos";
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent data-testid="chapters-bulk-delete-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Excluir {count} {noun}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {willDeleteBook
              ? "Todos os capítulos serão removidos e o livro será excluído junto. Esta ação não pode ser desfeita."
              : hasPaid
                ? "Capítulos com status 'pago' são preservados automaticamente. Esta ação não pode ser desfeita."
                : "Esta ação não pode ser desfeita."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            data-testid="chapters-bulk-delete-confirm-action"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
