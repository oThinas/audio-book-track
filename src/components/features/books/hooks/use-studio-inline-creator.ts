"use client";

import { type KeyboardEvent, useState } from "react";
import { apiFetch } from "@/lib/api/api-fetch";
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
      const result = await apiFetch<CreateStudioResponse>("/api/v1/studios", {
        method: "POST",
        body: {
          name: trimmed,
          defaultHourlyRateCents: INLINE_PLACEHOLDER_RATE_CENTS,
          inline: true,
        },
      });

      if (result.ok) {
        onCreated(result.data.data);
        return;
      }

      if (result.kind === "field-errors" && result.fields.name) {
        setError(result.fields.name);
        return;
      }

      if (result.kind === "api-error" && result.code === "NAME_ALREADY_IN_USE") {
        setError("Já existe um estúdio com este nome.");
      }
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
