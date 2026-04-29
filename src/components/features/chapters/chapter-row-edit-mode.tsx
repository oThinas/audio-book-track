"use client";

import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SecondsInput } from "@/components/ui/seconds-input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ChapterStatus } from "@/lib/domain/chapter";
import { cn } from "@/lib/utils";

import { ChapterPaidReversionDialog } from "./chapter-paid-reversion-dialog";
import type { ChapterRowEntity, ChapterRowOption } from "./chapter-row";
import { ChapterStatusSelect } from "./chapter-status-select";

const EDITED_SECONDS_MAX = 3_600_000;
const NULL_VALUE = "__none__";

interface DraftValues {
  readonly status: ChapterStatus;
  readonly narratorId: string | null;
  readonly editorId: string | null;
  readonly editedSeconds: number;
}

function buildDraft(chapter: ChapterRowEntity): DraftValues {
  return {
    status: chapter.status,
    narratorId: chapter.narrator?.id ?? null,
    editorId: chapter.editor?.id ?? null,
    editedSeconds: chapter.editedSeconds,
  };
}

function buildPatch(
  values: DraftValues,
  current: ChapterRowEntity,
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};

  if (values.status !== current.status) {
    patch.status = values.status;
  }
  if (values.narratorId !== (current.narrator?.id ?? null)) {
    patch.narratorId = values.narratorId;
  }
  if (values.editorId !== (current.editor?.id ?? null)) {
    patch.editorId = values.editorId;
  }
  if (values.editedSeconds !== current.editedSeconds) {
    patch.editedSeconds = values.editedSeconds;
  }

  if (Object.keys(patch).length === 0) return null;
  return patch;
}

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
  const [reversionPending, setReversionPending] = useState<DraftValues | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<DraftValues>({ defaultValues: buildDraft(chapter) });

  async function persist(patch: Record<string, unknown>): Promise<void> {
    try {
      const response = await fetch(`/api/v1/chapters/${chapter.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = (await response.json()) as
        | {
            data: {
              id: string;
              number: number;
              status: ChapterStatus;
              narratorId: string | null;
              editorId: string | null;
              editedSeconds: number;
            };
            meta: { bookStatus: ChapterStatus };
          }
        | { error: { code: string; message: string } };

      if (!response.ok) {
        const message = "error" in body ? body.error.message : "Erro ao atualizar capítulo.";
        toast.error(message);
        return;
      }
      if ("data" in body) {
        const data = body.data;
        const updated: ChapterRowEntity = {
          id: data.id,
          number: data.number,
          status: data.status,
          editedSeconds: data.editedSeconds,
          narrator: data.narratorId
            ? { id: data.narratorId, name: narratorNameById.get(data.narratorId) ?? "—" }
            : null,
          editor: data.editorId
            ? { id: data.editorId, name: editorNameById.get(data.editorId) ?? "—" }
            : null,
        };
        onSaved(updated, body.meta.bookStatus);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro de rede ao atualizar capítulo.");
    }
  }

  async function onSubmit(values: DraftValues): Promise<void> {
    const patch = buildPatch(values, chapter);
    if (!patch) {
      onCancel();
      return;
    }
    if (chapter.status === "paid" && patch.status === "completed") {
      setReversionPending(values);
      return;
    }
    await persist(patch);
  }

  async function confirmReversion(): Promise<void> {
    const pending = reversionPending;
    if (!pending) return;
    setReversionPending(null);
    const patch = buildPatch(pending, chapter);
    if (!patch) {
      onCancel();
      return;
    }
    await persist({ ...patch, confirmReversion: true });
  }

  return (
    <>
      <TableRow data-testid={`chapter-row-${chapter.id}`} data-mode="edit">
        <TableCell className="font-medium">
          <form id={formId} onSubmit={handleSubmit(onSubmit)} className="contents" noValidate />
          {chapter.number}
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
                value={field.value ?? NULL_VALUE}
                onValueChange={(value) => field.onChange(value === NULL_VALUE ? null : value)}
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
                  <SelectItem value={NULL_VALUE}>—</SelectItem>
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
                value={field.value ?? NULL_VALUE}
                onValueChange={(value) => field.onChange(value === NULL_VALUE ? null : value)}
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
                  <SelectItem value={NULL_VALUE}>—</SelectItem>
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
        <TableCell className="text-right">
          <Controller
            name="editedSeconds"
            control={control}
            render={({ field }) => (
              <SecondsInput
                form={formId}
                data-testid={`chapter-hours-${chapter.id}`}
                aria-label={`Horas editadas do capítulo ${chapter.number}`}
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
              aria-label={`Cancelar edição do capítulo ${chapter.number}`}
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
              aria-label={`Confirmar edição do capítulo ${chapter.number}`}
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
        chapterNumber={chapter.number}
        onCancel={() => setReversionPending(null)}
        onConfirm={confirmReversion}
      />
    </>
  );
}
