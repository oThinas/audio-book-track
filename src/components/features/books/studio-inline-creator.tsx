"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Studio } from "@/lib/domain/studio";

import { useStudioInlineCreator } from "./hooks/use-studio-inline-creator";

interface StudioInlineCreatorProps {
  readonly onCreated: (studio: Studio) => void;
  readonly onCancel: () => void;
}

export function StudioInlineCreator({ onCreated, onCancel }: StudioInlineCreatorProps) {
  const { name, setName, submitting, error, canSubmit, handleSubmit, handleKeyDown } =
    useStudioInlineCreator({ onCreated, onCancel });

  return (
    <div className="flex flex-col gap-3 p-3" data-testid="studio-inline-creator">
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="inline-studio-name">Nome do estúdio</FieldLabel>
        <Input
          id="inline-studio-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
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
