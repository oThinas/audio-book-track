"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { ApiErrorBody } from "@/lib/api/error-response";
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

export function useCreateStudioForm({
  form,
  onCreated,
}: UseCreateStudioFormArgs): UseCreateStudioFormReturn {
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  async function onSubmit(values: StudioFormValues) {
    const response = await fetch("/api/v1/studios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.status === 201) {
      const body = (await response.json()) as { data: Studio };
      onCreated(body.data);
      return;
    }

    if (response.status === 422) {
      const body = (await response.json()) as ApiErrorBody;
      for (const detail of body.error.details ?? []) {
        if (detail.field === "name") {
          form.setError("name", { message: detail.message });
        } else if (detail.field === "defaultHourlyRateCents") {
          form.setError("defaultHourlyRateCents", { message: detail.message });
        }
      }
      return;
    }

    if (response.status === 409) {
      const body = (await response.json()) as ApiErrorBody;
      if (body.error.code === "NAME_ALREADY_IN_USE") {
        form.setError("name", { message: "Nome já cadastrado" });
      }
      return;
    }

    toast.error("Não foi possível salvar o estúdio. Tente novamente.");
  }

  return {
    onSubmit,
    isSubmitting: form.formState.isSubmitting,
    firstFieldRef,
  };
}
