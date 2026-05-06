"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableCell, TableRow } from "@/components/ui/table";
import { type Editor, type EditorFormValues, editorFormSchema } from "@/lib/domain/editor";

import { useCreateEditorForm } from "./hooks/use-create-editor-form";

interface EditorNewRowProps {
  readonly onCreated: (editor: Editor) => void;
  readonly onCancelled: () => void;
}

const FORM_ID = "editor-new-row-form";
const NAME_FIELD_ID = "editor-new-name";
const EMAIL_FIELD_ID = "editor-new-email";

export function EditorNewRow({ onCreated, onCancelled }: EditorNewRowProps) {
  const form = useForm<EditorFormValues>({
    resolver: zodResolver(editorFormSchema),
    defaultValues: { name: "", email: "" },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const { onSubmit, isSubmitting, firstFieldRef } = useCreateEditorForm({ form, onCreated });

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
