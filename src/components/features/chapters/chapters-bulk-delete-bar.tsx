"use client";

import { Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ChaptersBulkDeleteBarProps {
  readonly selectedCount: number;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function ChaptersBulkDeleteBar({
  selectedCount,
  onCancel,
  onConfirm,
}: ChaptersBulkDeleteBarProps) {
  return (
    <div
      data-testid="chapters-bulk-delete-bar"
      className="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-3 backdrop-blur rounded-full"
    >
      <span className="text-sm font-medium" data-testid="chapters-bulk-delete-count">
        {selectedCount === 1 ? "1 capítulo selecionado" : `${selectedCount} capítulos selecionados`}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          data-testid="chapters-bulk-delete-cancel"
        >
          <X aria-hidden="true" className="size-4" />
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={selectedCount === 0}
          onClick={onConfirm}
          data-testid="chapters-bulk-delete-confirm-trigger"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Confirmar exclusão
        </Button>
      </div>
    </div>
  );
}
