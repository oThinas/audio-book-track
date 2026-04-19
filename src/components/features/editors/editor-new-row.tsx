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
import { type Editor, type EditorFormValues, editorFormSchema } from "@/lib/domain/editor";

interface EditorNewRowProps {
  readonly onCreated: (editor: Editor) => void;
  readonly onCancelled: () => void;
}

const FORM_ID = "editor-new-row-form";
const NAME_FIELD_ID = "editor-new-name";
const EMAIL_FIELD_ID = "editor-new-email";

export function EditorNewRow({ onCreated, onCancelled }: EditorNewRowProps) {
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<EditorFormValues>({
    resolver: zodResolver(editorFormSchema),
    defaultValues: { name: "", email: "" },
  });

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  async function onSubmit(values: EditorFormValues) {
    const response = await fetch("/api/v1/editors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.status === 201) {
      const body = (await response.json()) as { data: Editor };
      onCreated(body.data);
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
      const body = (await response.json()) as ApiErrorBody;
      if (body.error.code === "NAME_ALREADY_IN_USE") {
        setError("name", { message: "Nome já cadastrado" });
      } else if (body.error.code === "EMAIL_ALREADY_IN_USE") {
        setError("email", { message: "E-mail já cadastrado" });
      }
      return;
    }

    toast.error("Não foi possível salvar o editor. Tente novamente.");
  }

  const { ref: nameRefCallback, ...nameRegister } = register("name");

  return (
    <TableRow data-testid="editor-new-row">
      <TableCell className="align-top">
        <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="contents" noValidate />
        <Label htmlFor={NAME_FIELD_ID} className="sr-only">
          Nome
        </Label>
        <Input
          id={NAME_FIELD_ID}
          form={FORM_ID}
          placeholder="Nome do editor"
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
        <Label htmlFor={EMAIL_FIELD_ID} className="sr-only">
          E-mail
        </Label>
        <Input
          id={EMAIL_FIELD_ID}
          form={FORM_ID}
          type="email"
          placeholder="email@studio.com"
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
