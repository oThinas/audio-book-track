"use client";

import { type KeyboardEvent, useState } from "react";
import { toast } from "sonner";
import type { ApiErrorBody } from "@/lib/api/error-response";
import type { Studio } from "@/lib/domain/studio";

interface CreateStudioResponse {
  readonly data: Studio;
  readonly meta: {
    readonly reactivated: boolean;
    readonly rateResetForInline?: true;
  };
}

const INLINE_PLACEHOLDER_RATE_CENTS = 1;

export interface UseStudioInlineCreatorArgs {
  readonly onCreated: (studio: Studio) => void;
  readonly onCancel: () => void;
}

export interface UseStudioInlineCreatorReturn {
  readonly name: string;
  readonly setName: (next: string) => void;
  readonly submitting: boolean;
  readonly error: string | null;
  readonly canSubmit: boolean;
  readonly handleSubmit: () => Promise<void>;
  readonly handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export function useStudioInlineCreator({
  onCreated,
  onCancel,
}: UseStudioInlineCreatorArgs): UseStudioInlineCreatorReturn {
  const [name, setNameState] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSubmit = trimmed.length >= 2 && !submitting;

  function setName(next: string) {
    setNameState(next);
    if (error) setError(null);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/studios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          defaultHourlyRateCents: INLINE_PLACEHOLDER_RATE_CENTS,
          inline: true,
        }),
      });

      if (response.status === 201 || response.status === 200) {
        const body = (await response.json()) as CreateStudioResponse;
        onCreated(body.data);
        return;
      }

      if (response.status === 422) {
        const body = (await response.json()) as ApiErrorBody;
        const firstNameError = body.error.details?.find((d) => d.field === "name");
        setError(firstNameError?.message ?? "Nome inválido.");
        return;
      }

      if (response.status === 409) {
        setError("Já existe um estúdio com este nome.");
        return;
      }

      toast.error("Não foi possível criar o estúdio. Tente novamente.");
    } catch {
      toast.error("Erro de rede ao criar o estúdio.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSubmit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return { name, setName, submitting, error, canSubmit, handleSubmit, handleKeyDown };
}
