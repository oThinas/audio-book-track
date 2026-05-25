"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { TableCell, TableRow } from "@/components/ui/table";
import { type Studio, type StudioFormValues, studioFormSchema } from "@/lib/domain/studio";

import { useCreateStudioForm } from "./hooks/use-create-studio-form";

interface StudioNewRowProps {
  readonly onCreated: (studio: Studio) => void;
  readonly onCancelled: () => void;
}

const FORM_ID = "studio-new-row-form";
const NAME_FIELD_ID = "studio-new-name";
const RATE_FIELD_ID = "studio-new-default-hourly-rate";

export function StudioNewRow({ onCreated, onCancelled }: StudioNewRowProps) {
  const form = useForm<StudioFormValues>({
    resolver: zodResolver(studioFormSchema),
    defaultValues: { name: "", defaultHourlyRateCents: 0 },
  });
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = form;

  const { onSubmit, firstFieldRef } = useCreateStudioForm({ form, onCreated });

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
          name="defaultHourlyRateCents"
          control={control}
          render={({ field }) => (
            <MoneyInput
              id={RATE_FIELD_ID}
              form={FORM_ID}
              min={1}
              max={999_999}
              value={field.value ?? 0}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={errors.defaultHourlyRateCents ? true : undefined}
              disabled={isSubmitting}
            />
          )}
        />
        {errors.defaultHourlyRateCents && (
          <p className="mt-1 text-xs text-destructive">{errors.defaultHourlyRateCents.message}</p>
        )}
      </TableCell>
      <TableCell aria-hidden="true" />
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
