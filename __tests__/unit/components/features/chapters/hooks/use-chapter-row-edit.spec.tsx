// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChapterRowEntity } from "@/components/features/chapters/chapter-row";
import {
  buildChapterDraft,
  type ChapterEditDraftValues,
  useChapterRowEdit,
} from "@/components/features/chapters/hooks/use-chapter-row-edit";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

const CHAPTER: ChapterRowEntity = {
  id: "c-1",
  title: "Capítulo 1",
  position: 0,
  status: "editing",
  narrator: null,
  editor: null,
  editedSeconds: 0,
  deadline: null,
};

function setup() {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  const onVersionChange = vi.fn();
  const { result } = renderHook(() => {
    const form = useForm<ChapterEditDraftValues>({ defaultValues: buildChapterDraft(CHAPTER) });
    return useChapterRowEdit({
      chapter: CHAPTER,
      narratorNameById: new Map(),
      editorNameById: new Map(),
      form,
      onCancel,
      onSaved,
      onVersionChange,
    });
  });
  return { result, onSaved, onVersionChange };
}

describe("useChapterRowEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads meta.chaptersVersion and calls onSaved + onVersionChange", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: {
        data: {
          id: "c-1",
          title: "Novo título",
          position: 0,
          status: "editing",
          narratorId: null,
          editorId: null,
          editedSeconds: 0,
          deadline: null,
        },
        meta: { bookStatus: "editing", chaptersVersion: 7 },
      },
      headers: new Headers(),
    });

    const { result, onSaved, onVersionChange } = setup();
    await act(async () => {
      await result.current.onSubmit({ ...buildChapterDraft(CHAPTER), title: "Novo título" });
    });

    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c-1", title: "Novo título" }),
      "editing",
    );
    expect(onVersionChange).toHaveBeenCalledWith(7);
  });
});
