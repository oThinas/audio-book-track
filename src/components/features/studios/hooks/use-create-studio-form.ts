"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { apiFetch } from "@/lib/api/api-fetch";
import type { Studio, StudioFormValues } from "@/lib/domain/studio";

export interface UseCreateStudioFormArgs {
  readonly form: UseFormReturn<StudioFormValues>;
  readonly onCreated: (studio: Studio) => void;
}

export interface UseCreateStudioFormReturn {
  readonly onSubmit: (values: StudioFormValues) => Promise<void>;
  readonly isSubmitting: boolean;
  readonly firstFieldRef: RefObject<HTMLInputElement | null>;
}

const FIELD_NAMES = new Set<keyof StudioFormValues>(["name", "defaultHourlyRateCents"]);

export function useCreateStudioForm({
  form,
  onCreated,
}: UseCreateStudioFormArgs): UseCreateStudioFormReturn {
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  async function onSubmit(values: StudioFormValues) {
    const result = await apiFetch<{ data: Studio }>("/api/v1/studios", {
      method: "POST",
      body: values,
    });

    if (result.ok) {
      onCreated(result.data.data);
      return;
    }

    if (result.kind === "field-errors") {
      for (const [field, message] of Object.entries(result.fields)) {
        if (FIELD_NAMES.has(field as keyof StudioFormValues)) {
          form.setError(field as keyof StudioFormValues, { message });
        }
      }
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
