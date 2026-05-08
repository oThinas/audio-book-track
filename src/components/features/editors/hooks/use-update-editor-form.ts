"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { apiFetch } from "@/lib/api/api-fetch";
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

const FIELD_NAMES = new Set<keyof EditorFormValues>(["name", "email"]);

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
    const result = await apiFetch<{ data: Editor }>(`/api/v1/editors/${editorId}`, {
      method: "PATCH",
      body: values,
    });

    if (result.ok) {
      onUpdated(result.data.data);
      return;
    }

    if (result.kind === "field-errors") {
      for (const [field, message] of Object.entries(result.fields)) {
        if (FIELD_NAMES.has(field as keyof EditorFormValues)) {
          form.setError(field as keyof EditorFormValues, { message });
        }
      }
      return;
    }

    if (result.kind === "api-error") {
      if (result.code === "NAME_ALREADY_IN_USE") {
        form.setError("name", { message: "Nome já cadastrado." });
        return;
      }
      if (result.code === "EMAIL_ALREADY_IN_USE") {
        form.setError("email", { message: "E-mail já cadastrado." });
        return;
      }
      if (result.code === "EDITOR_NOT_FOUND") {
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
