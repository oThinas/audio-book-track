"use client";

import { Check, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";

interface ChapterRowEditActionsProps {
  readonly chapterId: string;
  readonly chapterTitle: string;
  readonly formId: string;
  readonly isSubmitting: boolean;
  readonly onCancel: () => void;
}

/** Cancel / confirm actions cell of a chapter row in edit mode. */
export function ChapterRowEditActions({
  chapterId,
  chapterTitle,
  formId,
  isSubmitting,
  onCancel,
}: ChapterRowEditActionsProps) {
  return (
    <TableCell className="text-right">
      <div className="inline-flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Cancelar edição do ${chapterTitle}`}
          data-testid={`chapter-cancel-${chapterId}`}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
        <Button
          type="submit"
          form={formId}
          variant="ghost"
          size="icon"
          aria-label={`Confirmar edição do ${chapterTitle}`}
          data-testid={`chapter-confirm-${chapterId}`}
          disabled={isSubmitting}
          className="text-primary"
        >
          {isSubmitting ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Check aria-hidden="true" className="size-4" />
          )}
        </Button>
      </div>
    </TableCell>
  );
}
