import { Loader2 } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

interface BookDialogSkeletonProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Suspense fallback for the lazy-loaded book create/edit dialogs. Mounts the
 * actual `<Dialog>` so the overlay/animation matches the real one — the user
 * sees the same surface immediately while the chunk is still loading.
 */
export function BookDialogSkeleton({ open, onOpenChange }: BookDialogSkeletonProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-busy="true"
        aria-live="polite"
        data-testid="book-dialog-skeleton"
        className="flex h-40 items-center justify-center"
      >
        <Loader2 aria-hidden="true" className="size-6 animate-spin text-muted-foreground" />
        <span className="sr-only">Carregando…</span>
      </DialogContent>
    </Dialog>
  );
}
