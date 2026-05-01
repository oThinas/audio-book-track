"use client";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { ApiErrorBody } from "@/lib/api/error-response";

export interface PdfUrlFormValues {
  readonly pdfUrl: string;
}

export interface UseBookPdfPopoverArgs {
  readonly bookId: string;
  readonly pdfUrl: string | null;
  readonly form: UseFormReturn<PdfUrlFormValues>;
  readonly onUpdated: (next: string | null) => void;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

export interface UseBookPdfPopoverReturn {
  readonly isOpen: boolean;
  readonly handleOpenChange: (next: boolean) => void;
  readonly onSubmit: (values: PdfUrlFormValues) => Promise<void>;
  readonly canSubmit: boolean;
  readonly isCleared: boolean;
  readonly hasPersistedChange: boolean;
}

export function useBookPdfPopover({
  bookId,
  pdfUrl,
  form,
  onUpdated,
  onOpenChange,
  open: controlledOpen,
}: UseBookPdfPopoverArgs): UseBookPdfPopoverReturn {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const watchedUrl = form.watch("pdfUrl");
  const draft = watchedUrl?.trim() ?? "";
  const isCleared = draft === "";
  const persistedUrl = pdfUrl ?? "";
  const hasPersistedChange = draft !== persistedUrl;

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      form.reset({ pdfUrl: pdfUrl ?? "" });
    }
    if (!isControlled) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  async function onSubmit(values: PdfUrlFormValues) {
    const trimmed = values.pdfUrl.trim();
    const payload: { pdfUrl: string | null } =
      trimmed === "" ? { pdfUrl: null } : { pdfUrl: trimmed };
    const response = await fetch(`/api/v1/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 200) {
      const next = trimmed === "" ? null : trimmed;
      onUpdated(next);
      handleOpenChange(false);
      return;
    }

    if (response.status === 422) {
      const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
      const fieldError = body?.error.details?.find((d) => d.field === "pdfUrl");
      form.setError("pdfUrl", { message: fieldError?.message ?? "URL inválida." });
      return;
    }

    toast.error("Não foi possível salvar a URL. Tente novamente.");
  }

  const { isDirty, isValid, isSubmitting } = form.formState;
  const canSubmit = isValid && (isDirty || hasPersistedChange) && !isSubmitting;

  return { isOpen, handleOpenChange, onSubmit, canSubmit, isCleared, hasPersistedChange };
}
