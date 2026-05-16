"use client";

import { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";

import { apiFetch } from "@/lib/api/api-fetch";
import type { BookStatus } from "@/lib/domain/book";
import type { ChapterStatus } from "@/lib/domain/chapter";
import { nextChapterTitle } from "@/lib/domain/next-chapter-title";

export type AddChapterPosition = "start" | "end" | { readonly after: string };

export type AddChapterKind = "numbered" | "template" | "custom";

export interface AddChapterFormValues {
  readonly kind: AddChapterKind;
  readonly template: "prologue" | "epilogue" | "presentation";
  readonly title: string;
  readonly positionMode: "start" | "end" | "after";
  readonly afterChapterId: string | null;
}

export interface UseAddChapterArgs {
  readonly bookId: string;
  readonly chaptersVersion: number;
  readonly existingTitles: ReadonlyArray<string>;
  readonly onCreated: (result: {
    readonly chaptersVersion: number;
    readonly bookStatus: BookStatus;
  }) => void;
  readonly onConflict: () => void;
}

interface CreatedChapter {
  readonly id: string;
  readonly title: string;
  readonly position: number;
  readonly status: ChapterStatus;
}

interface CreateResponse {
  readonly data: {
    readonly chapter: CreatedChapter;
    readonly bookStatus: BookStatus;
    readonly chaptersVersion: number;
  };
}

function templateTitle(template: AddChapterFormValues["template"]): string {
  switch (template) {
    case "prologue":
      return "Prólogo";
    case "epilogue":
      return "Epílogo";
    case "presentation":
      return "Apresentação";
  }
}

export function useAddChapter({
  bookId,
  chaptersVersion,
  existingTitles,
  onCreated,
  onConflict,
}: UseAddChapterArgs) {
  const defaultTitle = useMemo(() => nextChapterTitle(existingTitles), [existingTitles]);
  const form = useForm<AddChapterFormValues>({
    defaultValues: {
      kind: "numbered",
      template: "prologue",
      title: defaultTitle,
      positionMode: "end",
      afterChapterId: null,
    },
  });
  const { setValue, watch, handleSubmit, reset, getValues } = form;
  const kind = watch("kind");
  const template = watch("template");
  const lastSyncedKindRef = useRef<{ kind: AddChapterKind; template: string } | null>(null);
  const titlesKey = existingTitles.join("|");

  // Sync the title field only when the user changes kind/template (not on
  // every render). The first render is the user's "selection" — if they pick
  // another option, we re-suggest.
  useEffect(() => {
    const last = lastSyncedKindRef.current;
    if (last && last.kind === kind && last.template === template) {
      return;
    }
    lastSyncedKindRef.current = { kind, template };
    if (kind === "numbered") {
      setValue("title", nextChapterTitle(titlesKey.length === 0 ? [] : titlesKey.split("|")), {
        shouldValidate: false,
      });
    } else if (kind === "template") {
      setValue("title", templateTitle(template), { shouldValidate: false });
    } else if (kind === "custom") {
      const current = getValues("title");
      if (current === nextChapterTitle(titlesKey.length === 0 ? [] : titlesKey.split("|"))) {
        setValue("title", "", { shouldValidate: false });
      }
    }
  }, [kind, template, titlesKey, setValue, getValues]);

  async function onSubmit(values: AddChapterFormValues) {
    const trimmed = values.title.trim();
    if (trimmed.length === 0) {
      form.setError("title", { type: "manual", message: "Título é obrigatório." });
      return;
    }
    if (trimmed.length > 100) {
      form.setError("title", {
        type: "manual",
        message: "Título deve ter no máximo 100 caracteres.",
      });
      return;
    }
    if (/[\n\r]/.test(values.title)) {
      form.setError("title", {
        type: "manual",
        message: "Título não pode ter quebras de linha.",
      });
      return;
    }

    let position: AddChapterPosition;
    if (values.positionMode === "start") {
      position = "start";
    } else if (values.positionMode === "end") {
      position = "end";
    } else {
      if (!values.afterChapterId) {
        form.setError("afterChapterId", {
          type: "manual",
          message: "Escolha o capítulo de referência.",
        });
        return;
      }
      position = { after: values.afterChapterId };
    }

    const result = await apiFetch<CreateResponse>(`/api/v1/books/${bookId}/chapters`, {
      method: "POST",
      body: { title: trimmed, position, expectedVersion: chaptersVersion },
    });

    if (!result.ok) {
      if (result.kind === "api-error" && result.code === "BOOK_CHAPTERS_VERSION_CONFLICT") {
        onConflict();
        reset();
      }
      return;
    }

    onCreated({
      chaptersVersion: result.data.data.chaptersVersion,
      bookStatus: result.data.data.bookStatus,
    });
    reset();
  }

  return {
    form,
    defaultTitle,
    onSubmit: handleSubmit(onSubmit),
    reset,
  };
}
