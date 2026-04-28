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
import { type Editor, type EditorFormValues, editorFormSchema } from "@/lib/domain/editor";
import type { EditorListItem } from "@/lib/repositories/editor-repository";

interface EditorRowProps {
  readonly editor: EditorListItem;
  readonly onUpdated?: (editor: Editor) => void;
  readonly onRequestDelete?: (editor: Editor) => void;
}

export function EditorRow({ editor, onUpdated, onRequestDelete }: EditorRowProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <EditorRowEditMode
        editor={editor}
        onCancel={() => setIsEditing(false)}
        onUpdated={(updated) => {
          onUpdated?.(updated);
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <TableRow data-testid="editor-row">
      <TableCell data-testid="editor-name" className="text-foreground">
        {editor.name}
      </TableCell>
      <TableCell
        data-testid="editor-email"
        className="text-muted-foreground truncate"
        title={editor.email}
      >
        {editor.email}
      </TableCell>
      <TableCell data-testid="editor-chapters-count" className="text-foreground">
        {editor.chaptersCount}
      </TableCell>
      <TableCell className="w-24">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${editor.name}`}
            onClick={() => setIsEditing(true)}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Excluir ${editor.name}`}
            disabled={!onRequestDelete}
            onClick={() => onRequestDelete?.(editor)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface EditorRowEditModeProps {
  readonly editor: EditorListItem;
  readonly onCancel: () => void;
  readonly onUpdated: (editor: Editor) => void;
}

function EditorRowEditMode({ editor, onCancel, onUpdated }: EditorRowEditModeProps) {
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const formId = `editor-edit-row-form-${editor.id}`;
  const nameFieldId = `editor-edit-name-${editor.id}`;
  const emailFieldId = `editor-edit-email-${editor.id}`;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<EditorFormValues>({
    resolver: zodResolver(editorFormSchema),
    defaultValues: { name: editor.name, email: editor.email },
  });

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  async function onSubmit(values: EditorFormValues) {
    const response = await fetch(`/api/v1/editors/${editor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.status === 200) {
      const body = (await response.json()) as { data: Editor };
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
      const body = (await response.json()) as ApiErrorBody;
      if (body.error.code === "NAME_ALREADY_IN_USE") {
        setError("name", { message: "Nome já cadastrado" });
      } else if (body.error.code === "EMAIL_ALREADY_IN_USE") {
        setError("email", { message: "E-mail já cadastrado" });
      }
      return;
    }

    if (response.status === 404) {
      toast.error("Editor não existe mais.");
      onCancel();
      return;
    }

    toast.error("Não foi possível atualizar o editor. Tente novamente.");
  }

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
      <TableCell className="text-foreground align-top">
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
