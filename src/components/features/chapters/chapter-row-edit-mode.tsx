"use client";

import { Controller, useForm } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { SecondsInput } from "@/components/ui/seconds-input";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ChapterStatus } from "@/lib/domain/chapter";

import { ChapterAssigneeSelectCell } from "./chapter-assignee-select-cell";
import { ChapterDeadlinePicker } from "./chapter-deadline-picker";
import { ChapterPaidReversionDialog } from "./chapter-paid-reversion-dialog";
import type { ChapterRowEntity, ChapterRowOption } from "./chapter-row";
import { type ChapterEditField, resolveActivation } from "./chapter-row-activation";
import { ChapterRowEditActions } from "./chapter-row-edit-actions";
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
  /** Renders a leading placeholder cell so `table-fixed` columns stay aligned with the view row. */
  readonly canReorder: boolean;
  readonly onCancel: () => void;
  readonly onSaved: (updated: ChapterRowEntity, bookStatus: ChapterStatus) => void;
  readonly onChaptersVersionChange?: (newVersion: number) => void;
  /** Which control to auto-open/focus when entering edit via double-click. */
  readonly activateField: ChapterEditField | null;
}

export function ChapterRowEditMode({
  chapter,
  narrators,
  editors,
  narratorNameById,
  editorNameById,
  canReorder,
  onCancel,
  onSaved,
  onChaptersVersionChange,
  activateField,
}: ChapterRowEditModeProps) {
  const formId = `chapter-edit-row-form-${chapter.id}`;
  const form = useForm<ChapterEditDraftValues>({ defaultValues: buildChapterDraft(chapter) });
  const {
    control,
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = form;

  const {
    nullValue,
    reversionPending,
    cancelReversion,
    confirmReversion,
    onSubmit,
    handleRowKeyDown,
  } = useChapterRowEdit({
    chapter,
    narratorNameById,
    editorNameById,
    form,
    onCancel,
    onSaved,
    onVersionChange: onChaptersVersionChange,
  });

  const activation = resolveActivation(activateField, chapter);

  return (
    <>
      <TableRow
        data-testid={`chapter-row-${chapter.id}`}
        data-mode="edit"
        onKeyDown={handleRowKeyDown}
      >
        {canReorder && <TableCell className="w-8 p-0" aria-hidden="true" />}
        <TableCell className="font-medium">
          <form id={formId} onSubmit={handleSubmit(onSubmit)} className="contents" noValidate />
          <div className="flex flex-col gap-1">
            <Input
              form={formId}
              data-testid={`chapter-title-${chapter.id}`}
              aria-label={`Título do ${chapter.title}`}
              disabled={isSubmitting || chapter.status === "paid"}
              autoFocus={activation.titleAutoFocus}
              maxLength={100}
              {...register("title", {
                validate: (value) => {
                  const trimmed = (value ?? "").trim();
                  if (trimmed.length === 0) return "Título é obrigatório.";
                  if (trimmed.length > 100) return "Título deve ter no máximo 100 caracteres.";
                  if (/[\n\r]/.test(value)) return "Título não pode ter quebras de linha.";
                  return true;
                },
              })}
            />
            {errors.title?.message && (
              <span
                role="alert"
                className="text-xs text-destructive"
                data-testid={`chapter-title-error-${chapter.id}`}
              >
                {errors.title.message}
              </span>
            )}
          </div>
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
                defaultOpen={activation.statusOpen}
              />
            )}
          />
        </TableCell>
        <ChapterAssigneeSelectCell
          control={control}
          name="narratorId"
          options={narrators}
          nameById={narratorNameById}
          nullValue={nullValue}
          disabled={isSubmitting}
          defaultOpen={activation.narratorOpen}
          testId={`chapter-narrator-${chapter.id}`}
          placeholder="Selecionar narrador"
        />
        <ChapterAssigneeSelectCell
          control={control}
          name="editorId"
          options={editors}
          nameById={editorNameById}
          nullValue={nullValue}
          disabled={isSubmitting}
          defaultOpen={activation.editorOpen}
          testId={`chapter-editor-${chapter.id}`}
          placeholder="Selecionar editor"
        />
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
                defaultOpen={activation.deadlineOpen}
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
                autoFocus={activation.editedSecondsAutoFocus}
                className="text-right"
              />
            )}
          />
        </TableCell>
        <ChapterRowEditActions
          chapterId={chapter.id}
          chapterTitle={chapter.title}
          formId={formId}
          isSubmitting={isSubmitting}
          onCancel={onCancel}
        />
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
