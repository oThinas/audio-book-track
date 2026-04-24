"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ApiErrorBody } from "@/lib/api/error-response";
import {
  centsToReais,
  reaisToCents,
  type Studio,
  type StudioFormValues,
  studioFormSchema,
} from "@/lib/domain/studio";
import { formatBRL } from "@/lib/utils";

interface StudioRowProps {
  readonly studio: Studio;
  readonly onUpdated?: (studio: Studio) => void;
  readonly onRequestDelete?: (studio: Studio) => void;
}

export function StudioRow({ studio, onUpdated, onRequestDelete }: StudioRowProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <StudioRowEditMode
        studio={studio}
        onCancel={() => setIsEditing(false)}
        onUpdated={(updated) => {
          onUpdated?.(updated);
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <TableRow data-testid="studio-row">
      <TableCell data-testid="studio-name" className="text-foreground">
        {studio.name}
      </TableCell>
      <TableCell data-testid="studio-hourly-rate" className="text-foreground">
        {formatBRL(centsToReais(studio.defaultHourlyRateCents))}
      </TableCell>
      <TableCell className="w-24">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${studio.name}`}
            onClick={() => setIsEditing(true)}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Excluir ${studio.name}`}
            disabled={!onRequestDelete}
            onClick={() => onRequestDelete?.(studio)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface StudioRowEditModeProps {
  readonly studio: Studio;
  readonly onCancel: () => void;
  readonly onUpdated: (studio: Studio) => void;
}

function StudioRowEditMode({ studio, onCancel, onUpdated }: StudioRowEditModeProps) {
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const formId = `studio-edit-row-form-${studio.id}`;
  const nameFieldId = `studio-edit-name-${studio.id}`;
  const rateFieldId = `studio-edit-default-hourly-rate-${studio.id}`;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<StudioFormValues>({
    resolver: zodResolver(studioFormSchema),
    defaultValues: {
      name: studio.name,
      defaultHourlyRateReais: centsToReais(studio.defaultHourlyRateCents),
    },
  });

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  async function onSubmit(values: StudioFormValues) {
    const payload = {
      name: values.name,
      defaultHourlyRateCents: reaisToCents(values.defaultHourlyRateReais),
    };
    const response = await fetch(`/api/v1/studios/${studio.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 200) {
      const body = (await response.json()) as { data: Studio };
      onUpdated(body.data);
      return;
    }

    if (response.status === 422) {
      const body = (await response.json()) as ApiErrorBody;
      for (const detail of body.error.details ?? []) {
        if (detail.field === "name") {
          setError("name", { message: detail.message });
        } else if (detail.field === "defaultHourlyRateCents") {
          setError("defaultHourlyRateReais", { message: detail.message });
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

    if (response.status === 404) {
      toast.error("Estúdio não existe mais.");
      onCancel();
      return;
    }

    toast.error("Não foi possível atualizar o estúdio. Tente novamente.");
  }

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
          name="defaultHourlyRateReais"
          control={control}
          render={({ field }) => (
            <MoneyInput
              id={rateFieldId}
              form={formId}
              min={0.01}
              max={9999.99}
              value={field.value ?? 0}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={errors.defaultHourlyRateReais ? true : undefined}
              disabled={isSubmitting}
            />
          )}
        />
        {errors.defaultHourlyRateReais && (
          <p className="mt-1 text-xs text-destructive">{errors.defaultHourlyRateReais.message}</p>
        )}
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
