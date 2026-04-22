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
import type { Studio } from "@/lib/domain/studio";

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
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirm() {
    if (!studio) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/studios/${studio.id}`, {
        method: "DELETE",
      });

      if (response.status === 204) {
        onConfirmed(studio.id);
        onOpenChange(false);
        return;
      }

      if (response.status === 404) {
        onConfirmed(studio.id);
        onOpenChange(false);
        return;
      }

      toast.error("Não foi possível excluir o estúdio. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {studio?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. O estúdio será removido permanentemente.
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
