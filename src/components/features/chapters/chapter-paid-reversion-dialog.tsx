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

interface ChapterPaidReversionDialogProps {
  readonly open: boolean;
  readonly chapterNumber: number;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ChapterPaidReversionDialog({
  open,
  chapterNumber,
  onConfirm,
  onCancel,
}: ChapterPaidReversionDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent data-testid="chapter-paid-reversion-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Reverter capítulo {chapterNumber} de pago para concluído?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação destrava os dados financeiros do livro. Use apenas para corrigir um pagamento
            registrado por engano.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} data-testid="chapter-paid-reversion-confirm">
            Confirmar reversão
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
