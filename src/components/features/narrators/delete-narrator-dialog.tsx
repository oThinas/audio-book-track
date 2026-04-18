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
import type { Narrator } from "@/lib/domain/narrator";

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
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirm() {
    if (!narrator) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/narrators/${narrator.id}`, {
        method: "DELETE",
      });

      if (response.status === 204) {
        onConfirmed(narrator.id);
        onOpenChange(false);
        return;
      }

      if (response.status === 404) {
        onConfirmed(narrator.id);
        onOpenChange(false);
        return;
      }

      toast.error("Não foi possível excluir o narrador. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  }

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
            className="bg-destructive text-white hover:bg-destructive/90 focus-visible:border-destructive focus-visible:ring-destructive/30"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
