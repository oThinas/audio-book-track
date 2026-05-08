"use client";

import { useEffect, useMemo, useState } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/api-fetch";
import type { Studio } from "@/lib/domain/studio";
import type { CreateBookInput } from "@/lib/schemas/book";
import type { CreatedBook } from "../book-create-dialog";

export interface UseCreateBookFormArgs {
  readonly studios: readonly Studio[];
  readonly form: UseFormReturn<CreateBookInput>;
  readonly onCreated: (book: CreatedBook) => void;
  readonly onOpenChange: (open: boolean) => void;
}

export interface UseCreateBookFormReturn {
  readonly studioOptions: readonly Studio[];
  readonly selectedStudio: Studio | undefined;
  readonly studioPickerOpen: boolean;
  readonly setStudioPickerOpen: (open: boolean) => void;
  readonly showInlineCreator: boolean;
  readonly setShowInlineCreator: (show: boolean) => void;
  readonly handleInlineStudioCreated: (studio: Studio) => void;
  readonly handleOpenChange: (next: boolean) => void;
  readonly onSubmit: (values: CreateBookInput) => Promise<void>;
}

export function useCreateBookForm({
  studios,
  form,
  onCreated,
  onOpenChange,
}: UseCreateBookFormArgs): UseCreateBookFormReturn {
  const [studioPickerOpen, setStudioPickerOpen] = useState(false);
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
  const dirtyPrice = form.formState.dirtyFields.pricePerHourCents;

  useEffect(() => {
    if (!selectedStudio) return;
    if (dirtyPrice) return;
    form.setValue("pricePerHourCents", selectedStudio.defaultHourlyRateCents, {
      shouldValidate: true,
      shouldDirty: false,
    });
  }, [selectedStudio, form, dirtyPrice]);

  function resetState() {
    form.reset();
    setStudioPickerOpen(false);
    setShowInlineCreator(false);
    setInlineStudios([]);
    setInlineStudioId(null);
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

  async function onSubmit(values: CreateBookInput) {
    const payload =
      inlineStudioId && inlineStudioId === values.studioId ? { ...values, inlineStudioId } : values;
    const result = await apiFetch<{
      data: {
        readonly id: string;
        readonly title: string;
        readonly studioId: string;
        readonly pricePerHourCents: number;
        readonly chapters: ReadonlyArray<{ readonly id: string; readonly number: number }>;
      };
    }>("/api/v1/books", { method: "POST", body: payload });

    if (result.ok) {
      const studio = studioOptions.find((s) => s.id === result.data.data.studioId);
      const created: CreatedBook = {
        id: result.data.data.id,
        title: result.data.data.title,
        studio: { id: result.data.data.studioId, name: studio?.name ?? "" },
        pricePerHourCents: result.data.data.pricePerHourCents,
        chapters: result.data.data.chapters,
      };
      resetState();
      onCreated(created);
      return;
    }

    if (result.kind === "field-errors") {
      for (const [field, message] of Object.entries(result.fields)) {
        if (field in values) {
          form.setError(field as keyof CreateBookInput, { message });
        }
      }
      return;
    }

    if (result.kind === "api-error") {
      if (result.code === "STUDIO_REFERENCE_INVALID" || result.code === "STUDIO_NOT_FOUND") {
        form.setError("studioId", { message: "Estúdio não encontrado ou arquivado." });
        return;
      }
      if (result.code === "INLINE_STUDIO_INVALID") {
        form.setError("studioId", {
          message: "Estúdio inline inválido. Selecione outro estúdio.",
        });
        return;
      }
      if (result.code === "TITLE_ALREADY_IN_USE") {
        form.setError("title", { message: "Já existe um livro com este título neste estúdio." });
      }
    }
  }

  return {
    studioOptions,
    selectedStudio,
    studioPickerOpen,
    setStudioPickerOpen,
    showInlineCreator,
    setShowInlineCreator,
    handleInlineStudioCreated,
    handleOpenChange,
    onSubmit,
  };
}
