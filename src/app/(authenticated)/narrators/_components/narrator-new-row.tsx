"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ApiErrorBody } from "@/lib/api/error-response";
import { type Narrator, type NarratorFormValues, narratorFormSchema } from "@/lib/domain/narrator";

interface NarratorNewRowProps {
  readonly onCreated: (narrator: Narrator) => void;
  readonly onCancelled: () => void;
}

export function NarratorNewRow({ onCreated, onCancelled }: NarratorNewRowProps) {
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<NarratorFormValues>({
    resolver: zodResolver(narratorFormSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  async function onSubmit(values: NarratorFormValues) {
    const response = await fetch("/api/v1/narrators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.status === 201) {
      const body = (await response.json()) as { data: Narrator };
      onCreated(body.data);
      return;
    }

    if (response.status === 422) {
      const body = (await response.json()) as ApiErrorBody;
      for (const detail of body.error.details ?? []) {
        if (detail.field === "name") {
          setError("name", { message: detail.message });
        }
      }
      return;
    }

    if (response.status === 409) {
      setError("name", { message: "Nome já cadastrado" });
      return;
    }

    toast.error("Não foi possível salvar o narrador. Tente novamente.");
  }

  const { ref: nameRefCallback, ...nameRegister } = register("name");

  return (
    <TableRow data-testid="narrator-new-row">
      <TableCell className="align-top">
        <form
          id="narrator-new-row-form"
          onSubmit={handleSubmit(onSubmit)}
          className="contents"
          noValidate
        />
        <Label htmlFor="narrator-new-name" className="sr-only">
          Nome
        </Label>
        <Input
          id="narrator-new-name"
          form="narrator-new-row-form"
          placeholder="Nome do narrador"
          aria-invalid={errors.name ? true : undefined}
          disabled={isSubmitting}
          {...nameRegister}
          ref={(element) => {
            nameRefCallback(element);
            firstFieldRef.current = element;
          }}
        />
        {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
      </TableCell>
      <TableCell className="w-24">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Cancelar"
            onClick={onCancelled}
            disabled={isSubmitting}
          >
            <X aria-hidden="true" />
          </Button>
          <Button
            type="submit"
            form="narrator-new-row-form"
            variant="ghost"
            size="icon-sm"
            aria-label="Confirmar"
            className="text-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Check aria-hidden="true" />
            )}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
