"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { apiFetch } from "@/lib/api/api-fetch";
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
    const result = await apiFetch<{ data: Narrator }>(`/api/v1/narrators/${narratorId}`, {
      method: "PATCH",
      body: values,
    });

    if (result.ok) {
      onUpdated(result.data.data);
      return;
    }

    if (result.kind === "field-errors" && result.fields.name) {
      form.setError("name", { message: result.fields.name });
      return;
    }

    if (result.kind === "api-error") {
      if (result.code === "NAME_ALREADY_IN_USE") {
        form.setError("name", { message: "Nome já cadastrado." });
        return;
      }
      if (result.code === "NARRATOR_NOT_FOUND") {
        onNotFound?.();
      }
    }
  }

  return {
    onSubmit,
    isSubmitting: form.formState.isSubmitting,
    firstFieldRef,
  };
}
