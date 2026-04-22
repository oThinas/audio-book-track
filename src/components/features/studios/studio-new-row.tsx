"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ApiErrorBody } from "@/lib/api/error-response";
import { createStudioSchema, type Studio, type StudioFormValues } from "@/lib/domain/studio";

interface StudioNewRowProps {
  readonly onCreated: (studio: Studio) => void;
  readonly onCancelled: () => void;
}

const FORM_ID = "studio-new-row-form";
const NAME_FIELD_ID = "studio-new-name";
const RATE_FIELD_ID = "studio-new-default-hourly-rate";

export function StudioNewRow({ onCreated, onCancelled }: StudioNewRowProps) {
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<StudioFormValues>({
    resolver: zodResolver(createStudioSchema),
    defaultValues: { name: "", defaultHourlyRate: 0 },
  });

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
        if (detail.field === "name" || detail.field === "defaultHourlyRate") {
          setError(detail.field, { message: detail.message });
        }
      }
      return;
    }

    if (response.status === 409) {
      const body = (await response.json()) as ApiErrorBody;
      if (body.error.code === "NAME_ALREADY_IN_USE") {
        setError("name", { message: "Nome já cadastrado" });
      }
      return;
    }

    toast.error("Não foi possível salvar o estúdio. Tente novamente.");
  }

  const { ref: nameRefCallback, ...nameRegister } = register("name");

  return (
    <TableRow data-testid="studio-new-row">
      <TableCell className="align-top">
        <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="contents" noValidate />
        <Label htmlFor={NAME_FIELD_ID} className="sr-only">
          Nome
        </Label>
        <Input
          id={NAME_FIELD_ID}
          form={FORM_ID}
          placeholder="Nome do estúdio"
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
      <TableCell className="align-top">
        <Label htmlFor={RATE_FIELD_ID} className="sr-only">
          Valor/hora
        </Label>
        <Controller
          name="defaultHourlyRate"
          control={control}
          render={({ field }) => (
            <MoneyInput
              id={RATE_FIELD_ID}
              form={FORM_ID}
              min={0.01}
              max={9999.99}
              value={field.value ?? 0}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={errors.defaultHourlyRate ? true : undefined}
              disabled={isSubmitting}
            />
          )}
        />
        {errors.defaultHourlyRate && (
          <p className="mt-1 text-xs text-destructive">{errors.defaultHourlyRate.message}</p>
        )}
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
            form={FORM_ID}
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
