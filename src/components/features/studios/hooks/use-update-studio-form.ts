"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { apiFetch } from "@/lib/api/api-fetch";
import type { Studio, StudioFormValues } from "@/lib/domain/studio";

export interface UseUpdateStudioFormArgs {
  readonly studioId: string;
  readonly form: UseFormReturn<StudioFormValues>;
  readonly onUpdated: (studio: Studio) => void;
  readonly onNotFound?: () => void;
}

export interface UseUpdateStudioFormReturn {
  readonly onSubmit: (values: StudioFormValues) => Promise<void>;
  readonly isSubmitting: boolean;
  readonly firstFieldRef: RefObject<HTMLInputElement | null>;
}

const FIELD_NAMES = new Set<keyof StudioFormValues>(["name", "defaultHourlyRateCents"]);

export function useUpdateStudioForm({
  studioId,
  form,
  onUpdated,
  onNotFound,
}: UseUpdateStudioFormArgs): UseUpdateStudioFormReturn {
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  async function onSubmit(values: StudioFormValues) {
    const result = await apiFetch<{ data: Studio }>(`/api/v1/studios/${studioId}`, {
      method: "PATCH",
      body: values,
    });

    if (result.ok) {
      onUpdated(result.data.data);
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

    if (result.kind === "api-error") {
      if (result.code === "NAME_ALREADY_IN_USE") {
        form.setError("name", { message: "Nome já cadastrado." });
        return;
      }
      if (result.code === "STUDIO_NOT_FOUND") {
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
