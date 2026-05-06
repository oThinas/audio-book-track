"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableCell, TableRow } from "@/components/ui/table";
import { type Narrator, type NarratorFormValues, narratorFormSchema } from "@/lib/domain/narrator";
import type { NarratorListItem } from "@/lib/repositories/narrator-repository";

import { useUpdateNarratorForm } from "./hooks/use-update-narrator-form";

interface NarratorRowEditModeProps {
  readonly narrator: NarratorListItem;
  readonly onCancel: () => void;
  readonly onUpdated: (narrator: Narrator) => void;
}

export function NarratorRowEditMode({ narrator, onCancel, onUpdated }: NarratorRowEditModeProps) {
  const formId = `narrator-edit-row-form-${narrator.id}`;
  const nameFieldId = `narrator-edit-name-${narrator.id}`;

  const form = useForm<NarratorFormValues>({
    resolver: zodResolver(narratorFormSchema),
    defaultValues: { name: narrator.name },
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const { onSubmit, firstFieldRef } = useUpdateNarratorForm({
    narratorId: narrator.id,
    form,
    onUpdated,
    onNotFound: onCancel,
  });

  const { ref: nameRefCallback, ...nameRegister } = register("name");

  return (
    <TableRow data-testid="narrator-row">
      <TableCell className="align-top">
        <form id={formId} onSubmit={handleSubmit(onSubmit)} className="contents" noValidate />
        <Label htmlFor={nameFieldId} className="sr-only">
          Nome
        </Label>
        <Input
          id={nameFieldId}
          form={formId}
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
      <TableCell className="text-foreground align-top">
        <span className="text-muted-foreground">{narrator.chaptersCount}</span>
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
