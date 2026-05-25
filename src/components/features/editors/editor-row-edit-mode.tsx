"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableCell, TableRow } from "@/components/ui/table";
import { type Editor, type EditorFormValues, editorFormSchema } from "@/lib/domain/editor";
import type { EditorListItem } from "@/lib/repositories/editor-repository";

import { useUpdateEditorForm } from "./hooks/use-update-editor-form";

interface EditorRowEditModeProps {
  readonly editor: EditorListItem;
  readonly onCancel: () => void;
  readonly onUpdated: (editor: Editor) => void;
}

export function EditorRowEditMode({ editor, onCancel, onUpdated }: EditorRowEditModeProps) {
  const formId = `editor-edit-row-form-${editor.id}`;
  const nameFieldId = `editor-edit-name-${editor.id}`;
  const emailFieldId = `editor-edit-email-${editor.id}`;

  const form = useForm<EditorFormValues>({
    resolver: zodResolver(editorFormSchema),
    defaultValues: { name: editor.name, email: editor.email },
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const { onSubmit, firstFieldRef } = useUpdateEditorForm({
    editorId: editor.id,
    form,
    onUpdated,
    onNotFound: onCancel,
  });

  const { ref: nameRefCallback, ...nameRegister } = register("name");

  return (
    <TableRow data-testid="editor-row">
      <TableCell className="align-top">
        <form id={formId} onSubmit={handleSubmit(onSubmit)} className="contents" noValidate />
        <Label htmlFor={nameFieldId} className="sr-only">
          Nome
        </Label>
        <Input
          id={nameFieldId}
          form={formId}
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
        <Label htmlFor={emailFieldId} className="sr-only">
          E-mail
        </Label>
        <Input
          id={emailFieldId}
          form={formId}
          type="email"
          placeholder="email@studio.com"
          aria-invalid={errors.email ? true : undefined}
          disabled={isSubmitting}
          {...register("email")}
        />
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
      </TableCell>
      <TableCell className="text-foreground">
        <span className="text-muted-foreground">{editor.chaptersCount}</span>
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
