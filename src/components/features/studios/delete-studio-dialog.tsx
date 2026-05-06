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
import type { Studio } from "@/lib/domain/studio";

import { useDeleteStudio } from "./hooks/use-delete-studio";

interface DeleteStudioDialogProps {
  readonly studio: Studio | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirmed: (id: string) => void;
}

export function DeleteStudioDialog({
  studio,
  open,
  onOpenChange,
  onConfirmed,
}: DeleteStudioDialogProps) {
  const { isDeleting, error, handleConfirm } = useDeleteStudio({
    studio,
    onConfirmed,
    onOpenChange,
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {studio?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. O estúdio será removido permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
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
