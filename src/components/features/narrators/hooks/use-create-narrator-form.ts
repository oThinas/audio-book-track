"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { ApiErrorBody } from "@/lib/api/error-response";
import type { Narrator, NarratorFormValues } from "@/lib/domain/narrator";

export interface UseCreateNarratorFormArgs {
  readonly form: UseFormReturn<NarratorFormValues>;
  readonly onCreated: (narrator: Narrator) => void;
}

export interface UseCreateNarratorFormReturn {
  readonly onSubmit: (values: NarratorFormValues) => Promise<void>;
  readonly isSubmitting: boolean;
  readonly firstFieldRef: RefObject<HTMLInputElement | null>;
}

export function useCreateNarratorForm({
  form,
  onCreated,
}: UseCreateNarratorFormArgs): UseCreateNarratorFormReturn {
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  async function onSubmit(values: NarratorFormValues) {
    const response = await fetch("/api/v1/narrators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.status === 201) {
      const body = (await response.json()) as { data: Narrator };
      onCreated(body.data);
      return;
    }

    if (response.status === 422) {
      const body = (await response.json()) as ApiErrorBody;
      for (const detail of body.error.details ?? []) {
        if (detail.field === "name") {
          form.setError("name", { message: detail.message });
        }
      }
      return;
    }

    if (response.status === 409) {
      form.setError("name", { message: "Nome já cadastrado" });
      return;
    }

    toast.error("Não foi possível salvar o narrador. Tente novamente.");
  }

  return {
    onSubmit,
    isSubmitting: form.formState.isSubmitting,
    firstFieldRef,
  };
}
