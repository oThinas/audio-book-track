"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ApiErrorBody } from "@/lib/api/error-response";
import type { Studio } from "@/lib/domain/studio";

interface CreateStudioResponse {
  readonly data: Studio;
  readonly meta: {
    readonly reactivated: boolean;
    readonly rateResetForInline?: true;
  };
}

interface StudioInlineCreatorProps {
  readonly onCreated: (studio: Studio) => void;
  readonly onCancel: () => void;
}

const INLINE_PLACEHOLDER_RATE_CENTS = 1;

export function StudioInlineCreator({ onCreated, onCancel }: StudioInlineCreatorProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSubmit = trimmed.length >= 2 && !submitting;

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

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSubmit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3" data-testid="studio-inline-creator">
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="inline-studio-name">Nome do estúdio</FieldLabel>
        <Input
          id="inline-studio-name"
          autoFocus
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ex.: Sonora"
          aria-invalid={error ? true : undefined}
          disabled={submitting}
        />
        <FieldError>{error}</FieldError>
      </Field>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          data-testid="studio-inline-create-submit"
        >
          {submitting && <Loader2 aria-hidden="true" className="animate-spin" />}
          Criar
        </Button>
      </div>
    </div>
  );
}
