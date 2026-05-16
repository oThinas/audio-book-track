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

const NARRATOR_NAMES = new Map([["n-1", "Narrator A"]]);
const EDITOR_NAMES = new Map([["e-1", "Editor A"]]);

function makeChapter(overrides: Partial<ChapterRowEntity> = {}): ChapterRowEntity {
  return {
    id: "c-1",
    title: "Capítulo 1",
    position: 0,
    status: "pending",
    narrator: null,
    editor: null,
    editedSeconds: 0,
    deadline: null,
    ...overrides,
  };
}

function renderEditHook(chapter: ChapterRowEntity) {
  const onCancel = vi.fn();
  const onSaved = vi.fn();
  return {
    onCancel,
    onSaved,
    ...renderHook(() => {
      const form = useForm<ChapterEditDraftValues>({ defaultValues: buildChapterDraft(chapter) });
      const result = useChapterRowEdit({
        chapter,
        narratorNameById: NARRATOR_NAMES,
        editorNameById: EDITOR_NAMES,
        form,
        onCancel,
        onSaved,
      });
      return { form, ...result };
    }),
  };
}

describe("useChapterRowEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("buildChapterDraft maps a chapter to its draft equivalent", () => {
    const chapter = makeChapter({
      narrator: { id: "n-1", name: "N" },
      editor: { id: "e-1", name: "E" },
      editedSeconds: 1200,
      status: "editing",
    });
    expect(buildChapterDraft(chapter)).toEqual({
      title: "Capítulo 1",
      status: "editing",
      narratorId: "n-1",
      editorId: "e-1",
      editedSeconds: 1200,
      deadline: null,
    });
  });

  it("onSubmit envia title quando alterado", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: {
        data: {
          id: "c-1",
          title: "Abertura",
          position: 0,
          status: "pending",
          narratorId: null,
          editorId: null,
          editedSeconds: 0,
          deadline: null,
        },
        meta: { bookStatus: "pending" },
      },
      headers: new Headers(),
    });

    const chapter = makeChapter({ title: "Capítulo 1" });
    const { result, onSaved } = renderEditHook(chapter);

    await act(async () => {
      await result.current.onSubmit({
        title: "Abertura",
        status: chapter.status,
        narratorId: null,
        editorId: null,
        editedSeconds: 0,
        deadline: null,
      });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/chapters/c-1",
      expect.objectContaining({
        method: "PATCH",
        body: { title: "Abertura" },
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ title: "Abertura" }), "pending");
  });

  it("onSubmit aplica trim em title antes de comparar com o atual", async () => {
    const chapter = makeChapter({ title: "Capítulo 1" });
    const { result, onCancel } = renderEditHook(chapter);

    await act(async () => {
      await result.current.onSubmit({
        title: "  Capítulo 1  ",
        status: chapter.status,
        narratorId: null,
        editorId: null,
        editedSeconds: 0,
        deadline: null,
      });
    });

    expect(apiFetch).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it("onSubmit with no diff calls onCancel and skips fetch", async () => {
    const chapter = makeChapter();
    const { result, onCancel } = renderEditHook(chapter);

    await act(async () => {
      await result.current.onSubmit(buildChapterDraft(chapter));
    });

    expect(apiFetch).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it("onSubmit with diff PATCHes only changed fields", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: {
        data: {
          id: "c-1",
          title: "Capítulo 1",
          position: 0,
          status: "editing",
          narratorId: "n-1",
          editorId: null,
          editedSeconds: 0,
          deadline: null,
        },
        meta: { bookStatus: "editing" },
      },
      headers: new Headers(),
    });

    const chapter = makeChapter({ status: "pending" });
    const { result, onSaved } = renderEditHook(chapter);

    await act(async () => {
      await result.current.onSubmit({
        title: "Capítulo 1",
        status: "editing",
        narratorId: "n-1",
        editorId: null,
        editedSeconds: 0,
        deadline: null,
      });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/chapters/c-1",
      expect.objectContaining({
        method: "PATCH",
        body: { status: "editing", narratorId: "n-1" },
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "c-1",
        status: "editing",
        narrator: { id: "n-1", name: "Narrator A" },
        editor: null,
      }),
      "editing",
    );
  });

  it("on paid → completed transition, defers persistence to a reversion request", async () => {
    const chapter = makeChapter({ status: "paid" });
    const { result } = renderEditHook(chapter);

    await act(async () => {
      await result.current.onSubmit({
        title: "Capítulo 1",
        status: "completed",
        narratorId: null,
        editorId: null,
        editedSeconds: 0,
        deadline: null,
      });
    });

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.current.reversionPending).not.toBeNull();
  });

  it("confirmReversion persists the deferred draft with confirmReversion=true", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: {
        data: {
          id: "c-1",
          title: "Capítulo 1",
          position: 0,
          status: "completed",
          narratorId: null,
          editorId: null,
          editedSeconds: 0,
          deadline: null,
        },
        meta: { bookStatus: "completed" },
      },
      headers: new Headers(),
    });

    const chapter = makeChapter({ status: "paid" });
    const { result, onSaved } = renderEditHook(chapter);

    await act(async () => {
      await result.current.onSubmit({
        title: "Capítulo 1",
        status: "completed",
        narratorId: null,
        editorId: null,
        editedSeconds: 0,
        deadline: null,
      });
    });
    await act(async () => {
      await result.current.confirmReversion();
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/chapters/c-1",
      expect.objectContaining({
        method: "PATCH",
        body: { status: "completed", confirmReversion: true },
      }),
    );
    expect(onSaved).toHaveBeenCalled();
    expect(result.current.reversionPending).toBeNull();
  });

  it("cancelReversion clears the pending draft without fetching", async () => {
    const chapter = makeChapter({ status: "paid" });
    const { result } = renderEditHook(chapter);

    await act(async () => {
      await result.current.onSubmit({
        title: "Capítulo 1",
        status: "completed",
        narratorId: null,
        editorId: null,
        editedSeconds: 0,
        deadline: null,
      });
    });
    expect(result.current.reversionPending).not.toBeNull();

    act(() => result.current.cancelReversion());
    expect(result.current.reversionPending).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("on api-error, hook does not call onSaved (toast handled by wrapper)", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "CHAPTER_PAID_LOCKED",
    });

    const chapter = makeChapter();
    const { result, onSaved } = renderEditHook(chapter);
    await act(async () => {
      await result.current.onSubmit({
        title: "Capítulo 1",
        status: "editing",
        narratorId: "n-1",
        editorId: null,
        editedSeconds: 0,
        deadline: null,
      });
    });

    expect(onSaved).not.toHaveBeenCalled();
  });
});
