"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { ApiErrorBody } from "@/lib/api/error-response";
import type { Narrator, NarratorFormValues } from "@/lib/domain/narrator";

export interface UseUpdateNarratorFormArgs {
  readonly narratorId: string;
  readonly form: UseFormReturn<NarratorFormValues>;
  readonly onUpdated: (narrator: Narrator) => void;
  readonly onNotFound?: () => void;
}

export interface UseUpdateNarratorFormReturn {
  readonly onSubmit: (values: NarratorFormValues) => Promise<void>;
  readonly isSubmitting: boolean;
  readonly firstFieldRef: RefObject<HTMLInputElement | null>;
}

export function useUpdateNarratorForm({
  narratorId,
  form,
  onUpdated,
  onNotFound,
}: UseUpdateNarratorFormArgs): UseUpdateNarratorFormReturn {
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  async function onSubmit(values: NarratorFormValues) {
    const response = await fetch(`/api/v1/narrators/${narratorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.status === 200) {
      const body = (await response.json()) as { data: Narrator };
      onUpdated(body.data);
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

    if (response.status === 404) {
      toast.error("Narrador não existe mais.");
      onNotFound?.();
      return;
    }

    toast.error("Não foi possível atualizar o narrador. Tente novamente.");
  }

  return {
    onSubmit,
    isSubmitting: form.formState.isSubmitting,
    firstFieldRef,
  };
}
