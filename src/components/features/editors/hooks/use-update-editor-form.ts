"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { ApiErrorBody } from "@/lib/api/error-response";
import type { Editor, EditorFormValues } from "@/lib/domain/editor";

export interface UseUpdateEditorFormArgs {
  readonly editorId: string;
  readonly form: UseFormReturn<EditorFormValues>;
  readonly onUpdated: (editor: Editor) => void;
  readonly onNotFound?: () => void;
}

export interface UseUpdateEditorFormReturn {
  readonly onSubmit: (values: EditorFormValues) => Promise<void>;
  readonly isSubmitting: boolean;
  readonly firstFieldRef: RefObject<HTMLInputElement | null>;
}

export function useUpdateEditorForm({
  editorId,
  form,
  onUpdated,
  onNotFound,
}: UseUpdateEditorFormArgs): UseUpdateEditorFormReturn {
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  async function onSubmit(values: EditorFormValues) {
    const response = await fetch(`/api/v1/editors/${editorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.status === 200) {
      const body = (await response.json()) as { data: Editor };
      onUpdated(body.data);
      return;
    }

    if (response.status === 422) {
      const body = (await response.json()) as ApiErrorBody;
      for (const detail of body.error.details ?? []) {
        if (detail.field === "name" || detail.field === "email") {
          form.setError(detail.field, { message: detail.message });
        }
      }
      return;
    }

    if (response.status === 409) {
      const body = (await response.json()) as ApiErrorBody;
      if (body.error.code === "NAME_ALREADY_IN_USE") {
        form.setError("name", { message: "Nome já cadastrado" });
      } else if (body.error.code === "EMAIL_ALREADY_IN_USE") {
        form.setError("email", { message: "E-mail já cadastrado" });
      }
      return;
    }

    if (response.status === 404) {
      toast.error("Editor não existe mais.");
      onNotFound?.();
      return;
    }

    toast.error("Não foi possível atualizar o editor. Tente novamente.");
  }

  return {
    onSubmit,
    isSubmitting: form.formState.isSubmitting,
    firstFieldRef,
  };
}
