"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/features/books/status-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ChapterStatus } from "@/lib/domain/chapter";
import { formatSecondsAsHours, parseHoursInputToSeconds } from "@/lib/utils";

import { ChapterPaidReversionDialog } from "./chapter-paid-reversion-dialog";
import { ChapterStatusSelect } from "./chapter-status-select";

export interface ChapterRowEntity {
  readonly id: string;
  readonly number: number;
  readonly status: ChapterStatus;
  readonly narrator: { readonly id: string; readonly name: string } | null;
  readonly editor: { readonly id: string; readonly name: string } | null;
  readonly editedSeconds: number;
}

export interface ChapterRowOption {
  readonly id: string;
  readonly name: string;
}

interface ChapterRowProps {
  readonly chapter: ChapterRowEntity;
  readonly narrators: ReadonlyArray<ChapterRowOption>;
  readonly editors: ReadonlyArray<ChapterRowOption>;
  readonly onSaved: (updated: ChapterRowEntity, bookStatus: ChapterStatus) => void;
}

const NULL_VALUE = "__none__";

interface DraftState {
  readonly status: ChapterStatus;
  readonly narratorId: string | null;
  readonly editorId: string | null;
  readonly editedHours: string;
}

function buildDraft(chapter: ChapterRowEntity): DraftState {
  return {
    status: chapter.status,
    narratorId: chapter.narrator?.id ?? null,
    editorId: chapter.editor?.id ?? null,
    editedHours: formatSecondsAsHours(chapter.editedSeconds, {
      minDigits: 0,
      maxDigits: 4,
      emptyForZero: true,
    }),
  };
}

function buildPatch(draft: DraftState, current: ChapterRowEntity): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};

  if (draft.status !== current.status) {
    patch.status = draft.status;
  }
  if (draft.narratorId !== (current.narrator?.id ?? null)) {
    patch.narratorId = draft.narratorId;
  }
  if (draft.editorId !== (current.editor?.id ?? null)) {
    patch.editorId = draft.editorId;
  }
  const seconds = parseHoursInputToSeconds(draft.editedHours);
  if (seconds === null) return null;
  if (seconds !== current.editedSeconds) {
    patch.editedSeconds = seconds;
  }

  if (Object.keys(patch).length === 0) return null;
  return patch;
}

export function ChapterRow({ chapter, narrators, editors, onSaved }: ChapterRowProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [submitting, setSubmitting] = useState(false);
  const [reversionPending, setReversionPending] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<DraftState>(() => buildDraft(chapter));

  function enterEdit() {
    setDraft(buildDraft(chapter));
    setMode("edit");
  }

  function cancelEdit() {
    setMode("view");
  }

  async function submitPatch(payload: Record<string, unknown>) {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/chapters/${chapter.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
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
            ? (narrators.find((n) => n.id === data.narratorId) ??
              chapter.narrator ?? { id: data.narratorId, name: "—" })
            : null,
          editor: data.editorId
            ? (editors.find((e) => e.id === data.editorId) ??
              chapter.editor ?? { id: data.editorId, name: "—" })
            : null,
        };
        onSaved(updated, body.meta.bookStatus);
        setMode("view");
        toast.success(`Capítulo ${chapter.number} atualizado.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro de rede ao atualizar capítulo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    const patch = buildPatch(draft, chapter);
    if (!patch) {
      toast.message("Nenhuma alteração para salvar.");
      setMode("view");
      return;
    }

    if (chapter.status === "paid" && patch.status === "completed") {
      setReversionPending(patch);
      return;
    }
    await submitPatch(patch);
  }

  if (mode === "edit") {
    return (
      <>
        <TableRow data-testid={`chapter-row-${chapter.id}`} data-mode="edit">
          <TableCell className="font-medium">{chapter.number}</TableCell>
          <TableCell>
            <ChapterStatusSelect
              currentStatus={chapter.status}
              value={draft.status}
              onChange={(status) => setDraft((prev) => ({ ...prev, status }))}
              id={`chapter-status-${chapter.id}`}
            />
          </TableCell>
          <TableCell>
            <Select
              value={draft.narratorId ?? NULL_VALUE}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  narratorId: value === NULL_VALUE ? null : value,
                }))
              }
            >
              <SelectTrigger data-testid={`chapter-narrator-${chapter.id}`} className="w-full">
                <span className={draft.narratorId ? undefined : "text-muted-foreground"}>
                  {draft.narratorId
                    ? (narrators.find((n) => n.id === draft.narratorId)?.name ?? "—")
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
          </TableCell>
          <TableCell>
            <Select
              value={draft.editorId ?? NULL_VALUE}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  editorId: value === NULL_VALUE ? null : value,
                }))
              }
            >
              <SelectTrigger data-testid={`chapter-editor-${chapter.id}`} className="w-full">
                <span className={draft.editorId ? undefined : "text-muted-foreground"}>
                  {draft.editorId
                    ? (editors.find((e) => e.id === draft.editorId)?.name ?? "—")
                    : "Selecionar editor"}
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
          </TableCell>
          <TableCell className="text-right">
            <input
              type="text"
              inputMode="decimal"
              data-testid={`chapter-hours-${chapter.id}`}
              aria-label={`Horas editadas do capítulo ${chapter.number}`}
              value={draft.editedHours}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, editedHours: event.target.value }))
              }
              className="ml-auto block w-24 rounded-md border bg-background px-2 py-1 text-right text-sm tabular-nums"
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
                onClick={cancelEdit}
                disabled={submitting}
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Confirmar edição do capítulo ${chapter.number}`}
                data-testid={`chapter-confirm-${chapter.id}`}
                onClick={handleConfirm}
                disabled={submitting}
              >
                <Check aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        <ChapterPaidReversionDialog
          open={reversionPending !== null}
          chapterNumber={chapter.number}
          onCancel={() => setReversionPending(null)}
          onConfirm={async () => {
            const patch = reversionPending;
            setReversionPending(null);
            if (patch) {
              await submitPatch({ ...patch, confirmReversion: true });
            }
          }}
        />
      </>
    );
  }

  return (
    <TableRow data-testid={`chapter-row-${chapter.id}`} data-mode="view">
      <TableCell className="font-medium">{chapter.number}</TableCell>
      <TableCell>
        <StatusBadge status={chapter.status} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {chapter.narrator ? chapter.narrator.name : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {chapter.editor ? chapter.editor.name : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatSecondsAsHours(chapter.editedSeconds)}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Editar capítulo ${chapter.number}`}
            data-testid={`chapter-edit-${chapter.id}`}
            onClick={enterEdit}
          >
            <Pencil aria-hidden="true" className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Excluir capítulo ${chapter.number}`}
            data-testid={`chapter-delete-${chapter.id}`}
            disabled
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
