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
import type { StudioListItem } from "@/lib/repositories/studio-repository";

import { useUpdateStudioForm } from "./hooks/use-update-studio-form";

interface StudioRowEditModeProps {
  readonly studio: StudioListItem;
  readonly onCancel: () => void;
  readonly onUpdated: (studio: Studio) => void;
}

export function StudioRowEditMode({ studio, onCancel, onUpdated }: StudioRowEditModeProps) {
  const formId = `studio-edit-row-form-${studio.id}`;
  const nameFieldId = `studio-edit-name-${studio.id}`;
  const rateFieldId = `studio-edit-default-hourly-rate-${studio.id}`;

  const form = useForm<StudioFormValues>({
    resolver: zodResolver(studioFormSchema),
    defaultValues: {
      name: studio.name,
      defaultHourlyRateCents: studio.defaultHourlyRateCents,
    },
  });
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = form;

  const { onSubmit, firstFieldRef } = useUpdateStudioForm({
    studioId: studio.id,
    form,
    onUpdated,
    onNotFound: onCancel,
  });

  const { ref: nameRefCallback, ...nameRegister } = register("name");

  return (
    <TableRow data-testid="studio-row">
      <TableCell className="align-top">
        <form id={formId} onSubmit={handleSubmit(onSubmit)} className="contents" noValidate />
        <Label htmlFor={nameFieldId} className="sr-only">
          Nome
        </Label>
        <Input
          id={nameFieldId}
          form={formId}
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
        <Label htmlFor={rateFieldId} className="sr-only">
          Valor/hora
        </Label>
        <Controller
          name="defaultHourlyRateCents"
          control={control}
          render={({ field }) => (
            <MoneyInput
              id={rateFieldId}
              form={formId}
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
      <TableCell className="text-foreground align-top">
        <span className="text-muted-foreground">{studio.booksCount}</span>
      </TableCell>
      <TableCell className="w-24">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Cancelar"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <X aria-hidden="true" />
          </Button>
          <Button
            type="submit"
            form={formId}
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
