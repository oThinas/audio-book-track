"use client";

import type { KeyboardEvent } from "react";
import type { UseFormReturn } from "react-hook-form";
import { apiFetch } from "@/lib/api/api-fetch";
import type { ChapterStatus } from "@/lib/domain/chapter";
import type { ChapterRowEntity, ChapterRowOption } from "../chapter-row";
import { usePaidReversion } from "./use-paid-reversion";

const NULL_VALUE = "__none__";

export interface ChapterEditDraftValues {
  readonly title: string;
  readonly status: ChapterStatus;
  readonly narratorId: string | null;
  readonly editorId: string | null;
  readonly editedSeconds: number;
  readonly deadline: string | null;
}

export interface UseChapterRowEditArgs {
  readonly chapter: ChapterRowEntity;
  readonly narratorNameById: ReadonlyMap<string, string>;
  readonly editorNameById: ReadonlyMap<string, string>;
  readonly form: UseFormReturn<ChapterEditDraftValues>;
  readonly onCancel: () => void;
  readonly onSaved: (updated: ChapterRowEntity, bookStatus: ChapterStatus) => void;
  /**
   * Re-syncs the lifted `chaptersVersion` token from the PATCH response so the
   * next chapter mutation does not raise a spurious version conflict — without
   * depending on the background refresh (which can hang under loading.tsx).
   */
  readonly onVersionChange?: (newVersion: number) => void;
}

export interface UseChapterRowEditReturn {
  readonly nullValue: typeof NULL_VALUE;
  readonly reversionPending: ChapterEditDraftValues | null;
  readonly cancelReversion: () => void;
  readonly confirmReversion: () => Promise<void>;
  readonly onSubmit: (values: ChapterEditDraftValues) => Promise<void>;
  /**
   * Row-level key handler: Enter saves and Escape cancels the inline edit from
   * any control, but only when no Select/Popover/calendar is open (open-aware)
   * and the key did not originate on the action buttons. See FR-001..FR-007 and
   * the edit-row keyboard contract.
   */
  readonly handleRowKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => void;
}

export function buildChapterDraft(chapter: ChapterRowEntity): ChapterEditDraftValues {
  return {
    title: chapter.title,
    status: chapter.status,
    narratorId: chapter.narrator?.id ?? null,
    editorId: chapter.editor?.id ?? null,
    editedSeconds: chapter.editedSeconds,
    deadline: chapter.deadline,
  };
}

function buildPatch(
  values: ChapterEditDraftValues,
  current: ChapterRowEntity,
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};

  const trimmedTitle = values.title.trim();
  if (trimmedTitle !== current.title) patch.title = trimmedTitle;
  if (values.status !== current.status) patch.status = values.status;
  if (values.narratorId !== (current.narrator?.id ?? null)) patch.narratorId = values.narratorId;
  if (values.editorId !== (current.editor?.id ?? null)) patch.editorId = values.editorId;
  if (values.editedSeconds !== current.editedSeconds) patch.editedSeconds = values.editedSeconds;
  if (values.deadline !== current.deadline) patch.deadline = values.deadline;

  if (Object.keys(patch).length === 0) return null;
  return patch;
}

export function useChapterRowEdit({
  chapter,
  narratorNameById,
  editorNameById,
  form,
  onCancel,
  onSaved,
  onVersionChange,
}: UseChapterRowEditArgs): UseChapterRowEditReturn {
  const reversion = usePaidReversion<ChapterEditDraftValues>();

  async function persist(patch: Record<string, unknown>): Promise<void> {
    const result = await apiFetch<{
      data: {
        id: string;
        title: string;
        position: number;
        status: ChapterStatus;
        narratorId: string | null;
        editorId: string | null;
        editedSeconds: number;
        deadline: string | null;
      };
      meta: { bookStatus: ChapterStatus; chaptersVersion: number };
    }>(`/api/v1/chapters/${chapter.id}`, { method: "PATCH", body: patch });

    if (!result.ok) return;
    const { data, meta } = result.data;
    const updated: ChapterRowEntity = {
      id: data.id,
      title: data.title,
      position: data.position,
      status: data.status,
      editedSeconds: data.editedSeconds,
      deadline: data.deadline,
      narrator: data.narratorId
        ? { id: data.narratorId, name: narratorNameById.get(data.narratorId) ?? "—" }
        : null,
      editor: data.editorId
        ? { id: data.editorId, name: editorNameById.get(data.editorId) ?? "—" }
        : null,
    };
    onSaved(updated, meta.bookStatus);
    onVersionChange?.(meta.chaptersVersion);
  }

  async function onSubmit(values: ChapterEditDraftValues): Promise<void> {
    const patch = buildPatch(values, chapter);
    if (!patch) {
      onCancel();
      return;
    }
    if (chapter.status === "paid" && patch.status === "completed") {
      reversion.request(values);
      return;
    }
    await persist(patch);
  }

  async function confirmReversion(): Promise<void> {
    const pending = reversion.take();
    if (!pending) return;
    const patch = buildPatch(pending, chapter);
    if (!patch) {
      onCancel();
      return;
    }
    await persist({ ...patch, confirmReversion: true });
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>): void {
    if (event.key !== "Enter" && event.key !== "Escape") return;

    // React synthetic events bubble through the React tree, not the DOM, so a
    // keydown inside a portaled, open Base UI popup still reaches this row
    // handler. Detect the open popup explicitly and let Base UI act first.
    const el = event.target as HTMLElement;
    const popupOpen =
      el.closest('[aria-expanded="true"]') !== null ||
      el.closest('[data-slot="select-content"], [data-slot="popover-content"]') !== null;
    if (popupOpen) return;

    // Keep native button behavior for the Save (submit) / Cancel buttons.
    if (el.closest("[data-row-actions]")) return;

    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }

    // Enter: programmatic submit from any control, guarded against double submit.
    if (form.formState.isSubmitting) return;
    event.preventDefault();
    void form.handleSubmit(onSubmit)();
  }

  return {
    nullValue: NULL_VALUE,
    reversionPending: reversion.pending,
    cancelReversion: reversion.cancel,
    confirmReversion,
    onSubmit,
    handleRowKeyDown,
  };
}

// Re-export types used by consumers but not directly imported to avoid cycles.
export type { ChapterRowEntity, ChapterRowOption };
