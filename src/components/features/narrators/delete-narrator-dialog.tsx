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
import type { Narrator } from "@/lib/domain/narrator";

import { useDeleteNarrator } from "./hooks/use-delete-narrator";

interface DeleteNarratorDialogProps {
  readonly narrator: Narrator | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirmed: (id: string) => void;
}

export function DeleteNarratorDialog({
  narrator,
  open,
  onOpenChange,
  onConfirmed,
}: DeleteNarratorDialogProps) {
  const { isDeleting, handleConfirm } = useDeleteNarrator({ narrator, onConfirmed, onOpenChange });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {narrator?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. O narrador será removido permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="bg-transparent border-t-0">
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:border-destructive focus-visible:ring-destructive/30"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
