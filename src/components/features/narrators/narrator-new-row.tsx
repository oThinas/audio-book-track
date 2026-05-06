"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableCell, TableRow } from "@/components/ui/table";
import { type Narrator, type NarratorFormValues, narratorFormSchema } from "@/lib/domain/narrator";

import { useCreateNarratorForm } from "./hooks/use-create-narrator-form";

interface NarratorNewRowProps {
  readonly onCreated: (narrator: Narrator) => void;
  readonly onCancelled: () => void;
}

export function NarratorNewRow({ onCreated, onCancelled }: NarratorNewRowProps) {
  const form = useForm<NarratorFormValues>({
    resolver: zodResolver(narratorFormSchema),
    defaultValues: { name: "" },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const { onSubmit, isSubmitting, firstFieldRef } = useCreateNarratorForm({ form, onCreated });

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
