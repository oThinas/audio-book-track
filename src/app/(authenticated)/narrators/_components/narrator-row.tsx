"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ApiErrorBody } from "@/lib/api/error-response";
import { type Narrator, type NarratorFormValues, narratorFormSchema } from "@/lib/domain/narrator";

interface NarratorRowProps {
  readonly narrator: Narrator;
  readonly onUpdated?: (narrator: Narrator) => void;
  readonly onRequestDelete?: (narrator: Narrator) => void;
}

export function NarratorRow({ narrator, onUpdated, onRequestDelete }: NarratorRowProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <NarratorRowEditMode
        narrator={narrator}
        onCancel={() => setIsEditing(false)}
        onUpdated={(updated) => {
          onUpdated?.(updated);
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <TableRow data-testid="narrator-row">
      <TableCell data-testid="narrator-name" className="text-foreground">
        {narrator.name}
      </TableCell>
      <TableCell data-testid="narrator-email" className="text-muted-foreground">
        {narrator.email}
      </TableCell>
      <TableCell className="w-24">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${narrator.name}`}
            onClick={() => setIsEditing(true)}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Excluir ${narrator.name}`}
            disabled={!onRequestDelete}
            onClick={() => onRequestDelete?.(narrator)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface NarratorRowEditModeProps {
  readonly narrator: Narrator;
  readonly onCancel: () => void;
  readonly onUpdated: (narrator: Narrator) => void;
}

function NarratorRowEditMode({ narrator, onCancel, onUpdated }: NarratorRowEditModeProps) {
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const formId = `narrator-edit-row-form-${narrator.id}`;
  const nameFieldId = `narrator-edit-name-${narrator.id}`;
  const emailFieldId = `narrator-edit-email-${narrator.id}`;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<NarratorFormValues>({
    resolver: zodResolver(narratorFormSchema),
    defaultValues: { name: narrator.name, email: narrator.email },
  });

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  async function onSubmit(values: NarratorFormValues) {
    const response = await fetch(`/api/v1/narrators/${narrator.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.status === 200) {
      const body = (await response.json()) as { data: Narrator };
      onUpdated(body.data);
      return;
    }

    if (response.status === 422) {
      const body = (await response.json()) as ApiErrorBody;
      for (const detail of body.error.details ?? []) {
        if (detail.field === "name" || detail.field === "email") {
          setError(detail.field, { message: detail.message });
        }
      }
      return;
    }

    if (response.status === 409) {
      setError("email", { message: "E-mail já cadastrado" });
      return;
    }

    if (response.status === 404) {
      toast.error("Narrador não existe mais.");
      onCancel();
      return;
    }

    toast.error("Não foi possível atualizar o narrador. Tente novamente.");
  }

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
      <TableCell className="align-top">
        <Label htmlFor={emailFieldId} className="sr-only">
          E-mail
        </Label>
        <Input
          id={emailFieldId}
          form={formId}
          type="email"
          placeholder="email@exemplo.com"
          aria-invalid={errors.email ? true : undefined}
          disabled={isSubmitting}
          {...register("email")}
        />
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
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
