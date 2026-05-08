"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { apiFetch } from "@/lib/api/api-fetch";
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
    const result = await apiFetch<{ data: Narrator }>("/api/v1/narrators", {
      method: "POST",
      body: values,
    });

    if (result.ok) {
      onCreated(result.data.data);
      return;
    }

    if (result.kind === "field-errors" && result.fields.name) {
      form.setError("name", { message: result.fields.name });
      return;
    }

    if (result.kind === "api-error" && result.code === "NAME_ALREADY_IN_USE") {
      form.setError("name", { message: "Nome já cadastrado." });
    }
  }

  return {
    onSubmit,
    isSubmitting: form.formState.isSubmitting,
    firstFieldRef,
  };
}
