"use client";

import { Check, Loader2, X } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SecondsInput } from "@/components/ui/seconds-input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ChapterStatus } from "@/lib/domain/chapter";
import { cn } from "@/lib/utils";

import { ChapterDeadlinePicker } from "./chapter-deadline-picker";
import { ChapterPaidReversionDialog } from "./chapter-paid-reversion-dialog";
import type { ChapterRowEntity, ChapterRowOption } from "./chapter-row";
import { ChapterStatusSelect } from "./chapter-status-select";
import {
  buildChapterDraft,
  type ChapterEditDraftValues,
  useChapterRowEdit,
} from "./hooks/use-chapter-row-edit";

const EDITED_SECONDS_MAX = 3_600_000;

interface ChapterRowEditModeProps {
  readonly chapter: ChapterRowEntity;
  readonly narrators: ReadonlyArray<ChapterRowOption>;
  readonly editors: ReadonlyArray<ChapterRowOption>;
  readonly narratorNameById: ReadonlyMap<string, string>;
  readonly editorNameById: ReadonlyMap<string, string>;
  readonly onCancel: () => void;
  readonly onSaved: (updated: ChapterRowEntity, bookStatus: ChapterStatus) => void;
}

export function ChapterRowEditMode({
  chapter,
  narrators,
  editors,
  narratorNameById,
  editorNameById,
  onCancel,
  onSaved,
}: ChapterRowEditModeProps) {
  const formId = `chapter-edit-row-form-${chapter.id}`;
  const form = useForm<ChapterEditDraftValues>({ defaultValues: buildChapterDraft(chapter) });
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  const { nullValue, reversionPending, cancelReversion, confirmReversion, onSubmit } =
    useChapterRowEdit({
      chapter,
      narratorNameById,
      editorNameById,
      form,
      onCancel,
      onSaved,
    });

  return (
    <>
      <TableRow data-testid={`chapter-row-${chapter.id}`} data-mode="edit">
        <TableCell className="font-medium">
          <form id={formId} onSubmit={handleSubmit(onSubmit)} className="contents" noValidate />
          <Controller
            name="title"
            control={control}
            rules={{
              validate: (value) => {
                const trimmed = (value ?? "").trim();
                if (trimmed.length === 0) return "Título é obrigatório.";
                if (trimmed.length > 100) return "Título deve ter no máximo 100 caracteres.";
                if (/[\n\r]/.test(value)) return "Título não pode ter quebras de linha.";
                return true;
              },
            }}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-1">
                <Input
                  form={formId}
                  data-testid={`chapter-title-${chapter.id}`}
                  aria-label={`Título do ${chapter.title}`}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={isSubmitting || chapter.status === "paid"}
                  maxLength={100}
                />
                {fieldState.error?.message && (
                  <span
                    role="alert"
                    className="text-xs text-destructive"
                    data-testid={`chapter-title-error-${chapter.id}`}
                  >
                    {fieldState.error.message}
                  </span>
                )}
              </div>
            )}
          />
        </TableCell>
        <TableCell>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <ChapterStatusSelect
                currentStatus={chapter.status}
                value={field.value}
                onChange={field.onChange}
                id={`chapter-status-${chapter.id}`}
                disabled={isSubmitting}
              />
            )}
          />
        </TableCell>
        <TableCell>
          <Controller
            name="narratorId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? nullValue}
                onValueChange={(value) => field.onChange(value === nullValue ? null : value)}
                disabled={isSubmitting}
              >
                <SelectTrigger data-testid={`chapter-narrator-${chapter.id}`} className="w-full">
                  <span
                    className={cn("truncate", field.value ? undefined : "text-muted-foreground")}
                  >
                    {field.value
                      ? (narratorNameById.get(field.value) ?? "—")
                      : "Selecionar narrador"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={nullValue}>—</SelectItem>
                  {narrators.map((narrator) => (
                    <SelectItem key={narrator.id} value={narrator.id}>
                      {narrator.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </TableCell>
        <TableCell>
          <Controller
            name="editorId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? nullValue}
                onValueChange={(value) => field.onChange(value === nullValue ? null : value)}
                disabled={isSubmitting}
              >
                <SelectTrigger data-testid={`chapter-editor-${chapter.id}`} className="w-full">
                  <span
                    className={cn("truncate", field.value ? undefined : "text-muted-foreground")}
                  >
                    {field.value ? (editorNameById.get(field.value) ?? "—") : "Selecionar editor"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={nullValue}>—</SelectItem>
                  {editors.map((editor) => (
                    <SelectItem key={editor.id} value={editor.id}>
                      {editor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </TableCell>
        <TableCell>
          <Controller
            name="deadline"
            control={control}
            render={({ field }) => (
              <ChapterDeadlinePicker
                id={`chapter-deadline-${chapter.id}`}
                value={field.value}
                onChange={field.onChange}
                disabled={isSubmitting || chapter.status === "paid"}
              />
            )}
          />
        </TableCell>
        <TableCell className="text-right">
          <Controller
            name="editedSeconds"
            control={control}
            render={({ field }) => (
              <SecondsInput
                form={formId}
                data-testid={`chapter-hours-${chapter.id}`}
                aria-label={`Horas editadas do ${chapter.title}`}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                max={EDITED_SECONDS_MAX}
                disabled={isSubmitting}
                className="text-right"
              />
            )}
          />
        </TableCell>
        <TableCell className="text-right">
          <div className="inline-flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Cancelar edição do ${chapter.title}`}
              data-testid={`chapter-cancel-${chapter.id}`}
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
            <Button
              type="submit"
              form={formId}
              variant="ghost"
              size="icon"
              aria-label={`Confirmar edição do ${chapter.title}`}
              data-testid={`chapter-confirm-${chapter.id}`}
              disabled={isSubmitting}
              className="text-primary"
            >
              {isSubmitting ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Check aria-hidden="true" className="size-4" />
              )}
            </Button>
          </div>
        </TableCell>
      </TableRow>
      <ChapterPaidReversionDialog
        open={reversionPending !== null}
        chapterTitle={chapter.title}
        onCancel={cancelReversion}
        onConfirm={confirmReversion}
      />
    </>
  );
}
