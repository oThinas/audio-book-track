"use client";

import { useMemo, useState } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { ApiErrorBody } from "@/lib/api/error-response";
import type { Studio } from "@/lib/domain/studio";
import type { UpdateBookInput } from "@/lib/schemas/book";
import type { BookEditValues, UpdatedBookDetail } from "../book-edit-dialog";

export interface UseEditBookFormArgs {
  readonly book: BookEditValues;
  readonly studios: readonly Studio[];
  readonly form: UseFormReturn<UpdateBookInput>;
  readonly onUpdated: (detail: UpdatedBookDetail) => void;
  readonly onOpenChange: (open: boolean) => void;
}

export interface UseEditBookFormReturn {
  readonly studioOptions: readonly Studio[];
  readonly selectedStudio: Studio | undefined;
  readonly studioPickerOpen: boolean;
  readonly setStudioPickerOpen: (open: boolean) => void;
  readonly showInlineCreator: boolean;
  readonly setShowInlineCreator: (show: boolean) => void;
  readonly reduceHint: boolean;
  readonly setReduceHint: (next: boolean) => void;
  readonly handleInlineStudioCreated: (studio: Studio) => void;
  readonly handleOpenChange: (next: boolean) => void;
  readonly onSubmit: (values: UpdateBookInput) => Promise<void>;
}

export function useEditBookForm({
  book,
  studios,
  form,
  onUpdated,
  onOpenChange,
}: UseEditBookFormArgs): UseEditBookFormReturn {
  const [studioPickerOpen, setStudioPickerOpen] = useState(false);
  const [reduceHint, setReduceHint] = useState(false);
  const [showInlineCreator, setShowInlineCreator] = useState(false);
  const [inlineStudios, setInlineStudios] = useState<readonly Studio[]>([]);
  const [inlineStudioId, setInlineStudioId] = useState<string | null>(null);

  // Backend already orders `studios` alphabetically (`StudioService.list({ orderBy: "name" })`).
  // We just slot inline-created studios into the right position to keep the
  // dropdown alphabetical without a full re-sort.
  const studioOptions = useMemo(() => {
    if (inlineStudios.length === 0) return studios;
    const merged: Studio[] = [...studios];
    const seen = new Set(merged.map((s) => s.id));
    for (const inline of inlineStudios) {
      if (seen.has(inline.id)) continue;
      seen.add(inline.id);
      const idx = merged.findIndex((s) => s.name.localeCompare(inline.name, "pt-BR") > 0);
      if (idx === -1) merged.push(inline);
      else merged.splice(idx, 0, inline);
    }
    return merged;
  }, [studios, inlineStudios]);

  const selectedStudioId = useWatch({ control: form.control, name: "studioId" });
  const selectedStudio = studioOptions.find((s) => s.id === selectedStudioId);

  function resetState() {
    form.reset();
    setStudioPickerOpen(false);
    setShowInlineCreator(false);
    setInlineStudios([]);
    setInlineStudioId(null);
    setReduceHint(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (inlineStudioId) {
        toast.warning(
          "Estúdio criado mas não vinculado: o valor/hora ficou em R$ 0,01. Edite-o quando puder.",
        );
      }
      resetState();
    }
    onOpenChange(next);
  }

  function handleInlineStudioCreated(studio: Studio) {
    setInlineStudios((current) => [...current, studio]);
    setInlineStudioId(studio.id);
    form.setValue("studioId", studio.id, { shouldValidate: true, shouldDirty: true });
    setShowInlineCreator(false);
    setStudioPickerOpen(false);
  }

  async function onSubmit(values: UpdateBookInput) {
    const patch: UpdateBookInput = {};
    if (values.title !== undefined && values.title.trim() !== book.title) {
      patch.title = values.title.trim();
    }
    if (values.studioId !== undefined && values.studioId !== book.studioId) {
      patch.studioId = values.studioId;
    }
    if (
      values.pricePerHourCents !== undefined &&
      values.pricePerHourCents !== book.pricePerHourCents
    ) {
      patch.pricePerHourCents = values.pricePerHourCents;
    }
    if (values.numChapters !== undefined && values.numChapters !== book.currentChapters) {
      patch.numChapters = values.numChapters;
    }
    if (inlineStudioId && values.studioId === inlineStudioId && patch.studioId === inlineStudioId) {
      patch.inlineStudioId = inlineStudioId;
    }

    if (Object.keys(patch).length === 0) {
      handleOpenChange(false);
      return;
    }

    const response = await fetch(`/api/v1/books/${book.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (response.status === 200) {
      const body = (await response.json()) as { data: UpdatedBookDetail };
      resetState();
      onOpenChange(false);
      onUpdated(body.data);
      return;
    }

    if (response.status === 422) {
      const body = (await response.json()) as ApiErrorBody;
      if (body.error.code === "CANNOT_REDUCE_CHAPTERS") {
        form.setError("numChapters", {
          message: "Para reduzir a quantidade, use 'Excluir capítulos'.",
        });
        return;
      }
      if (body.error.code === "STUDIO_NOT_FOUND") {
        form.setError("studioId", { message: "Estúdio não encontrado ou arquivado." });
        return;
      }
      if (body.error.code === "INLINE_STUDIO_INVALID") {
        form.setError("studioId", { message: "Estúdio inline inválido. Selecione outro estúdio." });
        return;
      }
      for (const detail of body.error.details ?? []) {
        if (detail.field && detail.field in values) {
          form.setError(detail.field as keyof UpdateBookInput, { message: detail.message });
        }
      }
      return;
    }

    if (response.status === 409) {
      const body = (await response.json()) as ApiErrorBody;
      switch (body.error.code) {
        case "TITLE_ALREADY_IN_USE":
          form.setError("title", {
            message: "Já existe um livro com este título neste estúdio.",
          });
          return;
        case "BOOK_PAID_PRICE_LOCKED":
          form.setError("pricePerHourCents", {
            message: "Valor/hora não pode ser alterado: já há capítulo pago.",
          });
          return;
        case "BOOK_PAID_STUDIO_LOCKED":
          form.setError("studioId", {
            message: "Estúdio não pode ser alterado: já há capítulo pago.",
          });
          return;
        default:
          break;
      }
    }

    toast.error("Não foi possível atualizar o livro. Tente novamente.");
  }

  return {
    studioOptions,
    selectedStudio,
    studioPickerOpen,
    setStudioPickerOpen,
    showInlineCreator,
    setShowInlineCreator,
    reduceHint,
    setReduceHint,
    handleInlineStudioCreated,
    handleOpenChange,
    onSubmit,
  };
}
